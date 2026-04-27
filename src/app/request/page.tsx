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
import { buildPaymentUrl, expirePaymentRequest, formatPreferredRecipientInput, getPaymentRequests, savePaymentRequest, type PaymentRequestRecord } from "@/lib/utils";
import { usePaymentRequestWatcher } from "@/lib/usePaymentRequestWatcher";

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

  const qrValue = useMemo(() => {
    if (paymentUrl) return paymentUrl;
    if (!address || !amount || Number(amount) <= 0) return "";
    return buildPaymentUrl(formatPreferredRecipientInput(address), amount, token, memo);
  }, [address, amount, token, memo, paymentUrl]);

  useEffect(() => {
    if (!address) return;
    queueMicrotask(() => setRequests(getPaymentRequests(address).slice(0, 5)));
  }, [address]);

  function refreshRequests() {
    if (!address) return;
    setRequests(getPaymentRequests(address).slice(0, 5));
  }

  usePaymentRequestWatcher({ address, onPaid: () => refreshRequests() });

  function generate(e: React.FormEvent) {
    e.preventDefault();
    if (!address || !amount || Number(amount) <= 0) return;
    const requestId = crypto.randomUUID();
    const url = buildPaymentUrl(formatPreferredRecipientInput(address), amount, token, memo, requestId);
    setPaymentUrl(url);
    savePaymentRequest({ id: requestId, recipient: address, amount, token, memo: memo.trim() || undefined, url });
    refreshRequests();
  }

  function expireRequest(id: string) {
    expirePaymentRequest(id);
    refreshRequests();
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
          <Link href="/" className="text-2xl">‹</Link>
          <h1 className="text-sm font-bold">Request Payment</h1>
          <span className="w-6" />
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
              
              <div className="request-amount-row mt-3 flex items-center justify-center gap-3">
                <span className="request-currency-symbol text-4xl font-semibold tracking-[-0.06em]">$</span>
                <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" className="request-amount-input w-40 bg-transparent text-center text-4xl font-semibold tracking-[-0.06em] outline-none" />
                <button type="button" onClick={() => setShowTokenPicker(true)} className="request-token-pill flex items-center gap-2 rounded-full bg-white px-3 py-2 text-xs font-bold shadow-sm"><TokenLogo symbol={token} size={22} />{token}</button>
              </div>
              <p className="request-estimate mt-2 text-xs text-[#b2adba]">≈ {amount || "0.00"} {token}</p>

              <div className="request-main-card soft-card mx-auto mt-7 rounded-[28px] p-5">
                {!qrValue && <p className="mb-3 text-xs text-[#9a94a3]">Enter an amount to generate QR.</p>}
                <div ref={qrWrapRef} className="request-qr-frame relative mx-auto w-fit rounded-[24px] bg-white p-4 shadow-[0_14px_38px_rgba(143,124,255,.16)]">
                  {qrValue ? <QRCodeSVG value={qrValue} size={218} level="M" bgColor="#ffffff" fgColor="#050505" includeMargin /> : <div className="h-[218px] w-[218px] rounded-2xl bg-[#f7f5fb]" />}
                  {qrValue && <div className="radius-qr-logo absolute left-1/2 top-1/2 z-10 grid h-12 w-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-2xl bg-white text-2xl font-black text-[#7a70d8] shadow-lg">R</div>}
                </div>
                <p className="mt-3 text-xs text-[#9a94a3]">{qrValue ? "Scan to pay" : "QR appears here after amount is set"}</p>

                <label className="mt-5 block text-left text-xs font-semibold text-[#8b8795]">Payment link</label>
                <div className="request-link-box mt-2 flex items-center gap-2 rounded-2xl bg-[#f7f5fb] px-3 py-3 text-left text-xs text-[#686272]">
                  <span>🔗</span><span className="min-w-0 flex-1 truncate">{qrValue}</span><button type="button" onClick={copyLink} disabled={!qrValue}>›</button>
                </div>

                <input value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="Note" className="request-note-input radius-input mt-3 text-sm" />

                <div className="request-action-grid mt-4 grid grid-cols-3 gap-3">
                  <button type="button" aria-label="Share link" onClick={shareLink} className="ghost-btn text-lg">⇧</button>
                  <button type="button" aria-label="Copy link" onClick={copyLink} className="ghost-btn text-lg">{copied ? "✓" : "⧉"}</button>
                  <button type="button" aria-label="Save QR" onClick={saveQr} disabled={!qrValue} className="ghost-btn text-lg disabled:opacity-40">⇩</button>
                </div>
              </div>
            </form>


            <section className="mt-5 rounded-[28px] soft-card p-5 text-left">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold">Request status</h3>
                  <p className="mt-1 text-xs text-[#9a94a3]">Pending links turn paid when the matching balance lands.</p>
                </div>
                <button type="button" onClick={refreshRequests} className="ghost-btn px-3 py-2 text-xs">Refresh</button>
              </div>
              {requests.length === 0 ? (
                <p className="rounded-2xl bg-white/50 p-4 text-sm text-[#8b8795]">No requests created yet.</p>
              ) : (
                <div className="space-y-3">
                  {requests.map((request) => (
                    <div key={request.id} className="rounded-2xl bg-white/55 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <TokenLogo symbol={request.token} size={30} />
                          <div>
                            <p className="text-sm font-bold">{request.amount} {request.token}</p>
                            <p className="text-xs text-[#8b8795]">{request.memo || "Payment request"}</p>
                          </div>
                        </div>
                        <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${request.status === "paid" ? "bg-emerald-500/12 text-emerald-600" : request.status === "expired" ? "bg-zinc-500/10 text-zinc-500" : "bg-amber-500/12 text-amber-600"}`}>
                          {request.status}
                        </span>
                      </div>
                      <div className="mt-3 flex gap-2">
                        <button type="button" onClick={() => navigator.clipboard.writeText(request.url)} className="ghost-btn flex-1 px-3 py-2 text-xs">Copy link</button>
                        {request.status === "pending" && <button type="button" onClick={() => expireRequest(request.id)} className="ghost-btn px-3 py-2 text-xs">Expire</button>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {showTokenPicker && (
              <div className="fixed inset-0 z-[90] grid place-items-end bg-black/30 p-4" onClick={() => setShowTokenPicker(false)}>
                <div className="soft-card w-full max-w-sm rounded-[30px] p-5" onClick={(e) => e.stopPropagation()}>
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-lg font-bold">Choose token</h3>
                    <button type="button" onClick={() => setShowTokenPicker(false)} className="ghost-btn px-3 py-2 text-xs">Close</button>
                  </div>
                  <div className="space-y-3">
                    {(Object.keys(TOKENS) as TokenKey[]).map((key) => (
                      <button key={key} type="button" onClick={() => { setToken(key); setShowTokenPicker(false); }} className={`frosted-choice w-full ${token === key ? "active" : ""}`}>
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
