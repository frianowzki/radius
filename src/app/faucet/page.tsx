"use client";

import { useState } from "react";
import Link from "next/link";
import { useAccount } from "wagmi";
import { isAddress } from "viem";
import { useRadiusAuth } from "@/lib/web3auth";
import { AppShell } from "@/components/AppShell";
import { TokenLogo } from "@/components/TokenLogo";

const CIRCLE_FAUCET = "https://faucet.circle.com/";

type FaucetChain = "ARC-TESTNET" | "ETH-SEPOLIA" | "BASE-SEPOLIA" | "ARB-SEPOLIA";
type FaucetToken = "usdc" | "eurc";

const CHAINS: { id: FaucetChain; label: string; tokens: FaucetToken[] }[] = [
  { id: "ARC-TESTNET", label: "Arc Testnet", tokens: ["usdc", "eurc"] },
  { id: "ETH-SEPOLIA", label: "Ethereum Sepolia", tokens: ["usdc"] },
  { id: "BASE-SEPOLIA", label: "Base Sepolia", tokens: ["usdc"] },
  { id: "ARB-SEPOLIA", label: "Arbitrum Sepolia", tokens: ["usdc"] },
];

type Status = "idle" | "loading" | "success" | "error";

export default function FaucetPage() {
  const { address: wagmiAddress } = useAccount();
  const { address: authAddress } = useRadiusAuth();
  const connectedAddress = wagmiAddress || authAddress || "";

  const [recipient, setRecipient] = useState(connectedAddress);
  const [chain, setChain] = useState<FaucetChain>("ARC-TESTNET");
  const [token, setToken] = useState<FaucetToken>("usdc");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");
  const [fallbackUrl, setFallbackUrl] = useState("");

  const targetAddress = (recipient || connectedAddress).trim();
  const validAddress = isAddress(targetAddress);
  const chainConfig = CHAINS.find((c) => c.id === chain)!;
  const supportsToken = chainConfig.tokens.includes(token);

  async function requestDrip(e: React.FormEvent) {
    e.preventDefault();
    if (!validAddress || !supportsToken) return;
    setStatus("loading");
    setMessage("");
    setFallbackUrl("");
    try {
      const res = await fetch("/api/faucet", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ address: targetAddress, blockchain: chain, token }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus("error");
        setMessage(data.error || "Faucet request failed");
        if (data.fallbackUrl) setFallbackUrl(data.fallbackUrl);
        return;
      }
      setStatus("success");
      setMessage(`${token.toUpperCase()} drip requested on ${chainConfig.label}. It usually arrives within a minute.`);
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Network error");
    }
  }

  return (
    <AppShell>
      <div className="screen-pad">
        <header className="mb-6 flex items-center justify-between">
          <Link href="/" aria-label="Back" className="grid h-9 w-9 place-items-center rounded-full bg-white/40 text-[var(--brand)] backdrop-blur transition-colors hover:bg-white/60">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          </Link>
          <h1 className="text-sm font-bold">Add testnet funds</h1>
          <span className="w-9" />
        </header>

        <form onSubmit={requestDrip} className="space-y-4">
          <section className="soft-card rounded-[28px] p-5">
            <label className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-[#8b8795]">Recipient</label>
            <input
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder={connectedAddress || "0x..."}
              className="radius-input font-mono text-xs"
            />
            {!validAddress && targetAddress && (
              <p className="mt-2 text-xs text-red-500">Enter a valid EVM address.</p>
            )}
          </section>

          <section className="soft-card rounded-[28px] p-5">
            <label className="mb-3 block text-xs font-bold uppercase tracking-[0.18em] text-[#8b8795]">Chain</label>
            <div className="grid grid-cols-2 gap-2">
              {CHAINS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => {
                    setChain(option.id);
                    if (!option.tokens.includes(token)) setToken(option.tokens[0]);
                  }}
                  className={`frosted-choice text-xs ${chain === option.id ? "active" : ""}`}
                >
                  <p className="font-bold">{option.label}</p>
                  <p className="mt-1 text-[10px] uppercase tracking-[0.18em] opacity-70">{option.tokens.join(" • ")}</p>
                </button>
              ))}
            </div>
          </section>

          <section className="soft-card rounded-[28px] p-5">
            <label className="mb-3 block text-xs font-bold uppercase tracking-[0.18em] text-[#8b8795]">Token</label>
            <div className="grid grid-cols-2 gap-2">
              {(["usdc", "eurc"] as FaucetToken[]).map((option) => {
                const enabled = chainConfig.tokens.includes(option);
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => enabled && setToken(option)}
                    disabled={!enabled}
                    className={`frosted-choice flex items-center gap-3 ${token === option && enabled ? "active" : ""} ${enabled ? "" : "opacity-40"}`}
                  >
                    <TokenLogo symbol={option.toUpperCase()} size={26} />
                    <div className="text-left">
                      <p className="text-sm font-bold">{option.toUpperCase()}</p>
                      <p className="text-[10px] uppercase tracking-[0.18em] opacity-70">
                        {enabled ? "Available" : "Not on this chain"}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <button
            type="submit"
            disabled={!validAddress || !supportsToken || status === "loading"}
            className="primary-btn w-full text-sm disabled:opacity-40"
          >
            {status === "loading" ? "Requesting drip…" : `Drip ${token.toUpperCase()} on ${chainConfig.label}`}
          </button>

          {status === "success" && (
            <div className="flex items-start gap-3 rounded-[24px] border border-emerald-300/40 bg-emerald-500/10 p-4 text-sm text-emerald-700">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5"><polyline points="20 6 9 17 4 12"/></svg>
              <span>{message}</span>
            </div>
          )}
          {status === "error" && (
            <div className="rounded-[24px] border border-red-300/40 bg-red-500/10 p-4 text-sm text-red-600">
              <p>{message}</p>
              {fallbackUrl && (
                <a href={fallbackUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-xs font-semibold underline">
                  Open faucet.circle.com
                </a>
              )}
            </div>
          )}

          <p className="px-2 text-center text-xs leading-5 text-[#8b8795]">
            Routed through Circle’s testnet faucet.{" "}
            <a href={CIRCLE_FAUCET} target="_blank" rel="noopener noreferrer" className="font-semibold text-[var(--brand)] underline">
              Open the official faucet
            </a>
            {" "}if this app is unavailable.
          </p>
        </form>
      </div>
    </AppShell>
  );
}
