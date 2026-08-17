import { NextResponse } from "next/server";
import { recordStoreView, recordProductView, isThrottled } from "@/lib/analytics";

// Public, unauthenticated, fire-and-forget -- called via
// navigator.sendBeacon from ViewBeacon.js on every real pageview. Has to
// be a client-triggered beacon rather than counted in the server
// component itself: [slug]/page.js and product/[id]/page.js are ISR
// (revalidate: 300/30), so the server component only re-runs when Next
// regenerates the cached page, not on every real visitor -- counting
// there would undercount by however long the revalidate window is.
export async function POST(request) {
  try {
    const body = await request.json();
    const { type, storeId, productId } = body;

    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      || request.headers.get("x-real-ip")
      || "unknown";

    if (type === "store" && storeId) {
      if (!(await isThrottled(ip, "store", storeId))) {
        await recordStoreView(storeId);
      }
    } else if (type === "product" && productId) {
      if (!(await isThrottled(ip, "product", productId))) {
        await recordProductView(productId);
      }
    }

    // sendBeacon doesn't read the response, but a plain fetch fallback
    // (see ViewBeacon.js) does -- always 200, a dropped/throttled view is
    // never worth surfacing as an error to the caller.
    return NextResponse.json({ success: true });
  } catch (error) {
    console.warn("Error recording view:", error.message);
    return NextResponse.json({ success: true });
  }
}
