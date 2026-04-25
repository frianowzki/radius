import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import {
  injectedWallet,
  metaMaskWallet,
  rabbyWallet,
  coinbaseWallet,
  walletConnectWallet,
  safeWallet,
} from "@rainbow-me/rainbowkit/wallets";
import { createStorage, http } from "wagmi";
import { defineChain } from "viem";
import { arbitrumSepolia, baseSepolia, sepolia } from "viem/chains";

export const arcTestnet = defineChain({
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: {
    name: "USDC",
    symbol: "USDC",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ["https://rpc.testnet.arc.network"],
      webSocket: ["wss://rpc.testnet.arc.network"],
    },
  },
  blockExplorers: {
    default: {
      name: "ArcScan",
      url: "https://testnet.arcscan.app",
    },
  },
  testnet: true,
});

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID!;
const chains = [arcTestnet, sepolia, baseSepolia, arbitrumSepolia] as const;

const memoryStorage = (() => {
  const store = new Map<string, string>();
  return {
    getItem(key: string) {
      return store.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
    removeItem(key: string) {
      store.delete(key);
    },
  };
})();

const browserStorage =
  typeof window !== "undefined" && typeof window.localStorage?.getItem === "function"
    ? window.localStorage
    : memoryStorage;

export const config = getDefaultConfig({
  appName: "Radius",
  projectId,
  chains,
  ssr: false,
    wallets: [
    {
      groupName: "Wallets",
      wallets: [
        injectedWallet,
        metaMaskWallet,
        rabbyWallet,
        coinbaseWallet,
        walletConnectWallet,
        safeWallet,
      ],
    },
  ],
  storage: createStorage({
    storage: browserStorage,
  }),
  transports: {
    [arcTestnet.id]: http("https://rpc.testnet.arc.network"),
    [sepolia.id]: http(),
    [baseSepolia.id]: http(),
    [arbitrumSepolia.id]: http(),
  },
});
