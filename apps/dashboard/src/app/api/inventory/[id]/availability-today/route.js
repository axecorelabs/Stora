import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireCommerceApiAccess } from '@/lib/storeAccess';

// PUT - Toggle a Food/menu item's "unavailable today" flag from the quick
// row-detail view (Catalogue table, desktop expand + mobile modal), without
// opening the full Edit Product form. category_details is read first and
// only its `food` key is touched -- sending the two changed fields through
// the general PUT /api/inventory/[id] route would instead replace the
// whole category_details.food object (see that route's own comment),
// wiping foodType/servingSize/extras/ingredients/etc.
export async function PUT(req, { params }) {
  try {
    const access = await requireCommerceApiAccess(req);
    if (!access.ok) {
      return access.response;
    }
    const { user } = access;

    const { id } = await params;
    const { unavailableToday } = await req.json();

    if (typeof unavailableToday !== 'boolean') {
      return NextResponse.json(
        { success: false, message: 'unavailableToday must be a boolean value' },
        { status: 400 }
      );
    }

    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('inventory')
      .select('id, category, category_details')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json(
        { success: false, message: 'Inventory item not found' },
        { status: 404 }
      );
    }

    if (existing.category !== 'Food') {
      return NextResponse.json(
        { success: false, message: 'This flag only applies to Food/menu items' },
        { status: 400 }
      );
    }

    const unavailableMarkedAt = unavailableToday ? new Date().toISOString() : null;
    const nextCategoryDetails = {
      ...(existing.category_details || {}),
      food: {
        ...(existing.category_details?.food || {}),
        unavailableToday,
        unavailableMarkedAt
      }
    };

    const { data: item, error } = await supabaseAdmin
      .from('inventory')
      .update({
        category_details: nextCategoryDetails,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error || !item) {
      return NextResponse.json(
        { success: false, message: 'Failed to update availability' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: unavailableToday ? 'Marked unavailable for today' : 'Marked available again',
      data: {
        id: item.id,
        _id: item.id,
        categoryDetails: item.category_details
      }
    });

  } catch (error) {
    console.error('Availability-today update error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
