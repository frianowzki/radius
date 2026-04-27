"use client";

import type { EIP1193Provider } from "viem";
import type { AppKit } from "@circle-fin/app-kit";
import type { CrosschainRoute } from "@/config/crosschain";

let sharedKit: AppKit | null = null;

export async function getAppKit() {
  if (!sharedKit) {
    const { AppKit } = await import("@circle-fin/app-kit");
    sharedKit = new AppKit();
  }
  return sharedKit;
}

export async function createBrowserAppKitAdapter(provider: EIP1193Provider) {
  const { createViemAdapterFromProvider } = await import("@circle-fin/adapter-viem-v2");
  return createViemAdapterFromProvider({ provider });
}

export type BridgeSpeed = "FAST" | "SLOW";

export interface BridgeEstimateSummary {
  feeCount: number;
  gasFeeCount: number;
  feeLabels: string[];
  gasLabels: string[];
}

export interface BridgeProgressEvent {
  method: string;
  label: string;
  state?: string;
  txHash?: string;
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
    values?: { name?: string; state?: string; txHash?: string; data?: unknown };
  };
  const method = event.method || event.values?.name || "bridge";
  const txHashFromData = (event.values?.data as { txHash?: string } | undefined)?.txHash;
  const txHash = event.values?.txHash || txHashFromData;
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
  };
}

export async function estimateBridgeTransfer(
  provider: EIP1193Provider,
  route: CrosschainRoute,
  recipient: string,
  amount: string,
  speed: BridgeSpeed
) {
  const adapter = await createBrowserAppKitAdapter(provider);
  const kit = await getAppKit();

  return kit.estimateBridge({
    from: { adapter, chain: route.fromChain },
    to: {
      chain: route.toChain,
      recipientAddress: recipient,
      useForwarder: true,
    },
    amount,
    token: "USDC",
    config: getBridgeConfig(speed),
  });
}

export function summarizeBridgeEstimate(estimate: unknown): BridgeEstimateSummary {
  const estimateRecord = estimate as {
    fees?: Array<{ type?: string; amount?: string; token?: string; symbol?: string }>;
    gasFees?: Array<{ chain?: string; amount?: string; token?: string; symbol?: string }>;
  };

  const fees = Array.isArray(estimateRecord.fees) ? estimateRecord.fees : [];
  const gasFees = Array.isArray(estimateRecord.gasFees) ? estimateRecord.gasFees : [];

  return {
    feeCount: fees.length,
    gasFeeCount: gasFees.length,
    feeLabels: fees.map((fee) => [fee.type || "Fee", fee.amount, fee.token || fee.symbol].filter(Boolean).join(" • ")),
    gasLabels: gasFees.map((fee) => [fee.chain || "Gas", fee.amount, fee.token || fee.symbol].filter(Boolean).join(" • ")),
  };
}

export async function executeBridgeTransfer(
  provider: EIP1193Provider,
  route: CrosschainRoute,
  recipient: string,
  amount: string,
  speed: BridgeSpeed,
  onProgress?: (event: BridgeProgressEvent) => void
) {
  const adapter = await createBrowserAppKitAdapter(provider);
  const kit = await getAppKit();
  const handler = onProgress ? (payload: unknown) => onProgress(parseBridgeProgress(payload)) : undefined;

  if (handler) kit.on("*", handler);
  try {
    return await kit.bridge({
      from: { adapter, chain: route.fromChain },
      to: {
        chain: route.toChain,
        recipientAddress: recipient,
        useForwarder: true,
      },
      amount,
      token: "USDC",
      config: getBridgeConfig(speed),
    });
  } finally {
    if (handler) kit.off("*", handler);
  }
}

export function getBridgeErrorMessage(result: unknown) {
  const bridgeResult = result as { steps?: Array<{ name?: string; errorMessage?: string; error?: unknown }> };
  const failedStep = bridgeResult.steps?.find((step) => step.errorMessage || step.error);
  if (!failedStep) return "Crosschain transfer failed";

  const rawError = failedStep.error;
  const rawMessage = rawError instanceof Error ? rawError.message : typeof rawError === "string" ? rawError : "";
  const message = failedStep.errorMessage || rawMessage || "Crosschain transfer failed";
  return [failedStep.name, message].filter(Boolean).join(": ").slice(0, 220);
}
