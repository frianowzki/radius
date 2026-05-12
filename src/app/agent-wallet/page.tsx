"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Balance = { token?: string; amount?: string; symbol?: string };
type Wallet = { address: string; blockchain: string; type: string };
type ApiResult = {
  chain: string;
  configuredAddress: string | null;
  status: { ok: boolean; data?: unknown; error?: string };
  wallets: { ok: boolean; data?: { data?: { wallets?: Wallet[] } }; error?: string };
  balance: { ok: boolean; data?: { data?: { balances?: Balance[] } }; error?: string } | null;
};

export default function AgentWalletPage() {
  const [data, setData] = useState<ApiResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [funding, setFunding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/agent-wallet", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Unable to load agent wallet");
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load agent wallet");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const wallet = useMemo(() => {
    const wallets = data?.wallets?.data?.data?.wallets ?? [];
    return wallets.find((item) => item.blockchain === data?.chain) ?? wallets[0];
  }, [data]);

  const balances = data?.balance?.data?.data?.balances ?? [];

  async function requestFaucet() {
    setFunding(true);
    setError(null);
    try {
      const res = await fetch("/api/agent-wallet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "fund" }),
      });
      const json = await res.json();
      if (!res.ok || json?.ok === false) throw new Error(json?.error || "Faucet request failed");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Faucet request failed");
    } finally {
      setFunding(false);
    }
  }

  const address = data?.configuredAddress || wallet?.address || "";

  return (
    <div className="min-h-screen px-5 pb-28 pt-8 text-slate-950">
      <section className="rounded-[28px] border border-white/60 bg-white/80 p-6 shadow-xl shadow-blue-950/10 backdrop-blur">
        <div className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-600">Circle Agent Wallet</div>
        <h1 className="mt-3 text-3xl font-bold tracking-tight">Agent wallet</h1>
        <p className="mt-2 text-sm text-slate-600">Testnet automation wallet for Radius on Arc.</p>
      </section>

      <section className="mt-5 space-y-5 rounded-[28px] border border-white/60 bg-white/85 p-5 shadow-xl shadow-blue-950/10 backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs font-medium uppercase tracking-wider text-slate-500">Network</div>
            <strong>{data?.chain ?? "ARC-TESTNET"}</strong>
          </div>
          <button className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold disabled:opacity-60" onClick={refresh} disabled={loading}>
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>

        <div>
          <div className="text-xs font-medium uppercase tracking-wider text-slate-500">Wallet</div>
          <code className="mt-2 block break-all rounded-2xl bg-slate-950/5 p-3 text-xs">{address || "Not configured yet"}</code>
        </div>

        <div>
          <div className="text-xs font-medium uppercase tracking-wider text-slate-500">Balances</div>
          {balances.length ? (
            <div className="mt-2 space-y-2">
              {balances.map((item, index) => (
                <div key={`${item.token ?? item.symbol ?? "token"}-${index}`} className="flex items-center justify-between rounded-2xl bg-slate-950/5 px-4 py-3">
                  <span>{item.symbol ?? item.token ?? "Token"}</span>
                  <strong>{item.amount ?? "0"}</strong>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-sm text-slate-600">No testnet funds detected yet.</p>
          )}
        </div>

        {error && <p className="rounded-2xl bg-red-50 p-3 text-sm text-red-600">{error}</p>}

        <button className="w-full rounded-2xl bg-blue-600 px-5 py-3 font-semibold text-white shadow-lg shadow-blue-600/25 disabled:opacity-60" onClick={requestFaucet} disabled={funding || !data?.configuredAddress}>
          {funding ? "Requesting faucet…" : "Request testnet USDC"}
        </button>

        {!data?.configuredAddress && (
          <p className="text-xs text-slate-500">Set CIRCLE_AGENT_WALLET_ADDRESS on the server after creating the testnet wallet.</p>
        )}
      </section>

      <section className="mt-5 space-y-2 rounded-[28px] border border-white/60 bg-white/75 p-5 text-sm text-slate-600 shadow-xl shadow-blue-950/10 backdrop-blur">
        <h2 className="text-lg font-bold text-slate-950">What this enables</h2>
        <p>Radius can use this wallet for testnet agent actions, marketplace payments, and future automated flows without touching user wallets.</p>
        <Link href="/" className="inline-block font-semibold text-blue-600">Back home</Link>
      </section>
    </div>
  );
}
