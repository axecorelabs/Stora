import { supabaseAdmin } from '@/lib/supabase';

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
      full_store_subscription_next_payment_date: nextPaymentDate
    })
    .eq('id', storeId)
    .eq('platform_mode', 'store');

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
  await supabaseAdmin
    .from('stores')
    .update({ full_store_subscription_status: status })
    .eq('id', storeId)
    .eq('platform_mode', 'store');

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
    .select('id, owner_id, platform_mode, full_store_subscription_status, full_store_subscription_paystack_code')
    .eq('owner_id', ownerId)
    .eq('platform_mode', 'store')
    .maybeSingle();

  return store || null;
}

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
