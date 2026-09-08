import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifySession } from '@/lib/auth';

// GET -- polled by the Settings tab (both while waiting for a link to
// complete, and on normal page load to render the connected/not-connected
// state). Deliberately never returns the raw chat id to the client --
// there's nothing it needs it for, and it's not this store's to display.
export async function GET(req) {
  const user = await verifySession(req);
  if (!user) {
    return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 });
  }

  const { data: store } = await supabaseAdmin
    .from('stores')
    .select('telegram_chat_id, telegram_username')
    .eq('owner_id', user.id)
    .eq('is_active', true)
    .single();

  if (!store) {
    return NextResponse.json({ success: false, message: 'Store not found' }, { status: 404 });
  }

  return NextResponse.json({
    success: true,
    connected: !!store.telegram_chat_id,
    username: store.telegram_username || null
  });
}
