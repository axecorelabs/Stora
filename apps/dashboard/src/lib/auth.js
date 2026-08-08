import bcrypt from 'bcryptjs';
import { supabaseAdmin } from './supabase';
import crypto from 'crypto';

// Hash password
export async function hashPassword(password) {
  const saltRounds = 12;
  return await bcrypt.hash(password, saltRounds);
}

// Verify password
export async function verifyPassword(password, hashedPassword) {
  return await bcrypt.compare(password, hashedPassword);
}

// Create user session
export async function createSession(userId, req, res) {
  const sessionId = generateSessionId();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
  
  // Extract user agent and IP for session tracking
  const userAgent = req.headers.get('user-agent') || 'unknown';
  const ipAddress = req.headers.get('x-forwarded-for') || 
                   req.headers.get('x-real-ip') || 
                   'unknown';

  try {
    // Store session in database with tracking info
    const { error } = await supabaseAdmin
      .from('sessions')
      .insert({
        id: crypto.randomUUID(),
        user_id: userId,
        session_id: sessionId,
        expires_at: expiresAt.toISOString(),
        data: { userAgent, ipAddress },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

    if (error) {
      console.error('Session creation error:', error);
      throw error;
    }
  } catch (error) {
    console.error('Session creation error:', error);
    throw error;
  }

  // Set HTTP-only cookie
  res.headers.set('Set-Cookie', 
    `session=${sessionId}; HttpOnly; Path=/; Max-Age=${7 * 24 * 60 * 60}; SameSite=Strict${
      process.env.NODE_ENV === 'production' ? '; Secure' : ''
    }`
  );

  return sessionId;
}

// Verify session
export async function verifySession(req) {
  const cookieHeader = req.headers.get('cookie') || '';
  const cookies = parseCookies(cookieHeader);
  const sessionId = cookies.session;

  if (!sessionId) {
    return null;
  }

  try {
    // Get session
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('sessions')
      .select('*')
      .eq('session_id', sessionId)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (sessionError || !session) {
      return null;
    }

    // Get user
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, first_name, last_name, email, role, is_active')
      .eq('id', session.user_id)
      .eq('is_active', true)
      .single();

    if (userError || !user) {
      return null;
    }

    // Update last activity (non-blocking)
    supabaseAdmin
      .from('sessions')
      .update({ updated_at: new Date().toISOString() })
      .eq('session_id', sessionId)
      .then(() => {});

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

// Delete session
export async function deleteSession(sessionId) {
  try {
    await supabaseAdmin
      .from('sessions')
      .delete()
      .eq('session_id', sessionId);
  } catch (error) {
    console.error('Session deletion error:', error);
    // Don't throw error for session deletion failures
  }
}

// Helper functions
function generateSessionId() {
  // Use crypto for better security
  return crypto.randomUUID();
}

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
