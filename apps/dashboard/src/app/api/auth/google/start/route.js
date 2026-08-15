import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { getGoogleClient, getRequestOrigin } from '@/lib/googleAuth';

const STATE_COOKIE = 'google_oauth_state';
const STATE_MAX_AGE = 600; // 10 minutes -- just long enough to complete the Google consent screen

export async function GET(req) {
  const state = crypto.randomUUID();
  const client = getGoogleClient(getRequestOrigin(req));

  const authUrl = client.generateAuthUrl({
    access_type: 'online',
    scope: ['openid', 'email', 'profile'],
    state,
    prompt: 'select_account'
  });

  const response = NextResponse.redirect(authUrl);
  response.headers.set(
    'Set-Cookie',
    `${STATE_COOKIE}=${state}; HttpOnly; Path=/; Max-Age=${STATE_MAX_AGE}; SameSite=Lax${
      process.env.NODE_ENV === 'production' ? '; Secure' : ''
    }`
  );

  return response;
}
