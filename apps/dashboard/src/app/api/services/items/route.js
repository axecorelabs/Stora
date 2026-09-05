import { NextResponse, after } from 'next/server';
import crypto from 'crypto';
import { supabaseAdmin } from '@/lib/supabase';
import { verifySession } from '@/lib/auth';
import { uploadToR2, generateFileKey, validateImageFile } from '@/lib/r2';
import { loadServiceDocument } from '@/lib/services';
import { captureServerEvent } from '@/lib/posthog-server';

export const MAX_PORTFOLIO_IMAGES = 5;

// Fast client-side-shaped check before any R2 upload happens -- avoids
// uploading images for a request that's obviously going to be rejected.
// fn_write_service_item (see the migration) re-validates the same rules
// authoritatively inside the actual write transaction; this is a cheap
// early rejection, not the real guarantee.
export function validateServiceItemData(data) {
  const price = Number(data.price);
  if (!Number.isFinite(price) || price < 0) return { error: 'Price must be a non-negative number' };

  const duration = data.duration === undefined || data.duration === '' ? null : Number(data.duration);
  if (duration !== null && (!Number.isFinite(duration) || duration <= 0)) return { error: 'Duration must be greater than 0' };

  const maxBookingsPerDay = data.maxBookingsPerDay === undefined || data.maxBookingsPerDay === '' ? 10 : Number(data.maxBookingsPerDay);
  if (!Number.isFinite(maxBookingsPerDay) || maxBookingsPerDay <= 0) return { error: 'Max bookings per day must be greater than 0' };

  const yearsOfExperience = data.yearsOfExperience === undefined || data.yearsOfExperience === '' ? null : Number(data.yearsOfExperience);
  if (yearsOfExperience !== null && (!Number.isFinite(yearsOfExperience) || yearsOfExperience < 0)) return { error: 'Years of experience cannot be negative' };

  return { price, duration, maxBookingsPerDay, yearsOfExperience };
}

export async function uploadPortfolioImages(files, userId) {
  const urls = [];
  for (const file of files) {
    if (file && file.size > 0) {
      const { buffer, contentType } = await validateImageFile(file);
      const fileKey = generateFileKey(userId.toString());
      urls.push(await uploadToR2(buffer, fileKey, contentType));
    }
  }
  return urls;
}

// Single RPC call for the item + all 3 child tables -- fn_write_service_item
// (20260910000000) runs as one Postgres transaction, so any failure (a bad
// day_of_week, a constraint violation) rolls back everything the function
// did in this call automatically. Replaces the earlier approach of 4
// separate JS-side writes with app-level "delete the item if a child insert
// fails" cleanup, which covered create but never fully covered edit (a
// failed re-insert after the old child rows were already deleted had no way
// back). p_item_id is null for create, the target id for edit.
export async function writeServiceItem({ itemId, serviceId, data, validated, portfolioImages }) {
  const { data: resultItemId, error } = await supabaseAdmin.rpc('fn_write_service_item', {
    p_item_id: itemId || null,
    p_service_id: serviceId,
    p_name: data.name,
    p_description: data.description || null,
    p_category: data.category || null,
    p_sub_category: data.subCategory || null,
    p_price: validated.price,
    p_duration: validated.duration,
    p_duration_unit: data.durationUnit || 'minutes',
    p_years_of_experience: validated.yearsOfExperience,
    p_home_service_available: !!data.homeServiceAvailable,
    p_time_slot_duration: data.timeSlotDuration || null,
    p_max_bookings_per_day: validated.maxBookingsPerDay,
    p_portfolio_images: portfolioImages,
    p_availability: data.availability || [],
    p_locations: data.serviceLocations || { coverAllNigeria: false, states: [] },
    p_add_ons: (data.addOns || []).filter(a => a.name?.trim())
  });

  return { itemId: resultItemId, error };
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

    const formData = await request.formData();
    const serviceItemData = JSON.parse(formData.get('serviceItem'));

    const validated = validateServiceItemData(serviceItemData);
    if (validated.error) {
      return NextResponse.json({ success: false, error: validated.error }, { status: 400 });
    }

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

    const portfolioFiles = formData.getAll('portfolioImages').slice(0, MAX_PORTFOLIO_IMAGES);
    let portfolioUrls;
    try {
      portfolioUrls = await uploadPortfolioImages(portfolioFiles, user.id);
    } catch (error) {
      console.error('Error uploading portfolio image:', error);
      return NextResponse.json({ success: false, error: 'Could not upload one or more images. Please try again.' }, { status: 500 });
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

    const { error: writeError } = await writeServiceItem({
      itemId: null,
      serviceId: service.id,
      data: serviceItemData,
      validated,
      portfolioImages: portfolioUrls
    });

    if (writeError) {
      console.error('Error writing service item:', writeError);
      return NextResponse.json(
        { success: false, error: writeError.message || 'Could not save this service. Please try again.' },
        { status: 400 }
      );
    }

    const serviceDoc = await loadServiceDocument(userStore.id);
    after(() => captureServerEvent(user.id, 'service_created', { store_id: userStore.id }));

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
