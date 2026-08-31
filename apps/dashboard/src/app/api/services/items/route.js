import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { supabaseAdmin } from '@/lib/supabase';
import { verifySession } from '@/lib/auth';
import { uploadToR2, generateFileKey, validateImageFile } from '@/lib/r2';
import { loadServiceDocument } from '@/lib/services';

export async function POST(request) {
  try {
    const user = await verifySession(request);
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Not authenticated' },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const serviceItemData = JSON.parse(formData.get('serviceItem'));

    const { data: userStore } = await supabaseAdmin
      .from('stores')
      .select('id')
      .eq('owner_id', user.id)
      .eq('is_active', true)
      .single();

    if (!userStore) {
      return NextResponse.json(
        { success: false, error: 'Please create a store first before adding services', needsStore: true },
        { status: 400 }
      );
    }

    // Handle portfolio image uploads
    const portfolioUrls = [];
    const portfolioFiles = formData.getAll('portfolioImages');

    for (const file of portfolioFiles) {
      if (file && file.size > 0) {
        try {
          const { buffer, contentType } = await validateImageFile(file);
          const fileKey = generateFileKey(user.id.toString());
          const imageUrl = await uploadToR2(buffer, fileKey, contentType);
          portfolioUrls.push(imageUrl);
        } catch (error) {
          console.error('Error uploading portfolio image:', error);
          // Continue with other images even if one fails
        }
      }
    }

    // Find or create the services parent row for this store
    let { data: service } = await supabaseAdmin
      .from('services')
      .select('*')
      .eq('store_id', userStore.id)
      .maybeSingle();

    if (!service) {
      const { data: created, error } = await supabaseAdmin
        .from('services')
        .insert({
          id: crypto.randomUUID(),
          store_id: userStore.id,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();
      if (error) throw error;
      service = created;
    }

    const itemId = crypto.randomUUID();
    const { error: itemError } = await supabaseAdmin.from('service_items').insert({
      id: itemId,
      service_id: service.id,
      name: serviceItemData.name,
      description: serviceItemData.description || null,
      category: serviceItemData.category || null,
      sub_category: serviceItemData.subCategory || null,
      price: serviceItemData.price || 0,
      duration: serviceItemData.duration || null,
      duration_unit: serviceItemData.durationUnit || 'minutes',
      years_of_experience: serviceItemData.yearsOfExperience || null,
      home_service_available: !!serviceItemData.homeServiceAvailable,
      discount: serviceItemData.discount || 0,
      time_slot_duration: serviceItemData.timeSlotDuration || null,
      max_bookings_per_day: serviceItemData.maxBookingsPerDay || null,
      portfolio_images: portfolioUrls,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
    if (itemError) throw itemError;

    if (Array.isArray(serviceItemData.availability) && serviceItemData.availability.length > 0) {
      await supabaseAdmin.from('service_availability').insert(
        serviceItemData.availability.map(a => ({
          id: crypto.randomUUID(),
          service_item_id: itemId,
          day_of_week: a.day,
          is_available: !!a.isAvailable,
          opening_time: a.openingTime || null,
          closing_time: a.closingTime || null
        }))
      );
    }

    const locations = serviceItemData.serviceLocations;
    if (locations) {
      const rows = (locations.states || []).map(st => ({
        id: crypto.randomUUID(),
        service_item_id: itemId,
        cover_all_nigeria: !!locations.coverAllNigeria,
        state: st.state,
        cover_all_cities: !!st.coverAllCities,
        cities: st.cities || []
      }));
      if (locations.coverAllNigeria && rows.length === 0) {
        rows.push({ id: crypto.randomUUID(), service_item_id: itemId, cover_all_nigeria: true, state: null, cover_all_cities: false, cities: [] });
      }
      if (rows.length > 0) {
        await supabaseAdmin.from('service_locations').insert(rows);
      }
    }

    if (Array.isArray(serviceItemData.addOns) && serviceItemData.addOns.length > 0) {
      await supabaseAdmin.from('service_addons').insert(
        serviceItemData.addOns.map(a => ({
          id: crypto.randomUUID(),
          service_item_id: itemId,
          name: a.name,
          price: a.price || 0
        }))
      );
    }

    const serviceDoc = await loadServiceDocument(userStore.id);

    return NextResponse.json({
      success: true,
      data: serviceDoc
    }, { status: 201 });
  } catch (error) {
    console.error('Error adding service item:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to add service' },
      { status: 500 }
    );
  }
}
