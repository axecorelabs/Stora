import { NextResponse } from 'next/server';

export async function GET(request) {
  return NextResponse.json({
    success: false,
    message: 'This route is deprecated. Application now uses Supabase PostgreSQL instead of MongoDB.'
  }, { status: 410 }); // 410 Gone
}
