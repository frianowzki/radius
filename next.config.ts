import type { NextConfig } from "next";
import path from "node:path";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(self), microphone=(), geolocation=(), payment=(), usb=(), xr-spatial-tracking=()",
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      { source: "/(.*)", headers: securityHeaders },
      { source: "/api/(.*)", headers: [{ key: "Cache-Control", value: "no-store" }] },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.public.blob.vercel-storage.com",
      },
    ],
  },
  // Emit source maps for the production browser bundles when SENTRY_DSN is set.
  // Sentry's CLI / GitHub Action consumes the .map files to symbolicate the
  // stack frames forwarded by /api/log.
  productionBrowserSourceMaps: !!process.env.SENTRY_DSN,
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
