"use client";

import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import { WagmiProvider } from "wagmi";
import "@rainbow-me/rainbowkit/styles.css";
import { useState } from "react";
import { config } from "@/config/wagmi";
import { RadiusAuthProvider } from "@/lib/web3auth";
import { installCircleFetchProxy } from "@/lib/install-circle-fetch-proxy";

if (typeof window !== "undefined") {
  try {
    installCircleFetchProxy();
  } catch (err) {
    // Never let proxy install failures blank the app on mobile browsers.
    console.warn("[providers] installCircleFetchProxy failed", err);
  }
}

function WalletProviders({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <RainbowKitProvider
        theme={darkTheme({
          accentColor: "#183B5C",
          accentColorForeground: "white",
          borderRadius: "large",
          fontStack: "system",
        })}
      >
        {children}
      </RainbowKitProvider>
    </WagmiProvider>
  );
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <RadiusAuthProvider>
        <WalletProviders>{children}</WalletProviders>
      </RadiusAuthProvider>
    </QueryClientProvider>
  );
}
