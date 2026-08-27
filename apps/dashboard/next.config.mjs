/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@stora/shared-constants'],
  turbopack: {
    // Empty config to silence Turbopack warnings
  },
  // Mirrors apps/store/next.config.js's own image config exactly -- both
  // apps render the same inventory images, so the allow-list needs to
  // match. The two Wasabi entries are old links that predate the move to
  // R2 (bucket name "cdn.233cars.com" appears both as a path prefix under
  // the Wasabi endpoint, and as its own custom hostname); the R2 entries
  // cover current uploads (see apps/dashboard/src/lib/r2.js) -- the custom
  // domain production actually serves from, plus the default *.r2.dev
  // subdomain in case a bucket isn't on a custom domain.
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
    ],
  },
};

export default nextConfig;
