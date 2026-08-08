import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { supabaseAdmin } from '@/lib/supabase';
import { verifySession } from '@/lib/auth';
import { loadServiceDocument } from '@/lib/services';

export async function GET(request) {
  try {
    const user = await verifySession(request);
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Not authenticated' },
        { status: 401 }
      );
    }

    const { data: store } = await supabaseAdmin
      .from('stores')
      .select('id')
      .eq('owner_id', user.id)
      .single();

    if (!store) {
      return NextResponse.json({ success: true, data: null });
    }

    const serviceDoc = await loadServiceDocument(store.id);

    return NextResponse.json({
      success: true,
      data: serviceDoc // single service object or null, matching prior behavior
    });
  } catch (error) {
    console.error('Error fetching services:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch services' },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const user = await verifySession(request);
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Not authenticated' },
        { status: 401 }
      );
    }

    const data = await request.json();

    if (data.portfolioImages && data.portfolioImages.length > 10) {
      return NextResponse.json(
        { error: 'Maximum 10 portfolio images allowed' },
        { status: 400 }
      );
    }

    const { data: store } = await supabaseAdmin
      .from('stores')
      .select('id')
      .eq('owner_id', user.id)
      .single();

    if (!store) {
      return NextResponse.json(
        { error: 'Please create a store first before adding services', needsStore: true },
        { status: 400 }
      );
    }

    let { data: service } = await supabaseAdmin
      .from('services')
      .select('*')
      .eq('store_id', store.id)
      .maybeSingle();

    if (!service) {
      const { data: created, error } = await supabaseAdmin
        .from('services')
        .insert({ id: crypto.randomUUID(), store_id: store.id, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .select()
        .single();
      if (error) throw error;
      service = created;
    }

    for (const item of (data.services || [data])) {
      const itemId = crypto.randomUUID();
      await supabaseAdmin.from('service_items').insert({
        id: itemId,
        service_id: service.id,
        name: item.name,
        description: item.description || null,
        category: item.category || null,
        sub_category: item.subCategory || null,
        price: item.price || 0,
        duration: item.duration || null,
        duration_unit: item.durationUnit || 'minutes',
        years_of_experience: item.yearsOfExperience || null,
        home_service_available: !!item.homeServiceAvailable,
        discount: item.discount || 0,
        time_slot_duration: item.timeSlotDuration || null,
        max_bookings_per_day: item.maxBookingsPerDay || null,
        portfolio_images: item.portfolioImages || [],
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    }

    const serviceDoc = await loadServiceDocument(store.id);

    return NextResponse.json({ success: true, data: serviceDoc }, { status: 201 });
  } catch (error) {
    console.error('Error creating service:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create service' },
      { status: 500 }
    );
  }
}
