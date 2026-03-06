import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingIncludes: {
    "/": ["./node_modules/@aws-sdk/client-secrets-manager/**/*"],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "4mb",
    },
  },
  serverExternalPackages: ["@prisma/client", "@aws-sdk/client-secrets-manager"],
};

export default nextConfig;
