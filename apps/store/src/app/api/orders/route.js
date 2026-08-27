import { NextResponse } from "next/server";
import { verifyCustomerSession } from "@/lib/supabaseAuth";
import { findOrdersByCustomerId, getOrderStats, transformOrderFields } from "@/lib/supabaseOrders";

export async function GET(request) {
  try {
    const customerId = await verifyCustomerSession(request);
    if (!customerId) {
      return NextResponse.json(
        { success: false, message: "Authentication required" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page')) || 1;
    const limit = parseInt(searchParams.get('limit')) || 10;

    // Handle multiple status filters
    const statusParams = searchParams.getAll('status');
    console.log('Status params received:', statusParams);

    // Fetch orders using Supabase
    const { orders: rawOrders, totalCount } = await findOrdersByCustomerId(customerId, {
      page,
      limit,
      statuses: statusParams.length > 0 ? statusParams : []
    });

    // Transform orders to camelCase
    const orders = rawOrders.map(transformOrderFields);

    console.log(`Found ${orders.length} orders for customer ${customerId}`);

    // Get order statistics
    const stats = await getOrderStats(customerId);

    // Calculate pagination info
    const totalPages = Math.ceil(totalCount / limit);
    const pagination = {
      currentPage: page,
      totalPages,
      totalItems: totalCount,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1
    };

    return NextResponse.json({
      success: true,
      orders,
      stats,
      pagination
    });
  } catch (error) {
    console.error("Error fetching orders:", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch orders" },
      { status: 500 }
    );
  }
}
