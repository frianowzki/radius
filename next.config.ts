import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
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
