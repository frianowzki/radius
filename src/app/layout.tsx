import "@/lib/storage-polyfill";
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ClientRuntime } from "@/components/ClientRuntime";
import FluidBackground from "@/components/FluidBackground";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Radius",
  description: "Peer-to-peer stablecoin payments on Arc Testnet",
  applicationName: "Radius",
  manifest: "/manifest.webmanifest",
  openGraph: {
    title: "Radius — P2P Stablecoin Payments",
    description: "Send and receive stablecoins peer-to-peer on Arc Testnet. Social wallets, instant settlement.",
    url: "https://radius-gules.vercel.app",
    siteName: "Radius",
    type: "website",
    images: [{ url: "/icon-512.png", width: 512, height: 512, alt: "Radius" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Radius — P2P Stablecoin Payments",
    description: "Send and receive stablecoins peer-to-peer on Arc Testnet. Social wallets, instant settlement.",
    images: ["/icon-512.png"],
  },
  appleWebApp: {
    capable: true,
    title: "Radius",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon-180.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#2563eb",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* Anti-FOUC: apply saved theme before first paint */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var saved=localStorage.getItem('radius-theme');var preferred=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';var theme=saved==='dark'||saved==='light'?saved:preferred;document.documentElement.setAttribute('data-theme',theme);document.documentElement.classList.toggle('dark',theme==='dark');document.documentElement.style.colorScheme=theme}catch(e){document.documentElement.setAttribute('data-theme','light');document.documentElement.classList.remove('dark');document.documentElement.style.colorScheme='light'}})()`,
          }}
        />
      </head>
      <body className="min-h-full">
        <FluidBackground />
        <ErrorBoundary>
          <Providers>{children}</Providers>
        </ErrorBoundary>
        <ClientRuntime />
      </body>
    </html>
  );
}
