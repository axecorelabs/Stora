import { NextResponse, after } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifySession } from '@/lib/auth';
import { invalidateStorefrontCache } from '@/lib/redis';
import { BUSINESS_CATEGORY_VALUES, isValidNigerianState } from '@stora/shared-constants';
import { embedStoreById } from '@/lib/openrouter';
import { captureServerEvent } from '@/lib/posthog-server';
import { RESERVED_SUBDOMAINS } from '@/lib/websitePath';
import { transformStore } from '@/lib/transformStore';

function normalizeBusinessCategory(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const normalized = String(value).trim().toLowerCase();
  if (!normalized) return null;
  return BUSINESS_CATEGORY_VALUES.includes(normalized) ? normalized : '__invalid__';
}

function normalizeBusinessSubcategory(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const normalized = String(value).trim();
  return normalized || null;
}

function normalizeBusinessSubcategories(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (!Array.isArray(value)) return '__invalid__';
  const deduped = [...new Set(value.map((entry) => String(entry).trim()).filter(Boolean))];
  return deduped.length > 0 ? deduped : null;
}

function mergeBusinessSubcategories({ primary, list, fallbackPrimary = null, fallbackList = [] }) {
  const normalizedPrimary = normalizeBusinessSubcategory(primary);
  const normalizedList = normalizeBusinessSubcategories(list);

  if (normalizedList === '__invalid__') {
    return '__invalid__';
  }

  const resolvedPrimary = normalizedPrimary !== undefined ? normalizedPrimary : (fallbackPrimary || null);
  const baseList = normalizedList !== undefined
    ? (normalizedList || [])
    : Array.isArray(fallbackList) ? fallbackList : [];

  const combined = resolvedPrimary
    ? [resolvedPrimary, ...baseList.filter((entry) => entry !== resolvedPrimary)]
    : baseList;

  const deduped = [...new Set(combined.map((entry) => String(entry).trim()).filter(Boolean))];
  return {
    primary: resolvedPrimary,
    list: deduped.length > 0 ? deduped : null
  };
}

function inferBusinessCategory({ restaurantMode, sellsProducts, offersServices }) {
  if (restaurantMode) return 'restaurant';
  if (offersServices && sellsProducts) return 'hybrid';
  if (offersServices) return 'services';
  if (sellsProducts) return 'retail';
  return 'other';
}

