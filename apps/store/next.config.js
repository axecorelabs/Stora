/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@stora/shared-constants'],
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
      // storage.stora.com.ng is the custom domain the R2 bucket is actually
      // served from in production; *.r2.dev covers the default public
      // subdomain in case a store's bucket isn't on a custom domain.
      {
        protocol: 'https',
        hostname: 'storage.stora.com.ng',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.r2.dev',
        port: '',
        pathname: '/**',
      },
      {
        // New uploads' public URL (R2_PUBLIC_URL) -- storage.stora.com.ng
        // above stays for images uploaded before this domain existed;
        // nothing rewrites those to the new host, so both entries are
        // needed until old inventory naturally ages out.
        protocol: 'https',
        hostname: 'cdn.ivma.ng',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

module.exports = nextConfig;