"use client";

import { useEffect, useMemo, useState } from "react";
import { useAccount, useChainId, useReadContracts, useSwitchChain, useWalletClient, usePublicClient } from "wagmi";
import type { EIP1193Provider } from "viem";
import { createWalletClient, custom, formatUnits } from "viem";
import { AppShell } from "@/components/AppShell";
import { TokenLogo } from "@/components/TokenLogo";
import { useRadiusAuth } from "@/lib/web3auth";

import { TOKENS, ERC20_TRANSFER_ABI, type TokenKey } from "@/config/tokens";
import { LUNEX_SWAP_POOL, LUNEX_TOKEN_INDEX, LUNEX_POOL_ABI } from "@/config/lunex";
import { arcTestnet } from "@/config/wagmi";
import { decimalToUnits, formatAmount, getLocalTransfers, getPaymentRequests, saveLocalTransfer } from "@/lib/utils";
import { pushRemoteActivity } from "@/lib/activity-sync";

type SwapStatus = "idle" | "approving" | "estimating" | "confirming" | "success" | "error";

const swapTokens: TokenKey[] = ["USDC", "EURC"];

export default function SwapPage() {
  const { address: wagmiAddress, isConnected: wagmiConnected } = useAccount();
  const { authenticated, address: authAddress, provider: authProvider, chainId: authChainId, switchChain: switchAuthChain } = useRadiusAuth();
  const address = wagmiAddress ?? authAddress;
  const isConnected = wagmiConnected || authenticated;
  const wagmiChainId = useChainId();
  const activeChainId = wagmiConnected ? wagmiChainId : authChainId;
  const { switchChainAsync } = useSwitchChain();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();

  const [tokenIn, setTokenIn] = useState<TokenKey>("USDC");
  const tokenOut: TokenKey = tokenIn === "USDC" ? "EURC" : "USDC";
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState<SwapStatus>("idle");
  const [error, setError] = useState("");
  const [txHash, setTxHash] = useState("");
  const [estimateText, setEstimateText] = useState("");
  const [allowanceOk, setAllowanceOk] = useState(false);

  const isOnArc = activeChainId === arcTestnet.id;
  const validAmount = Number(amount) > 0 && Number.isFinite(Number(amount));
  const requestedRaw = amount && validAmount ? decimalToUnits(amount, TOKENS[tokenIn].decimals) : BigInt(0);

  // Pool fee
  const { data: poolData } = useReadContracts({
    contracts: [
      { address: LUNEX_SWAP_POOL, abi: LUNEX_POOL_ABI, functionName: "fee", chainId: arcTestnet.id },
    ],
    query: { refetchInterval: 10_000 },
  });

  const poolFeeRaw = poolData?.[0]?.result as bigint | undefined;
  const feePercent = poolFeeRaw ? Number(poolFeeRaw) / 100 : 0.04;

  // User balances
  const { data: balances } = useReadContracts({
    contracts: address ? swapTokens.map((key) => ({
      address: TOKENS[key].address,
      abi: ERC20_TRANSFER_ABI,
      functionName: "balanceOf" as const,
      args: [address],
      chainId: arcTestnet.id,
    })) : [],
    query: { enabled: !!address },
  });

  const balanceMap = useMemo(() => ({
    USDC: balances?.[0]?.result as bigint | undefined,
    EURC: balances?.[1]?.result as bigint | undefined,
  }), [balances]);
  const inputBalance = balanceMap[tokenIn];
  const hasEnoughBalance = typeof inputBalance === "bigint" ? inputBalance >= requestedRaw : false;

  // Quote from Lunex pool
  const fromIdx = BigInt(LUNEX_TOKEN_INDEX[tokenIn]);
  const toIdx = BigInt(LUNEX_TOKEN_INDEX[tokenOut]);
  const { data: quoteRaw } = useReadContracts({
    contracts: validAmount && requestedRaw > BigInt(0) ? [
      { address: LUNEX_SWAP_POOL, abi: LUNEX_POOL_ABI, functionName: "get_dy" as const, args: [fromIdx, toIdx, requestedRaw], chainId: arcTestnet.id },
    ] : [],
    query: { enabled: validAmount && requestedRaw > BigInt(0), refetchInterval: 5_000 },
  });

  const quoteOut = quoteRaw?.[0]?.result as bigint | undefined;
  const quoteOutText = quoteOut !== undefined ? formatUnits(quoteOut, TOKENS[tokenOut].decimals) : "";

  // Check allowance
  useEffect(() => {
    if (!address || !validAmount || requestedRaw <= BigInt(0)) return;
    let cancelled = false;
    (async () => {
      try {
        const allowance = await publicClient?.readContract({
          address: TOKENS[tokenIn].address,
          abi: ERC20_TRANSFER_ABI,
          functionName: "allowance",
          args: [address, LUNEX_SWAP_POOL],
        });
        if (!cancelled) setAllowanceOk(typeof allowance === "bigint" && allowance >= requestedRaw);
      } catch { if (!cancelled) setAllowanceOk(false); }
    })();
    return () => { cancelled = true; };
  }, [address, tokenIn, requestedRaw, validAmount, publicClient]);

  const canSwap = isConnected && isOnArc && validAmount && hasEnoughBalance && status !== "approving" && status !== "confirming" && status !== "estimating";

  async function getActiveWalletClient() {
    if (walletClient) return walletClient;
    if (!authProvider || !address) return null;
    return createWalletClient({ account: address, chain: arcTestnet, transport: custom(authProvider as EIP1193Provider) });
  }

  async function switchToArc() {
    if (wagmiConnected) await switchChainAsync({ chainId: arcTestnet.id });
    else await switchAuthChain(arcTestnet.id);
  }

  function flipTokens() {
    setTokenIn((c) => c === "USDC" ? "EURC" : "USDC");
    setError("");
    setEstimateText("");
    setTxHash("");
    setStatus("idle");
    setAllowanceOk(false);
  }

  async function handleSwap(e: React.FormEvent) {
    e.preventDefault();
    if (!address || !publicClient) return;
    if (!validAmount) { setStatus("error"); setError("Enter a valid positive amount."); return; }
    if (!isOnArc) { setStatus("error"); setError("Switch wallet to Arc Testnet first."); return; }
    if (!hasEnoughBalance) { setStatus("error"); setError(`Insufficient ${tokenIn} balance.`); return; }

    const wc = await getActiveWalletClient();
    if (!wc) { setStatus("error"); setError("Wallet signer unavailable. Reconnect and try again."); return; }

    try {
      // Step 1: Approve if needed
      if (!allowanceOk) {
        setStatus("approving");
        setError("");
        const approveHash = await wc.writeContract({
          address: TOKENS[tokenIn].address,
          abi: ERC20_TRANSFER_ABI,
          functionName: "approve",
          args: [LUNEX_SWAP_POOL, requestedRaw],
        });
        await publicClient.waitForTransactionReceipt({ hash: approveHash });
        setAllowanceOk(true);
      }

      // Step 2: Quote for min output (1% slippage)
      setStatus("estimating");
      const minOut = await publicClient.readContract({
        address: LUNEX_SWAP_POOL,
        abi: LUNEX_POOL_ABI,
        functionName: "get_dy",
        args: [fromIdx, toIdx, requestedRaw],
      });
      const minOutWithSlippage = (minOut as bigint) * BigInt(99) / BigInt(100);

      // Step 3: Execute swap
      setStatus("confirming");
      setError("");
      const swapHash = await wc.writeContract({
        address: LUNEX_SWAP_POOL,
        abi: LUNEX_POOL_ABI,
        functionName: "exchange",
        args: [fromIdx, toIdx, requestedRaw, minOutWithSlippage],
      });
      await publicClient.waitForTransactionReceipt({ hash: swapHash });

      setTxHash(swapHash);
      const receivedText = formatUnits(minOut as bigint, TOKENS[tokenOut].decimals);
      setEstimateText(`Received ~${receivedText} ${tokenOut}`);
      saveLocalTransfer({
        from: address,
        to: address,
        value: requestedRaw.toString(),
        token: tokenIn,
        txHash: swapHash,
        direction: "sent",
        routeLabel: `Swap ${tokenIn} → ${tokenOut} via Radius Dex`,
      });
      void pushRemoteActivity(address, { requests: getPaymentRequests(), transfers: getLocalTransfers() });
      setStatus("success");
    } catch (err: unknown) {
      setStatus("error");
      if (err instanceof Error) {
        setError(err.message.includes("User rejected") ? "Transaction rejected." : err.message.slice(0, 220));
      } else {
        setError("Swap failed.");
      }
    }
  }

  function resetForm() {
    setAmount("");
    setStatus("idle");
    setError("");
    setTxHash("");
    setEstimateText("");
    setAllowanceOk(false);
  }

  const readyToSwap = canSwap && !error;

  return (
    <AppShell>
      <div className="screen-pad">
        {status === "success" ? (
          /* ─── Success state ─── */
          <div className="space-y-5">
            <div className="glass-panel-strong rounded-[32px] p-6">
              <p className="mb-3 text-[11px] uppercase tracking-[0.3em] text-[var(--brand)]">Swap complete</p>
              <h2 className="text-3xl font-semibold tracking-tight text-glow">Swapped on Arc.</h2>
              <p className="mt-3 text-sm leading-6 text-zinc-400">{estimateText}</p>
              {txHash && (
                <div className="mt-5 rounded-[24px] bg-white/70 p-4 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-500">Transaction</span>
                    <a
                      href={`${arcTestnet.blockExplorers.default.url}/tx/${txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-[var(--brand)]"
                    >
                      {txHash.slice(0, 10)}…{txHash.slice(-8)} ↗
                    </a>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-zinc-500">Route</span>
                    <span className="font-medium text-zinc-700">Radius Dex</span>
                  </div>
                </div>
              )}
              <div className="mt-5 grid grid-cols-2 gap-3">
                <button onClick={resetForm} className="ghost-btn text-sm">Swap again</button>
                {txHash && (
                  <a
                    href={`${arcTestnet.blockExplorers.default.url}/tx/${txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="primary-btn text-center text-sm"
                  >
                    View tx
                  </a>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* ─── Swap form ─── */
          <form onSubmit={handleSwap} className="send-flow space-y-5">
            {/* Hero header */}
            <div className="send-hero-card glass-panel-strong rounded-[32px] p-6">
              <div className="flex items-start gap-4">
                <div className="bridge-header-icon shrink-0">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M7 7h11" /><path d="m14 3 4 4-4 4" /><path d="M17 17H6" /><path d="m10 21-4-4 4-4" />
                  </svg>
                </div>
                <div>
                  <p className="mb-1 text-[11px] uppercase tracking-[0.3em] text-[var(--brand)]">Swap</p>
                  <h2 className="text-2xl font-black tracking-tight text-glow">Stablecoin Swap</h2>
                  <p className="mt-2 max-w-xs text-sm leading-6 text-zinc-400">
                    Swap USDC ↔ EURC instantly via Radius Dex on Arc Testnet.
                  </p>
                </div>
              </div>
            </div>

            {/* Network status */}
            <div className="flow-card compact glass-panel rounded-[28px] p-5 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-zinc-500">Network</span>
                <span className={`inline-flex items-center gap-2 font-medium ${isOnArc ? "text-emerald-500" : "text-amber-500"}`}>
                  <span className={`status-dot ${isOnArc ? "ok" : "warn"}`} aria-hidden="true" />
                  {isOnArc ? "Arc Testnet" : "Switch to Arc Testnet"}
                </span>
              </div>
              {!isOnArc && isConnected && (
                <button type="button" onClick={switchToArc} className="ghost-btn mt-3 w-full text-xs">Switch to Arc</button>
              )}
            </div>

            {/* From card */}
            <div className="flow-card glass-panel rounded-[28px] p-5">
              <div className="mb-3 flex items-center justify-between">
                <label className="text-sm font-medium text-zinc-400">You send</label>
                <span className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">From</span>
              </div>
              <div className="flex items-center gap-3 rounded-[24px] border-0 bg-white/55 p-4">
                <input
                  value={amount}
                  onChange={(e) => { setAmount(e.target.value); setEstimateText(""); setError(""); setAllowanceOk(false); }}
                  inputMode="decimal"
                  placeholder="0.00"
                  className="min-w-0 flex-1 border-0 bg-transparent text-5xl font-semibold tracking-tight outline-none ring-0 focus:ring-0"
                />
                <button
                  type="button"
                  onClick={() => { setTokenIn((c) => c === "USDC" ? "EURC" : "USDC"); setAllowanceOk(false); }}
                  className="inline-flex items-center gap-2 rounded-full bg-[var(--brand)]/8 px-3 py-1.5 text-xs font-semibold text-[var(--brand)]"
                >
                  <TokenLogo symbol={tokenIn} size={20} />
                  {tokenIn}
                </button>
              </div>
              {inputBalance !== undefined && (
                <div className="mt-3 flex items-center justify-between gap-3 text-xs text-zinc-500">
                  <span>Available: {formatAmount(inputBalance, TOKENS[tokenIn].decimals)} {tokenIn}</span>
                  <button
                    type="button"
                    onClick={() => setAmount(formatAmount(inputBalance, TOKENS[tokenIn].decimals).replace(/,/g, ""))}
                    className="font-semibold text-[var(--brand)]"
                  >
                    Max
                  </button>
                </div>
              )}
              {!hasEnoughBalance && amount && validAmount && (
                <p className="mt-3 rounded-2xl bg-red-500/10 p-3 text-xs font-medium text-red-500">Insufficient {tokenIn} balance.</p>
              )}
            </div>

            {/* Flip button — overlaps From/To cards */}
            <div className="relative z-10 flex justify-center" style={{ marginTop: "-22px", marginBottom: "-22px" }}>
              <button
                type="button"
                onClick={flipTokens}
                className="grid h-12 w-12 place-items-center rounded-full border-[3px] border-white bg-gradient-to-b from-blue-400 to-blue-600 text-white shadow-xl shadow-blue-500/30 transition-transform hover:scale-110 active:scale-95"
                aria-label="Switch swap direction"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m7 16 4 4 4-4" /><path d="M11 4v16" /><path d="m17 8-4-4-4 4" />
                </svg>
              </button>
            </div>

            {/* To card */}
            <div className="flow-card glass-panel rounded-[28px] p-5">
              <div className="mb-3 flex items-center justify-between">
                <label className="text-sm font-medium text-zinc-400">You receive</label>
                <span className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">To</span>
              </div>
              <div className="flex items-center gap-3 rounded-[24px] border-0 bg-white/35 p-4">
                <div className="min-w-0 flex-1 text-5xl font-semibold tracking-tight text-zinc-400">
                  {quoteOutText || "0.00"}
                </div>
                <span className="inline-flex items-center gap-2 rounded-full bg-white/60 px-3 py-1.5 text-xs font-semibold text-zinc-600">
                  <TokenLogo symbol={tokenOut} size={20} />
                  {tokenOut}
                </span>
              </div>
              {quoteOutText && (
                <p className="mt-3 text-xs text-zinc-500">
                  Rate: 1 {tokenIn} ≈ {validAmount ? (Number(quoteOutText) / Number(amount)).toFixed(6) : "—"} {tokenOut} · Fee: {feePercent}%
                </p>
              )}
            </div>


            {/* Error / info messages */}
            {estimateText && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">{estimateText}</div>
            )}
            {error && (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
            )}

            {/* CTA button */}
            {!isConnected ? (
              <div className="glass-panel rounded-[28px] p-5 text-center text-sm text-zinc-500">
                Connect your wallet from Home first.
              </div>
            ) : !isOnArc ? (
              <button type="button" onClick={switchToArc} className="primary-btn flow-primary-action w-full">
                Switch to Arc Testnet
              </button>
            ) : (
              <button
                type="submit"
                disabled={!readyToSwap}
                className="primary-btn flow-primary-action w-full disabled:opacity-40"
              >
                {status === "approving"
                  ? "Approving…"
                  : status === "estimating"
                    ? "Getting quote…"
                    : status === "confirming"
                      ? "Swapping…"
                      : `Swap to ${tokenOut}`}
              </button>
            )}

            <p className="text-center text-[11px] font-medium tracking-wide text-zinc-400">Powered by Radius Dex</p>
          </form>
        )}
      </div>
    </AppShell>
  );
}
