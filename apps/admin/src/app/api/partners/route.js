import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

// Lists vendors for the partner-management screen -- includes every
// vendor (not just current partners), with an optional `q` search over
// store name/slug, plus each store's most recent partner_contracts row
// (if any) so the UI can show "no contract" / "pending vendor response" /
// "accepted, here are the terms" without a second round trip per store.
export async function GET(request) {
  const staff = await verifySession(request);
  if (!staff) {
    return NextResponse.json({ success: false, message: 'Not authorized' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q')?.trim();

  let query = supabaseAdmin
    .from('stores')
    .select('id, store_name, store_slug, is_partner, partner_designated_at, paystack_ready, is_active')
    .order('store_name', { ascending: true })
    .limit(100);

  if (q) {
    query = query.or(`store_name.ilike.%${q}%,store_slug.ilike.%${q}%`);
  }

  const { data, error } = await query;
  if (error) {
    console.error('Error listing stores for partners view:', error);
    return NextResponse.json({ success: false, message: 'Failed to load vendors' }, { status: 500 });
  }

  const storeIds = (data || []).map((s) => s.id);
  let latestContractByStore = new Map();
  if (storeIds.length > 0) {
    const { data: contracts, error: contractsError } = await supabaseAdmin
      .from('partner_contracts')
      .select('id, store_id, status, rate_type, rate_value, terms, proposed_at, responded_at, created_at')
      .in('store_id', storeIds)
      .order('created_at', { ascending: false });
    if (contractsError) {
      console.error('Error loading partner contracts:', contractsError);
      return NextResponse.json({ success: false, message: 'Failed to load vendors' }, { status: 500 });
    }
    // First row per store_id wins, since the query is already ordered
    // newest-first -- gives "the most recent contract regardless of status".
    (contracts || []).forEach((c) => {
      if (!latestContractByStore.has(c.store_id)) latestContractByStore.set(c.store_id, c);
    });
  }

  return NextResponse.json({
    success: true,
    stores: (data || []).map((s) => {
      const contract = latestContractByStore.get(s.id);
      return {
        id: s.id,
        storeName: s.store_name,
        storeSlug: s.store_slug,
        isPartner: !!s.is_partner,
        partnerDesignatedAt: s.partner_designated_at,
        paystackReady: !!s.paystack_ready,
        isActive: !!s.is_active,
        contract: contract
          ? {
              id: contract.id,
              status: contract.status,
              rateType: contract.rate_type,
              rateValue: parseFloat(contract.rate_value),
              terms: contract.terms,
              proposedAt: contract.proposed_at,
              respondedAt: contract.responded_at
            }
          : null
      };
    })
  });
}
