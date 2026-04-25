export const CHAIN_USDC_ADDRESSES = {
  Arc_Testnet: "0x3600000000000000000000000000000000000000",
  Ethereum_Sepolia: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
  Base_Sepolia: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
  Arbitrum_Sepolia: "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d",
} as const;

export const CHAIN_METADATA = {
  Arc_Testnet: {
    label: "Arc Testnet",
    chainId: 5042002,
    explorerUrl: "https://testnet.arcscan.app",
  },
  Ethereum_Sepolia: {
    label: "Ethereum Sepolia",
    chainId: 11155111,
    explorerUrl: "https://sepolia.etherscan.io",
  },
  Base_Sepolia: {
    label: "Base Sepolia",
    chainId: 84532,
    explorerUrl: "https://sepolia.basescan.org",
  },
  Arbitrum_Sepolia: {
    label: "Arbitrum Sepolia",
    chainId: 421614,
    explorerUrl: "https://sepolia.arbiscan.io",
  },
} as const;

export type CrosschainChain = keyof typeof CHAIN_METADATA;

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
    id: "arc-to-ethereum-sepolia",
    label: "Arc → Ethereum Sepolia",
    fromChain: "Arc_Testnet",
    toChain: "Ethereum_Sepolia",
    token: "USDC",
    mode: "bridge",
  },
  {
    id: "arc-to-base-sepolia",
    label: "Arc → Base Sepolia",
    fromChain: "Arc_Testnet",
    toChain: "Base_Sepolia",
    token: "USDC",
    mode: "bridge",
  },
  {
    id: "arc-to-arbitrum-sepolia",
    label: "Arc → Arbitrum Sepolia",
    fromChain: "Arc_Testnet",
    toChain: "Arbitrum_Sepolia",
    token: "USDC",
    mode: "bridge",
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
