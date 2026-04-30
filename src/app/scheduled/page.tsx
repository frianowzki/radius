"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAccount } from "wagmi";
import { useRadiusAuth } from "@/lib/web3auth";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { AppShell } from "@/components/AppShell";
import { TOKENS, type TokenKey } from "@/config/tokens";
import { TokenLogo } from "@/components/TokenLogo";
import {
  getScheduledPayments,
  removeScheduledPayment,
  saveScheduledPayment,
  setSchedulePaused,
  type ScheduleCadence,
  type ScheduledPaymentRecord,
} from "@/lib/scheduled-payments";

const CADENCES: { id: ScheduleCadence; label: string }[] = [
  { id: "daily", label: "Daily" },
  { id: "weekly", label: "Weekly" },
  { id: "monthly", label: "Monthly" },
];

function formatDate(ts: number) {
  try {
    return new Date(ts).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return new Date(ts).toISOString();
  }
}

export default function ScheduledPage() {
  const { isConnected: wagmiConnected } = useAccount();
  const { authenticated } = useRadiusAuth();
  const isConnected = wagmiConnected || authenticated;
  const [items, setItems] = useState<ScheduledPaymentRecord[]>([]);
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [token, setToken] = useState<TokenKey>("USDC");
  const [memo, setMemo] = useState("");
  const [cadence, setCadence] = useState<ScheduleCadence>("weekly");
  const [autoConfirm, setAutoConfirm] = useState(false);
  const [startAt, setStartAt] = useState(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  });

  const [now, setNow] = useState(0);
  /* eslint-disable react-hooks/set-state-in-effect -- hydrate from localStorage on mount */
  useEffect(() => {
    setItems(getScheduledPayments());
    setNow(Date.now());
    const t = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(t);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  function refresh() { setItems(getScheduledPayments()); }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!recipient.trim() || !amount || Number(amount) <= 0) return;
    saveScheduledPayment({
      recipient: recipient.trim(),
      amount,
      token,
      memo: memo.trim() || undefined,
      cadence,
      startAt: new Date(startAt).getTime(),
      autoConfirm,
    });
    setRecipient(""); setAmount(""); setMemo(""); setAutoConfirm(false);
    refresh();
  }

  function toggleAutoConfirm(item: ScheduledPaymentRecord) {
    saveScheduledPayment({ ...item, autoConfirm: !item.autoConfirm });
    refresh();
  }

  function buildSendHref(item: ScheduledPaymentRecord) {
    const params = new URLSearchParams({ to: item.recipient, amount: item.amount, token: item.token, schedule: item.id });
    if (item.memo) params.set("memo", item.memo);
    if (item.autoConfirm) params.set("autorun", "1");
    return `/send?${params.toString()}`;
  }

  return (
    <AppShell>
      <div className="screen-pad space-y-5">
        <header className="mb-2 flex items-center justify-between">
          <Link href="/" aria-label="Back" className="grid h-9 w-9 place-items-center rounded-full bg-white/40 text-[var(--brand)] backdrop-blur transition-colors hover:bg-white/60">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          </Link>
          <h1 className="text-sm font-bold">Scheduled payments</h1>
          <span className="w-9" />
        </header>

        {!isConnected ? (
          <div className="pt-16 text-center">
            <div className="orb mx-auto mb-8 h-20 w-20 rounded-full" />
            <h2 className="text-xl font-semibold">Connect to schedule payments</h2>
            <div className="wallet-connect-row mx-auto mt-6 flex max-w-64 justify-center rounded-2xl">
              <ConnectButton showBalance={false} chainStatus="none" accountStatus="address" />
            </div>
          </div>
        ) : (
          <>
            <form onSubmit={submit} className="soft-card rounded-[28px] p-5 space-y-3">
              <p className="text-sm font-bold">New schedule</p>
              <input className="radius-input text-sm" placeholder="@handle or 0x..." value={recipient} onChange={(e) => setRecipient(e.target.value)} />
              <div className="grid grid-cols-3 gap-2">
                <input className="radius-input col-span-2 text-sm" inputMode="decimal" placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} />
                <select className="radius-input text-sm" value={token} onChange={(e) => setToken(e.target.value as TokenKey)}>
                  {(Object.keys(TOKENS) as TokenKey[]).map((k) => <option key={k} value={k}>{k}</option>)}
                </select>
              </div>
              <input className="radius-input text-sm" placeholder="Memo (optional)" value={memo} onChange={(e) => setMemo(e.target.value)} />
              <div className="grid grid-cols-2 gap-2">
                <select className="radius-input text-sm" value={cadence} onChange={(e) => setCadence(e.target.value as ScheduleCadence)}>
                  {CADENCES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
                <input className="radius-input text-sm" type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} />
              </div>
              <label className="flex items-center gap-2 rounded-2xl bg-white/50 px-3 py-2.5 text-xs text-[#5d5868]">
                <input type="checkbox" checked={autoConfirm} onChange={(e) => setAutoConfirm(e.target.checked)} className="h-4 w-4 accent-[var(--brand)]" />
                <span><span className="font-bold text-[#17151f]">Auto-confirm</span> when due (still signed by your wallet)</span>
              </label>
              <button type="submit" className="primary-btn w-full text-sm">Save schedule</button>
              <p className="text-[11px] text-[#8b8795]">Auto-confirm fires the tx on arrival but your wallet still has to sign — no silent execution.</p>
            </form>

            <section className="soft-card rounded-[28px] p-5 space-y-3">
              <p className="text-sm font-bold">Active schedules</p>
              {items.length === 0 ? (
                <p className="rounded-2xl bg-white/50 p-4 text-sm text-[#8b8795]">No schedules yet.</p>
              ) : (
                items.map((item) => {
                  const due = !item.paused && item.nextRunAt <= now;
                  return (
                    <div key={item.id} className="rounded-2xl bg-white/55 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <TokenLogo symbol={item.token} size={30} />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold">{item.amount} {item.token} → {item.recipient}</p>
                            <p className="text-xs text-[#8b8795]">{item.cadence} · next {formatDate(item.nextRunAt)}</p>
                          </div>
                        </div>
                        <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${item.paused ? "bg-zinc-500/10 text-zinc-500" : due ? "bg-emerald-500/12 text-emerald-600" : "bg-amber-500/12 text-amber-600"}`}>
                          {item.paused ? "paused" : due ? "due" : "scheduled"}
                        </span>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Link href={buildSendHref(item)} className="primary-btn px-3 py-2 text-xs">{due ? "Run now" : "Run early"}</Link>
                        <button type="button" onClick={() => toggleAutoConfirm(item)} className={`px-3 py-2 text-xs rounded-2xl font-bold ${item.autoConfirm ? "bg-[var(--brand)]/12 text-[var(--brand)]" : "ghost-btn"}`}>
                          {item.autoConfirm ? "Auto on" : "Auto off"}
                        </button>
                        <button type="button" onClick={() => { setSchedulePaused(item.id, !item.paused); refresh(); }} className="ghost-btn px-3 py-2 text-xs">{item.paused ? "Resume" : "Pause"}</button>
                        <button type="button" onClick={() => { removeScheduledPayment(item.id); refresh(); }} className="ghost-btn px-3 py-2 text-xs">Delete</button>
                      </div>
                    </div>
                  );
                })
              )}
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}
