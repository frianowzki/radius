"use client";

import { useEffect, useState } from "react";
import { useUnifiedBalance } from "@/lib/unified-balance";
import { useMounted } from "@/lib/useMounted";

/**
 * Displays the user's unified USDC balance across all supported chains.
 * Shows total + per-chain breakdown.
 */
export function UnifiedBalanceCard() {
  const mounted = useMounted();
  const { total, perChain, loading, error, fetchBalance, isConnected } =
    useUnifiedBalance();
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (isConnected && mounted) {
      fetchBalance();
    }
  }, [isConnected, mounted, fetchBalance]);

  if (!mounted || !isConnected) return null;

  const chainNames: Record<number, string> = {
    421614: "Arc",
    11155111: "Ethereum",
    84532: "Base",
    42161: "Arbitrum",
    43113: "Avalanche",
    11155420: "Optimism",
    80002: "Polygon",
    59141: "Linea",
    1301: "Unichain",
    480: "World Chain",
    763373: "Ink",
    41454: "Monad",
    998: "HyperEVM",
    16122: "Plume",
    1328: "Sei",
    51178: "XDC",
    111557560: "Codex",
  };

  const nonZeroChains = Object.entries(perChain)
    .filter(([, bal]) => bal !== "0")
    .map(([chainId, bal]) => ({
      chainId: Number(chainId),
      name: chainNames[Number(chainId)] || `Chain ${chainId}`,
      balance: bal,
    }));

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between"
      >
        <div className="text-left">
          <p className="text-xs text-white/50 uppercase tracking-wider">
            Unified Balance
          </p>
          <p className="text-2xl font-semibold text-white mt-1">
            {loading ? (
              <span className="inline-block h-7 w-24 animate-pulse rounded bg-white/10" />
            ) : (
              `$${total}`
            )}
          </p>
        </div>
        <div className="text-white/40">
          <svg
            className={`h-5 w-5 transition-transform ${expanded ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </div>
      </button>

      {error && (
        <p className="mt-2 text-xs text-red-400">{error}</p>
      )}

      {expanded && (
        <div className="mt-3 space-y-1.5 border-t border-white/10 pt-3">
          {nonZeroChains.length === 0 && !loading && (
            <p className="text-xs text-white/30">
              No balances found across chains
            </p>
          )}
          {nonZeroChains.map(({ chainId, name, balance }) => (
            <div
              key={chainId}
              className="flex items-center justify-between text-sm"
            >
              <span className="text-white/60">{name}</span>
              <span className="text-white font-medium">
                ${balance}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
