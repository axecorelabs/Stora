import { supabaseAdmin } from '@/lib/supabase';
import { normalizeWebsiteConfig } from '@/lib/listingSubscription';

const DEFAULT_GRACE_DAYS = 7;
const DEFAULT_ENFORCEMENT_START = '2026-09-30T00:00:00Z';

export function getFullStoreEnforcementStartMs() {
  const configured = process.env.FULL_STORE_SUBSCRIPTION_ENFORCEMENT_START || DEFAULT_ENFORCEMENT_START;
  const parsed = new Date(configured).getTime();
  if (!Number.isFinite(parsed)) {
    return new Date(DEFAULT_ENFORCEMENT_START).getTime();
  }
  return parsed;
}

export function getFullStoreGraceDays() {
  const raw = Number(process.env.FULL_STORE_SUBSCRIPTION_GRACE_DAYS ?? DEFAULT_GRACE_DAYS);
  if (!Number.isFinite(raw)) return DEFAULT_GRACE_DAYS;
  return Math.min(Math.max(Math.round(raw), 3), 7);
}

function computeGraceEndsAtIso(now = Date.now()) {
  const graceDays = getFullStoreGraceDays();
  const ms = graceDays * 24 * 60 * 60 * 1000;
  return new Date(now + ms).toISOString();
}

export function evaluateFullStoreCommerceAccess(store, nowMs = Date.now()) {
  if (!store || store.platform_mode !== 'store') {
    return { allowed: true, restrictedReason: null, graceEndsAt: null, graceActive: false };
  }

  const enforcementStartMs = getFullStoreEnforcementStartMs();
  if (nowMs < enforcementStartMs) {
    return {
      allowed: true,
      restrictedReason: null,
      graceEndsAt: null,
      graceActive: false,
      enforcementDeferredUntil: new Date(enforcementStartMs).toISOString()
    };
  }

  const status = store.full_store_subscription_status || 'none';
  const graceEndsAt = store.full_store_subscription_grace_ends_at || null;
  const lockedAt = store.full_store_subscription_locked_at || null;

  if (status === 'active') {
    return { allowed: true, restrictedReason: null, graceEndsAt, graceActive: false };
  }

  if (status === 'past_due') {
    if (!graceEndsAt) {
      return { allowed: true, restrictedReason: null, graceEndsAt: null, graceActive: true };
    }

    const graceExpiryMs = new Date(graceEndsAt).getTime();
    const graceActive = Number.isFinite(graceExpiryMs) && graceExpiryMs > nowMs;
    if (graceActive) {
      return { allowed: true, restrictedReason: null, graceEndsAt, graceActive: true };
    }

    return {
      allowed: false,
      restrictedReason: lockedAt ? 'subscription_locked' : 'grace_expired',
      graceEndsAt,
      graceActive: false
    };
  }

  if (status === 'cancelled') {
    return { allowed: false, restrictedReason: 'subscription_cancelled', graceEndsAt, graceActive: false };
  }

  // Treat 'none' as allowed during rollout; can be tightened later.
  return { allowed: true, restrictedReason: null, graceEndsAt, graceActive: false };
}

async function setStorefrontEnabled(storeId, enabled) {
  const { data: store } = await supabaseAdmin
    .from('stores')
    .select('website')
    .eq('id', storeId)
    .eq('platform_mode', 'store')
    .maybeSingle();

  if (!store) return;

  const nextWebsite = {
    ...normalizeWebsiteConfig(store.website),
    isEnabled: !!enabled
  };

  await supabaseAdmin
    .from('stores')
    .update({
      website: nextWebsite,
      updated_at: new Date().toISOString()
    })
    .eq('id', storeId)
    .eq('platform_mode', 'store');
}

export async function enforceFullStoreLockIfNeeded(store) {
  const access = evaluateFullStoreCommerceAccess(store);
  if (access.allowed) return { ...access, newlyLocked: false };

  const nowIso = new Date().toISOString();

  const { data: lockResult } = await supabaseAdmin
    .from('stores')
    .update({ full_store_subscription_locked_at: nowIso })
    .eq('id', store.id)
    .eq('platform_mode', 'store')
    .is('full_store_subscription_locked_at', null)
    .select('id')
    .maybeSingle();

  await setStorefrontEnabled(store.id, false);

  return { ...access, newlyLocked: !!lockResult?.id };
}

export async function upsertFullStoreSubscription({
  storeId,
  ownerId,
  status,
  providerCustomerCode = null,
  providerSubscriptionCode = null,
  providerPlanCode = null,
  currentPeriodStart = null,
  currentPeriodEnd = null,
  nextPaymentDate = null,
  cancelledAt = null,
  metadata = null
}) {
  const payload = {
    store_id: storeId,
    owner_id: ownerId,
    provider: 'paystack',
    provider_customer_code: providerCustomerCode,
    provider_subscription_code: providerSubscriptionCode,
    provider_plan_code: providerPlanCode,
    status,
    current_period_start: currentPeriodStart,
    current_period_end: currentPeriodEnd,
    next_payment_date: nextPaymentDate,
    cancelled_at: cancelledAt,
    metadata,
    updated_at: new Date().toISOString()
  };

  await supabaseAdmin
    .from('full_store_subscriptions')
    .upsert(payload, { onConflict: 'store_id' });
}

