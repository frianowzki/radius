"use client";

import type { CreateAppKit } from "@reown/appkit/react";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { arcTestnet } from "@/config/wagmi";
import { arbitrumSepolia, baseSepolia, sepolia } from "viem/chains";

const envProjectId = process.env.NEXT_PUBLIC_REOWN_PROJECT_ID?.trim() ?? "";
const hasConfiguredProjectId = Boolean(envProjectId && envProjectId !== "your_real_project_id_here");
const projectId: string = hasConfiguredProjectId ? envProjectId : "arc-p2p-demo";

const metadata = {
  name: "Arc P2P",
  description: "Arc Flow, crosschain social payments on Arc testnet.",
  url: "https://arc-p2p.local",
  icons: ["https://avatars.githubusercontent.com/u/179229932?s=200&v=4"],
};

const networks = [arcTestnet, sepolia, baseSepolia, arbitrumSepolia] as const;

const wagmiAdapter = new WagmiAdapter({
  projectId,
  networks: [...networks],
});

export const reownConfig: CreateAppKit = {
  adapters: [wagmiAdapter],
  projectId,
  metadata,
  networks: [...networks],
  defaultNetwork: arcTestnet,
  themeMode: "dark",
  allWallets: "HIDE",
  enableWallets: true,
  enableInjected: true,
  enableCoinbase: false,
  enableWalletConnect: false,
  enableEIP6963: true,
  enableWalletGuide: true,
  enableReconnect: true,
  features: {
    email: true,
    socials: ["google", "apple", "github", "x", "discord"],
    emailCapture: false,
    swaps: false,
    onramp: false,
    activity: false,
    multiWallet: false,
    reownAuthentication: true,
    payments: false,
    payWithExchange: false,
    reownBranding: false,
  } as CreateAppKit["features"],
};

export { hasConfiguredProjectId, projectId as reownProjectId };
