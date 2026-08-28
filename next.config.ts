import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  basePath: "/gather-room",
  assetPrefix: "/gather-room",
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
