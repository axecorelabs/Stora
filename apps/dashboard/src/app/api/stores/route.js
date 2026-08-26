import { NextResponse, after } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifySession } from '@/lib/auth';
import { invalidateStorefrontCache } from '@/lib/redis';
import { isValidNigerianState } from '@stora/shared-constants';
import { embedStoreById } from '@/lib/openrouter';

// Helper to transform store data for response
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
    state: store.state,
    // Distinct from `state` (where the vendor is based) -- this is which
    // states they'll actually ship to. NULL/empty stored value means
    // nationwide; deliveryNationwide is derived here so the dashboard UI
    // doesn't need to re-derive the same null-check itself.
    deliveryStates: store.delivery_states && store.delivery_states.length > 0 ? store.delivery_states : null,
    deliveryNationwide: !store.delivery_states || store.delivery_states.length === 0,
    // Flat fee per destination state (keyed by NIGERIAN_STATES value), and
    // who collects it -- 'pay_on_delivery' carves only the delivery-fee
    // portion out of the Paystack charge, merchandise payment is untouched.
    deliveryFees: (typeof store.delivery_fees === 'string' ? JSON.parse(store.delivery_fees) : store.delivery_fees) || {},
    fulfillmentMethod: store.fulfillment_method === 'pay_on_delivery' ? 'pay_on_delivery' : 'platform_collected',
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
    websiteUrl: websitePath ? `${storeBaseUrl}/${websitePath}` : null,
    websiteFullPath: websitePath ? `${storeBaseUrl.replace(/^https?:\/\//, '')}/${websitePath}` : null,
    createdAt: store.created_at,
    updatedAt: store.updated_at
  };
}

