/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 's3.eu-central-1.wasabisys.com',
        port: '',
        pathname: '/cdn.233cars.com/**',
      },
      {
        protocol: 'https',
        hostname: 'cdn.233cars.com',
        port: '',
        pathname: '/**',
      },
      // Cloudflare R2 -- inventory images now upload here (see apps/dashboard/src/lib/r2.js).
      // Covers the default r2.dev public subdomain; if the bucket is served from a
      // custom domain instead, that hostname needs to be added here too.
      {
        protocol: 'https',
        hostname: '*.r2.dev',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

module.exports = nextConfig;