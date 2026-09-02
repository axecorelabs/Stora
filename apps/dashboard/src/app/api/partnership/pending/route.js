import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifySession } from '@/lib/auth';

// Returns this vendor's own store's current 'proposed' contract, if any --
// PartnershipProposalModal (mounted globally in DashboardLayout.js) polls
// this once per load to decide whether to show the proposal modal.
export async function GET(request) {
  const user = await verifySession(request);
  if (!user) {
    return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 });
  }

  const { data: store } = await supabaseAdmin
    .from('stores')
    .select('id, store_name')
    .eq('owner_id', user.id)
    .single();

  if (!store) {
    return NextResponse.json({ success: true, contract: null });
  }

  const { data: contract, error } = await supabaseAdmin
    .from('partner_contracts')
    .select('id, rate_type, rate_value, terms, proposed_at')
    .eq('store_id', store.id)
    .eq('status', 'proposed')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Error fetching pending partnership proposal:', error);
    return NextResponse.json({ success: false, message: 'Failed to load proposal' }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    contract: contract
      ? {
          id: contract.id,
          storeName: store.store_name,
          rateType: contract.rate_type,
          rateValue: parseFloat(contract.rate_value),
          terms: contract.terms,
          proposedAt: contract.proposed_at
        }
      : null
  });
}
