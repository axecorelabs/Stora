import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

function normalizeWebsiteConfig(rawWebsite) {
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

function parseAmountKobo({ amountKobo, amountNaira }) {
  if (amountKobo !== undefined && amountKobo !== null && amountKobo !== '') {
    const parsed = Number(amountKobo);
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    return Math.round(parsed);
  }

  if (amountNaira !== undefined && amountNaira !== null && amountNaira !== '') {
    const parsed = Number(amountNaira);
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    return Math.round(parsed * 100);
  }

  return null;
}

function buildManualReference(storeId) {
  return `manual-${Date.now()}-${String(storeId || '').slice(0, 8)}`;
}

export async function POST(request, { params }) {
  const staff = await verifySession(request);
  if (!staff) {
    return NextResponse.json({ success: false, message: 'Not authorized' }, { status: 403 });
  }

  try {
    const { storeId } = await params;
    const body = await request.json();

    const amountKobo = parseAmountKobo(body || {});
    if (!amountKobo) {
      return NextResponse.json({ success: false, message: 'A valid payment amount is required' }, { status: 400 });
    }

    const currency = String(body?.currency || 'NGN').toUpperCase();
    const note = body?.note ? String(body.note).slice(0, 500) : null;
    const planCode = body?.planCode ? String(body.planCode).slice(0, 80) : 'listing_manual';
    const periodDaysRaw = Number(body?.periodDays ?? 30);
    const periodDays = Number.isFinite(periodDaysRaw) ? Math.min(Math.max(Math.round(periodDaysRaw), 1), 365) : 30;

    const paidAtDate = body?.paidAt ? new Date(body.paidAt) : new Date();
    if (Number.isNaN(paidAtDate.getTime())) {
      return NextResponse.json({ success: false, message: 'Invalid paidAt date' }, { status: 400 });
    }

    const currentPeriodStart = paidAtDate.toISOString();
    const currentPeriodEndDate = new Date(paidAtDate.getTime());
    currentPeriodEndDate.setUTCDate(currentPeriodEndDate.getUTCDate() + periodDays);
    const currentPeriodEnd = currentPeriodEndDate.toISOString();

    const reference = body?.reference
      ? String(body.reference).trim().slice(0, 120)
      : buildManualReference(storeId);

    const { data: store, error: storeError } = await supabaseAdmin
      .from('stores')
      .select('id, owner_id, store_name, platform_mode, is_active, website')
      .eq('id', storeId)
      .single();

    if (storeError || !store) {
      return NextResponse.json({ success: false, message: 'Store not found' }, { status: 404 });
    }

    if ((store.platform_mode || 'store') !== 'listing') {
      return NextResponse.json(
        { success: false, message: 'Manual subscription activation is only for listing-mode stores' },
        { status: 422 }
      );
    }

    const nextWebsite = {
      ...normalizeWebsiteConfig(store.website),
      isEnabled: true,
    };

    const nowIso = new Date().toISOString();

    const { error: storeUpdateError } = await supabaseAdmin
      .from('stores')
      .update({
        subscription_status: 'active',
        subscription_next_payment_date: currentPeriodEnd,
        website: nextWebsite,
        updated_at: nowIso,
      })
      .eq('id', storeId)
      .eq('platform_mode', 'listing');

    if (storeUpdateError) {
      throw storeUpdateError;
    }

    const { error: subError } = await supabaseAdmin
      .from('listing_subscriptions')
      .upsert(
        {
          store_id: storeId,
          owner_id: store.owner_id,
          provider: 'manual',
          provider_plan_code: planCode,
          status: 'active',
          current_period_start: currentPeriodStart,
          current_period_end: currentPeriodEnd,
          next_payment_date: currentPeriodEnd,
          cancelled_at: null,
          metadata: {
            source: 'admin_manual_activation',
            note,
            activated_by: {
              id: staff.id,
              email: staff.email,
              name: staff.name,
            },
          },
          updated_at: nowIso,
        },
        { onConflict: 'store_id' }
      );

    if (subError) {
      throw subError;
    }

    const { error: txError } = await supabaseAdmin
      .from('listing_subscription_transactions')
      .insert({
        store_id: storeId,
        owner_id: store.owner_id,
        provider: 'manual',
        provider_reference: reference,
        provider_plan_code: planCode,
        amount_kobo: amountKobo,
        currency,
        status: 'success',
        paid_at: paidAtDate.toISOString(),
        verification_payload: {
          source: 'admin_manual_payment',
          note,
          period_days: periodDays,
          activated_by: {
            id: staff.id,
            email: staff.email,
            name: staff.name,
          },
        },
        updated_at: nowIso,
      });

    if (txError) {
      throw txError;
    }

    return NextResponse.json({
      success: true,
      store: {
        id: store.id,
        storeName: store.store_name,
        subscriptionStatus: 'active',
        subscriptionNextPaymentDate: currentPeriodEnd,
        isPublished: true,
        isLive: !!store.is_active,
      },
      payment: {
        provider: 'manual',
        providerReference: reference,
        amountKobo,
        currency,
        paidAt: paidAtDate.toISOString(),
      },
    });
  } catch (error) {
    console.error('Manual subscription activation error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to activate manual subscription' },
      { status: 500 }
    );
  }
}
