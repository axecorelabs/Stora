import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { supabaseAdmin } from '@/lib/supabase';
import { createSession } from '@/lib/auth';
import { sendWelcomeEmail } from '@/lib/email';
import { getGoogleClient } from '@/lib/googleAuth';

const STATE_COOKIE = 'google_oauth_state';

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

function errorRedirect(req, code) {
  const response = NextResponse.redirect(new URL(`/?error=${code}`, req.url));
  response.headers.set('Set-Cookie', `${STATE_COOKIE}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`);
  return response;
}

async function createUserFromGoogle(payload) {
  const newUserId = crypto.randomUUID();
  const now = new Date().toISOString();

  const { data: newUser, error: userError } = await supabaseAdmin
    .from('users')
    .insert({
      id: newUserId,
      first_name: payload.given_name || payload.name || 'Google',
      last_name: payload.family_name || 'User',
      email: payload.email.toLowerCase(),
      password_hash: null,
      google_id: payload.sub,
      is_active: true,
      is_subscribed: false,
      role: 'user',
      created_at: now,
      updated_at: now
    })
    .select()
    .single();

  if (userError) throw userError;

  // Same 14-day trial every password signup gets (verify-email/route.js) --
  // a Google signup must not skip it.
  const trialEndDate = new Date();
  trialEndDate.setDate(trialEndDate.getDate() + 14);

  const { data: trialSubscription, error: subError } = await supabaseAdmin
    .from('subscriptions')
    .insert({
      id: crypto.randomUUID(),
      user_id: newUserId,
      plan_type: 'free',
      plan_name: 'Trial Plan - Full Access',
      status: 'trial',
      billing_cycle: 'trial',
      price: 0,
      currency: 'USD',
      start_date: now,
      end_date: trialEndDate.toISOString(),
      features: {
        realTimeStockTracking: true,
        advancedReporting: true,
        freeWebsite: true,
        whatsappCheckout: true,
        aiReports: true,
        unlimitedUsers: true,
        stockAlerts: true,
        purchaseOrders: true,
        multiLocation: true,
        cloudBackup: true,
        prioritySupport: true
      },
      created_at: now,
      updated_at: now
    })
    .select()
    .single();

  if (subError) throw subError;

  const { data: updatedUser, error: updateError } = await supabaseAdmin
    .from('users')
    .update({
      is_subscribed: true,
      date_subscribed: now,
      current_subscription_id: trialSubscription.id,
      updated_at: now
    })
    .eq('id', newUserId)
    .select()
    .single();

  if (updateError) throw updateError;

  await sendWelcomeEmail(updatedUser.email, updatedUser.first_name);

  return updatedUser;
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const googleError = searchParams.get('error');

  if (googleError) {
    return errorRedirect(req, 'google_cancelled');
  }

  const cookies = parseCookies(req.headers.get('cookie') || '');
  if (!state || !cookies[STATE_COOKIE] || state !== cookies[STATE_COOKIE]) {
    console.error('Google OAuth state mismatch (possible CSRF attempt)');
    return errorRedirect(req, 'state_mismatch');
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
    return errorRedirect(req, 'google_failed');
  }

  if (!payload.email_verified) {
    return errorRedirect(req, 'google_email_unverified');
  }

  try {
    let user = null;

    const { data: byGoogleId } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('google_id', payload.sub)
      .maybeSingle();

    if (byGoogleId) {
      user = byGoogleId;
    } else {
      const { data: byEmail } = await supabaseAdmin
        .from('users')
        .select('*')
        .eq('email', payload.email.toLowerCase())
        .maybeSingle();

      if (byEmail) {
        // Auto-link: Google has already proven ownership of this email.
        const { data: linkedUser, error: linkError } = await supabaseAdmin
          .from('users')
          .update({ google_id: payload.sub, updated_at: new Date().toISOString() })
          .eq('id', byEmail.id)
          .select()
          .single();
        if (linkError) throw linkError;
        user = linkedUser;
      } else {
        user = await createUserFromGoogle(payload);
      }
    }

    if (!user.is_active) {
      return errorRedirect(req, 'account_deactivated');
    }

    const response = NextResponse.redirect(new URL('/dashboard', req.url));
    // createSession() uses headers.set(), which replaces the whole
    // Set-Cookie header -- it must run before any .append() call below,
    // or the appended cookie would be wiped out by the later .set().
    await createSession(user.id, req, response);
    response.headers.append('Set-Cookie', `${STATE_COOKIE}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`);
    return response;
  } catch (error) {
    console.error('Google sign-in error:', error);
    return errorRedirect(req, 'server_error');
  }
}
