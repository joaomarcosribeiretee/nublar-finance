import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@nublar/validation", "@nublar/types"],
};

export default nextConfig;
