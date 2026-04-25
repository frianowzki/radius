"use client";

import type { PrivyClientConfig } from "@privy-io/react-auth";

const envAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID?.trim() ?? "";
const envClientId = process.env.NEXT_PUBLIC_PRIVY_CLIENT_ID?.trim() ?? "";
const envSocialMethods = process.env.NEXT_PUBLIC_PRIVY_SOCIAL_LOGIN_METHODS?.trim() || "google,twitter,github,apple";

const supportedSocialMethods = ["google", "apple", "github", "twitter"] as const;
export type EnabledSocialLoginMethod = (typeof supportedSocialMethods)[number];

export const enabledSocialLoginMethods = envSocialMethods
  .split(",")
  .map((method) => method.trim().toLowerCase())
  .filter((method): method is EnabledSocialLoginMethod =>
    supportedSocialMethods.includes(method as EnabledSocialLoginMethod)
  );

export const hasConfiguredPrivy = Boolean(envAppId && envAppId !== "your_privy_app_id");

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
  loginMethods: ["email", ...enabledSocialLoginMethods, "wallet"],
  embeddedWallets: {
    ethereum: {
      createOnLogin: "users-without-wallets",
    },
    showWalletUIs: false,
  },
};
