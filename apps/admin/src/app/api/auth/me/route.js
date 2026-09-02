import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/auth';

export async function GET(req) {
  try {
    const user = await verifySession(req);
    if (!user) {
      return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 });
    }
    return NextResponse.json({ success: true, user });
  } catch (error) {
    console.error('Auth check error:', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}
