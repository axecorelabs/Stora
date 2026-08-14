import bcrypt from 'bcryptjs';
import { supabaseAdmin } from './supabase';
import crypto from 'crypto';
import { redis, sessionKey, withTimeout } from './redis';

const SESSION_CACHE_TTL_SECONDS = 5 * 60;

// Hash password
export async function hashPassword(password) {
  const saltRounds = 12;
  return await bcrypt.hash(password, saltRounds);
}

// Verify password
export async function verifyPassword(password, hashedPassword) {
  return await bcrypt.compare(password, hashedPassword);
}

// Generate session ID
function generateSessionId() {
  return crypto.randomBytes(32).toString('hex');
}

// Parse cookies helper
function parseCookies(cookieHeader) {
  const cookies = {};
  if (cookieHeader) {
    cookieHeader.split(';').forEach(cookie => {
      const [name, value] = cookie.trim().split('=');
      if (name && value) {
        cookies[name] = decodeURIComponent(value);
      }
    });
  }
  return cookies;
}

// Create customer session
export async function createSession(customerId, req, res) {
  const sessionId = generateSessionId();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
  const now = new Date().toISOString();

  // Extract metadata from request
  const ipAddress = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
  const userAgent = req.headers.get('user-agent') || 'unknown';

  console.log('Creating customer session:', { customerId, sessionId, expiresAt });

  // Store session in database - explicitly set all required fields
  const { data, error } = await supabaseAdmin
    .from('customer_sessions')
    .insert({
      id: crypto.randomUUID(), // Generate UUID for id field
      customer_id: customerId,
      session_id: sessionId,
      user_agent: userAgent,
      ip_address: ipAddress,
      expires_at: expiresAt.toISOString(),
      is_active: true,
      last_activity_at: now,
      created_at: now,
      updated_at: now
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating session:', error);
    throw new Error('Failed to create session');
  }

  console.log('Customer session stored in database');

  // Set HTTP-only cookie
  const cookieValue = `session=${sessionId}; HttpOnly; Path=/; Max-Age=${7 * 24 * 60 * 60}; SameSite=Lax${
    process.env.NODE_ENV === 'production' ? '; Secure' : ''
  }`;

  console.log('Setting session cookie');

  res.headers.set('Set-Cookie', cookieValue);

  return sessionId;
}

// Verify customer session
export async function verifyCustomerSession(req) {
  const cookies = parseCookies(req.headers.get('cookie') || '');
  const sessionId = cookies.session;

  if (!sessionId) {
    console.log('No session cookie found');
    return null;
  }

  // Cache-aside: skip Postgres entirely on a cache hit.
  try {
    const cached = await withTimeout(redis.get(sessionKey(sessionId)));
    if (cached) {
      return cached;
    }
  } catch (error) {
    console.error('Session cache read failed, falling back to Postgres:', error.message);
  }

  // Find valid session
  const { data: session, error } = await supabaseAdmin
    .from('customer_sessions')
    .select(`
      *,
      customers (
        id,
        first_name,
        last_name,
        email,
        is_verified,
        is_active
      )
    `)
    .eq('session_id', sessionId)
    .eq('is_active', true)
    .gt('expires_at', new Date().toISOString())
    .single();

  if (error || !session || !session.customers) {
    console.log('Invalid or expired session:', error?.message);
    return null;
  }

  const customerId = session.customers.id;

  // Populate the cache; only touch last_activity_at on a miss (a cache hit
  // skips this write entirely, which is the point of caching).
  try {
    await withTimeout(redis.set(sessionKey(sessionId), customerId, { ex: SESSION_CACHE_TTL_SECONDS }));
  } catch (error) {
    console.error('Session cache write failed, skipping:', error.message);
  }

  // Update last activity
  try {
    await supabaseAdmin
      .from('customer_sessions')
      .update({
        last_activity_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('session_id', sessionId);
  } catch (error) {
    console.warn('Failed to update session activity:', error.message);
  }

  console.log('Customer session verified:', session.customers.email);

  return customerId;
}

// Delete customer session
export async function deleteSession(sessionId) {
  const { error } = await supabaseAdmin
    .from('customer_sessions')
    .update({
      is_active: false,
      logout_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('session_id', sessionId);

  if (error) {
    console.error('Error deleting session:', error);
    throw new Error('Failed to delete session');
  }

  try {
    await withTimeout(redis.del(sessionKey(sessionId)));
  } catch (error) {
    // Self-heals via the cache entry's own TTL -- not a new hole.
    console.error('Session cache invalidation failed, skipping:', error.message);
  }
}

// Logout customer (invalidate session)
export async function logoutCustomer(req) {
  const cookies = parseCookies(req.headers.get('cookie') || '');
  const sessionId = cookies.session;

  if (sessionId) {
    await deleteSession(sessionId);
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
  
  return sanitized;
}
