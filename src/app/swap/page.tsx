"use client";

import { useMemo, useState } from "react";
import { useAccount, useChainId, useReadContracts, useSwitchChain } from "wagmi";
import type { EIP1193Provider } from "viem";
import { isAddress } from "viem";
import { AppShell } from "@/components/AppShell";
import { TokenLogo } from "@/components/TokenLogo";
import { useRadiusAuth } from "@/lib/web3auth";
import { useMounted } from "@/lib/useMounted";
import { TOKENS, ERC20_TRANSFER_ABI, type TokenKey } from "@/config/tokens";
import { arcTestnet } from "@/config/wagmi";
import { executeSwapTransfer, estimateSwapTransfer, getSwapErrorMessage } from "@/lib/appkit";
import { decimalToUnits, formatAddress, formatAmount, getIdentityLabel, getIdentityProfile, getLocalTransfers, getPaymentRequests, saveLocalTransfer } from "@/lib/utils";
import { pushRemoteActivity } from "@/lib/activity-sync";

type SwapStatus = "idle" | "estimating" | "confirming" | "success" | "error";

const swapTokens: TokenKey[] = ["USDC", "EURC"];

export default function SwapPage() {
  const { address: wagmiAddress, isConnected: wagmiConnected, connector } = useAccount();
  const { authenticated, address: authAddress, provider: authProvider, chainId: authChainId, switchChain: switchAuthChain } = useRadiusAuth();
  const address = wagmiAddress ?? authAddress;
  const isConnected = wagmiConnected || authenticated;
  const wagmiChainId = useChainId();
  const activeChainId = wagmiConnected ? wagmiChainId : authChainId;
  const { switchChainAsync } = useSwitchChain();
  const mounted = useMounted();

  const [tokenIn, setTokenIn] = useState<TokenKey>("USDC");
  const tokenOut: TokenKey = tokenIn === "USDC" ? "EURC" : "USDC";
  const [amount, setAmount] = useState("");
  const receiver = address ?? "";
  const [status, setStatus] = useState<SwapStatus>("idle");
  const [error, setError] = useState("");
  const [txHash, setTxHash] = useState("");
  const [estimateText, setEstimateText] = useState("");


  const { data: balances } = useReadContracts({
    contracts: address ? swapTokens.map((key) => ({
      address: TOKENS[key].address,
      abi: ERC20_TRANSFER_ABI,
      functionName: "balanceOf",
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
  const requestedRaw = amount && Number(amount) > 0 ? decimalToUnits(amount, TOKENS[tokenIn].decimals) : BigInt(0);
  const hasEnoughBalance = typeof inputBalance === "bigint" ? inputBalance >= requestedRaw : true;
  const isOnArc = activeChainId === arcTestnet.id;
  const canSwap = isConnected && isOnArc && isAddress(receiver) && Number(amount) > 0 && hasEnoughBalance && status !== "estimating" && status !== "confirming";
  const senderLabel = mounted ? getIdentityLabel(getIdentityProfile()) : "Connected wallet";

  async function getActiveProvider() {
    if (wagmiConnected && connector?.getProvider) {
      try {
        const provider = (await connector.getProvider()) as EIP1193Provider | undefined;
        if (provider) return provider;
      } catch {
        // fall through
      }
    }
    if (authProvider) return authProvider as EIP1193Provider;
    return (globalThis as typeof globalThis & { ethereum?: EIP1193Provider }).ethereum ?? null;
  }

  async function switchToArc() {
    if (wagmiConnected) await switchChainAsync({ chainId: arcTestnet.id });
    else await switchAuthChain(arcTestnet.id);
  }

  function flipTokens() {
    setTokenIn((current) => current === "USDC" ? "EURC" : "USDC");
    setError("");
    setEstimateText("");
    setTxHash("");
    setStatus("idle");
  }

  async function handleEstimate() {
    if (!amount || Number(amount) <= 0) return;
    setStatus("estimating");
    setError("");
    setEstimateText("");
    try {
      const provider = await getActiveProvider();
      if (!provider) throw new Error("Wallet provider unavailable. Reconnect and try again.");
      const estimate = await estimateSwapTransfer(provider, tokenIn, tokenOut, amount) as { estimatedOutput?: { amount?: string; token?: string }; stopLimit?: { amount?: string; token?: string } };
      const output = estimate.estimatedOutput?.amount ? `${estimate.estimatedOutput.amount} ${estimate.estimatedOutput.token}` : "Quote ready";
      const min = estimate.stopLimit?.amount ? ` · Min ${estimate.stopLimit.amount} ${estimate.stopLimit.token}` : "";
      setEstimateText(`${output}${min}`);
      setStatus("idle");
    } catch (err) {
      setStatus("error");
      setError(getSwapErrorMessage(err));
    }
  }

  async function handleSwap(e: React.FormEvent) {
    e.preventDefault();
    if (!address) return;
    if (!isOnArc) {
      setStatus("error");
      setError("Switch wallet to Arc Testnet first.");
      return;
    }
    if (!hasEnoughBalance) {
      setStatus("error");
      setError(`Insufficient ${tokenIn} balance.`);
      return;
    }

    setStatus("confirming");
    setError("");
    setTxHash("");
    try {
      const provider = await getActiveProvider();
      if (!provider) throw new Error("Wallet provider unavailable. Reconnect and try again.");
      const result = await executeSwapTransfer(provider, tokenIn, tokenOut, amount) as { txHash: `0x${string}`; amountOut?: string };
      setTxHash(result.txHash);
      saveLocalTransfer({
        from: address,
        to: receiver,
        value: requestedRaw.toString(),
        token: tokenIn,
        txHash: result.txHash,
        direction: "sent",
        routeLabel: `Swap ${tokenIn} → ${tokenOut}`,
      });
      void pushRemoteActivity(address, { requests: getPaymentRequests(), transfers: getLocalTransfers() });
      setEstimateText(result.amountOut ? `Received ${result.amountOut} ${tokenOut}` : estimateText);
      setStatus("success");
    } catch (err) {
      setStatus("error");
      setError(getSwapErrorMessage(err));
    }
  }

  return (
    <AppShell>
      <div className="bridge-v2">
        <form onSubmit={handleSwap} className="space-y-4">
          <header className="bridge-v2-header">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--brand)]">Arc swap</p>
              <h1 className="text-2xl font-black tracking-tight text-[#17151f]">Swap</h1>
              <p className="mt-1 text-xs text-[#8b8795]">Swap USDC ↔ EURC on Arc Testnet.</p>
            </div>
          </header>

          <section className="bridge-premium-card p-4">
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-[#8b8795]">Token pair</p>
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
              <button type="button" onClick={() => setTokenIn("USDC")} className={`bridge-chain-card ${tokenIn === "USDC" ? "is-active" : ""}`}>
                <span className="bridge-chain-avatar"><TokenLogo symbol="USDC" size={28} /></span>
                <span className="min-w-0 text-left"><b>USDC</b><small>From</small></span>
              </button>
              <button type="button" onClick={flipTokens} className="bridge-switch-btn" aria-label="Switch swap direction">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M7 7h11"/><path d="m14 3 4 4-4 4"/><path d="M17 17H6"/><path d="m10 21-4-4 4-4"/></svg>
              </button>
              <button type="button" onClick={() => setTokenIn("EURC")} className={`bridge-chain-card ${tokenOut === "EURC" ? "is-active" : ""}`}>
                <span className="bridge-chain-avatar is-destination"><TokenLogo symbol="EURC" size={28} /></span>
                <span className="min-w-0 text-left"><b>{tokenOut}</b><small>To</small></span>
              </button>
            </div>
          </section>

          <section className="bridge-premium-card p-4">
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-[#8b8795]">Amount</p>
            <div className="relative">
              <input className="radius-input pr-28 text-3xl font-black tracking-[-0.04em]" inputMode="decimal" value={amount} onChange={(e) => { setAmount(e.target.value); setEstimateText(""); setError(""); }} placeholder="0.00" />
              <span className="absolute right-4 top-1/2 flex -translate-y-1/2 items-center gap-2 rounded-xl bg-white/75 px-2 py-1 text-sm font-semibold text-[#3d3750]"><TokenLogo symbol={tokenIn} size={20} />{tokenIn}</span>
            </div>
            {inputBalance !== undefined && (
              <div className="mt-3 flex items-center justify-between gap-3 text-xs text-[#8b8795]">
                <span>Available: {formatAmount(inputBalance, TOKENS[tokenIn].decimals)} {tokenIn}</span>
                <button type="button" onClick={() => setAmount(formatAmount(inputBalance, TOKENS[tokenIn].decimals).replace(/,/g, ""))} className="font-semibold text-[var(--brand)]">Max</button>
              </div>
            )}
            {!hasEnoughBalance && amount && Number(amount) > 0 && <p className="mt-3 rounded-2xl bg-red-500/10 p-3 text-xs font-medium text-red-500">Insufficient {tokenIn} balance.</p>}
          </section>

          <section className="bridge-premium-card p-4">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8b8795]">Receiver</p>
            <div className="mt-3 rounded-2xl bg-white/60 p-3 text-sm text-[#17151f]">
              <b>{senderLabel}</b>
              <p className="mt-1 break-all text-xs text-[#8b8795]">{receiver ? `${formatAddress(receiver)} · own address` : "Connect wallet"}</p>
            </div>
          </section>

          {estimateText && <p className="rounded-2xl bg-emerald-500/10 p-3 text-xs font-medium text-emerald-600">{estimateText}</p>}
          {error && <p className="rounded-2xl bg-red-500/10 p-3 text-xs font-medium text-red-500">{error}</p>}
          {txHash && <a href={`${arcTestnet.blockExplorers.default.url}/tx/${txHash}`} target="_blank" rel="noopener noreferrer" className="block rounded-2xl bg-white/70 p-3 text-xs font-semibold text-[var(--brand)]">View transaction · {formatAddress(txHash)}</a>}

          {!isConnected ? (
            <div className="bridge-premium-card p-4 text-sm text-[#8b8795]">Connect your wallet from Home first.</div>
          ) : !isOnArc ? (
            <button type="button" onClick={switchToArc} className="primary-btn w-full rounded-2xl px-4 py-4 font-semibold text-white">Switch to Arc Testnet</button>
          ) : (
            <div className="grid grid-cols-[0.8fr_1.2fr] gap-3">
              <button type="button" onClick={handleEstimate} disabled={!amount || Number(amount) <= 0 || status === "estimating"} className="ghost-btn rounded-2xl px-4 py-4 text-sm font-semibold disabled:opacity-40">{status === "estimating" ? "Quoting..." : "Quote"}</button>
              <button type="submit" disabled={!canSwap} className="primary-btn rounded-2xl px-4 py-4 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none">{status === "confirming" ? "Swapping..." : `Swap to ${tokenOut}`}</button>
            </div>
          )}
        </form>
      </div>
    </AppShell>
  );
}
