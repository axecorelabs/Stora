import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifySession } from '@/lib/auth';

// POST -- instant, no confirmation needed (same reasoning the business-type
// toggles use: trivially reversible by reconnecting, so it doesn't need
// the batched Edit Store modal's Save/Cancel contract). Scoped to
// owner_id, same as every other store-mutating route -- a vendor can only
// ever disconnect their own store.
export async function POST(req) {
  const user = await verifySession(req);
  if (!user) {
    return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 });
  }

  const { error } = await supabaseAdmin
    .from('stores')
    .update({ telegram_chat_id: null, telegram_username: null, updated_at: new Date().toISOString() })
    .eq('owner_id', user.id)
    .eq('is_active', true);

  if (error) {
    console.error('Error disconnecting Telegram:', error);
    return NextResponse.json({ success: false, message: 'Failed to disconnect' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
