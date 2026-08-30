import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifySession } from '@/lib/auth';
import { uploadToR2, generateFileKey, validateImageFile, deleteFromR2, extractKeyFromUrl } from '@/lib/r2';
import { invalidateStorefrontCache } from '@/lib/redis';

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

// PUT - Update store branding
export async function PUT(req) {
  try {
    const user = await verifySession(req);
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Get current store
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

    // Parse current branding
    const currentBranding = typeof store.branding === 'string' 
      ? JSON.parse(store.branding) 
      : store.branding || {};

    // Parse form data
    const formData = await req.formData();
    const primaryColor = formData.get('primaryColor');
    const secondaryColor = formData.get('secondaryColor');
    const logoFile = formData.get('logo');
    const bannerFile = formData.get('banner');

    const updatedBranding = {
      ...currentBranding,
      primaryColor: primaryColor || currentBranding.primaryColor,
      secondaryColor: secondaryColor || currentBranding.secondaryColor
    };

    // Handle logo upload
    if (logoFile && logoFile.size > 0) {
      try {
        const { buffer, contentType } = await validateImageFile(logoFile);

        // Delete old logo if exists
        if (currentBranding.logo) {
          try {
            const oldKey = extractKeyFromUrl(currentBranding.logo);
            if (oldKey) {
              await deleteFromR2(oldKey);
            }
          } catch (deleteError) {
            console.warn('Failed to delete old logo:', deleteError);
          }
        }

        // Upload new logo
        const logoKey = generateFileKey(user.id, `logo-${logoFile.name}`);
        const logoUrl = await uploadToR2(buffer, logoKey, contentType);
        updatedBranding.logo = logoUrl;
        
      } catch (uploadError) {
        return NextResponse.json(
          { success: false, message: `Logo upload failed: ${uploadError.message}` },
          { status: 400 }
        );
      }
    }

    // Handle banner upload
    if (bannerFile && bannerFile.size > 0) {
      try {
        const { buffer, contentType } = await validateImageFile(bannerFile);

        // Delete old banner if exists
        if (currentBranding.banner) {
          try {
            const oldKey = extractKeyFromUrl(currentBranding.banner);
            if (oldKey) {
              await deleteFromR2(oldKey);
            }
          } catch (deleteError) {
            console.warn('Failed to delete old banner:', deleteError);
          }
        }

        // Upload new banner
        const bannerKey = generateFileKey(user.id, `banner-${bannerFile.name}`);
        const bannerUrl = await uploadToR2(buffer, bannerKey, contentType);
        updatedBranding.banner = bannerUrl;
        
      } catch (uploadError) {
        return NextResponse.json(
          { success: false, message: `Banner upload failed: ${uploadError.message}` },
          { status: 400 }
        );
      }
    }

    // Update store
    const { data: updatedStore, error: updateError } = await supabaseAdmin
      .from('stores')
      .update({
        branding: updatedBranding,
        updated_at: new Date().toISOString()
      })
      .eq('owner_id', user.id)
      .eq('is_active', true)
      .select()
      .single();

    if (updateError) {
      console.error('Store branding update error:', updateError);
      return NextResponse.json(
        { success: false, message: 'Failed to update branding' },
        { status: 500 }
      );
    }

    await invalidateStorefrontCache(updatedStore.store_slug);

    return NextResponse.json({
      success: true,
      message: 'Store branding updated successfully',
      data: transformStore(updatedStore)
    });

  } catch (error) {
    console.error('Store branding update error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
