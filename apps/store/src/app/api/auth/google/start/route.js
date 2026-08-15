import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { getGoogleClient, isSafeReturnTo } from '@/lib/googleAuth';

const STATE_COOKIE = 'google_oauth_state';
const RETURN_TO_COOKIE = 'google_oauth_return_to';
const COOKIE_MAX_AGE = 600; // 10 minutes -- just long enough to complete the Google consent screen

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const returnTo = searchParams.get('returnTo');

  const state = crypto.randomUUID();
  const client = getGoogleClient();

  const authUrl = client.generateAuthUrl({
    access_type: 'online',
    scope: ['openid', 'email', 'profile'],
    state,
    prompt: 'select_account'
  });

  const response = NextResponse.redirect(authUrl);
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  response.headers.append(
    'Set-Cookie',
    `${STATE_COOKIE}=${state}; HttpOnly; Path=/; Max-Age=${COOKIE_MAX_AGE}; SameSite=Lax${secure}`
  );
  if (isSafeReturnTo(returnTo)) {
    response.headers.append(
      'Set-Cookie',
      `${RETURN_TO_COOKIE}=${encodeURIComponent(returnTo)}; HttpOnly; Path=/; Max-Age=${COOKIE_MAX_AGE}; SameSite=Lax${secure}`
    );
  }

  return response;
}
