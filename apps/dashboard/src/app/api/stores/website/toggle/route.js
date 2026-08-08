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
    website: typeof store.website === 'string' ? JSON.parse(store.website) : store.website,
    createdAt: store.created_at,
    updatedAt: store.updated_at
  };
}

// PUT - Toggle website status
export async function PUT(req) {
  try {
    const user = await verifySession(req);
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Not authenticated' },
        { status: 401 }
      );
    }

    const { status } = await req.json();
    
    // Validate status
    const validStatuses = ['active', 'inactive', 'pending', 'suspended', 'maintenance', 'archived'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { success: false, message: 'Invalid status' },
        { status: 400 }
      );
    }

    // Find the store
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

    // Parse current website
    const currentWebsite = typeof store.website === 'string' 
      ? JSON.parse(store.website) 
      : store.website || {};

    // Generate website path if activating and doesn't exist
    let websitePath = currentWebsite.websitePath;
    if (status === 'active' && !websitePath) {
      let basePath = store.store_name
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .substring(0, 30);
      
      if (basePath.length < 3) {
        basePath = `store-${basePath}`;
      }
      
      websitePath = basePath;
      let counter = 1;
      
      // Check if path is available
      while (true) {
        const { data: existingStore } = await supabaseAdmin
          .from('stores')
          .select('id')
          .neq('id', store.id)
          .contains('website', { websitePath })
          .single();
        
        if (!existingStore) break;
        
        websitePath = `${basePath}-${counter}`;
        counter++;
        
        if (counter > 100) {
          websitePath = `${basePath}-${Date.now()}`;
          break;
        }
      }
    }

    // Build updated website
    const updatedWebsite = {
      ...currentWebsite,
      status,
      isEnabled: status === 'active',
      websitePath
    };

    if (status === 'active') {
      updatedWebsite.activatedAt = new Date().toISOString();
      updatedWebsite.lastPublishedAt = new Date().toISOString();
    } else if (status === 'suspended') {
      updatedWebsite.suspendedAt = new Date().toISOString();
    }

    // Update the store
    const { data: updatedStore, error: updateError } = await supabaseAdmin
      .from('stores')
      .update({
        website: updatedWebsite,
        updated_at: new Date().toISOString()
      })
      .eq('owner_id', user.id)
      .eq('is_active', true)
      .select()
      .single();

    if (updateError) {
      console.error('Website toggle error:', updateError);
      return NextResponse.json(
        { success: false, message: 'Failed to toggle website status' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Website ${status === 'active' ? 'activated' : 'deactivated'} successfully`,
      data: transformStore(updatedStore)
    });

  } catch (error) {
    console.error('Website toggle error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
