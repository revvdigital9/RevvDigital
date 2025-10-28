import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,  // Ignore ESLint during build
  },
  typescript: {
    ignoreBuildErrors: true,   // Ignore TypeScript errors during build
  },
};

export default nextConfig;
