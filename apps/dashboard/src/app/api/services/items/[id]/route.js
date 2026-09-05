import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifySession } from '@/lib/auth';
import { loadServiceDocument } from '@/lib/services';
import { validateServiceItemData, uploadPortfolioImages, writeServiceItem, MAX_PORTFOLIO_IMAGES } from '../route';

// Neither PATCH nor DELETE existed for a specific service item before this
// -- services/page.js rendered "Edit"/delete affordances that did nothing.
// Ownership is scoped through services.store_id (service_items itself has
// no store_id/user_id column), matching this store's own owner_id -- the
// same two-hop scoping loadServiceDocument/items/route.js already use for
// every other services query, just enforced here as a WHERE clause rather
// than trusted from the client.
async function resolveOwnedItem(itemId, userId) {
  const { data: store } = await supabaseAdmin
    .from('stores')
    .select('id')
    .eq('owner_id', userId)
    .eq('is_active', true)
    .single();
  if (!store) return { error: NextResponse.json({ success: false, error: 'Store not found' }, { status: 404 }) };

  const { data: service } = await supabaseAdmin
    .from('services')
    .select('id')
    .eq('store_id', store.id)
    .single();
  if (!service) return { error: NextResponse.json({ success: false, error: 'Service not found' }, { status: 404 }) };

  const { data: item } = await supabaseAdmin
    .from('service_items')
    .select('id, portfolio_images')
    .eq('id', itemId)
    .eq('service_id', service.id)
    .single();
  if (!item) return { error: NextResponse.json({ success: false, error: 'Service not found' }, { status: 404 }) };

  return { store, service, item };
}

export async function PATCH(request, { params }) {
  try {
    const user = await verifySession(request);
    if (!user) {
      return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 });
    }

    const { id } = await params;
    const { store, service, error } = await resolveOwnedItem(id, user.id);
    if (error) return error;

    const formData = await request.formData();
    const serviceItemData = JSON.parse(formData.get('serviceItem'));
    // URLs the vendor kept from what was already uploaded -- distinct from
    // new files below, since re-uploading an unchanged portfolio image on
    // every edit would be wasteful and would orphan the original in R2.
    const keptImageUrls = JSON.parse(formData.get('existingPortfolioImages') || '[]');

    const validated = validateServiceItemData(serviceItemData);
    if (validated.error) {
      return NextResponse.json({ success: false, error: validated.error }, { status: 400 });
    }

    const newFiles = formData.getAll('portfolioImages')
      .slice(0, Math.max(0, MAX_PORTFOLIO_IMAGES - keptImageUrls.length));
    let newUrls;
    try {
      newUrls = await uploadPortfolioImages(newFiles, user.id);
    } catch (uploadError) {
      console.error('Error uploading portfolio image:', uploadError);
      return NextResponse.json({ success: false, error: 'Could not upload one or more images. Please try again.' }, { status: 500 });
    }

    // fn_write_service_item (see 20260910000000) runs the item update and
    // the full delete-then-reinsert of availability/locations/addons as one
    // Postgres transaction -- if anything inside fails, none of it commits,
    // including the deletes. The prior app-level version deleted the old
    // child rows via separate JS calls before re-inserting, with no way to
    // put them back if the re-insert failed.
    const { error: writeError } = await writeServiceItem({
      itemId: id,
      serviceId: service.id,
      data: serviceItemData,
      validated,
      portfolioImages: [...keptImageUrls, ...newUrls]
    });

    if (writeError) {
      console.error('Error updating service item:', writeError);
      return NextResponse.json(
        { success: false, error: writeError.message || 'Could not save your changes. Please try again.' },
        { status: 400 }
      );
    }

    const serviceDoc = await loadServiceDocument(store.id);
    return NextResponse.json({ success: true, data: serviceDoc });
  } catch (error) {
    console.error('Error updating service item:', error);
    return NextResponse.json({ success: false, error: error.message || 'Failed to update service' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const user = await verifySession(request);
    if (!user) {
      return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 });
    }

    const { id } = await params;
    const { store, error } = await resolveOwnedItem(id, user.id);
    if (error) return error;

    // ON DELETE CASCADE on service_availability/service_locations/
    // service_addons (see 20260717000000_initial_schema.sql) handles
    // cleanup of all three child tables -- no manual cascade needed here.
    const { error: deleteError } = await supabaseAdmin.from('service_items').delete().eq('id', id);
    if (deleteError) throw deleteError;

    const serviceDoc = await loadServiceDocument(store.id);
    return NextResponse.json({ success: true, data: serviceDoc });
  } catch (error) {
    console.error('Error deleting service item:', error);
    return NextResponse.json({ success: false, error: error.message || 'Failed to delete service' }, { status: 500 });
  }
}
