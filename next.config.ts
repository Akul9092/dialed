import type { NextConfig } from "next";

// Dialed has no server code. Everything is exported as static files so the
// service worker can cache the whole app for offline use.
const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
};

export default nextConfig;
