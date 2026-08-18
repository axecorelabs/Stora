import { NextResponse } from "next/server";
import { verifyCustomerSession, updateCustomer } from "@/lib/supabaseAuth";
import { isValidNigerianState } from "@stora/shared-constants";

// Backs DeliveryStateContext's cookie->profile sync -- called whenever a
// logged-in customer changes their delivery state, or once on login/signup
// to carry a guest-set state onto the account (see DeliveryStateContext's
// rules 3 and 4). `state: null` is a valid, deliberate "clear it" request,
// not an error -- distinct from an actively invalid string.
export async function PATCH(request) {
  try {
    const customerId = await verifyCustomerSession(request);
    if (!customerId) {
      return NextResponse.json({ success: false, message: "Not authenticated" }, { status: 401 });
    }

    const { state } = await request.json();
    if (state !== null && !isValidNigerianState(state)) {
      return NextResponse.json({ success: false, message: "Not a valid state" }, { status: 400 });
    }

    await updateCustomer(customerId, { preferred_state: state, updated_at: new Date().toISOString() });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating preferred state:", error);
    return NextResponse.json({ success: false, message: "Failed to update" }, { status: 500 });
  }
}
