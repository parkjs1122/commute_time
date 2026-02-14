import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/**/*": ["./src/generated/prisma/*.node"],
  },
};

export default nextConfig;