// GET - Fetch user's store
export async function GET(req) {
  try {
    const user = await verifySession(req);
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Not authenticated' },
        { status: 401 }
      );
    }

    const { data: store, error } = await supabaseAdmin
      .from('stores')
      .select('*')
      .eq('owner_id', user.id)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Store fetch error:', error);
      return NextResponse.json(
        { success: false, message: 'Failed to fetch store' },
        { status: 500 }
      );
    }

    if (!store) {
      return NextResponse.json({
        success: true,
        hasStore: false,
        message: 'No store found for user'
      });
    }

    return NextResponse.json({
      success: true,
      hasStore: true,
      data: transformStore(store)
    });

  } catch (error) {
    console.error('Store fetch error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - Create new store
export async function POST(req) {
  try {
    const user = await verifySession(req);
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Check if user already has a store
    const { data: existingStore } = await supabaseAdmin
      .from('stores')
      .select('id')
      .eq('owner_id', user.id)
      .single();

    if (existingStore) {
      return NextResponse.json(
        { success: false, message: 'User already has a store' },
        { status: 409 }
      );
    }

    const storeData = await req.json();

    // Required going forward for every new store, regardless of storeType --
    // online-only vendors used to skip location entirely, which is exactly
    // why most existing stores have no state on record. Existing stores are
    // never touched by this check (see PUT below), only new creations.
    if (!isValidNigerianState(storeData.state)) {
      return NextResponse.json(
        { success: false, message: 'A valid operating state is required' },
        { status: 400 }
      );
    }

    // Generate store slug
    const storeSlug = storeData.storeName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    const { data: store, error } = await supabaseAdmin
      .from('stores')
      .insert({
        owner_id: user.id,
        store_name: storeData.storeName,
        store_slug: storeSlug,
        store_description: storeData.storeDescription || '',
        store_type: storeData.storeType || 'physical',
        store_phone: storeData.storePhone || '',
        store_email: storeData.storeEmail || user.email,
        state: storeData.state,
        address: storeData.address || {},
        online_store_info: storeData.onlineStoreInfo || {},
        branding: storeData.branding || {},
        business_hours: storeData.businessHours || {},
        settings: storeData.settings || {
          currency: 'NGN',
          timezone: 'Africa/Lagos',
          allowOnlineOrders: true
        },
        bank_details: storeData.bankDetails || {},
        is_active: true,
        website: {
          status: 'inactive',
          isEnabled: false,
          websitePath: storeSlug
        }
      })
      .select()
      .single();

    if (error) {
      console.error('Store creation error:', error);
      if (error.code === '23505') {
        return NextResponse.json(
          { success: false, message: 'User already has a store' },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { success: false, message: 'Failed to create store' },
        { status: 500 }
      );
    }

    // Creating a store satisfies both onboarding hard-blockers (name is
    // already on the users row by this point, whether from signup or the
    // wizard's name-confirm step) -- this is the single point that marks
    // onboarding done, true for the wizard and any other path that ever
    // creates a store, rather than a call scattered across UI entry points.
    await supabaseAdmin
      .from('users')
      .update({ onboarding_completed_at: new Date().toISOString() })
      .eq('id', user.id)
      .is('onboarding_completed_at', null);

    // Deferred -- same non-blocking pattern as the inventory routes.
    after(() => embedStoreById(store.id));

    return NextResponse.json({
      success: true,
      message: 'Store created successfully',
      data: transformStore(store)
    });

  } catch (error) {
    console.error('Store creation error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT - Update store
export async function PUT(req) {
  try {
    const user = await verifySession(req);
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Not authenticated' },
        { status: 401 }
      );
    }

    const updateData = await req.json();

    // Special handling for store type changes
    if (updateData.storeType === 'physical' && updateData.address) {
      if (!updateData.address.city || !updateData.address.state) {
        return NextResponse.json(
          { success: false, message: 'City and state are required for physical stores' },
          { status: 400 }
        );
      }
    }

    // Not required here -- existing stores without a state are nudged, not
    // blocked (see SetupChecklist). Only reject a value that's
    // actively wrong, not a missing one.
    if (updateData.state !== undefined && updateData.state !== null && !isValidNigerianState(updateData.state)) {
      return NextResponse.json(
        { success: false, message: 'Not a valid operating state' },
        { status: 400 }
      );
    }

    // deliveryStates: which states this vendor ships to (distinct from
    // `state`, where they're based). null/undefined leaves it untouched;
    // an array must be all-valid states; an empty array is coerced to
    // null (nationwide) rather than rejected -- the dashboard UI already
    // requires >=1 state when "Specific states" is chosen, so this is
    // just a defensive backstop against a store ending up deliverable to
    // nowhere.
    let deliveryStatesUpdate;
    if (updateData.deliveryStates !== undefined && updateData.deliveryStates !== null) {
      if (!Array.isArray(updateData.deliveryStates)) {
        return NextResponse.json(
          { success: false, message: 'deliveryStates must be an array of states' },
          { status: 400 }
        );
      }
      if (updateData.deliveryStates.some((s) => !isValidNigerianState(s))) {
        return NextResponse.json(
          { success: false, message: 'deliveryStates contains an invalid state' },
          { status: 400 }
        );
      }
      const deduped = [...new Set(updateData.deliveryStates)];
      deliveryStatesUpdate = deduped.length > 0 ? deduped : null;
    } else if (updateData.deliveryStates === null) {
      deliveryStatesUpdate = null;
    }

    // deliveryFees: flat fee per destination state, keyed the same as
    // deliveryStates. Deliberately NOT required to be a subset of
    // deliveryStates -- a fee for a state temporarily removed from
    // deliveryStates stays dormant rather than being deleted, so re-adding
    // that state later restores its old price instead of starting blank.
    let deliveryFeesUpdate;
    if (updateData.deliveryFees !== undefined && updateData.deliveryFees !== null) {
      if (typeof updateData.deliveryFees !== 'object' || Array.isArray(updateData.deliveryFees)) {
        return NextResponse.json(
          { success: false, message: 'deliveryFees must be an object' },
          { status: 400 }
        );
      }
      for (const [state, amount] of Object.entries(updateData.deliveryFees)) {
        if (!isValidNigerianState(state)) {
          return NextResponse.json(
            { success: false, message: `deliveryFees has an invalid state: ${state}` },
            { status: 400 }
          );
        }
        if (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0) {
          return NextResponse.json(
            { success: false, message: `deliveryFees.${state} must be a number >= 0` },
            { status: 400 }
          );
        }
      }
      deliveryFeesUpdate = updateData.deliveryFees;
    }

    // Build update object with snake_case keys
    const dbUpdate = {};
    if (updateData.storeName) dbUpdate.store_name = updateData.storeName;
    if (updateData.storeDescription !== undefined) dbUpdate.store_description = updateData.storeDescription;
    if (updateData.storeType) dbUpdate.store_type = updateData.storeType;
    if (updateData.storePhone) dbUpdate.store_phone = updateData.storePhone;
    if (updateData.storeEmail) dbUpdate.store_email = updateData.storeEmail;
    if (updateData.state !== undefined) dbUpdate.state = updateData.state;
    if (deliveryStatesUpdate !== undefined) dbUpdate.delivery_states = deliveryStatesUpdate;
    if (deliveryFeesUpdate !== undefined) dbUpdate.delivery_fees = deliveryFeesUpdate;
    if (updateData.address) dbUpdate.address = updateData.address;
    if (updateData.onlineStoreInfo) dbUpdate.online_store_info = updateData.onlineStoreInfo;
    if (updateData.branding) dbUpdate.branding = updateData.branding;
    if (updateData.businessHours) dbUpdate.business_hours = updateData.businessHours;
    if (updateData.settings) dbUpdate.settings = updateData.settings;
    if (updateData.bankDetails) dbUpdate.bank_details = updateData.bankDetails;
    
    dbUpdate.updated_at = new Date().toISOString();

    const { data: store, error } = await supabaseAdmin
      .from('stores')
      .update(dbUpdate)
      .eq('owner_id', user.id)
      .eq('is_active', true)
      .select()
      .single();

    if (error) {
      console.error('Store update error:', error);
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { success: false, message: 'Store not found' },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { success: false, message: 'Failed to update store' },
        { status: 500 }
      );
    }

    await invalidateStorefrontCache(store.store_slug);

    // Only re-embed when the text an AI-search match is judged against
    // actually changed -- most store edits (branding, hours, bank details)
    // don't need a new OpenRouter round trip.
    if (dbUpdate.store_name !== undefined || dbUpdate.store_description !== undefined) {
      after(() => embedStoreById(store.id));
    }

    return NextResponse.json({
      success: true,
      message: updateData.storeType === 'physical'
        ? 'Store converted to physical store successfully'
        : 'Store updated successfully',
      data: transformStore(store)
    });

  } catch (error) {
    console.error('Store update error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
