import AWS from 'aws-sdk';

// Configure AWS SDK for Wasabi
const s3 = new AWS.S3({
  endpoint: new AWS.Endpoint(process.env.WASABI_ENDPOINT || 'https://s3.wasabisys.com'),
  accessKeyId: process.env.WASABI_ACCESS_KEY,
  secretAccessKey: process.env.WASABI_SECRET_KEY,
  region: process.env.WASABI_REGION || 'us-east-1',
  s3ForcePathStyle: true
});

const BUCKET_NAME = process.env.WASABI_BUCKET_NAME;

// Upload file to Wasabi
export async function uploadToWasabi(file, key) {
  try {
    // Convert file to buffer if it's not already
    let buffer;
    if (file instanceof Buffer) {
      buffer = file;
    } else {
      const arrayBuffer = await file.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
    }

    // Upload parameters
    const uploadParams = {
      Bucket: BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: file.type || 'application/octet-stream',
      ACL: 'public-read', // Make file publicly accessible
      Metadata: {
        'upload-timestamp': Date.now().toString()
      }
    };

    // Upload to Wasabi
    const result = await s3.upload(uploadParams).promise();

    return result.Location;
  } catch (error) {
    console.error('Error uploading to Wasabi:', error);
    throw new Error('Failed to upload image');
  }
}

// Delete file from Wasabi
export async function deleteFromWasabi(key) {
  try {
    const deleteParams = {
      Bucket: BUCKET_NAME,
      Key: key
    };

    await s3.deleteObject(deleteParams).promise();
    return true;
  } catch (error) {
    console.error('Error deleting from Wasabi:', error);
    throw new Error('Failed to delete image');
  }
}

// Generate a unique file key
export function generateFileKey(userId, originalName) {
  const timestamp = Date.now();
  const randomString = Math.random().toString(36).substring(2, 15);
  const extension = originalName.split('.').pop().toLowerCase();
  return `inventory/${userId}/${timestamp}-${randomString}.${extension}`;
}

// Validate image file
export function validateImageFile(file) {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  const maxSize = 5 * 1024 * 1024; // 5MB

  if (!allowedTypes.includes(file.type)) {
    throw new Error('Only JPEG, PNG, and WebP images are allowed');
  }

  if (file.size > maxSize) {
    throw new Error('Image size must be less than 5MB');
  }

  return true;
}

// Generate presigned URL for private access (if needed)
export async function generatePresignedUrl(key, expiresIn = 3600) {
  try {
    const url = s3.getSignedUrl('getObject', {
      Bucket: BUCKET_NAME,
      Key: key,
      Expires: expiresIn
    });

    return url;
  } catch (error) {
    console.error('Error generating presigned URL:', error);
    throw new Error('Failed to generate presigned URL');
  }
}
