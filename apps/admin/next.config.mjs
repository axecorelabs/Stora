/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    // Empty config to silence Turbopack warnings
  },
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? { exclude: ['error', 'warn'] } : false,
  },
};

export default nextConfig;
