/** @type {import('next').NextConfig} */
const nextConfig = {
  // Removed 'output: export' to support API routes and dynamic features
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: { unoptimized: true },
  webpack: (config) => {
    // Silence DuckDB's CJS dynamic require warning in the Node bundle.
    // This is expected and harmless; the browser bundle is used on the client.
    config.ignoreWarnings = [
      ...(config.ignoreWarnings || []),
      {
        module: /@duckdb\/duckdb-wasm\/dist\/duckdb-node\.cjs/,
        message: /Critical dependency: the request of a dependency is an expression/,
      },
    ];
    return config;
  },
};

module.exports = nextConfig;
