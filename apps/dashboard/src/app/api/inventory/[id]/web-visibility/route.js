import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifySession } from '@/lib/auth';

// PUT - Update web visibility for specific inventory item
export async function PUT(req, { params }) {
  try {
    const user = await verifySession(req);
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Not authenticated' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const { webVisibility } = await req.json();

    // Validate and normalize the webVisibility value
    if (typeof webVisibility !== 'boolean') {
      return NextResponse.json(
        { success: false, message: 'webVisibility must be a boolean value' },
        { status: 400 }
      );
    }

    // Find and update the inventory item -- web_visibility (storefront display)
    // and is_active (whether the item is archived/deleted) are distinct columns;
    // this endpoint was writing to the wrong one.
    const { data: item, error } = await supabaseAdmin
      .from('inventory')
      .update({
        web_visibility: Boolean(webVisibility),
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error || !item) {
      return NextResponse.json(
        { success: false, message: 'Inventory item not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Product ${webVisibility ? 'shown on' : 'hidden from'} website`,
      data: {
        id: item.id,
        _id: item.id,
        name: item.name,
        productName: item.name,
        webVisibility: Boolean(item.web_visibility),
        isActive: item.is_active
      }
    });

  } catch (error) {
    console.error('Web visibility update error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
