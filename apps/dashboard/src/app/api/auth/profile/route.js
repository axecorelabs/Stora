import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifySession } from '@/lib/auth';

// Name confirmation, step 1 of the onboarding wizard -- Google sign-in
// populates first_name/last_name from Google's own profile claims (see
// google/callback/route.js), which can be a display name rather than a
// legal one. The NIN verification flow name-matches against exactly
// these columns, so this is the one place a vendor can correct them
// before that matters.
export async function PATCH(req) {
  try {
    const user = await verifySession(req);
    if (!user) {
      return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 });
    }

    const { firstName, lastName } = await req.json();
    if (!firstName?.trim() || !lastName?.trim()) {
      return NextResponse.json(
        { success: false, message: 'First and last name are required' },
        { status: 400 }
      );
    }

    const { data: updatedUser, error } = await supabaseAdmin
      .from('users')
      .update({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id)
      .select('id, first_name, last_name')
      .single();

    if (error) {
      console.error('Profile update error:', error);
      return NextResponse.json({ success: false, message: 'Failed to update name' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: { firstName: updatedUser.first_name, lastName: updatedUser.last_name }
    });
  } catch (error) {
    console.error('Profile update error:', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}
