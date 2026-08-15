import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { supabaseAdmin } from '@/lib/supabase';
import { createSession } from '@/lib/supabaseAuth';
import { sendWelcomeEmail } from '@/lib/email';
import { getGoogleClient, isSafeReturnTo } from '@/lib/googleAuth';

const STATE_COOKIE = 'google_oauth_state';
const RETURN_TO_COOKIE = 'google_oauth_return_to';

function parseCookies(cookieHeader) {
  const cookies = {};
  if (cookieHeader) {
    cookieHeader.split(';').forEach(cookie => {
      const [name, value] = cookie.trim().split('=');
      if (name && value) cookies[name] = decodeURIComponent(value);
    });
  }
  return cookies;
}

function clearOauthCookies(response) {
  response.headers.append('Set-Cookie', `${STATE_COOKIE}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`);
  response.headers.append('Set-Cookie', `${RETURN_TO_COOKIE}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`);
}

function errorRedirect(req, code, returnTo) {
  const destination = isSafeReturnTo(returnTo) ? returnTo : '/';
  const url = new URL(destination, req.url);
  url.searchParams.set('authError', code);
  const response = NextResponse.redirect(url);
  clearOauthCookies(response);
  return response;
}

async function createCustomerFromGoogle(payload) {
  const newCustomerId = crypto.randomUUID();
  const now = new Date().toISOString();

  const { data: newCustomer, error } = await supabaseAdmin
    .from('customers')
    .insert({
      id: newCustomerId,
      first_name: payload.given_name || payload.name || 'Google',
      last_name: payload.family_name || 'User',
      email: payload.email.toLowerCase(),
      password_hash: null,
      google_id: payload.sub,
      avatar: payload.picture || null,
      is_verified: true, // Google already verified this email
      is_active: true,
      created_at: now,
      updated_at: now
    })
    .select()
    .single();

  if (error) throw error;

  await sendWelcomeEmail(newCustomer.email, newCustomer.first_name);

  return newCustomer;
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const googleError = searchParams.get('error');

  const cookies = parseCookies(req.headers.get('cookie') || '');
  const returnTo = cookies[RETURN_TO_COOKIE];

  if (googleError) {
    return errorRedirect(req, 'google_cancelled', returnTo);
  }

  if (!state || !cookies[STATE_COOKIE] || state !== cookies[STATE_COOKIE]) {
    console.error('Google OAuth state mismatch (possible CSRF attempt)');
    return errorRedirect(req, 'state_mismatch', returnTo);
  }

  let payload;
  try {
    const client = getGoogleClient();
    const { tokens } = await client.getToken(code);
    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token,
      audience: process.env.GOOGLE_CLIENT_ID
    });
    payload = ticket.getPayload();
  } catch (error) {
    console.error('Google token exchange/verification failed:', error);
    return errorRedirect(req, 'google_failed', returnTo);
  }

  if (!payload.email_verified) {
    return errorRedirect(req, 'google_email_unverified', returnTo);
  }

  try {
    let customer = null;

    const { data: byGoogleId } = await supabaseAdmin
      .from('customers')
      .select('*')
      .eq('google_id', payload.sub)
      .maybeSingle();

    if (byGoogleId) {
      customer = byGoogleId;
    } else {
      const { data: byEmail } = await supabaseAdmin
        .from('customers')
        .select('*')
        .eq('email', payload.email.toLowerCase())
        .maybeSingle();

      if (byEmail) {
        // Auto-link: Google has already proven ownership of this email.
        const { data: linkedCustomer, error: linkError } = await supabaseAdmin
          .from('customers')
          .update({
            google_id: payload.sub,
            is_verified: true,
            updated_at: new Date().toISOString()
          })
          .eq('id', byEmail.id)
          .select()
          .single();
        if (linkError) throw linkError;
        customer = linkedCustomer;
      } else {
        customer = await createCustomerFromGoogle(payload);
      }
    }

    if (!customer.is_active) {
      return errorRedirect(req, 'account_deactivated', returnTo);
    }

    const destination = isSafeReturnTo(returnTo) ? returnTo : '/';
    const response = NextResponse.redirect(new URL(destination, req.url));
    // createSession() uses headers.set(), which replaces the whole
    // Set-Cookie header -- it must run before clearOauthCookies()'s
    // .append() calls, or they'd be wiped out by the later .set().
    await createSession(customer.id, req, response);
    clearOauthCookies(response);
    return response;
  } catch (error) {
    console.error('Google sign-in error:', error);
    return errorRedirect(req, 'server_error', returnTo);
  }
}
