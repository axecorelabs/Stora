/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@stora/shared-constants'],
  turbopack: {
    // Empty config to silence Turbopack warnings
  },
};

export default nextConfig;
