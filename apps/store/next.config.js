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
    ],
  },
};

module.exports = nextConfig;