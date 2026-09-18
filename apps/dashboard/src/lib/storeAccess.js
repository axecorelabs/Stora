import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { verifySession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { captureServerEvent } from '@/lib/posthog-server';
import { enforceFullStoreLockIfNeeded, evaluateFullStoreCommerceAccess } from '@/lib/fullStoreSubscription';

const LISTING_FORBIDDEN_MESSAGE = 'Listing accounts cannot access commerce features. Upgrade to a full store to continue.';
const FULL_STORE_RESTRICTED_MESSAGE = 'Your full-store subscription is inactive. Complete payment to restore storefront, POS, and inventory access.';

async function getOwnerStore(userId) {
  const { data: store, error } = await supabaseAdmin
    .from('stores')
    .select('id, owner_id, platform_mode, is_active, website, full_store_subscription_status, full_store_subscription_grace_ends_at, full_store_subscription_locked_at')
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

  const commerceAccess = evaluateFullStoreCommerceAccess(store);
  if (!commerceAccess.allowed) {
    const lockResult = await enforceFullStoreLockIfNeeded(store);
    if (lockResult.newlyLocked) {
      await captureServerEvent(user.id, 'subscription_suspended', {
        source: 'access_gate',
        subscriptionMode: 'full_store',
        storeId: store.id,
        reason: commerceAccess.restrictedReason || 'grace_expired'
      });
    }
    return {
      ok: false,
      response: NextResponse.json(
        {
          success: false,
          message: FULL_STORE_RESTRICTED_MESSAGE,
          code: commerceAccess.restrictedReason || 'full_store_subscription_inactive',
          graceEndsAt: commerceAccess.graceEndsAt || null
        },
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
  if (!store) {
    return { user, store: null, commerceAccess: { allowed: false, restrictedReason: 'store_not_found' } };
  }

  if (store.platform_mode === 'listing') {
    return { user, store, commerceAccess: { allowed: false, restrictedReason: 'listing_mode' } };
  }

  const commerceAccess = evaluateFullStoreCommerceAccess(store);
  if (!commerceAccess.allowed) {
    const lockResult = await enforceFullStoreLockIfNeeded(store);
    if (lockResult.newlyLocked) {
      await captureServerEvent(user.id, 'subscription_suspended', {
        source: 'access_gate',
        subscriptionMode: 'full_store',
        storeId: store.id,
        reason: commerceAccess.restrictedReason || 'grace_expired'
      });
    }
  }

  return { user, store, commerceAccess };
}
