import { NextResponse } from "next/server";
import { findStoreByWebsitePath, buildPublicStoreData } from "@/lib/supabaseStore";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(request, { params }) {
  try {
    const { websitePath } = await params;

    console.log('Fetching public store data for path:', websitePath);

    // Find store by website path
    const store = await findStoreByWebsitePath(websitePath);

    if (!store) {
      console.log('Store not found for path:', websitePath);
      return NextResponse.json(
        { success: false, message: "Store not found or not active" },
        { status: 404 }
      );
    }

    // console.log('Store found:', store.store_name);

    // Update website metrics (view count) - non-blocking
    try {
      await supabaseAdmin
        .from('stores')
        .update({ 
          updated_at: new Date().toISOString()
        })
        .eq('id', store.id);
    } catch (metricsError) {
      console.log('Failed to update metrics, but continuing:', metricsError.message);
    }

    // Build public store data
    const publicStore = buildPublicStoreData(store);

    return NextResponse.json({
      success: true,
      store: publicStore
    });

  } catch (error) {
    console.error("Error fetching public store data:", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch store data" },
      { status: 500 }
    );
  }
}
