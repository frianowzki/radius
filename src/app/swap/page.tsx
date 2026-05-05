"use client";

import { useEffect, useMemo, useState } from "react";
import { useAccount, useChainId, useReadContracts, useSwitchChain, useWalletClient, usePublicClient } from "wagmi";
import type { EIP1193Provider } from "viem";
import { createWalletClient, custom, parseUnits, formatUnits } from "viem";
import { AppShell } from "@/components/AppShell";
import { TokenLogo } from "@/components/TokenLogo";
import { useRadiusAuth } from "@/lib/web3auth";
import { useMounted } from "@/lib/useMounted";
import { TOKENS, ERC20_TRANSFER_ABI, type TokenKey } from "@/config/tokens";
import { LUNEX_SWAP_POOL, LUNEX_TOKEN_INDEX, LUNEX_POOL_ABI } from "@/config/lunex";
import { arcTestnet } from "@/config/wagmi";
import { decimalToUnits, formatAmount, getIdentityLabel, getIdentityProfile, getLocalTransfers, getPaymentRequests, saveLocalTransfer } from "@/lib/utils";
import { pushRemoteActivity } from "@/lib/activity-sync";

type SwapStatus = "idle" | "approving" | "estimating" | "confirming" | "success" | "error";

const swapTokens: TokenKey[] = ["USDC", "EURC"];

