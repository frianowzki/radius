"use client";

import { useEffect, useMemo, useState } from "react";
import { useAccount } from "wagmi";
import { isAddress } from "viem";
import { AppShell } from "@/components/AppShell";

const FAUCET_COOLDOWN_MS = 2 * 60 * 60 * 1000;
const FAUCET_HISTORY_KEY = "radius-faucet-requests";

const CHAINS = [
  { id: "ARC-TESTNET", label: "Arc Testnet", blurb: "Best default for Radius payments." },
  { id: "BASE-SEPOLIA", label: "Base Sepolia", blurb: "Useful for Base ↔ Arc bridge testing." },
  { id: "ARB-SEPOLIA", label: "Arbitrum Sepolia", blurb: "Useful for Arbitrum ↔ Arc bridge testing." },
  { id: "ETH-SEPOLIA", label: "Ethereum Sepolia", blurb: "Slower, but good for canonical Sepolia tests." },
] as const;

type FaucetStatus = "idle" | "requesting" | "success" | "error";

type FaucetHistory = Record<string, number>;

function getHistory(): FaucetHistory {
  if (typeof window === "undefined") return {};
  const raw = localStorage.getItem(FAUCET_HISTORY_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as FaucetHistory;
  } catch {
    return {};
  }
}

function saveHistory(history: FaucetHistory) {
  localStorage.setItem(FAUCET_HISTORY_KEY, JSON.stringify(history));
}

function formatWait(ms: number) {
  const minutes = Math.ceil(ms / 60000);
  if (minutes <= 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

export default function FaucetPage() {
  const { address } = useAccount();
  const [manualAddress, setManualAddress] = useState(address ?? "");
  const [chain, setChain] = useState<(typeof CHAINS)[number]["id"]>("ARC-TESTNET");
  const [token, setToken] = useState<"usdc" | "eurc">("usdc");
  const [status, setStatus] = useState<FaucetStatus>("idle");
  const [message, setMessage] = useState("");
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);
  const targetAddress = (address || manualAddress).trim();
  const validAddress = isAddress(targetAddress);

  const cooldown = useMemo(() => {
    const history = getHistory();
    const key = `${targetAddress.toLowerCase()}:${chain}:${token}`;
    const last = history[key] ?? 0;
    return Math.max(0, FAUCET_COOLDOWN_MS - (now - last));
  }, [targetAddress, chain, token, now]);

  async function requestFaucet() {
    if (!validAddress || cooldown > 0) return;
    setStatus("requesting");
    setMessage("");

    const res = await fetch("/api/faucet", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address: targetAddress, blockchain: chain, token }),
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const circleCode = data?.details?.code;
      const circleMessage = data?.details?.message;
      if (circleCode === 5 || String(circleMessage || "").toLowerCase().includes("rate limit")) {
        const history = getHistory();
        const limitedAt = Date.now();
        history[`${targetAddress.toLowerCase()}:${chain}:${token}`] = limitedAt;
        saveHistory(history);
        setNow(limitedAt);
        setStatus("error");
        setMessage("Circle faucet rate limit reached. I started a local 2-hour cooldown; try again later or use the public faucet fallback.");
        return;
      }

      setStatus("error");
      const details = data?.details ? ` ${JSON.stringify(data.details).slice(0, 220)}` : "";
      setMessage(data?.fallbackUrl ? "Server faucet is not configured yet. Use Circle’s public faucet link below." : `${data?.error || "Faucet request failed."}${details}`);
      return;
    }

    const history = getHistory();
    const requestedAt = Date.now();
    history[`${targetAddress.toLowerCase()}:${chain}:${token}`] = requestedAt;
    saveHistory(history);
    setNow(requestedAt);
    setStatus("success");
    setMessage(`Requested ${token.toUpperCase()} on ${chain}.`);
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl space-y-5">
        <section className="glass-panel-strong rounded-[32px] p-7 sm:p-8">
          <p className="mb-3 text-[11px] uppercase tracking-[0.3em] text-zinc-500">Faucet</p>
          <h2 className="text-4xl font-semibold tracking-tight text-glow">Top up testnet funds.</h2>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-zinc-400">
            Request Circle testnet stablecoins for Radius flows. The app tracks a local 2-hour cooldown per address, chain, and token so faucet requests stay clean.
          </p>
        </section>

        <section className="grid gap-5 lg:grid-cols-[1fr_0.8fr]">
          <div className="glass-panel rounded-[28px] p-5 space-y-5">
            <div>
              <label className="mb-2 block text-sm font-medium text-zinc-400">Address</label>
              <input
                value={address ?? manualAddress}
                onChange={(e) => setManualAddress(e.target.value)}
                disabled={!!address}
                placeholder="0x..."
                className="w-full rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-4 font-mono text-sm text-white placeholder-zinc-500 focus:border-indigo-500 focus:outline-none disabled:opacity-70"
              />
              {!validAddress && <p className="mt-2 text-xs text-red-400">Connect wallet or enter a valid EVM address.</p>}
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-zinc-400">Token</label>
              <div className="grid grid-cols-2 gap-2">
                {(["usdc", "eurc"] as const).map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setToken(item)}
                    className={`rounded-2xl border px-4 py-3 text-sm font-semibold uppercase transition-all ${token === item ? "border-indigo-400/30 bg-indigo-500/15 text-indigo-300" : "border-white/6 bg-white/[0.04] text-zinc-400"}`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-zinc-400">Chain</label>
              <div className="grid gap-2 sm:grid-cols-2">
                {CHAINS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setChain(item.id)}
                    className={`rounded-2xl border px-4 py-3 text-left text-sm transition-all ${chain === item.id ? "border-indigo-400/30 bg-indigo-500/15 text-indigo-300" : "border-white/6 bg-white/[0.04] text-zinc-400"}`}
                  >
                    <span className="block font-semibold">{item.label}</span>
                    <span className="mt-1 block text-xs text-zinc-500">{item.blurb}</span>
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={requestFaucet}
              disabled={!validAddress || cooldown > 0 || status === "requesting"}
              className="w-full rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-600 px-4 py-4 font-semibold text-white shadow-lg shadow-indigo-500/20 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {status === "requesting" ? "Requesting..." : cooldown > 0 ? `Available in ${formatWait(cooldown)}` : `Request ${token.toUpperCase()}`}
            </button>

            {message && (
              <p className={`text-center text-sm ${status === "success" ? "text-emerald-300" : "text-amber-300"}`}>{message}</p>
            )}
          </div>

          <div className="glass-panel rounded-[28px] p-5 text-sm leading-7 text-zinc-400">
            <p className="font-semibold text-zinc-100">Fallback</p>
            <p className="mt-2">
              If the server faucet is not configured with a Circle API key, use the public Circle faucet manually. I’m not bypassing CAPTCHA or faucet limits.
            </p>
            <a
              href="https://faucet.circle.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-3 font-semibold text-zinc-100"
            >
              Open Circle faucet
            </a>
            <div className="mt-5 rounded-2xl border border-white/8 bg-white/[0.03] p-4 text-xs leading-6 text-zinc-500">
              Seamless requests require `CIRCLE_API_KEY` in the Vercel project environment. Without it, this tab still gives the right address, token, chain, cooldown, and public faucet handoff.
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
