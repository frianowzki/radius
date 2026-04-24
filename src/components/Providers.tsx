"use client";

import type { Config } from "wagmi";
import type { CreateAppKit } from "@reown/appkit/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import { AppKitProvider } from "@reown/appkit/react";
import "@rainbow-me/rainbowkit/styles.css";
import { useEffect, useState } from "react";

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
  const [wagmiConfig, setWagmiConfig] = useState<Config | null>(null);
  const [appKitConfig, setAppKitConfig] = useState<CreateAppKit | null>(null);

  useEffect(() => {
    installStoragePolyfill();
    Promise.all([import("@/config/wagmi"), import("@/lib/reown")]).then(([wagmiModule, reownModule]) => {
      setWagmiConfig(wagmiModule.config);
      setAppKitConfig(reownModule.reownConfig);
    });
  }, []);

  if (!wagmiConfig || !appKitConfig) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-indigo-500" />
      </div>
    );
  }

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <AppKitProvider {...appKitConfig}>
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
        </AppKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
