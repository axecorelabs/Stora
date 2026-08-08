import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifySession } from '@/lib/auth';

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
    ivmaWebsite: typeof store.ivma_website === 'string' ? JSON.parse(store.ivma_website) : store.ivma_website,
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

    // Merge ivmaWebsite settings
    const currentIvmaWebsite = typeof store.ivma_website === 'string' 
      ? JSON.parse(store.ivma_website) 
      : store.ivma_website || {};
    
    // Build the update - merge nested ivmaWebsite fields
    const dbUpdate = {
      updated_at: new Date().toISOString()
    };

    // Handle ivmaWebsite nested updates
    if (updateData.ivmaWebsite || updateData['ivmaWebsite.seoSettings'] || updateData['ivmaWebsite.customization'] || updateData['ivmaWebsite.settings']) {
      const updatedIvmaWebsite = { ...currentIvmaWebsite };
      
      if (updateData.ivmaWebsite) {
        Object.assign(updatedIvmaWebsite, updateData.ivmaWebsite);
      }
      if (updateData['ivmaWebsite.seoSettings']) {
        updatedIvmaWebsite.seoSettings = { ...updatedIvmaWebsite.seoSettings, ...updateData['ivmaWebsite.seoSettings'] };
      }
      if (updateData['ivmaWebsite.customization']) {
        updatedIvmaWebsite.customization = { ...updatedIvmaWebsite.customization, ...updateData['ivmaWebsite.customization'] };
      }
      if (updateData['ivmaWebsite.settings']) {
        updatedIvmaWebsite.settings = { ...updatedIvmaWebsite.settings, ...updateData['ivmaWebsite.settings'] };
      }
      
      dbUpdate.ivma_website = updatedIvmaWebsite;
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
