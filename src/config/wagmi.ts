import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import {
  injectedWallet,
  metaMaskWallet,
  rabbyWallet,
  okxWallet,
  bitgetWallet,
  coinbaseWallet,
  walletConnectWallet,
  safeWallet,
} from "@rainbow-me/rainbowkit/wallets";
import { createStorage, http } from "wagmi";
import { defineChain } from "viem";
import { getBrowserRpcUrl, getServerRpcUrl } from "@/config/rpc";
import {
  arbitrumSepolia,
  avalancheFuji,
  baseSepolia,
  codexTestnet,
  hyperliquidEvmTestnet,
  inkSepolia,
  lineaSepolia,
  monadTestnet,
  optimismSepolia,
  plumeSepolia,
  polygonAmoy,
  seiTestnet,
  sepolia,
  unichainSepolia,
  worldchainSepolia,
  xdcTestnet,
} from "viem/chains";

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

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "placeholder";
const chains = [
  arcTestnet,
  sepolia,
  baseSepolia,
  arbitrumSepolia,
  avalancheFuji,
  optimismSepolia,
  polygonAmoy,
  lineaSepolia,
  unichainSepolia,
  worldchainSepolia,
  inkSepolia,
  monadTestnet,
  hyperliquidEvmTestnet,
  plumeSepolia,
  seiTestnet,
  xdcTestnet,
  codexTestnet,
] as const;

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

function rpcTransport(chainId: number) {
  return http(typeof window !== "undefined" ? getBrowserRpcUrl(chainId) : getServerRpcUrl(chainId));
}

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
        okxWallet,
        bitgetWallet,
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
    [arcTestnet.id]: rpcTransport(arcTestnet.id),
    [sepolia.id]: rpcTransport(sepolia.id),
    [baseSepolia.id]: rpcTransport(baseSepolia.id),
    [arbitrumSepolia.id]: rpcTransport(arbitrumSepolia.id),
    [avalancheFuji.id]: rpcTransport(avalancheFuji.id),
    [optimismSepolia.id]: rpcTransport(optimismSepolia.id),
    [polygonAmoy.id]: rpcTransport(polygonAmoy.id),
    [lineaSepolia.id]: rpcTransport(lineaSepolia.id),
    [unichainSepolia.id]: rpcTransport(unichainSepolia.id),
    [worldchainSepolia.id]: rpcTransport(worldchainSepolia.id),
    [inkSepolia.id]: rpcTransport(inkSepolia.id),
    [monadTestnet.id]: rpcTransport(monadTestnet.id),
    [hyperliquidEvmTestnet.id]: rpcTransport(hyperliquidEvmTestnet.id),
    [plumeSepolia.id]: rpcTransport(plumeSepolia.id),
    [seiTestnet.id]: rpcTransport(seiTestnet.id),
    [xdcTestnet.id]: rpcTransport(xdcTestnet.id),
    [codexTestnet.id]: rpcTransport(codexTestnet.id),
  },
});
