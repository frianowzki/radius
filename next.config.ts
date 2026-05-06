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
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://*.privy.io https://*.walletconnect.com https://*.walletconnect.org",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://*.public.blob.vercel-storage.com https://*.privy.io https://*.walletconnect.com https://cdn.jsdelivr.net",
      "font-src 'self' data:",
      "connect-src 'self' https://*.privy.io https://*.walletconnect.com https://*.walletconnect.org https://*.circle.com https://iris-api*.circle.com https://gateway-api*.circle.com wss://*.walletconnect.com wss://*.walletconnect.org https://rpc.walletconnect.org https://pulse.walletconnect.org https://api.github.com https://cdn.jsdelivr.net https://rpc.testnet.arc.network wss://rpc.testnet.arc.network https://*.public.blobscan.com https://*.infura.io https://*.alchemy.com blob: data:",
      "frame-src 'self' https://*.privy.io https://*.walletconnect.com https://*.walletconnect.org https://verify.walletconnect.com https://verify.walletconnect.org",
      "worker-src 'self' blob:",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
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
