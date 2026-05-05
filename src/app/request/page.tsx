"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useAccount } from "wagmi";
import { useRadiusAuth } from "@/lib/web3auth";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { QRCodeSVG } from "qrcode.react";
import { AppShell } from "@/components/AppShell";
import { TOKENS, type TokenKey } from "@/config/tokens";
import { TokenLogo } from "@/components/TokenLogo";
import { buildPaymentUrl, decimalToUnits, deletePaymentRequest, expirePaymentRequest, formatAmount, formatPreferredRecipientInput, getLocalTransfers, getPaymentRequests, saveLocalTransfers, savePaymentRequest, savePaymentRequests, type PaymentRequestRecord } from "@/lib/utils";
import { usePaymentRequestWatcher } from "@/lib/usePaymentRequestWatcher";
import { fetchRemoteActivity, mergePaymentRequests, mergeTransfers, pushRemoteActivity, addDeletedRequestId } from "@/lib/activity-sync";

export default function RequestPage() {
  const { address: wagmiAddress, isConnected: wagmiConnected } = useAccount();
  const { authenticated, address: authAddress } = useRadiusAuth();
  const address = wagmiAddress ?? authAddress;
  const isConnected = wagmiConnected || authenticated;

  const qrWrapRef = useRef<HTMLDivElement>(null);
  const [amount, setAmount] = useState("");
  const [token, setToken] = useState<TokenKey>("USDC");
  const [memo, setMemo] = useState("");
  const [paymentUrl, setPaymentUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [showTokenPicker, setShowTokenPicker] = useState(false);
  const [requests, setRequests] = useState<PaymentRequestRecord[]>([]);
  const [splitMode, setSplitMode] = useState(false);
  const [participants, setParticipants] = useState("2");
  const qrValue = useMemo(() => {
    if (paymentUrl) return paymentUrl;
    if (!address || !amount || Number(amount) <= 0) return "";
    return buildPaymentUrl(formatPreferredRecipientInput(address), amount, token, memo);
  }, [address, amount, token, memo, paymentUrl]);

  useEffect(() => {
    if (!address) return;
    let cancelled = false;
    queueMicrotask(() => setRequests(getPaymentRequests(address).slice(0, 5)));
    fetchRemoteActivity(address).then((remote) => {
      if (!remote || cancelled) return;
      const mergedRequests = mergePaymentRequests(getPaymentRequests(), remote.requests);
      const mergedTransfers = mergeTransfers(getLocalTransfers(), remote.transfers);
      savePaymentRequests(mergedRequests);
      saveLocalTransfers(mergedTransfers);
      setRequests(getPaymentRequests(address).slice(0, 5));
      void pushRemoteActivity(address, { requests: mergedRequests, transfers: mergedTransfers });
    });
    return () => { cancelled = true; };
  }, [address]);

  function pushActivity() {
    if (!address) return;
    void pushRemoteActivity(address, { requests: getPaymentRequests(), transfers: getLocalTransfers() });
  }

  function refreshRequests() {
    if (!address) return;
    setRequests(getPaymentRequests(address).slice(0, 5));
  }

  usePaymentRequestWatcher({ address, onPaid: () => refreshRequests() });

  function maybeAskNotificationPermission() {
    if (typeof window === "undefined") return;
    if (!("Notification" in window)) return;
    if (Notification.permission !== "default") return;
    if (localStorage.getItem("radius-asked-notify") === "1") return;
    localStorage.setItem("radius-asked-notify", "1");
    // Tied to a real user gesture (form submit), satisfying browser policies.
    Notification.requestPermission().catch(() => undefined);
  }

  function generate(e: React.FormEvent) {
    e.preventDefault();
    if (!address || !amount || Number(amount) <= 0) return;
    const decimals = TOKENS[token].decimals;
    const totalUnits = decimalToUnits(amount, decimals);
    const headcount = splitMode ? Math.max(2, Math.floor(Number(participants) || 2)) : 1;
    const perPersonUnits = splitMode ? totalUnits / BigInt(headcount) : totalUnits;
    const perPersonDisplay = splitMode ? formatAmount(perPersonUnits, decimals) : amount;
    const requestId = crypto.randomUUID();
    const url = buildPaymentUrl(formatPreferredRecipientInput(address), perPersonDisplay, token, memo, requestId);
    setPaymentUrl(url);
    savePaymentRequest({
      id: requestId,
      recipient: address,
      amount,
      token,
      memo: memo.trim() || undefined,
      url,
      ...(splitMode
        ? { split: { targetUnits: totalUnits.toString(), paidUnits: "0", participants: headcount } }
        : {}),
    });
    refreshRequests();
    pushActivity();
    maybeAskNotificationPermission();
  }

  function expireRequest(id: string) {
    expirePaymentRequest(id);
    refreshRequests();
    pushActivity();
  }

  function removeRequest(id: string) {
    addDeletedRequestId(id);
    deletePaymentRequest(id);
    refreshRequests();
    pushActivity();
  }

  async function copyLink() {
    if (!qrValue) return;
    await navigator.clipboard.writeText(qrValue);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  async function shareLink() {
    if (!qrValue) return;
    if (navigator.share) await navigator.share({ title: "Radius payment request", url: qrValue });
    else await copyLink();
  }

  function saveQr() {
    const svg = qrWrapRef.current?.querySelector("svg");
    if (!svg || !qrValue) return;
    const clone = svg.cloneNode(true) as SVGElement;
    clone.setAttribute("width", "500");
    clone.setAttribute("height", "500");
    const serialized = new XMLSerializer().serializeToString(clone);
    const blob = new Blob([serialized], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `radius-request-${Date.now()}.svg`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <AppShell>
      <div className="screen-pad">
        <header className="mb-7 flex items-center justify-between">
          <Link href="/" aria-label="Back" className="grid h-9 w-9 place-items-center rounded-full bg-white/40 text-[var(--brand)] backdrop-blur transition-colors hover:bg-white/60">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          </Link>
          <h1 className="text-sm font-bold">Request Payment</h1>
          <span className="w-9" />
        </header>

        {!isConnected ? (
          <div className="pt-16 text-center">
            <div className="orb mx-auto mb-8 h-24 w-24 rounded-full" />
            <h2 className="text-3xl font-semibold tracking-[-0.04em]">Connect to request</h2>
            <p className="mx-auto mt-3 max-w-64 text-sm leading-6 text-[#8b8795]">Connect a wallet to create a beautiful Radius request QR.</p>
            <div className="wallet-connect-row mx-auto mt-8 flex max-w-64 justify-center rounded-2xl">
              <ConnectButton showBalance={false} chainStatus="none" accountStatus="address" />
            </div>
          </div>
        ) : (
          <>
            <form onSubmit={generate} className="request-form text-center">
              
              <div className="request-amount-row mt-3 flex items-center justify-center gap-3 rounded-[24px] border-0 bg-white/55 p-4">
                <span className="request-currency-symbol text-4xl font-semibold tracking-[-0.06em]">$</span>
                <input value={amount} onChange={(e) => { setAmount(e.target.value); setPaymentUrl(""); }} inputMode="decimal" className="request-amount-input w-40 border-0 bg-transparent text-center text-4xl font-semibold tracking-[-0.06em] outline-none ring-0 focus:ring-0" />
                <button type="button" onClick={() => setShowTokenPicker(true)} className="request-token-pill flex items-center gap-2 rounded-full bg-white px-3 py-2 text-xs font-bold shadow-sm"><TokenLogo symbol={token} size={22} />{token}</button>
              </div>
              {/* estimate removed */}

              <div className="request-main-card soft-card mx-auto mt-7 rounded-[28px] p-5">
                {!qrValue && <p className="mb-3 text-xs text-[#9a94a3]">Enter an amount to generate QR.</p>}
                <div ref={qrWrapRef} className="request-qr-frame relative mx-auto w-fit rounded-[24px] bg-white p-4 shadow-[0_14px_38px_rgba(143,124,255,.16)]">
                  {qrValue ? <QRCodeSVG value={qrValue} size={218} level="M" bgColor="#ffffff" fgColor="#050505" includeMargin /> : <div className="h-[218px] w-[218px] rounded-2xl bg-[#f7f5fb]" />}
                  {qrValue && <div className="radius-qr-logo absolute left-1/2 top-1/2 z-10 grid h-12 w-12 -translate-x-1/2 -translate-y-1/2 place-items-center overflow-hidden rounded-2xl shadow-lg"><span className="flex h-full w-full items-center justify-center rounded-2xl bg-gradient-to-br from-[#6366f1] to-[#3b82f6]"><span className="relative flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-[#818cf8] to-[#3b82f6] shadow-[inset_0_1px_2px_rgba(255,255,255,0.3)]"><span className="absolute top-0.5 left-0.5 h-1.5 w-1.5 rounded-full bg-white/60" /></span></span></div>}
                </div>
                <p className="mt-3 text-xs text-[#9a94a3]">{qrValue ? "Scan to pay" : "QR appears here after amount is set"}</p>

                <label className="mt-5 block text-left text-xs font-semibold text-[#8b8795]">Payment link</label>
                <div className="request-link-box mt-2 flex items-center gap-2 rounded-2xl bg-[#f7f5fb] px-3 py-3 text-left text-xs text-[#686272]">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-[var(--brand)]"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                  <span className="min-w-0 flex-1 truncate">{qrValue || "Link will appear here"}</span>
                  <button type="button" onClick={copyLink} disabled={!qrValue} aria-label="Copy link" className="shrink-0 text-[var(--brand)] disabled:opacity-40">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                  </button>
                </div>

                <input value={memo} onChange={(e) => { setMemo(e.target.value); setPaymentUrl(""); }} placeholder="Note" className="request-note-input radius-input mt-3 text-sm" />

                <div className="mt-3 flex items-center justify-between rounded-2xl bg-white/55 px-3 py-2 text-left">
                  <label className="flex items-center gap-2 text-xs font-semibold text-[#595465]">
                    <input type="checkbox" checked={splitMode} onChange={(e) => { setSplitMode(e.target.checked); setPaymentUrl(""); }} />
                    Split this bill
                  </label>
                  {splitMode && (
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-[#8b8795]">Among</span>
                      <input
                        type="number"
                        min={2}
                        max={50}
                        value={participants}
                        onChange={(e) => { setParticipants(e.target.value); setPaymentUrl(""); }}
                        className="w-14 rounded-lg bg-white px-2 py-1 text-center text-xs"
                      />
                      <span className="text-[#8b8795]">people</span>
                    </div>
                  )}
                </div>
                {splitMode && amount && Number(amount) > 0 && (
                  <p className="mt-2 text-left text-[11px] text-[#8b8795]">
                    Each person pays ≈ {formatAmount(decimalToUnits(amount, TOKENS[token].decimals) / BigInt(Math.max(2, Math.floor(Number(participants) || 2))), TOKENS[token].decimals)} {token}
                  </p>
                )}

                <button type="submit" disabled={!address || !amount || Number(amount) <= 0} className="primary-btn mt-4 w-full disabled:opacity-40">
                  {paymentUrl ? "Refresh request link" : "Create request link"}
                </button>

                <div className="request-action-grid mt-4 grid grid-cols-3 gap-3">
                  <button type="button" aria-label="Share link" onClick={shareLink} disabled={!qrValue} className="ghost-btn flex items-center justify-center gap-2 text-sm disabled:opacity-40">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                    Share
                  </button>
                  <button type="button" aria-label="Copy link" onClick={copyLink} disabled={!qrValue} className="ghost-btn flex items-center justify-center gap-2 text-sm disabled:opacity-40">
                    {copied ? (
                      <><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Copied</>
                    ) : (
                      <><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy</>
                    )}
                  </button>
                  <button type="button" aria-label="Save QR" onClick={saveQr} disabled={!qrValue} className="ghost-btn flex items-center justify-center gap-2 text-sm disabled:opacity-40">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    Save
                  </button>
                </div>
              </div>
            </form>


            <section className="mt-5 rounded-[28px] soft-card p-5 text-left">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold">Request status</h3>
                  <p className="mt-1 text-xs text-[#9a94a3]">Pending links turn paid when the matching balance lands.</p>
                </div>
                <button type="button" onClick={refreshRequests} aria-label="Refresh request status" className="grid h-10 w-10 place-items-center rounded-full bg-[var(--brand)]/10 text-[var(--brand)] shadow-sm">
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.5 2v6h-6"/><path d="M2.5 22v-6h6"/><path d="M2.5 12a10 10 0 0 1 17.36-6.84"/><path d="M21.5 12a10 10 0 0 1-17.36 6.84"/></svg>
                </button>
              </div>
              {requests.length === 0 ? (
                <p className="request-status-empty rounded-2xl bg-white/50 p-4 text-sm text-[#8b8795]">No requests created yet.</p>
              ) : (
                <div className="space-y-3">
                  {requests.map((request) => {
                    const decimals = TOKENS[request.token].decimals;
                    const split = request.split;
                    const targetUnits = split ? BigInt(split.targetUnits) : decimalToUnits(request.amount, decimals);
                    const paidUnits = split ? BigInt(split.paidUnits) : (request.status === "paid" ? targetUnits : BigInt(0));
                    const pct = targetUnits > BigInt(0) ? Math.min(100, Number((paidUnits * BigInt(1000)) / targetUnits) / 10) : 0;
                    return (
                      <div key={request.id} className="rounded-2xl bg-white/55 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <TokenLogo symbol={request.token} size={30} />
                            <div>
                              <p className="text-sm font-bold">{request.amount} {request.token}{split ? ` · split ${split.participants ?? ""}` : ""}</p>
                              <p className="text-xs text-[#8b8795]">{request.memo || "Payment request"}</p>
                            </div>
                          </div>
                          <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${request.status === "paid" ? "bg-emerald-500/12 text-emerald-600" : request.status === "expired" ? "bg-zinc-500/10 text-zinc-500" : "bg-amber-500/12 text-amber-600"}`}>
                            {request.status}
                          </span>
                        </div>
                        {split && (
                          <div className="mt-3">
                            <div className="h-2 w-full overflow-hidden rounded-full bg-[#ece9f3]">
                              <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
                            </div>
                            <p className="mt-1 text-[11px] text-[#8b8795]">
                              {formatAmount(paidUnits, decimals)} / {formatAmount(targetUnits, decimals)} {request.token} ({pct.toFixed(0)}%)
                            </p>
                          </div>
                        )}
                        <div className="mt-3 flex gap-2">
                          <button type="button" onClick={() => navigator.clipboard.writeText(request.url)} className="ghost-btn flex-1 px-3 py-2 text-xs">Copy link</button>
                          {request.status === "pending" && <button type="button" onClick={() => expireRequest(request.id)} className="ghost-btn px-3 py-2 text-xs">Expire</button>}
                          {request.status === "expired" && <button type="button" onClick={() => removeRequest(request.id)} className="ghost-btn px-3 py-2 text-xs text-red-500">Remove</button>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {showTokenPicker && (
              <div className="fixed inset-0 z-[90] grid place-items-end bg-black/30 p-4" onClick={() => setShowTokenPicker(false)}>
                <div className="bg-white w-full max-w-sm rounded-[30px] p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-lg font-bold">Choose token</h3>
                    <button type="button" onClick={() => setShowTokenPicker(false)} className="grid h-9 w-9 place-items-center rounded-full bg-red-500/10 text-red-500">❌</button>
                  </div>
                  <div className="space-y-3">
                    {(Object.keys(TOKENS) as TokenKey[]).map((key) => (
                      <button key={key} type="button" onClick={() => { setToken(key); setPaymentUrl(""); setShowTokenPicker(false); }} className={`frosted-choice w-full ${token === key ? "active" : ""}`}>
                        <div className="flex items-center gap-3"><TokenLogo symbol={key} size={34} /><div><p className="font-bold">{key}</p><p className="text-xs opacity-70">{TOKENS[key].name}</p></div></div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

          </>
        )}
      </div>
    </AppShell>
  );
}
