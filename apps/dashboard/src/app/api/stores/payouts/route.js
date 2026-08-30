import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifySession } from '@/lib/auth';
import { resolveAccountNumber, createSubaccount } from '@/lib/paystack';

const PLATFORM_COMMISSION_RATE = parseFloat(process.env.PLATFORM_COMMISSION_RATE || '0.02');

// Mirrors the transformStore() in apps/dashboard/src/app/api/stores/branding/route.js
// and apps/dashboard/src/app/api/store/route.js -- same shape, so the
// modal callback can setStore(response.data) exactly like the branding
// modal does, no bespoke partial-merge on the page.
function transformStore(store) {
  if (!store) return null;

  const websiteData = typeof store.website === 'string' ? JSON.parse(store.website) : store.website;
  const websitePath = websiteData?.websitePath || store.store_slug;
  const storeBaseUrl = process.env.NEXT_PUBLIC_STORE_URL || 'https://stora.com.ng';

  return {
    id: store.id,
    mongoId: store.mongo_id,
    userId: store.owner_id,
    storeName: store.store_name,
    storeSlug: store.store_slug,
    storeDescription: store.store_description,
    storeType: store.store_type,
    storePhone: store.store_phone,
    storeEmail: store.store_email,
    address: typeof store.address === 'string' ? JSON.parse(store.address) : store.address,
    onlineStoreInfo: typeof store.online_store_info === 'string' ? JSON.parse(store.online_store_info) : store.online_store_info,
    branding: typeof store.branding === 'string' ? JSON.parse(store.branding) : store.branding,
    businessHours: typeof store.business_hours === 'string' ? JSON.parse(store.business_hours) : store.business_hours,
    settings: typeof store.settings === 'string' ? JSON.parse(store.settings) : store.settings,
    bankDetails: typeof store.bank_details === 'string' ? JSON.parse(store.bank_details) : store.bank_details,
    isActive: store.is_active,
    isVerified: store.is_verified,
    verificationStatus: store.verification_status,
    totalSales: parseFloat(store.total_sales) || 0,
    totalOrders: store.total_orders || 0,
    averageRating: parseFloat(store.average_rating) || 0,
    totalReviews: store.total_reviews || 0,
    website: websiteData,
    websitePath,
    // Shown to the vendor as their storefront's real address -- the
    // wildcard vendor subdomain (see workers/subdomain-router), not the
    // internal storeBaseUrl/slug path the marketplace itself still uses
    // for in-app navigation between stores.
    websiteUrl: websitePath ? `https://${websitePath}.${storeBaseUrl.replace(/^https?:\/\//, '')}` : null,
    websiteFullPath: websitePath ? `${websitePath}.${storeBaseUrl.replace(/^https?:\/\//, '')}` : null,
    createdAt: store.created_at,
    updatedAt: store.updated_at
  };
}

export async function PATCH(req) {
  try {
    const user = await verifySession(req);
    if (!user) {
      return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 });
    }

    const { bankCode, bankName, accountNumber } = await req.json();
    if (!bankCode || !bankName || !accountNumber) {
      return NextResponse.json(
        { success: false, message: 'Bank and account number are required' },
        { status: 400 }
      );
    }

    const { data: store, error: fetchError } = await supabaseAdmin
      .from('stores')
      .select('*')
      .eq('owner_id', user.id)
      .eq('is_active', true)
      .single();

    if (fetchError || !store) {
      return NextResponse.json({ success: false, message: 'Store not found' }, { status: 404 });
    }

    // Re-resolve server-side rather than trusting a client-supplied account
    // name -- the client only ever displays what this same endpoint already
    // returned, but the subaccount must be created against Paystack's own
    // authoritative resolution, not whatever the browser sent back.
    let resolved;
    try {
      resolved = await resolveAccountNumber(accountNumber, bankCode);
    } catch (error) {
      return NextResponse.json(
        { success: false, message: error.message || 'Could not verify this account number' },
        { status: 400 }
      );
    }

    let subaccount;
    try {
      subaccount = await createSubaccount({
        businessName: store.store_name,
        bankCode,
        accountNumber,
        commissionRate: PLATFORM_COMMISSION_RATE,
        contactEmail: store.store_email || user.email,
        contactName: resolved.account_name
      });
    } catch (error) {
      console.error('Paystack subaccount creation error:', error);
      return NextResponse.json(
        { success: false, message: error.message || 'Failed to set up payouts with Paystack' },
        { status: 502 }
      );
    }

    const currentBankDetails = typeof store.bank_details === 'string'
      ? JSON.parse(store.bank_details)
      : store.bank_details || {};

    const updatedBankDetails = {
      ...currentBankDetails,
      bank_code: bankCode,
      bank_name: bankName,
      account_number: accountNumber,
      account_name: resolved.account_name,
      paystack_subaccount_code: subaccount.subaccount_code,
      percentage_charge: PLATFORM_COMMISSION_RATE * 100,
      verified_at: new Date().toISOString()
    };

    const { data: updatedStore, error: updateError } = await supabaseAdmin
      .from('stores')
      .update({ bank_details: updatedBankDetails, updated_at: new Date().toISOString() })
      .eq('owner_id', user.id)
      .eq('is_active', true)
      .select()
      .single();

    if (updateError) {
      console.error('Store payout settings update error:', updateError);
      return NextResponse.json({ success: false, message: 'Failed to save payout settings' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Payout settings saved',
      data: transformStore(updatedStore)
    });
  } catch (error) {
    console.error('Store payout settings error:', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}