// store_slug is UNIQUE at the DB level (see the initial schema migration),
// but slugifying a store name alone never guaranteed that -- two vendors
// both naming their store "John's Store" would both slugify to
// "john-s-store", and the second insert would just fail. That was a latent
// annoyance when the slug was only ever an internal /[slug] path segment;
// it becomes a real product problem once it's also a vendor's public
// subdomain (a vendor doesn't get to pick "john-s-store" if that identity
// is already spoken for). Check-and-increment here rather than leaning on
// the DB constraint to reject a collision, so a duplicate name still gets
// a real store instead of a confusing failure.
async function generateUniqueStoreSlug(storeName) {
  const base = storeName
    .toLowerCase()
    // Stripped rather than hyphenated -- "Dotun's Store" reading as
    // "dotun-s-store" (an orphan one-letter "-s-" segment) looks broken in
    // a way "dotuns-store" doesn't. Same convention every major platform
    // uses (Shopify, WordPress, GitHub all drop apostrophes rather than
    // treat them as a word boundary).
    .replace(/['’`]/g, '')
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'store';

  for (let suffix = 0; ; suffix += 1) {
    const candidate = suffix === 0 ? base : `${base}-${suffix}`;
    // A store's default public subdomain IS its store_slug (transformStore
    // falls back to it whenever no custom websitePath is set) -- a vendor
    // naming their store "Admin" or "App" must not walk away with the
    // subdomain workers/subdomain-router reserves for real infrastructure,
    // same reserved list lib/websitePath.js's custom-address path already
    // enforces. Treated exactly like a DB collision: skip to the next
    // numbered suffix instead of handing it out.
    if (RESERVED_SUBDOMAINS.has(candidate)) continue;
    const { data: existing } = await supabaseAdmin
      .from('stores')
      .select('id')
      .eq('store_slug', candidate)
      .maybeSingle();
    if (!existing) return candidate;
  }
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
    const normalizedBusinessCategory = normalizeBusinessCategory(storeData.businessCategory);
    const mergedBusinessSubcategories = mergeBusinessSubcategories({
      primary: storeData.businessSubcategory,
      list: storeData.businessSubcategories
    });

    if (normalizedBusinessCategory === '__invalid__') {
      return NextResponse.json(
        { success: false, message: `businessCategory must be one of: ${BUSINESS_CATEGORY_VALUES.join(', ')}` },
        { status: 400 }
      );
    }

    if (mergedBusinessSubcategories === '__invalid__') {
      return NextResponse.json(
        { success: false, message: 'businessSubcategories must be an array of strings' },
        { status: 400 }
      );
    }

    const inferredBusinessCategory = inferBusinessCategory({
      restaurantMode: !!storeData.offersFood,
      sellsProducts: storeData.sellsProducts !== false,
      offersServices: !!storeData.offersServices
    });

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

    const storeSlug = await generateUniqueStoreSlug(storeData.storeName);

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
        // Currency is always NGN -- Paystack only ever charges NGN
        // regardless of this setting, so it's forced server-side rather
        // than trusted from the client.
        settings: {
          timezone: 'Africa/Lagos',
          allowOnlineOrders: true,
          ...(storeData.settings || {}),
          currency: 'NGN'
        },
        bank_details: storeData.bankDetails || {},
        // Non-exclusive "what does your business do" set, chosen together
        // as one step in CreateBusinessModal.js -- previously restaurant_mode
        // was the only one of these three, and it was set via its own
        // separate PATCH /api/stores/restaurant-mode call from a dedicated
        // onboarding step, after the store already existed. All three are
        // now set together at creation time instead; the PATCH route still
        // exists for changing it later from Store settings.
        sells_products: storeData.sellsProducts !== false,
        offers_services: !!storeData.offersServices,
        restaurant_mode: !!storeData.offersFood,
        business_category: normalizedBusinessCategory ?? inferredBusinessCategory,
        business_subcategory: mergedBusinessSubcategories.primary,
        business_subcategories: mergedBusinessSubcategories.list,
        business_tags: Array.isArray(storeData.businessTags) && storeData.businessTags.length > 0
          ? [...new Set(storeData.businessTags.map((tag) => String(tag).trim()).filter(Boolean))]
          : null,
        // 'store' (default) or 'listing' -- set during onboarding intent step.
        platform_mode: storeData.platformMode === 'listing' ? 'listing' : 'store',
        subscription_status: 'none',
        is_active: true,
        // No websitePath here -- it's derived from store_slug at read time
        // (transformStore below) rather than stored as its own value, so
        // there's nothing for it to independently drift from or collide
        // on. Legacy stores with a websitePath already saved from before
        // this change keep using it (transformStore still prefers it when
        // present); this only affects stores created from now on.
        website: {
          status: 'inactive',
          isEnabled: false
        }
      })
      .select()
      .single();

    if (error) {
      console.error('Store creation error:', error);
      // 23505 is a generic unique-violation code -- it doesn't say which
      // constraint fired. store_slug is now pre-checked above, so this
      // should really only mean the owner_id constraint (a rare
      // create-twice race), but the message check keeps that assumption
      // from being blindly trusted if it's ever wrong.
      if (error.code === '23505') {
        const message = error.message?.includes('store_slug')
          ? 'That store name is already taken -- try a different one'
          : 'User already has a store';
        return NextResponse.json({ success: false, message }, { status: 409 });
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

    after(() => captureServerEvent(user.id, 'store_created', {
      store_type: store.store_type,
      onboarding_completed: true
    }));

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
    const normalizedBusinessCategory = normalizeBusinessCategory(updateData.businessCategory);
    const normalizedBusinessSubcategories = normalizeBusinessSubcategories(updateData.businessSubcategories);

    if (normalizedBusinessCategory === '__invalid__') {
      return NextResponse.json(
        { success: false, message: `businessCategory must be one of: ${BUSINESS_CATEGORY_VALUES.join(', ')}` },
        { status: 400 }
      );
    }

    if (normalizedBusinessSubcategories === '__invalid__') {
      return NextResponse.json(
        { success: false, message: 'businessSubcategories must be an array of strings' },
        { status: 400 }
      );
    }

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

    // A store must always do at least one of Products/Food/Services -- the
    // same rule CreateBusinessModal enforces at creation time ("Select at
    // least one -- what does your business do?"). restaurant_mode is set
    // via a separate endpoint (PATCH /api/stores/restaurant-mode), so
    // checking this here means fetching its current value alongside
    // whatever this request is actually changing.
    let inferredAutoBusinessCategory;
    let currentClassification;
    if (updateData.sellsProducts !== undefined || updateData.offersServices !== undefined) {
      const { data: currentStore } = await supabaseAdmin
        .from('stores')
        .select('sells_products, offers_services, restaurant_mode, business_category')
        .eq('owner_id', user.id)
        .eq('is_active', true)
        .single();

      const resultingSellsProducts = updateData.sellsProducts !== undefined ? !!updateData.sellsProducts : !!currentStore?.sells_products;
      const resultingOffersServices = updateData.offersServices !== undefined ? !!updateData.offersServices : !!currentStore?.offers_services;
      const resultingRestaurantMode = !!currentStore?.restaurant_mode;

      if (!resultingSellsProducts && !resultingOffersServices && !resultingRestaurantMode) {
        return NextResponse.json(
          { success: false, message: 'Your business must do at least one of Products, Food, or Services -- turn on another before turning this off.' },
          { status: 400 }
        );
      }

      // Keep business_category coherent when the vendor never explicitly
      // chose one (legacy rows/backfill) and they change business type flags.
      if (normalizedBusinessCategory === undefined && !currentStore?.business_category) {
        inferredAutoBusinessCategory = inferBusinessCategory({
          restaurantMode: resultingRestaurantMode,
          sellsProducts: resultingSellsProducts,
          offersServices: resultingOffersServices
        });
      }
    }

    if (updateData.businessSubcategory !== undefined || normalizedBusinessSubcategories !== undefined) {
      const { data: classificationRow } = await supabaseAdmin
        .from('stores')
        .select('business_subcategory, business_subcategories')
        .eq('owner_id', user.id)
        .eq('is_active', true)
        .single();
      currentClassification = classificationRow;
    }

    const mergedBusinessSubcategories = (updateData.businessSubcategory !== undefined || normalizedBusinessSubcategories !== undefined)
      ? mergeBusinessSubcategories({
          primary: updateData.businessSubcategory,
          list: normalizedBusinessSubcategories,
          fallbackPrimary: currentClassification?.business_subcategory || null,
          fallbackList: Array.isArray(currentClassification?.business_subcategories)
            ? currentClassification.business_subcategories
            : (currentClassification?.business_subcategory ? [currentClassification.business_subcategory] : [])
        })
      : null;

    if (mergedBusinessSubcategories === '__invalid__') {
      return NextResponse.json(
        { success: false, message: 'businessSubcategories must be an array of strings' },
        { status: 400 }
      );
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
    // Currency is always NGN -- Paystack only ever charges NGN regardless
    // of this setting, so it's forced server-side rather than trusted
    // from the client.
    if (updateData.settings) dbUpdate.settings = { ...updateData.settings, currency: 'NGN' };
    if (updateData.bankDetails) dbUpdate.bank_details = updateData.bankDetails;
    if (updateData.sellsProducts !== undefined) dbUpdate.sells_products = !!updateData.sellsProducts;
    if (updateData.offersServices !== undefined) dbUpdate.offers_services = !!updateData.offersServices;
    if (normalizedBusinessCategory !== undefined) dbUpdate.business_category = normalizedBusinessCategory;
    if (normalizedBusinessCategory === undefined && inferredAutoBusinessCategory) {
      dbUpdate.business_category = inferredAutoBusinessCategory;
    }
    if (mergedBusinessSubcategories) {
      dbUpdate.business_subcategory = mergedBusinessSubcategories.primary;
      dbUpdate.business_subcategories = mergedBusinessSubcategories.list;
    }
    if (updateData.businessTags !== undefined) {
      if (updateData.businessTags === null) {
        dbUpdate.business_tags = null;
      } else if (!Array.isArray(updateData.businessTags)) {
        return NextResponse.json(
          { success: false, message: 'businessTags must be an array of strings' },
          { status: 400 }
        );
      } else {
        const dedupedTags = [...new Set(updateData.businessTags.map((tag) => String(tag).trim()).filter(Boolean))];
        dbUpdate.business_tags = dedupedTags.length > 0 ? dedupedTags : null;
      }
    }
    
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

    after(() => captureServerEvent(user.id, 'store_updated', {
      store_type: store.store_type,
      updated_field_count: Object.keys(dbUpdate).filter(key => key !== 'updated_at').length,
      storefront_content_updated: dbUpdate.store_name !== undefined || dbUpdate.store_description !== undefined
    }));

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
