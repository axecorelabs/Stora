import { supabaseAdmin } from './supabase';
import { auth } from './betterAuth';

// Session verification is the one thing every other part of this app
// still needs from this module -- inventory, orders, payments, stores,
// etc. (48 call sites) all call this to find out who's asking, expecting
// the exact {id, firstName, lastName, email, role, isActive} shape this
// always returned. Better Auth's own getSession() only knows about the
// fields mapped in betterAuth.js (name/email/emailVerified/image) -- not
// firstName/lastName/role/isActive, which aren't part of its user model
// at all -- so this wrapper re-fetches the real row to reconstruct the
// same shape every caller already expects, the same way this function
// always queried `sessions` joined to `users` directly.
//
// Everything else this module used to own (hashPassword/verifyPassword,
// createSession, deleteSession, invalidateSessions,
// getSessionIdFromRequest) has no remaining callers now that
// apps/dashboard/src/app/api/auth/* and google/* call auth.api.* directly
// -- deleted rather than kept as unused exports.
export async function verifySession(req) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session?.user?.id) return null;

    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('id, first_name, last_name, email, role, is_active')
      .eq('id', session.user.id)
      .eq('is_active', true)
      .single();

    if (error || !user) return null;

    return {
      id: user.id,
      firstName: user.first_name,
      lastName: user.last_name,
      email: user.email,
      role: user.role,
      isActive: user.is_active
    };
  } catch (error) {
    console.error('Session verification error:', error);
    return null;
  }
}

// Validate email format
export function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Validate password strength
export function validatePassword(password) {
  const minLength = 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasNonalphas = /\W/.test(password);

  return {
    isValid: password.length >= minLength && hasUpperCase && hasLowerCase && hasNumbers && hasNonalphas,
    checks: {
      length: password.length >= minLength,
      upperCase: hasUpperCase,
      lowerCase: hasLowerCase,
      numbers: hasNumbers,
      specialChars: hasNonalphas,
    }
  };
}
