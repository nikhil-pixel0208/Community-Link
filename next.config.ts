import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Community Link is a realtime, request-time app (live feeds, countdowns, chat).
  // Cache Components' prerender validation buys us nothing here, so it stays off.
  cacheComponents: false,
  serverExternalPackages: ["better-sqlite3"],
  // The hosted preview reaches the dev server through a proxied subdomain.
  allowedDevOrigins: ["*.e2b.app", "*.app.github.dev", "*.gitpod.io"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
