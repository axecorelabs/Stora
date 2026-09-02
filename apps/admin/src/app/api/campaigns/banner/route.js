import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/auth';
import { uploadToR2, generateFileKey, validateImageFile } from '@/lib/r2';

// Uploads a campaign banner -- used both as the campaign page's social
// share image (Open Graph/Twitter card) and for on-site placement
// (homepage teaser, footers). Returns the public URL; the builder stores
// it on the campaign only once the form itself is saved (this route
// doesn't touch the campaigns table).
export async function POST(request) {
  const staff = await verifySession(request);
  if (!staff) {
    return NextResponse.json({ success: false, message: 'Not authorized' }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get('banner');
  if (!file || typeof file === 'string') {
    return NextResponse.json({ success: false, message: 'No file provided' }, { status: 400 });
  }

  try {
    const { buffer, contentType } = await validateImageFile(file);
    const key = generateFileKey('campaigns');
    const url = await uploadToR2(buffer, key, contentType);
    return NextResponse.json({ success: true, url });
  } catch (error) {
    console.error('Error uploading campaign banner:', error);
    return NextResponse.json({ success: false, message: error.message || 'Failed to upload banner' }, { status: 400 });
  }
}
