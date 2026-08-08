import { NextResponse } from "next/server";
import { verifyCustomerSession, findCustomerById, sanitizeCustomer } from "@/lib/supabaseAuth";

export async function GET(request) {
  try {
    const customerId = await verifyCustomerSession(request);

    if (!customerId) {
      console.log('Auth check: No valid customer session');
      return NextResponse.json(
        { success: false, message: "Not authenticated" },
        { status: 401 }
      );
    }

    console.log('Auth check: Customer ID:', customerId);

    const customer = await findCustomerById(customerId);

    if (!customer) {
      console.log('Auth check: Customer not found');
      return NextResponse.json(
        { success: false, message: "Customer not found" },
        { status: 404 }
      );
    }

    console.log('Auth check: Customer found:', customer.email);

    return NextResponse.json({
      success: true,
      customer: sanitizeCustomer(customer)
    });
  } catch (error) {
    console.error("Error fetching customer:", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch customer data" },
      { status: 500 }
    );
  }
}
