"use client";

import { createPublicClient, fallback, http, type Chain, type EIP1193Provider, type PublicClient } from "viem";
import type { AppKit } from "@circle-fin/app-kit";
import type { CrosschainRoute } from "@/config/crosschain";
import { getRpcUrlsForChainId } from "@/config/rpc";

let sharedKit: AppKit | null = null;

export async function getAppKit() {
  if (!sharedKit) {
    const { AppKit } = await import("@circle-fin/app-kit");
    sharedKit = new AppKit();
  }
  return sharedKit;
}

function createStablecoinKitPublicClient({ chain }: { chain: Chain }): PublicClient {
  const rpcUrls = getRpcUrlsForChainId(chain.id);
  const transport = rpcUrls?.length ? fallback(rpcUrls.map((url) => http(url))) : http();
  return createPublicClient({ chain, transport }) as unknown as PublicClient;
}

export function createAccountSafeProvider(provider: EIP1193Provider, account?: `0x${string}`): EIP1193Provider {
  if (!account) return provider;
  return {
    ...provider,
    request: async (args) => {
      if (args.method === "eth_requestAccounts" || args.method === "eth_accounts") return [account];
      return provider.request(args as Parameters<EIP1193Provider["request"]>[0]);
    },
  } as EIP1193Provider;
}

/**
 * Wraps an EIP-1193 provider so that `eth_sendTransaction` is intercepted:
 * the tx is signed via the supplied `signTransaction` callback (Privy embedded
 * wallet), and the resulting raw tx is broadcast through our own publicClient
 * (via /api/rpc/<chain>) instead of Privy's RPC, which doesn't broadcast on
 * testnets cleanly. All other RPC methods pass through unchanged.
 */
export function createSignAndForwardProvider(
  provider: EIP1193Provider,
  account: `0x${string}`,
  signTransaction: (req: {
    to?: `0x${string}`;
    data?: `0x${string}`;
    value?: `0x${string}`;
    chainId: number;
    gasLimit?: `0x${string}`;
    nonce?: `0x${string}`;
    maxFeePerGas?: `0x${string}`;
    maxPriorityFeePerGas?: `0x${string}`;
    gasPrice?: `0x${string}`;
  }) => Promise<`0x${string}`>,
  getRawClient: (chainId: number) => PublicClient | null
): EIP1193Provider {
  const inner = createAccountSafeProvider(provider, account);
  return {
    ...inner,
    request: async (args) => {
      if (args.method === "eth_sendTransaction") {
        const params = (args.params as Array<Record<string, string>>) || [];
        const tx = params[0] || {};
        const chainIdHex = (await provider.request({ method: "eth_chainId" } as Parameters<EIP1193Provider["request"]>[0])) as string;
        const chainId = parseInt(chainIdHex, 16);
        const pub = getRawClient(chainId);
        if (!pub) throw new Error(`No public client configured for chain ${chainId}`);
        // Fill nonce / gas if missing.
        const nonce = tx.nonce
          ? BigInt(tx.nonce)
          : BigInt(await pub.getTransactionCount({ address: account, blockTag: "pending" }));
        let gasLimit: bigint;
        if (tx.gas) {
          gasLimit = BigInt(tx.gas);
        } else {
          const est = await pub.estimateGas({
            account,
            to: tx.to as `0x${string}` | undefined,
            data: tx.data as `0x${string}` | undefined,
            value: tx.value ? BigInt(tx.value) : undefined,
          });
          gasLimit = est + est / BigInt(5);
        }
        const fees = (await pub.estimateFeesPerGas().catch(() => null)) as
          | { maxFeePerGas?: bigint; maxPriorityFeePerGas?: bigint; gasPrice?: bigint }
          | null;
        const feeFields: Record<string, `0x${string}`> = {};
        if (tx.maxFeePerGas) {
          feeFields.maxFeePerGas = tx.maxFeePerGas as `0x${string}`;
          feeFields.maxPriorityFeePerGas = (tx.maxPriorityFeePerGas as `0x${string}`) ?? `0x0`;
        } else if (tx.gasPrice) {
          feeFields.gasPrice = tx.gasPrice as `0x${string}`;
        } else if (fees?.maxFeePerGas && fees?.maxPriorityFeePerGas) {
          feeFields.maxFeePerGas = `0x${fees.maxFeePerGas.toString(16)}`;
          feeFields.maxPriorityFeePerGas = `0x${fees.maxPriorityFeePerGas.toString(16)}`;
        } else if (fees?.gasPrice) {
          feeFields.gasPrice = `0x${fees.gasPrice.toString(16)}`;
        }
        const signed = await signTransaction({
          to: tx.to as `0x${string}` | undefined,
          data: (tx.data as `0x${string}` | undefined) ?? "0x",
          value: (tx.value as `0x${string}` | undefined) ?? "0x0",
          chainId,
          gasLimit: `0x${gasLimit.toString(16)}`,
          nonce: `0x${nonce.toString(16)}`,
          ...feeFields,
        });
        return pub.sendRawTransaction({ serializedTransaction: signed });
      }
      return inner.request(args as Parameters<EIP1193Provider["request"]>[0]);
    },
  } as EIP1193Provider;
}