export default function SwapPage() {
  const { address: wagmiAddress, isConnected: wagmiConnected, connector } = useAccount();
  const { authenticated, address: authAddress, provider: authProvider, chainId: authChainId, switchChain: switchAuthChain } = useRadiusAuth();
  const address = wagmiAddress ?? authAddress;
  const isConnected = wagmiConnected || authenticated;
  const wagmiChainId = useChainId();
  const activeChainId = wagmiConnected ? wagmiChainId : authChainId;
  const { switchChainAsync } = useSwitchChain();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  const mounted = useMounted();

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
  const senderLabel = mounted ? getIdentityLabel(getIdentityProfile()) : "Connected wallet";

  // Pool reserves + fee
  const { data: poolData } = useReadContracts({
    contracts: [
      { address: LUNEX_SWAP_POOL, abi: LUNEX_POOL_ABI, functionName: "balances", args: [BigInt(LUNEX_TOKEN_INDEX.USDC)], chainId: arcTestnet.id },
      { address: LUNEX_SWAP_POOL, abi: LUNEX_POOL_ABI, functionName: "balances", args: [BigInt(LUNEX_TOKEN_INDEX.EURC)], chainId: arcTestnet.id },
      { address: LUNEX_SWAP_POOL, abi: LUNEX_POOL_ABI, functionName: "fee", chainId: arcTestnet.id },
    ],
    query: { refetchInterval: 10_000 },
  });

  const poolUsdc = poolData?.[0]?.result as bigint | undefined;
  const poolEurc = poolData?.[1]?.result as bigint | undefined;
  const poolFeeRaw = poolData?.[2]?.result as bigint | undefined;
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
    if (!address || !validAmount || requestedRaw <= BigInt(0)) { setAllowanceOk(false); return; }
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
        routeLabel: `Swap ${tokenIn} → ${tokenOut} via Lunex`,
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

  return (
    <AppShell>
      <div className="bridge-v2">
        <form onSubmit={handleSwap} className="space-y-4">
          <header className="bridge-v2-header">
            <div>
              <h1 className="text-2xl font-black tracking-tight text-[#17151f]">Swap</h1>
            </div>
          </header>



          {/* Token pair */}
          <section className="bridge-premium-card p-4">
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-[#8b8795]">Token pair</p>
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
              <button type="button" onClick={() => { setTokenIn("USDC"); setAllowanceOk(false); }} className={`bridge-chain-card ${tokenIn === "USDC" ? "is-active" : ""}`}>
                <span className="bridge-chain-avatar"><TokenLogo symbol="USDC" size={28} /></span>
                <span className="min-w-0 text-left"><b>USDC</b><small>From</small></span>
              </button>
              <button type="button" onClick={flipTokens} className="bridge-switch-btn" aria-label="Switch swap direction">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M7 7h11"/><path d="m14 3 4 4-4 4"/><path d="M17 17H6"/><path d="m10 21-4-4 4-4"/></svg>
              </button>
              <button type="button" onClick={() => { setTokenIn("EURC"); setAllowanceOk(false); }} className={`bridge-chain-card ${tokenIn === "EURC" ? "is-active" : ""}`}>
                <span className="bridge-chain-avatar is-destination"><TokenLogo symbol="EURC" size={28} /></span>
                <span className="min-w-0 text-left"><b>{tokenOut}</b><small>To</small></span>
              </button>
            </div>
          </section>

          {/* Amount */}
          <section className="bridge-premium-card p-4">
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-[#8b8795]">Amount</p>
            <div className="relative">
              <input className="radius-input pr-28 text-3xl font-black tracking-[-0.04em]" inputMode="decimal" value={amount} onChange={(e) => { setAmount(e.target.value); setEstimateText(""); setError(""); setAllowanceOk(false); }} placeholder="0.00" />
              <span className="absolute right-4 top-1/2 flex -translate-y-1/2 items-center gap-2 rounded-xl bg-white/75 px-2 py-1 text-sm font-semibold text-[#3d3750]"><TokenLogo symbol={tokenIn} size={20} />{tokenIn}</span>
            </div>
            {inputBalance !== undefined && (
              <div className="mt-3 flex items-center justify-between gap-3 text-xs text-[#8b8795]">
                <span>Available: {formatAmount(inputBalance, TOKENS[tokenIn].decimals)} {tokenIn}</span>
                <button type="button" onClick={() => setAmount(formatAmount(inputBalance, TOKENS[tokenIn].decimals).replace(/,/g, ""))} className="font-semibold text-[var(--brand)]">Max</button>
              </div>
            )}
            {!hasEnoughBalance && amount && validAmount && <p className="mt-3 rounded-2xl bg-red-500/10 p-3 text-xs font-medium text-red-500">Insufficient {tokenIn} balance.</p>}
          </section>

          {/* Quote preview */}
          {quoteOutText && (
            <section className="bridge-premium-card p-4">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8b8795]">You receive</p>
              <p className="mt-2 text-2xl font-black text-[#17151f]">{quoteOutText} <span className="text-base font-semibold text-[#8b8795]">{tokenOut}</span></p>
            </section>
          )}

          {estimateText && <p className="rounded-2xl bg-emerald-500/10 p-3 text-xs font-medium text-emerald-600">{estimateText}</p>}
          {error && <p className="rounded-2xl bg-red-500/10 p-3 text-xs font-medium text-red-500">{error}</p>}
          {txHash && <a href={`${arcTestnet.blockExplorers.default.url}/tx/${txHash}`} target="_blank" rel="noopener noreferrer" className="block rounded-2xl bg-white/70 p-3 text-xs font-semibold text-[var(--brand)]">View transaction · {txHash.slice(0, 10)}…{txHash.slice(-8)}</a>}

          {!isConnected ? (
            <div className="bridge-premium-card p-4 text-sm text-[#8b8795]">Connect your wallet from Home first.</div>
          ) : !isOnArc ? (
            <button type="button" onClick={switchToArc} className="primary-btn w-full rounded-2xl px-4 py-4 font-semibold text-white">Switch to Arc Testnet</button>
          ) : (
            <button type="submit" disabled={!canSwap} className="primary-btn w-full rounded-2xl px-4 py-4 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none">
              {status === "approving" ? "Approving…" : status === "estimating" ? "Getting quote…" : status === "confirming" ? "Swapping…" : `Swap to ${tokenOut}`}
            </button>
          )}
        </form>
      </div>
    </AppShell>
  );
}
