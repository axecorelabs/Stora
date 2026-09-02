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

export async function GET(request) {
  const staff = await verifySession(request);
  if (!staff) {
    return NextResponse.json({ success: false, message: 'Not authorized' }, { status: 403 });
  }

  const { data, error } = await supabaseAdmin
    .from('campaigns')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error listing campaigns:', error);
    return NextResponse.json({ success: false, message: 'Failed to load campaigns' }, { status: 500 });
  }

  const campaigns = await Promise.all((data || []).map(transformCampaign));
  return NextResponse.json({ success: true, campaigns });
}

export async function POST(request) {
  const staff = await verifySession(request);
  if (!staff) {
    return NextResponse.json({ success: false, message: 'Not authorized' }, { status: 403 });
  }

  const { storeIds, title, config, attributionWindowHours, bannerUrl } = await request.json();

  if (!Array.isArray(storeIds) || storeIds.length === 0 || !title?.trim()) {
    return NextResponse.json({ success: false, message: 'At least one storeId and a title are required' }, { status: 400 });
  }

  // A campaign can only ever pool designated partners -- enforcement
  // point, not just a UI restriction (the builder's own vendor picker
  // also only lists partners, but a direct POST must not bypass that).
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

  const { data: campaign, error } = await supabaseAdmin
    .from('campaigns')
    .insert({
      created_by: staff.id,
      title: title.trim(),
      config: config || {},
      attribution_window_hours: attributionWindowHours || 48,
      banner_url: bannerUrl || null,
      status: 'draft'
    })
    .select('*')
    .single();

  if (error || !campaign) {
    console.error('Error creating campaign:', error);
    return NextResponse.json({ success: false, message: 'Failed to create campaign' }, { status: 500 });
  }

  const { error: memberError } = await supabaseAdmin
    .from('campaign_stores')
    .insert(storeIds.map((storeId) => ({ campaign_id: campaign.id, store_id: storeId })));
  if (memberError) {
    console.error('Error adding campaign members:', memberError);
    return NextResponse.json({ success: false, message: 'Campaign created but failed to add vendors' }, { status: 500 });
  }

  return NextResponse.json({ success: true, campaign: await transformCampaign(campaign) });
}
