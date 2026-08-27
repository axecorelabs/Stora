import { NextResponse } from 'next/server';
import { auth } from '@/lib/betterAuth';

export async function POST(req) {
  try {
    const response = await auth.api.signOut({
      headers: req.headers,
      asResponse: true
    });

    const result = NextResponse.json({
      success: true,
      message: 'Signed out successfully'
    });

    const setCookie = response.headers.get('set-cookie');
    if (setCookie) result.headers.set('set-cookie', setCookie);

    return result;
  } catch (error) {
    console.error('Signout error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
