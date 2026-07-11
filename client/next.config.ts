import type { NextConfig } from "next";

// This Next.js config allows the app to safely render images served by the backend upload folder.
const nextConfig: NextConfig = {
  // Hide the Next.js dev-tools indicator button in development.
  devIndicators: false,
  // The Image component blocks unknown hosts by default, so we whitelist local API hosts here.
  images: {
    remotePatterns: [
      // Localhost URL used by many dev environments.
      {
        protocol: "http",
        hostname: "localhost",
        port: "5000",
        pathname: "/uploads/**",
      },
      // 127.0.0.1 URL variant used on some machines/tools.
      {
        protocol: "http",
        hostname: "127.0.0.1",
        port: "5000",
        pathname: "/uploads/**",
      },
    ],
  },
};

// Export this config so Next.js can apply it during build/dev startup.
export default nextConfig;
