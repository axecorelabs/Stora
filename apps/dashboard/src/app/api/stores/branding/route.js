import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifySession } from '@/lib/auth';
import { uploadToWasabi, generateFileKey, validateImageFile, deleteFromWasabi } from '@/lib/wasabi';

// Helper to transform store data for response
function transformStore(store) {
  if (!store) return null;
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
    website: typeof store.website === 'string' ? JSON.parse(store.website) : store.website,
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
        validateImageFile(logoFile);
        
        // Delete old logo if exists
        if (currentBranding.logo) {
          try {
            const oldKey = currentBranding.logo.split('.com/')[1];
            if (oldKey) {
              await deleteFromWasabi(oldKey);
            }
          } catch (deleteError) {
            console.warn('Failed to delete old logo:', deleteError);
          }
        }
        
        // Upload new logo
        const logoKey = generateFileKey(user.id, `logo-${logoFile.name}`);
        const logoUrl = await uploadToWasabi(logoFile, logoKey);
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
        validateImageFile(bannerFile);
        
        // Delete old banner if exists
        if (currentBranding.banner) {
          try {
            const oldKey = currentBranding.banner.split('.com/')[1];
            if (oldKey) {
              await deleteFromWasabi(oldKey);
            }
          } catch (deleteError) {
            console.warn('Failed to delete old banner:', deleteError);
          }
        }
        
        // Upload new banner
        const bannerKey = generateFileKey(user.id, `banner-${bannerFile.name}`);
        const bannerUrl = await uploadToWasabi(bannerFile, bannerKey);
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
