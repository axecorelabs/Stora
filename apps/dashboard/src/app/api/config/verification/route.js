import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/auth';

// A pure feature flag, not tied to any store -- checked from three
// separate places (Settings' Verification tab, SetupChecklist, the
// onboarding wizard's verification step) that each need to know whether
// to show verification at all before QOREID_CLIENT_ID/SECRET are
// configured, so vendors are never shown a form that can only fail.
// Self-updating: flip on the moment real keys are set, no separate
// toggle to remember to flip too.
export async function GET(req) {
  const user = await verifySession(req);
  if (!user) {
    return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 });
  }

  const enabled = Boolean(process.env.QOREID_CLIENT_ID && process.env.QOREID_CLIENT_SECRET);
  return NextResponse.json({ success: true, enabled });
}
