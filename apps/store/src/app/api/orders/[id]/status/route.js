import { NextResponse } from "next/server";
import { verifyCustomerSession } from "@/lib/supabaseAuth";
import { updateOrderStatus, transformOrderFields } from "@/lib/supabaseOrders";

export async function PATCH(request, { params }) {
  try {
    const customerId = await verifyCustomerSession(request);
    if (!customerId) {
      return NextResponse.json(
        { success: false, message: "Authentication required" },
        { status: 401 }
      );
    }

    const { id } = await params;
    const { status } = await request.json();

    // Validate status
    const allowedStatuses = ['cancelled'];
    if (!allowedStatuses.includes(status)) {
      return NextResponse.json(
        { success: false, message: "Invalid status. Customers can only cancel orders." },
        { status: 400 }
      );
    }

    // Update order status using Supabase
    const rawOrder = await updateOrderStatus(id, status, customerId);

    if (!rawOrder) {
      return NextResponse.json(
        { success: false, message: "Order not found or already processed" },
        { status: 404 }
      );
    }

    // Transform order to camelCase
    const order = transformOrderFields(rawOrder);

    return NextResponse.json({
      success: true,
      message: "Order status updated successfully",
      order
    });
  } catch (error) {
    console.error("Error updating order status:", error);
    return NextResponse.json(
      { success: false, message: "Failed to update order status" },
      { status: 500 }
    );
  }
}
