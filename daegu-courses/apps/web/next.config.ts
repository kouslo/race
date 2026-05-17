import type { NextConfig } from "next";

const config: NextConfig = {
  transpilePackages: ["@daegu-courses/api-client", "@daegu-courses/api-schemas"],
  experimental: {
    typedRoutes: true,
  },
};

export default config;
