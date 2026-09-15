import { supabaseAdmin } from '@/lib/supabase';

export function normalizeWebsiteConfig(rawWebsite) {
  if (!rawWebsite) return {};
  if (typeof rawWebsite === 'string') {
    try {
      return JSON.parse(rawWebsite);
    } catch {
      return {};
    }
  }
  return rawWebsite;
}

export async function setListingWebsiteEnabled(storeId, enabled) {
  const { data: store } = await supabaseAdmin
    .from('stores')
    .select('website')
    .eq('id', storeId)
    .eq('platform_mode', 'listing')
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
    .eq('platform_mode', 'listing');
}

export async function upsertListingSubscription({
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
    .from('listing_subscriptions')
    .upsert(payload, { onConflict: 'store_id' });
}

export async function upsertSubscriptionTransaction({
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
    .from('listing_subscription_transactions')
    .upsert(payload, { onConflict: 'provider,provider_reference' });
}

export async function findStoreByTransactionReference(reference) {
  if (!reference) return null;

  const { data: tx } = await supabaseAdmin
    .from('listing_subscription_transactions')
    .select('store_id, owner_id')
    .eq('provider', 'paystack')
    .eq('provider_reference', reference)
    .maybeSingle();

  if (!tx) return null;
  return { storeId: tx.store_id, ownerId: tx.owner_id };
}

export async function getLatestPendingTransactionReference(storeId) {
  const { data: tx } = await supabaseAdmin
    .from('listing_subscription_transactions')
    .select('provider_reference, status')
    .eq('provider', 'paystack')
    .eq('store_id', storeId)
    .in('status', ['initialized', 'pending'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return tx?.provider_reference || null;
}

export async function applyListingActiveState({
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
      subscription_status: 'active',
      subscription_paystack_code: subscriptionCode,
      subscription_next_payment_date: nextPaymentDate
    })
    .eq('id', storeId)
    .eq('platform_mode', 'listing');

  await upsertListingSubscription({
    storeId,
    ownerId,
    status: 'active',
    providerCustomerCode: customerCode,
    providerSubscriptionCode: subscriptionCode,
    providerPlanCode: planCode,
    nextPaymentDate,
    metadata: raw
  });

  await setListingWebsiteEnabled(storeId, true);

  if (raw?.reference) {
    await upsertSubscriptionTransaction({
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

export async function applyListingInactiveState({
  storeId,
  ownerId,
  status,
  subscriptionCode = null,
  cancelledAt = null,
  raw = null
}) {
  await supabaseAdmin
    .from('stores')
    .update({ subscription_status: status })
    .eq('id', storeId)
    .eq('platform_mode', 'listing');

  await upsertListingSubscription({
    storeId,
    ownerId,
    status,
    providerSubscriptionCode: subscriptionCode,
    cancelledAt,
    metadata: raw
  });

  await setListingWebsiteEnabled(storeId, false);
}

export async function resolveListingStoreByOwner(ownerId) {
  const { data: store } = await supabaseAdmin
    .from('stores')
    .select('id, owner_id, platform_mode, subscription_status, subscription_paystack_code')
    .eq('owner_id', ownerId)
    .eq('platform_mode', 'listing')
    .maybeSingle();

  return store || null;
}

export async function resolveListingStoreByCustomerEmail(email) {
  if (!email) return null;

  const { data: user } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('email', email)
    .eq('is_active', true)
    .maybeSingle();

  if (!user?.id) return null;

  return resolveListingStoreByOwner(user.id);
}

export async function registerWebhookEvent({ providerEventKey, eventType, payloadHash, payload }) {
  const { data, error } = await supabaseAdmin
    .from('payment_webhook_events')
    .insert({
      provider: 'paystack',
      provider_event_key: providerEventKey,
      event_type: eventType,
      payload_hash: payloadHash,
      payload,
      status: 'received'
    })
    .select('id')
    .maybeSingle();

  if (error) {
    if (error.code === '23505') return { duplicate: true, id: null };
    throw error;
  }

  return { duplicate: false, id: data?.id || null };
}

export async function completeWebhookEvent(id) {
  if (!id) return;
  await supabaseAdmin
    .from('payment_webhook_events')
    .update({ status: 'processed', processed_at: new Date().toISOString() })
    .eq('id', id);
}

export async function failWebhookEvent(id, message) {
  if (!id) return;
  await supabaseAdmin
    .from('payment_webhook_events')
    .update({
      status: 'failed',
      error_message: message?.slice(0, 1000) || 'unknown error',
      processed_at: new Date().toISOString()
    })
    .eq('id', id);
}
