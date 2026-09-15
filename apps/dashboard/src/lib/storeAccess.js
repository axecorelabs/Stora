import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { verifySession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

const LISTING_FORBIDDEN_MESSAGE = 'Listing accounts cannot access commerce features. Upgrade to a full store to continue.';

async function getOwnerStore(userId) {
  const { data: store, error } = await supabaseAdmin
    .from('stores')
    .select('id, owner_id, platform_mode, is_active')
    .eq('owner_id', userId)
    .eq('is_active', true)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return store || null;
}

export async function requireCommerceApiAccess(req) {
  const user = await verifySession(req);
  if (!user) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, message: 'Not authenticated' },
        { status: 401 }
      )
    };
  }

  const store = await getOwnerStore(user.id);
  if (!store) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, message: 'Store not found' },
        { status: 404 }
      )
    };
  }

  if (store.platform_mode === 'listing') {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, message: LISTING_FORBIDDEN_MESSAGE },
        { status: 403 }
      )
    };
  }

  return { ok: true, user, store };
}

export async function getDashboardAccessContext() {
  const requestHeaders = await headers();
  const user = await verifySession({ headers: requestHeaders });
  if (!user) {
    return { user: null, store: null };
  }

  const store = await getOwnerStore(user.id);
  return { user, store };
}
