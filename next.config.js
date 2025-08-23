/** @type {import('next').NextConfig} */
const nextConfig = {
  // Removed 'output: export' to support API routes and dynamic features
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: { unoptimized: true },
};

module.exports = nextConfig;
