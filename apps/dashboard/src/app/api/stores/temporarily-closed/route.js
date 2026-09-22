import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifySession } from '@/lib/auth';

// PATCH -- manual "closed right now" override, separate from the weekly
// business_hours schedule (see isStoreOpenNow in @stora/shared-constants).
// Covers a vendor closing unexpectedly (ran out of food, emergency) that
// the recurring schedule alone can't represent. No prerequisite gating,
// same as restaurant-mode's own toggle -- this has no dependency on any
// other setup step.
export async function PATCH(req) {
  try {
    const user = await verifySession(req);
    if (!user) {
      return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 });
    }

    const { temporarilyClosed } = await req.json().catch(() => ({}));
    if (typeof temporarilyClosed !== 'boolean') {
      return NextResponse.json(
        { success: false, message: 'temporarilyClosed must be a boolean' },
        { status: 400 }
      );
    }

    const { data: updatedStore, error } = await supabaseAdmin
      .from('stores')
      .update({ temporarily_closed: temporarilyClosed, updated_at: new Date().toISOString() })
      .eq('owner_id', user.id)
      .select('temporarily_closed')
      .single();

    if (error || !updatedStore) {
      console.error('Error updating temporarily closed status:', error);
      return NextResponse.json({ success: false, message: 'Store not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: temporarilyClosed ? 'Store marked temporarily closed' : 'Store reopened',
      data: { temporarilyClosed: updatedStore.temporarily_closed }
    });
  } catch (error) {
    console.error('Temporarily closed update error:', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}
