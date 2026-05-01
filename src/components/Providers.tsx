"use client";

import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import { WagmiProvider } from "wagmi";
import "@rainbow-me/rainbowkit/styles.css";
import { useEffect, useState } from "react";
import { config } from "@/config/wagmi";
import { RadiusAuthProvider } from "@/lib/web3auth";
import { installCircleFetchProxy } from "@/lib/install-circle-fetch-proxy";

function WalletProviders({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={config} reconnectOnMount={false}>
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
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            refetchOnReconnect: false,
          },
        },
      })
  );

  useEffect(() => {
    const run = () => {
      try {
        installCircleFetchProxy();
      } catch (err) {
        // Never let proxy install failures blank the app on mobile browsers.
        console.warn("[providers] installCircleFetchProxy failed", err);
      }
    };
    const idle = window.requestIdleCallback?.(run, { timeout: 1200 });
    if (!idle) window.setTimeout(run, 300);
    return () => {
      if (idle) window.cancelIdleCallback?.(idle);
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <RadiusAuthProvider>
        <WalletProviders>{children}</WalletProviders>
      </RadiusAuthProvider>
    </QueryClientProvider>
  );
}
