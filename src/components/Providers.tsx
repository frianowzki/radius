"use client";

import type { Config } from "wagmi";
import type { PrivyClientConfig } from "@privy-io/react-auth";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import { PrivyProvider } from "@privy-io/react-auth";
import { WagmiProvider as PrivyWagmiProvider } from "@privy-io/wagmi";
import "@rainbow-me/rainbowkit/styles.css";
import { useEffect, useState } from "react";

type PrivyModule = {
  hasConfiguredPrivy: boolean;
  privyAppId: string;
  privyClientId: string;
  privyConfig: PrivyClientConfig;
};

function installStoragePolyfill() {
  if (typeof window === "undefined") return;

  const createMemoryStorage = () => {
    const store = new Map<string, string>();
    return {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
      clear: () => {
        store.clear();
      },
      key: (index: number) => Array.from(store.keys())[index] ?? null,
      get length() {
        return store.size;
      },
    };
  };

  for (const key of ["localStorage", "sessionStorage"] as const) {
    const current = window[key];
    if (current && typeof current.getItem === "function" && typeof current.setItem === "function") {
      continue;
    }

    Object.defineProperty(window, key, {
      value: createMemoryStorage(),
      configurable: true,
    });
  }
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  const [configReady, setConfigReady] = useState(false);
  const [wagmiConfig, setWagmiConfig] = useState<Config | null>(null);
  const [privyModule, setPrivyModule] = useState<PrivyModule | null>(null);

  useEffect(() => {
    installStoragePolyfill();
    Promise.all([import("@/config/wagmi"), import("@/lib/privy")]).then(([wagmiModule, privy]) => {
      setWagmiConfig(wagmiModule.config);
      setPrivyModule(privy as PrivyModule);
      setConfigReady(true);
    });
  }, []);

  if (!configReady || !wagmiConfig || !privyModule) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-indigo-500" />
      </div>
    );
  }

  const { hasConfiguredPrivy, privyAppId, privyClientId, privyConfig } = privyModule;

  const app = (
    <PrivyWagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={darkTheme({
            accentColor: "#6366f1",
            accentColorForeground: "white",
            borderRadius: "large",
            fontStack: "system",
          })}
        >
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </PrivyWagmiProvider>
  );

  if (!hasConfiguredPrivy) {
    return app;
  }

  return (
    <PrivyProvider
      appId={privyAppId}
      {...(privyClientId ? { clientId: privyClientId } : {})}
      config={privyConfig}
    >
      {app}
    </PrivyProvider>
  );
}
