import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifySession } from '@/lib/auth';

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
    websiteUrl: websitePath ? `${storeBaseUrl}/${websitePath}` : null,
    websiteFullPath: websitePath ? `${storeBaseUrl.replace(/^https?:\/\//, '')}/${websitePath}` : null,
    createdAt: store.created_at,
    updatedAt: store.updated_at
  };
}

// GET - Get user's store
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

    return NextResponse.json({
      success: true,
      data: transformStore(store),
      hasStore: !!store
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
        { success: false, message: 'You already have a store' },
        { status: 409 }
      );
    }

    const storeData = await req.json();

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
        store_type: storeData.storeType || 'online',
        store_phone: storeData.storePhone || '',
        store_email: storeData.storeEmail || user.email,
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
          { success: false, message: 'You already have a store' },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { success: false, message: 'Failed to create store' },
        { status: 500 }
      );
    }

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

    // Build update object with snake_case keys
    const dbUpdate = {};
    if (updateData.storeName) dbUpdate.store_name = updateData.storeName;
    if (updateData.storeDescription !== undefined) dbUpdate.store_description = updateData.storeDescription;
    if (updateData.storeType) dbUpdate.store_type = updateData.storeType;
    if (updateData.storePhone) dbUpdate.store_phone = updateData.storePhone;
    if (updateData.storeEmail) dbUpdate.store_email = updateData.storeEmail;
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

    return NextResponse.json({
      success: true,
      message: 'Store updated successfully',
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
