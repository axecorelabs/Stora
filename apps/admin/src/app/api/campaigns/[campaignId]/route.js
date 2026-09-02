import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

async function transformCampaign(row) {
  const { data: memberRows } = await supabaseAdmin
    .from('campaign_stores')
    .select('stores(id, store_name, store_slug)')
    .eq('campaign_id', row.id);
  const stores = (memberRows || []).map((r) => r.stores).filter(Boolean);

  return {
    id: row.id,
    storeIds: stores.map((s) => s.id),
    stores: stores.map((s) => ({ id: s.id, storeName: s.store_name, storeSlug: s.store_slug })),
    title: row.title,
    type: row.type,
    status: row.status,
    config: row.config,
    bannerUrl: row.banner_url,
    attributionWindowHours: row.attribution_window_hours,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export async function GET(request, { params }) {
  const staff = await verifySession(request);
  if (!staff) {
    return NextResponse.json({ success: false, message: 'Not authorized' }, { status: 403 });
  }

  const { campaignId } = await params;
  const { data, error } = await supabaseAdmin
    .from('campaigns')
    .select('*')
    .eq('id', campaignId)
    .single();

  if (error || !data) {
    return NextResponse.json({ success: false, message: 'Campaign not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true, campaign: await transformCampaign(data) });
}

// Edits or archives a campaign -- there is deliberately no DELETE. A
// campaign is soft-archived (status: 'archived') instead of hard-deleted
// so historical campaign_attributions/order_payment_splits rows keep
// meaningful context.
export async function PATCH(request, { params }) {
  const staff = await verifySession(request);
  if (!staff) {
    return NextResponse.json({ success: false, message: 'Not authorized' }, { status: 403 });
  }

  const { campaignId } = await params;
  const { title, config, attributionWindowHours, status, bannerUrl, storeIds } = await request.json();

  const updates = {};
  if (title !== undefined) updates.title = title.trim();
  if (config !== undefined) updates.config = config;
  if (attributionWindowHours !== undefined) updates.attribution_window_hours = attributionWindowHours;
  if (bannerUrl !== undefined) updates.banner_url = bannerUrl;
  if (status !== undefined) {
    if (!['draft', 'active', 'archived'].includes(status)) {
      return NextResponse.json({ success: false, message: 'Invalid status' }, { status: 400 });
    }
    updates.status = status;
  }
  updates.updated_at = new Date().toISOString();

  if (storeIds !== undefined) {
    if (!Array.isArray(storeIds) || storeIds.length === 0) {
      return NextResponse.json({ success: false, message: 'At least one storeId is required' }, { status: 400 });
    }
    const { data: stores, error: storesError } = await supabaseAdmin
      .from('stores')
      .select('id, is_partner')
      .in('id', storeIds);
    if (storesError) {
      return NextResponse.json({ success: false, message: 'Failed to validate vendors' }, { status: 500 });
    }
    const foundIds = new Set((stores || []).map((s) => s.id));
    if (foundIds.size !== storeIds.length || (stores || []).some((s) => !s.is_partner)) {
      return NextResponse.json({ success: false, message: 'One or more selected vendors are not designated partners' }, { status: 400 });
    }
  }

  const { data, error } = await supabaseAdmin
    .from('campaigns')
    .update(updates)
    .eq('id', campaignId)
    .select('*')
    .single();

  if (error || !data) {
    console.error('Error updating campaign:', error);
    return NextResponse.json({ success: false, message: 'Failed to update campaign' }, { status: 500 });
  }

  if (storeIds !== undefined) {
    const { error: deleteError } = await supabaseAdmin.from('campaign_stores').delete().eq('campaign_id', campaignId);
    if (deleteError) {
      console.error('Error clearing campaign members:', deleteError);
      return NextResponse.json({ success: false, message: 'Campaign updated but failed to update vendors' }, { status: 500 });
    }
    const { error: memberError } = await supabaseAdmin
      .from('campaign_stores')
      .insert(storeIds.map((storeId) => ({ campaign_id: campaignId, store_id: storeId })));
    if (memberError) {
      console.error('Error updating campaign members:', memberError);
      return NextResponse.json({ success: false, message: 'Campaign updated but failed to update vendors' }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true, campaign: await transformCampaign(data) });
}
