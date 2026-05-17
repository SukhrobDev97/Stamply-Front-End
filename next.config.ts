import type { NextConfig } from "next";

/** Nest/GraphQL API (server-side proxy target). Override in .env.local. */
const graphqlProxyTarget = (
  process.env.GRAPHQL_PROXY_TARGET ?? "http://127.0.0.1:3007"
).replace(/\/+$/, "");

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.0.13"],
  async rewrites() {
    return [
      {
        source: "/graphql",
        destination: `${graphqlProxyTarget}/graphql`,
      },
    ];
  },
};

export default nextConfig;
