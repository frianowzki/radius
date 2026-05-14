"use client";

import { config, createConfig, EVM, executeRoute, getRoutes } from "@lifi/sdk";
import { ChainType, type Route } from "@lifi/types";
import { createWalletClient, custom, parseUnits, type EIP1193Provider } from "viem";
import { CHAIN_METADATA, CHAIN_USDC_ADDRESSES, type CrosschainRoute } from "@/config/crosschain";
import { RPC_SLUG_BY_CHAIN_ID, getRpcUrlsForChainId } from "@/config/rpc";

let lifiConfigured = false;

export interface LifiProgressEvent {
  label: string;
  state?: string;
  txHash?: string;
  errorMessage?: string;
}

export interface LifiBridgeResult {
  state: "success" | "error";
  route: Route;
  steps: Array<{ name?: string; txHash?: string; errorMessage?: string; error?: unknown }>;
}

type SwitchChainFn = (chainId: number) => Promise<void>;

const lifiRpcUrls = Object.fromEntries(
  Object.keys(RPC_SLUG_BY_CHAIN_ID).map((chainId) => [Number(chainId), getRpcUrlsForChainId(Number(chainId)) ?? []])
);

function ensureLifiConfig(provider: EIP1193Provider, account: `0x${string}`, switchChain: SwitchChainFn) {
  const getWalletClient = async () => createWalletClient({ account, transport: custom(provider) }) as never;

  if (!lifiConfigured) {
    createConfig({
      integrator: "radius",
      providers: [
        EVM({
          getWalletClient,
          switchChain: async (chainId) => {
            await switchChain(chainId);
            return getWalletClient();
          },
        }),
      ],
      rpcUrls: lifiRpcUrls,
      preloadChains: false,
    });
    lifiConfigured = true;
    return;
  }

  const evmProvider = config.getProvider(ChainType.EVM) as ReturnType<typeof EVM> | undefined;
  evmProvider?.setOptions({
    getWalletClient,
    switchChain: async (chainId) => {
      await switchChain(chainId);
      return getWalletClient();
    },
  });
}

export async function getLifiUsdcRoute(route: CrosschainRoute, account: `0x${string}`, recipient: `0x${string}`, amount: string) {
  const fromChainId = CHAIN_METADATA[route.fromChain].chainId;
  const toChainId = CHAIN_METADATA[route.toChain].chainId;
  const fromTokenAddress = CHAIN_USDC_ADDRESSES[route.fromChain];
  const toTokenAddress = CHAIN_USDC_ADDRESSES[route.toChain];

  const response = await getRoutes({
    fromChainId,
    toChainId,
    fromTokenAddress,
    toTokenAddress,
    fromAddress: account,
    toAddress: recipient,
    fromAmount: parseUnits(amount, 6).toString(),
    options: {
      integrator: "radius",
      order: "RECOMMENDED",
      slippage: 0.005,
      allowSwitchChain: true,
    },
  });

  const bestRoute = response.routes?.[0];
  if (!bestRoute) {
    throw new Error(`LI.FI has no USDC route for ${CHAIN_METADATA[route.fromChain].label} → ${CHAIN_METADATA[route.toChain].label} right now.`);
  }
  return bestRoute;
}

type ExecutedStep = Route["steps"][number] & {
  execution?: {
    status?: string;
    process?: Array<{
      status?: string;
      txHash?: string;
      message?: string;
      error?: { message?: string };
    }>;
  };
};

type ExecutedRoute = Omit<Route, "steps"> & { steps: ExecutedStep[] };

function flattenRouteSteps(route: ExecutedRoute): LifiBridgeResult["steps"] {
  return route.steps.map((step) => {
    const processWithHash = step.execution?.process?.find((process) => process.txHash);
    const failedProcess = step.execution?.process?.find((process) => process.status === "FAILED" || process.error);
    return {
      name: step.toolDetails?.name || step.tool,
      txHash: processWithHash?.txHash,
      errorMessage: failedProcess?.message || failedProcess?.error?.message,
      error: failedProcess?.error,
    };
  });
}

export async function executeLifiUsdcBridgeTransfer(
  provider: EIP1193Provider,
  account: `0x${string}`,
  route: CrosschainRoute,
  recipient: `0x${string}`,
  amount: string,
  switchChain: SwitchChainFn,
  onProgress?: (event: LifiProgressEvent) => void
): Promise<LifiBridgeResult> {
  ensureLifiConfig(provider, account, switchChain);
  const lifiRoute = await getLifiUsdcRoute(route, account, recipient, amount);

  const executed = await executeRoute(lifiRoute, {
    updateRouteHook: (updatedRoute) => {
      const executedRoute = updatedRoute as ExecutedRoute;
      const activeStep = executedRoute.steps.find((step) => step.execution?.status && step.execution.status !== "DONE") ?? executedRoute.steps.at(-1);
      const activeProcess = activeStep?.execution?.process?.at(-1);
      if (activeStep || activeProcess) {
        onProgress?.({
          label: activeStep?.toolDetails?.name || activeStep?.tool || "LI.FI bridge",
          state: activeProcess?.status || activeStep?.execution?.status,
          txHash: activeProcess?.txHash,
          errorMessage: activeProcess?.message || activeProcess?.error?.message,
        });
      }
    },
  });

  const executedRoute = executed as ExecutedRoute;
  const failed = executedRoute.steps.some((step) => step.execution?.status === "FAILED");
  return {
    state: failed ? "error" : "success",
    route: executed as Route,
    steps: flattenRouteSteps(executedRoute),
  };
}

export function getLifiErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "LI.FI bridge route failed.";
  if (/no.*route|routes.*0|not supported/i.test(message)) return message;
  if (/user rejected|denied|rejected/i.test(message)) return "Transaction rejected.";
  return message.slice(0, 220);
}
