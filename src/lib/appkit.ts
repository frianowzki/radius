"use client";

import type { EIP1193Provider } from "viem";
import { AppKit } from "@circle-fin/app-kit";
import { createViemAdapterFromProvider } from "@circle-fin/adapter-viem-v2";
import type { CrosschainRoute } from "@/config/crosschain";

let sharedKit: AppKit | null = null;

export function getAppKit() {
  if (!sharedKit) sharedKit = new AppKit();
  return sharedKit;
}

export async function createBrowserAppKitAdapter(provider: EIP1193Provider) {
  return createViemAdapterFromProvider({ provider });
}

export interface BridgeEstimateSummary {
  feeCount: number;
  gasFeeCount: number;
  feeLabels: string[];
  gasLabels: string[];
}

export async function estimateBridgeTransfer(
  provider: EIP1193Provider,
  route: CrosschainRoute,
  recipient: string,
  amount: string
) {
  const adapter = await createBrowserAppKitAdapter(provider);
  const kit = getAppKit();

  return kit.estimateBridge({
    from: { adapter, chain: route.fromChain },
    to: {
      adapter,
      chain: route.toChain,
      recipientAddress: recipient,
    },
    amount,
    token: "USDC",
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
  amount: string
) {
  const adapter = await createBrowserAppKitAdapter(provider);
  const kit = getAppKit();

  return kit.bridge({
    from: { adapter, chain: route.fromChain },
    to: {
      adapter,
      chain: route.toChain,
      recipientAddress: recipient,
    },
    amount,
    token: "USDC",
  });
}
