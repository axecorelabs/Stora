import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifySession } from '@/lib/auth';
import { normalizeWebsitePath, getWebsitePathShapeError, isWebsitePathTaken } from '@/lib/websitePath';

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
    // Shown to the vendor as their storefront's real address -- the
    // wildcard vendor subdomain (see workers/subdomain-router), not the
    // internal storeBaseUrl/slug path the marketplace itself still uses
    // for in-app navigation between stores.
    websiteUrl: websitePath ? `https://${websitePath}.${storeBaseUrl.replace(/^https?:\/\//, '')}` : null,
    websiteFullPath: websitePath ? `${websitePath}.${storeBaseUrl.replace(/^https?:\/\//, '')}` : null,
    createdAt: store.created_at,
    updatedAt: store.updated_at
  };
}

// PUT - Update website settings
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
    
    // Find the store first
    const { data: store, error: fetchError } = await supabaseAdmin
      .from('stores')
      .select('*')
      .eq('owner_id', user.id)
      .eq('is_active', true)
      .single();

    if (fetchError || !store) {
      return NextResponse.json(
        { success: false, message: 'Store not found' },
        { status: 404 }
      );
    }

    // Merge website settings
    const currentWebsite = typeof store.website === 'string' 
      ? JSON.parse(store.website) 
      : store.website || {};
    
    // Build the update - merge nested website fields
    const dbUpdate = {
      updated_at: new Date().toISOString()
    };

    // Handle website nested updates
    if (updateData.website || updateData['website.seoSettings'] || updateData['website.customization'] || updateData['website.settings']) {
      const updatedWebsite = { ...currentWebsite };
      
      if (updateData.website) {
        // websitePath is handled separately below (it needs an async
        // uniqueness check, unlike everything else merged here) --
        // stripped out first so a bare Object.assign can't set it
        // unvalidated.
        const { websitePath, ...safeWebsiteUpdate } = updateData.website;
        Object.assign(updatedWebsite, safeWebsiteUpdate);

        if (websitePath !== undefined) {
          const normalized = normalizeWebsitePath(websitePath);

          if (!normalized) {
            // Explicit clear -- revert to deriving from store_slug
            // (transformStore's own fallback) rather than storing an
            // empty value.
            delete updatedWebsite.websitePath;
          } else {
            const shapeError = getWebsitePathShapeError(normalized);
            if (shapeError) {
              return NextResponse.json({ success: false, message: shapeError }, { status: 400 });
            }

            // Re-saving the store's own current value (whichever field
            // it's presently resolved from) is always fine -- only a
            // genuine change needs the availability check.
            const currentlyResolvedPath = currentWebsite.websitePath || store.store_slug;
            if (normalized !== currentlyResolvedPath) {
              const taken = await isWebsitePathTaken(normalized, { excludeStoreId: store.id });
              if (taken) {
                return NextResponse.json(
                  { success: false, message: 'That website address is already taken' },
                  { status: 409 }
                );
              }
            }

            updatedWebsite.websitePath = normalized;
          }
        }
      }
      if (updateData['website.seoSettings']) {
        updatedWebsite.seoSettings = { ...updatedWebsite.seoSettings, ...updateData['website.seoSettings'] };
      }
      if (updateData['website.customization']) {
        updatedWebsite.customization = { ...updatedWebsite.customization, ...updateData['website.customization'] };
      }
      if (updateData['website.settings']) {
        updatedWebsite.settings = { ...updatedWebsite.settings, ...updateData['website.settings'] };
      }
      
      dbUpdate.website = updatedWebsite;
    }

    // Update the store
    const { data: updatedStore, error: updateError } = await supabaseAdmin
      .from('stores')
      .update(dbUpdate)
      .eq('owner_id', user.id)
      .eq('is_active', true)
      .select()
      .single();

    if (updateError) {
      console.error('Website settings update error:', updateError);
      return NextResponse.json(
        { success: false, message: 'Failed to update website settings' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Website settings updated successfully',
      data: transformStore(updatedStore)
    });

  } catch (error) {
    console.error('Website settings update error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