export async function createBrowserAppKitAdapter(provider: EIP1193Provider, account?: `0x${string}`) {
  const { createViemAdapterFromProvider } = await import("@circle-fin/adapter-viem-v2");
  return createViemAdapterFromProvider({
    provider: createAccountSafeProvider(provider, account),
    getPublicClient: createStablecoinKitPublicClient,
  });
}

export type BridgeSpeed = "FAST" | "SLOW";
export type SwapToken = "USDC" | "EURC";

const CIRCLE_KIT_KEY = process.env.NEXT_PUBLIC_CIRCLE_KIT_KEY?.trim() || "";

function getSwapConfig() {
  if (!CIRCLE_KIT_KEY) throw new Error("Circle Kit key is missing. Add NEXT_PUBLIC_CIRCLE_KIT_KEY to enable swaps.");
  return {
    kitKey: CIRCLE_KIT_KEY,
    slippageBps: 100,
    allowanceStrategy: "approve" as const,
  };
}

export interface BridgeEstimateSummary {
  /** Best-effort total bridge ETA in seconds, when the SDK provides one. */
  totalEtaSeconds?: number;
  /** Best-effort attestation-only ETA in seconds (the dominant CCTP wait). */
  attestationEtaSeconds?: number;
  feeCount: number;
  gasFeeCount: number;
  totalUsdcFees: number;
  feeLabels: string[];
  gasLabels: string[];
}

export interface BridgeProgressEvent {
  method: string;
  label: string;
  state?: string;
  txHash?: string;
  errorMessage?: string;
}

function getBridgeConfig(speed: BridgeSpeed) {
  return {
    transferSpeed: speed,
    batchTransactions: false,
  } as const;
}

function parseBridgeProgress(payload: unknown): BridgeProgressEvent {
  const event = payload as {
    method?: string;
    values?: {
      name?: string;
      state?: string;
      txHash?: string;
      data?: unknown;
      error?: unknown;
      errorMessage?: string;
    };
  };
  const method = event.method || event.values?.name || "bridge";
  const txHashFromData = (event.values?.data as { txHash?: string } | undefined)?.txHash;
  const txHash = event.values?.txHash || txHashFromData;
  const rawError = event.values?.error;
  const errorMessage = event.values?.errorMessage || (rawError instanceof Error ? rawError.message : typeof rawError === "string" ? rawError : undefined);
  const labels: Record<string, string> = {
    approve: "Approving USDC spend",
    burn: "Source burn submitted",
    fetchAttestation: "Waiting for Circle attestation",
    reAttest: "Refreshing Circle attestation",
    mint: "Minting on destination chain",
  };

  return {
    method,
    label: labels[method] || `Bridge step: ${method}`,
    state: event.values?.state,
    txHash,
    errorMessage,
  };
}

export async function estimateSwapTransfer(
  provider: EIP1193Provider,
  tokenIn: SwapToken,
  tokenOut: SwapToken,
  amountIn: string
) {
  const adapter = await createBrowserAppKitAdapter(provider);
  const kit = await getAppKit();

  return (kit as { estimateSwap: (params: unknown) => Promise<unknown> }).estimateSwap({
    from: { adapter, chain: "Arc_Testnet" },
    tokenIn,
    tokenOut,
    amountIn,
    config: getSwapConfig(),
  });
}

export async function executeSwapTransfer(
  provider: EIP1193Provider,
  tokenIn: SwapToken,
  tokenOut: SwapToken,
  amountIn: string
) {
  const adapter = await createBrowserAppKitAdapter(provider);
  const kit = await getAppKit();

  return (kit as { swap: (params: unknown) => Promise<unknown> }).swap({
    from: { adapter, chain: "Arc_Testnet" },
    tokenIn,
    tokenOut,
    amountIn,
    config: getSwapConfig(),
  });
}

export function getSwapErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "Swap failed";
  if (/kit key/i.test(message)) return message;
  if (/insufficient/i.test(message)) return "Insufficient balance for this swap.";
  if (/user rejected|denied|rejected/i.test(message)) return "Transaction rejected.";
  return message.slice(0, 220);
}

export async function estimateBridgeTransfer(
  provider: EIP1193Provider,
  route: CrosschainRoute,
  recipient: string,
  amount: string,
  speed: BridgeSpeed,
  useForwarder = true,
  account?: `0x${string}`
) {
  const adapter = await createBrowserAppKitAdapter(provider, account);
  const kit = await getAppKit();

  const destination = useForwarder
    ? { chain: route.toChain, recipientAddress: recipient, useForwarder: true as const }
    : { adapter, chain: route.toChain, recipientAddress: recipient };

  return kit.estimateBridge({
    from: { adapter, chain: route.fromChain },
    to: destination,
    amount,
    token: "USDC",
    config: getBridgeConfig(speed),
  });
}

