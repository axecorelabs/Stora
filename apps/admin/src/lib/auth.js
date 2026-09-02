import { supabaseAdmin } from './supabase';
import { auth } from './betterAuth';

// Mirrors apps/dashboard's verifySession() shape (id/name/email/isActive),
// minus any role check -- there's nothing to check. Every row in
// admin_users is staff by construction (no public signup, no vendor
// accounts in this table at all), so a valid session on THIS app already
// is the admin gate.
export async function verifySession(req) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session?.user?.id) return null;

    const { data: user, error } = await supabaseAdmin
      .from('admin_users')
      .select('id, name, email, is_active')
      .eq('id', session.user.id)
      .eq('is_active', true)
      .single();

    if (error || !user) return null;

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      isActive: user.is_active
    };
  } catch (error) {
    console.error('Session verification error:', error);
    return null;
  }
}

export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
