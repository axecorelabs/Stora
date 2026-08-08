import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(request, { params }) {
  try {
    const { websitePath } = await params;
    const body = await request.json();
    const { views = 1, isOrder = false } = body;

    // Find store
    const { data: store, error: findError } = await supabaseAdmin
      .from('stores')
      .select('id, total_orders')
      .eq('store_slug', websitePath)
      .eq('is_active', true)
      .single();

    if (findError || !store) {
      return NextResponse.json(
        { success: false, message: "Store not found" },
        { status: 404 }
      );
    }

    // Build update object
    const updates = {
      updated_at: new Date().toISOString()
    };

    if (isOrder) {
      updates.total_orders = (store.total_orders || 0) + 1;
    }

    // Update store metrics
    const { error: updateError } = await supabaseAdmin
      .from('stores')
      .update(updates)
      .eq('id', store.id);

    if (updateError) {
      console.error('Error updating metrics:', updateError);
      return NextResponse.json(
        { success: false, message: "Failed to update metrics" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Metrics updated successfully"
    });

  } catch (error) {
    console.error("Error updating store metrics:", error);
    return NextResponse.json(
      { success: false, message: "Failed to update metrics" },
      { status: 500 }
    );
  }
}