export async function upsertFullStoreSubscriptionTransaction({
  storeId,
  ownerId,
  reference,
  status,
  amountKobo = null,
  currency = null,
  authorizationUrl = null,
  providerTransactionId = null,
  providerSubscriptionCode = null,
  providerCustomerCode = null,
  providerPlanCode = null,
  paidAt = null,
  verificationPayload = null
}) {
  if (!reference) return;

  const payload = {
    store_id: storeId,
    owner_id: ownerId,
    provider: 'paystack',
    provider_reference: reference,
    provider_transaction_id: providerTransactionId,
    provider_subscription_code: providerSubscriptionCode,
    provider_customer_code: providerCustomerCode,
    provider_plan_code: providerPlanCode,
    amount_kobo: amountKobo,
    currency,
    status,
    paid_at: paidAt,
    authorization_url: authorizationUrl,
    verification_payload: verificationPayload,
    updated_at: new Date().toISOString()
  };

  await supabaseAdmin
    .from('full_store_subscription_transactions')
    .upsert(payload, { onConflict: 'provider,provider_reference' });
}

export async function findFullStoreByTransactionReference(reference) {
  if (!reference) return null;

  const { data: tx } = await supabaseAdmin
    .from('full_store_subscription_transactions')
    .select('store_id, owner_id')
    .eq('provider', 'paystack')
    .eq('provider_reference', reference)
    .maybeSingle();

  if (!tx) return null;
  return { storeId: tx.store_id, ownerId: tx.owner_id };
}

export async function getLatestPendingFullStoreTransactionReference(storeId) {
  const { data: tx } = await supabaseAdmin
    .from('full_store_subscription_transactions')
    .select('provider_reference, status')
    .eq('provider', 'paystack')
    .eq('store_id', storeId)
    .in('status', ['initialized', 'pending'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return tx?.provider_reference || null;
}

export async function applyFullStoreActiveState({
  storeId,
  ownerId,
  subscriptionCode = null,
  nextPaymentDate = null,
  customerCode = null,
  planCode = null,
  paidAt = null,
  raw = null
}) {
  await supabaseAdmin
    .from('stores')
    .update({
      full_store_subscription_status: 'active',
      full_store_subscription_paystack_code: subscriptionCode,
      full_store_subscription_next_payment_date: nextPaymentDate,
      full_store_subscription_grace_ends_at: null,
      full_store_subscription_locked_at: null
    })
    .eq('id', storeId)
    .eq('platform_mode', 'store');

  await setStorefrontEnabled(storeId, true);

  await upsertFullStoreSubscription({
    storeId,
    ownerId,
    status: 'active',
    providerCustomerCode: customerCode,
    providerSubscriptionCode: subscriptionCode,
    providerPlanCode: planCode,
    nextPaymentDate,
    metadata: raw
  });

  if (raw?.reference) {
    await upsertFullStoreSubscriptionTransaction({
      storeId,
      ownerId,
      reference: raw.reference,
      status: 'success',
      amountKobo: raw.amount ?? null,
      currency: raw.currency ?? null,
      providerTransactionId: raw.id ? String(raw.id) : null,
      providerSubscriptionCode: subscriptionCode,
      providerCustomerCode: customerCode,
      providerPlanCode: planCode,
      paidAt,
      verificationPayload: raw
    });
  }
}

export async function applyFullStoreInactiveState({
  storeId,
  ownerId,
  status,
  subscriptionCode = null,
  cancelledAt = null,
  raw = null
}) {
  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const graceEndsAt = status === 'past_due' ? computeGraceEndsAtIso(now) : null;
  const lockedAt = status === 'cancelled' ? nowIso : null;

  await supabaseAdmin
    .from('stores')
    .update({
      full_store_subscription_status: status,
      full_store_subscription_grace_ends_at: graceEndsAt,
      full_store_subscription_locked_at: lockedAt
    })
    .eq('id', storeId)
    .eq('platform_mode', 'store');

  if (status === 'cancelled') {
    await setStorefrontEnabled(storeId, false);
  }

  await upsertFullStoreSubscription({
    storeId,
    ownerId,
    status,
    providerSubscriptionCode: subscriptionCode,
    cancelledAt,
    metadata: raw
  });
}

export async function resolveFullStoreByOwner(ownerId) {
  const { data: store } = await supabaseAdmin
    .from('stores')
    .select('id, owner_id, platform_mode, full_store_subscription_status, full_store_subscription_paystack_code, full_store_subscription_grace_ends_at, full_store_subscription_locked_at')
    .eq('owner_id', ownerId)
    .eq('platform_mode', 'store')
    .maybeSingle();

  return store || null;
}

// Compatibility alias: requested naming in rollout checklist.
export const resolveFullStoreStoreByOwner = resolveFullStoreByOwner;

// Compatibility alias: requested naming in rollout checklist.
export const upsertFullStoreTransaction = upsertFullStoreSubscriptionTransaction;

export async function resolveFullStoreByCustomerEmail(email) {
  if (!email) return null;

  const { data: user } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('email', email)
    .eq('is_active', true)
    .maybeSingle();

  if (!user?.id) return null;

  return resolveFullStoreByOwner(user.id);
}
