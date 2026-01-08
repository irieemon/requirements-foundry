import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Extend server action timeout for AI analysis (default is 30s)
  // Vercel Pro: up to 300s, Hobby: up to 60s
  experimental: {
    serverActions: {
      bodySizeLimit: "4mb",
    },
  },
};

export default nextConfig;
