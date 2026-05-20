export const RPC_ENDPOINTS_BY_SLUG = {
  arc: ["https://rpc.testnet.arc.network"],
  sepolia: [
    "https://11155111.rpc.thirdweb.com",
    "https://sepolia.drpc.org",
    "https://ethereum-sepolia.publicnode.com",
  ],
  "base-sepolia": [
    "https://sepolia.base.org",
    "https://base-sepolia-rpc.publicnode.com",
    "https://84532.rpc.thirdweb.com",
  ],
  "arbitrum-sepolia": [
    "https://sepolia-rollup.arbitrum.io/rpc",
    "https://arbitrum-sepolia.drpc.org",
    "https://arbitrum-sepolia-rpc.publicnode.com",
    "https://421614.rpc.thirdweb.com",
  ],
  "avalanche-fuji": [
    "https://api.avax-test.network/ext/bc/C/rpc",
    "https://avalanche-fuji-c-chain-rpc.publicnode.com",
  ],
  "optimism-sepolia": [
    "https://sepolia.optimism.io",
    "https://optimism-sepolia.drpc.org",
    "https://optimism-sepolia-rpc.publicnode.com",
  ],
  "polygon-amoy": [
    "https://rpc-amoy.polygon.technology",
    "https://polygon-amoy-bor-rpc.publicnode.com",
  ],
  "linea-sepolia": ["https://rpc.sepolia.linea.build"],
  "unichain-sepolia": ["https://sepolia.unichain.org"],
  "worldchain-sepolia": ["https://worldchain-sepolia.g.alchemy.com/public"],
  "ink-testnet": ["https://rpc-gel-sepolia.inkonchain.com"],
  "monad-testnet": ["https://testnet-rpc.monad.xyz"],
  "hyperevm-testnet": ["https://rpc.hyperliquid-testnet.xyz/evm"],
  "plume-testnet": ["https://testnet-rpc.plume.org"],
  "sei-testnet": ["https://evm-rpc-testnet.sei-apis.com"],
  "xdc-apothem": ["https://erpc.apothem.network"],
  "codex-testnet": ["https://rpc.codex-stg.xyz"],
} as const;

export const RPC_SLUG_BY_CHAIN_ID = {
  5042002: "arc",
  11155111: "sepolia",
  84532: "base-sepolia",
  421614: "arbitrum-sepolia",
  43113: "avalanche-fuji",
  11155420: "optimism-sepolia",
  80002: "polygon-amoy",
  59141: "linea-sepolia",
  1301: "unichain-sepolia",
  4801: "worldchain-sepolia",
  763373: "ink-testnet",
  10143: "monad-testnet",
  998: "hyperevm-testnet",
  98867: "plume-testnet",
  1328: "sei-testnet",
  51: "xdc-apothem",
  812242: "codex-testnet",
} as const;

export type RpcSlug = keyof typeof RPC_ENDPOINTS_BY_SLUG;
export type SupportedRpcChainId = keyof typeof RPC_SLUG_BY_CHAIN_ID;

export function getRpcSlug(chainId: number): RpcSlug | undefined {
  return RPC_SLUG_BY_CHAIN_ID[chainId as SupportedRpcChainId];
}

export function getBrowserRpcUrl(chainId: number) {
  const slug = getRpcSlug(chainId);
  return slug ? `/api/rpc/${slug}` : undefined;
}

export function getServerRpcUrl(chainId: number) {
  const slug = getRpcSlug(chainId);
  return slug ? RPC_ENDPOINTS_BY_SLUG[slug][0] : undefined;
}

export function getRpcUrlsForChainId(chainId: number) {
  const slug = getRpcSlug(chainId);
  if (!slug) return undefined;
  return [`/api/rpc/${slug}`, ...RPC_ENDPOINTS_BY_SLUG[slug]];
}
