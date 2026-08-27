import { supabaseAdmin } from './supabase';
import { auth } from './betterAuth';

// Session verification is the one thing every other part of this app
// still needs from this module -- cart, wishlist, reviews, orders,
// payments, etc. all call this to find out who's asking. Everything else
// this module used to own (hashPassword/verifyPassword, createSession,
// deleteSession/logoutCustomer, invalidateSessions,
// getSessionIdFromRequest) has no remaining callers now that
// apps/store/src/app/api/auth/customer/* and google/* call auth.api.*
// directly -- deleted rather than kept as unused exports.
export async function verifyCustomerSession(req) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    return session?.user?.id || null;
  } catch (error) {
    console.error('Session verification error:', error);
    return null;
  }
}

// Customer operations
export async function findCustomerByEmail(email) {
  const { data, error } = await supabaseAdmin
    .from('customers')
    .select('*')
    .eq('email', email.toLowerCase().trim())
    .eq('is_active', true)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // No rows returned
      return null;
    }
    console.error('Error finding customer:', error);
    throw new Error('Failed to find customer');
  }

  return data;
}

export async function findCustomerById(id) {
  const { data, error } = await supabaseAdmin
    .from('customers')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    console.error('Error finding customer:', error);
    throw new Error('Failed to find customer');
  }

  return data;
}

export async function createCustomer(customerData) {
  const { data, error } = await supabaseAdmin
    .from('customers')
    .insert(customerData)
    .select()
    .single();

  if (error) {
    console.error('Error creating customer:', error);
    throw error;
  }

  return data;
}

export async function updateCustomer(id, updates) {
  const { data, error } = await supabaseAdmin
    .from('customers')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating customer:', error);
    throw new Error('Failed to update customer');
  }

  return data;
}

// Update customer last login
export async function updateCustomerLastLogin(id) {
  return await updateCustomer(id, {
    last_login: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
}

// Generate verification code
export function generateVerificationCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Validation helpers
export function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

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

// Remove sensitive fields from customer object
export function sanitizeCustomer(customer) {
  if (!customer) return null;

  const {
    password_hash,
    verification_token,
    password_reset_token,
    ...sanitized
  } = customer;

  return {
    ...sanitized,
    // Frontend (StoreHeader.js etc.) reads camelCase; the DB row is
    // snake_case -- alias here so every route through sanitizeCustomer
    // (login, /me, verify-email) is consistent, rather than fixing it
    // per-consumer (OrderModal.js already worked around this with its own
    // firstName || first_name fallback, which is the tell this was
    // already silently biting call sites that didn't hedge for it).
    firstName: customer.first_name,
    lastName: customer.last_name,
    fullName: [customer.first_name, customer.last_name].filter(Boolean).join(' ').trim() || null,
    preferredState: customer.preferred_state
  };
}
