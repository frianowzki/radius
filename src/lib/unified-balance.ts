"use client";

import { useCallback, useState } from "react";
import { useAccount, useWalletClient } from "wagmi";
import { useRadiusAuth } from "@/lib/web3auth";
import { getAppKit, createBrowserAppKitAdapter } from "@/lib/appkit";
import type { EIP1193Provider } from "viem";

/** Chains supported by Circle Unified Balance */
type UnifiedBalanceChainName =
  | "Arc_Testnet"
  | "Ethereum_Sepolia"
  | "Base_Sepolia"
  | "Arbitrum_Sepolia"
  | "Avalanche_Fuji"
  | "Optimism_Sepolia"
  | "Polygon_Amoy_Testnet"
  | "Unichain_Sepolia"
  | "World_Chain_Sepolia"
  | "HyperEVM_Testnet"
  | "Sei_Testnet"
  | "Sonic_Testnet"
  | "Solana_Devnet";

export interface UnifiedBalanceState {
  /** Total USDC across all chains (as decimal string) */
  total: string;
  /** Per-chain balances: { chainId: amount } */
  perChain: Record<number, string>;
  /** Loading state */
  loading: boolean;
  /** Error message if any */
  error: string | null;
}

export interface SpendFromUnifiedOptions {
  /** Destination chain */
  toChain: UnifiedBalanceChainName;
  /** Recipient address */
  recipient: `0x${string}`;
  /** Amount in decimal USDC */
  amount: string;
}

/**
 * Hook for interacting with Circle Unified Balance.
 *
 * Unified Balance lets users deposit USDC from multiple chains into a single
 * chain-agnostic balance, then spend it instantly on any supported blockchain.
 */
export function useUnifiedBalance() {
  const { address: wagmiAddress } = useAccount();
  const { authenticated, address: authAddress, provider: authProvider } =
    useRadiusAuth();
  const { data: wagmiWalletClient } = useWalletClient();
  const address = wagmiAddress ?? authAddress;

  const [balanceState, setBalanceState] = useState<UnifiedBalanceState>({
    total: "0",
    perChain: {},
    loading: false,
    error: null,
  });

  /** Get the EIP-1193 provider (from wagmi or Privy) */
  const getProvider = useCallback((): EIP1193Provider | null => {
    if (wagmiWalletClient) {
      return wagmiWalletClient.transport as unknown as EIP1193Provider;
    }
    if (authenticated && authProvider) {
      return authProvider as EIP1193Provider;
    }
    return null;
  }, [wagmiWalletClient, authenticated, authProvider]);

  /** Fetch unified balance across all supported chains */
  const fetchBalance = useCallback(async () => {
    if (!address) {
      setBalanceState((s) => ({ ...s, error: "Not connected" }));
      return;
    }
    setBalanceState((s) => ({ ...s, loading: true, error: null }));
    try {
      const kit = await getAppKit();
      const provider = getProvider();
      if (!provider) {
        setBalanceState((s) => ({
          ...s,
          loading: false,
          error: "No provider",
        }));
        return;
      }
      const adapter = await createBrowserAppKitAdapter(
        provider,
        address as `0x${string}`
      );

      const result = await kit.unifiedBalance.getBalances({
        token: "USDC",
        sources: { adapter },
      });

      const perChain: Record<number, string> = {};
      let total = "0";

      if (result && typeof result === "object") {
        const res = result as {
          total?: string;
          perChain?: Array<{ chainId: number; balance: string }>;
        };
        if (res.total) total = res.total;
        if (Array.isArray(res.perChain)) {
          for (const entry of res.perChain) {
            perChain[entry.chainId] = entry.balance;
          }
        }
      }

      setBalanceState({ total, perChain, loading: false, error: null });
    } catch (err) {
      setBalanceState((s) => ({
        ...s,
        loading: false,
        error:
          err instanceof Error ? err.message : "Failed to fetch balance",
      }));
    }
  }, [address, getProvider]);

  /** Spend from unified balance to a recipient on any chain */
  const spend = useCallback(
    async (options: SpendFromUnifiedOptions) => {
      const provider = getProvider();
      if (!provider || !address) {
        throw new Error("Wallet not connected");
      }

      const kit = await getAppKit();
      const adapter = await createBrowserAppKitAdapter(
        provider,
        address as `0x${string}`
      );

      return kit.unifiedBalance.spend({
        from: { adapter },
        to: {
          adapter,
          chain: options.toChain,
          recipientAddress: options.recipient,
        },
        amount: options.amount,
        token: "USDC",
      });
    },
    [getProvider, address]
  );

  return {
    ...balanceState,
    fetchBalance,
    spend,
    isConnected: !!address,
    address,
  };
}

export type { UnifiedBalanceChainName };
