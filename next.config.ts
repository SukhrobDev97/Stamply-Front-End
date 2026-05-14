import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "192.168.0.13",
    "nonstaining-cammie-overcautious.ngrok-free.dev",
    ...(process.env.NGROK_DEV_ORIGIN
      ? [process.env.NGROK_DEV_ORIGIN.replace(/^https?:\/\//, "").split("/")[0]!]
      : []),
  ],
};

export default nextConfig;
