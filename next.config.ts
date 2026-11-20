import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dev roda em lvh.me / <tenant>.lvh.me (README); sem isso o Next bloqueia
  // os assets de dev e a página não hidrata.
  allowedDevOrigins: ["lvh.me", "*.lvh.me"],
  experimental: {
    serverActions: {
      bodySizeLimit: "12mb",
    },
  },
};

export default nextConfig;
