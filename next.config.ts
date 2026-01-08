import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Vercel Pro: up to 300s timeout for server actions
  experimental: {
    serverActions: {
      bodySizeLimit: "4mb",
    },
  },
  // Set max duration for all serverless functions (Vercel Pro: 300s max)
  serverExternalPackages: ["@prisma/client"],
};

export default nextConfig;
