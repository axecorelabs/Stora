import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/auth';
import { uploadToR2, generateFileKey, validateImageFile } from '@/lib/r2';

export async function POST(req) {
  try {
    // Verify authentication
    const user = await verifySession(req);
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Parse form data
    const formData = await req.formData();
    const file = formData.get('image');

    if (!file) {
      return NextResponse.json(
        { success: false, message: 'No image file provided' },
        { status: 400 }
      );
    }

    // Validate the image file
    let buffer, contentType;
    try {
      ({ buffer, contentType } = await validateImageFile(file));
    } catch (error) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 400 }
      );
    }

    // Generate unique file key (use user.id instead of user._id)
    const fileKey = generateFileKey(user.id);

    // Upload to R2
    const imageUrl = await uploadToR2(buffer, fileKey, contentType);

    return NextResponse.json({
      success: true,
      imageUrl,
      url: imageUrl, // Include both for frontend compatibility
      message: 'Image uploaded successfully'
    });

  } catch (error) {
    console.error('Image upload error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to upload image' },
      { status: 500 }
    );
  }
}
