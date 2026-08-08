import { NextResponse } from 'next/server';
import { deleteSession } from '@/lib/auth';

export async function POST(req) {
  try {
    const cookies = req.headers.get('cookie') || '';
    const sessionId = cookies.split(';')
      .find(c => c.trim().startsWith('session='))
      ?.split('=')[1];

    if (sessionId) {
      await deleteSession(sessionId);
    }

    const response = NextResponse.json({
      success: true,
      message: 'Signed out successfully'
    });

    // Clear session cookie
    response.headers.set('Set-Cookie', 'session=; HttpOnly; Path=/; Max-Age=0; SameSite=Strict');

    return response;

  } catch (error) {
    console.error('Signout error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
