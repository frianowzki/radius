"use client";

import type { ReactNode } from "react";
import type { PrivyClientConfig } from "@privy-io/react-auth";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import { PrivyProvider } from "@privy-io/react-auth";
import { WagmiProvider } from "@privy-io/wagmi";
import "@rainbow-me/rainbowkit/styles.css";
import { useState } from "react";
import { config } from "@/config/wagmi";
import { hasConfiguredPrivy, privyAppId, privyClientId, privyConfig } from "@/lib/privy";

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
      {hasConfiguredPrivy ? (
        <PrivyProvider
          appId={privyAppId}
          {...(privyClientId ? { clientId: privyClientId } : {})}
          config={privyConfig as PrivyClientConfig}
        >
          <WalletProviders>{children}</WalletProviders>
        </PrivyProvider>
      ) : (
        <WalletProviders>{children}</WalletProviders>
      )}
    </QueryClientProvider>
  );
}
