"use client";

import type { PrivyClientConfig } from "@privy-io/react-auth";

const envAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID?.trim() ?? "";
const envClientId = process.env.NEXT_PUBLIC_PRIVY_CLIENT_ID?.trim() ?? "";

export const hasConfiguredPrivy = Boolean(
  envAppId &&
    envClientId &&
    envAppId !== "your_privy_app_id" &&
    envClientId !== "your_privy_client_id"
);

export const privyAppId = envAppId;
export const privyClientId = envClientId;

export const privyConfig: PrivyClientConfig = {
  appearance: {
    theme: "dark",
    accentColor: "#6366f1",
    landingHeader: "Radius",
    loginMessage: "Fast stablecoin payments on Arc, cleaner on mobile.",
    showWalletLoginFirst: false,
    walletChainType: "ethereum-only",
  },
  loginMethods: ["email", "google", "apple", "github", "wallet"],
  embeddedWallets: {
    ethereum: {
      createOnLogin: "users-without-wallets",
    },
    showWalletUIs: false,
  },
  defaultChain: undefined,
  supportedChains: undefined,
};