/**
 * Pluck a number from a candidate field on an SDK response. The Circle SDK has
 * shipped time fields under several names across versions, so probe defensively.
 */
function pickSeconds(source: Record<string, unknown> | undefined, keys: string[]): number | undefined {
  if (!source) return undefined;
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "number" && Number.isFinite(value) && value > 0) return value;
    if (typeof value === "string") {
      const num = Number(value);
      if (Number.isFinite(num) && num > 0) return num;
    }
  }
  return undefined;
}

export function summarizeBridgeEstimate(estimate: unknown): BridgeEstimateSummary {
  const estimateRecord = estimate as {
    fees?: Array<{ type?: string; amount?: string; token?: string; symbol?: string }>;
    gasFees?: Array<{ chain?: string; amount?: string; token?: string; symbol?: string }>;
    estimatedTime?: number | string;
    eta?: number | string;
    durationSeconds?: number | string;
    attestation?: Record<string, unknown>;
    timing?: Record<string, unknown>;
  };

  const fees = Array.isArray(estimateRecord.fees) ? estimateRecord.fees : [];
  const gasFees = Array.isArray(estimateRecord.gasFees) ? estimateRecord.gasFees : [];
  const totalUsdcFees = fees.reduce((sum, fee) => {
    const amount = typeof fee.amount === "string" ? Number(fee.amount) : undefined;
    return Number.isFinite(amount) ? sum + (amount as number) : sum;
  }, 0);

  // Total ETA: top-level estimatedTime / eta / durationSeconds, or timing.totalSeconds.
  const totalEtaSeconds =
    pickSeconds(estimateRecord as unknown as Record<string, unknown>, ["estimatedTime", "eta", "durationSeconds"]) ||
    pickSeconds(estimateRecord.timing, ["totalSeconds", "total", "eta"]);

  // Attestation ETA: attestation.estimatedSeconds / timing.attestationSeconds.
  const attestationEtaSeconds =
    pickSeconds(estimateRecord.attestation, ["estimatedSeconds", "eta", "seconds"]) ||
    pickSeconds(estimateRecord.timing, ["attestationSeconds", "attestation"]);

  return {
    totalEtaSeconds,
    attestationEtaSeconds,
    feeCount: fees.length,
    gasFeeCount: gasFees.length,
    totalUsdcFees,
    feeLabels: fees.map((fee) => [fee.type || "Fee", fee.amount, fee.token || fee.symbol].filter(Boolean).join(" • ")),
    gasLabels: gasFees.map((fee) => [fee.chain || "Gas", fee.amount, fee.token || fee.symbol].filter(Boolean).join(" • ")),
  };
}

/** Render a seconds value as "12s" / "3m 20s" / "1h 5m". */
export function formatEtaSeconds(seconds: number): string {
  if (seconds < 60) return `~${Math.round(seconds)}s`;
  if (seconds < 3600) {
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    return s ? `~${m}m ${s}s` : `~${m}m`;
  }
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return m ? `~${h}h ${m}m` : `~${h}h`;
}

export async function executeBridgeTransfer(
  provider: EIP1193Provider,
  route: CrosschainRoute,
  recipient: string,
  amount: string,
  speed: BridgeSpeed,
  onProgress?: (event: BridgeProgressEvent) => void,
  useForwarder = true,
  account?: `0x${string}`
) {
  const adapter = await createBrowserAppKitAdapter(provider, account);
  const kit = await getAppKit();
  const handler = onProgress ? (payload: unknown) => onProgress(parseBridgeProgress(payload)) : undefined;

  const destination = useForwarder
    ? { chain: route.toChain, recipientAddress: recipient, useForwarder: true as const }
    : { adapter, chain: route.toChain, recipientAddress: recipient };

  if (handler) kit.on("*", handler);
  try {
    return await kit.bridge({
      from: { adapter, chain: route.fromChain },
      to: destination,
      amount,
      token: "USDC",
      config: getBridgeConfig(speed),
    });
  } finally {
    if (handler) kit.off("*", handler);
  }
}

function simplifyBridgeError(message: string) {
  if (/iris-api.*circle|safesurf|biznet|cert.*altname|fetch failed|failed to fetch|network/i.test(message)) {
    return "Circle IRIS API/network failed. If you are on Biznet SafeSurf or filtered DNS, switch network/VPN/private DNS and retry.";
  }
  return message;
}

export function getBridgeErrorMessage(result: unknown) {
  const bridgeResult = result as { steps?: Array<{ name?: string; errorMessage?: string; error?: unknown }> };
  const failedStep = bridgeResult.steps?.find((step) => step.errorMessage || step.error);
  if (!failedStep) return "Crosschain transfer failed";

  const rawError = failedStep.error;
  const rawMessage = rawError instanceof Error ? rawError.message : typeof rawError === "string" ? rawError : "";
  const message = simplifyBridgeError(failedStep.errorMessage || rawMessage || "Crosschain transfer failed");
  return [failedStep.name, message].filter(Boolean).join(": ").slice(0, 220);
}
