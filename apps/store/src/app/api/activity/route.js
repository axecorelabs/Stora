import { NextResponse } from "next/server";
import { findRecentActivity } from "@/lib/supabaseActivity";
import { cached, cacheKey } from "@/lib/redis";

// Public, unauthenticated -- backs the homepage's "Live on Stora" feed,
// which every open tab polls every 60s (see LiveActivityFeed's REFRESH_MS).
// A 45s cache means most of those polls -- across every visitor, not just
// one -- are served without touching Postgres at all, while the feed still
// reads as "live" rather than visibly stale.
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const limitParam = parseInt(searchParams.get("limit"), 10);
    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 20) : 8;

    const activity = await cached(cacheKey.activity(limit), 45, () => findRecentActivity({ limit }));

    return NextResponse.json({ success: true, activity });
  } catch (error) {
    console.error("Error fetching recent activity:", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch activity" },
      { status: 500 }
    );
  }
}
