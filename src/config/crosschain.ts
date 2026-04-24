export const CROSSCHAIN_ROUTES = [
  {
    id: "arc-to-arc",
    label: "Arc → Arc",
    fromChain: "Arc_Testnet",
    toChain: "Arc_Testnet",
    token: "USDC",
    mode: "same-chain",
  },
  {
    id: "ethereum-sepolia-to-arc",
    label: "Ethereum Sepolia → Arc",
    fromChain: "Ethereum_Sepolia",
    toChain: "Arc_Testnet",
    token: "USDC",
    mode: "bridge",
  },
  {
    id: "base-sepolia-to-arc",
    label: "Base Sepolia → Arc",
    fromChain: "Base_Sepolia",
    toChain: "Arc_Testnet",
    token: "USDC",
    mode: "bridge",
  },
  {
    id: "arbitrum-sepolia-to-arc",
    label: "Arbitrum Sepolia → Arc",
    fromChain: "Arbitrum_Sepolia",
    toChain: "Arc_Testnet",
    token: "USDC",
    mode: "bridge",
  },
] as const;

export type CrosschainRoute = (typeof CROSSCHAIN_ROUTES)[number];
