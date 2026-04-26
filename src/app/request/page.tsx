"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useAccount } from "wagmi";
import { useRadiusAuth } from "@/lib/web3auth";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { QRCodeSVG } from "qrcode.react";
import { AppShell } from "@/components/AppShell";
import { TOKENS, type TokenKey } from "@/config/tokens";
import { buildPaymentUrl, formatPreferredRecipientInput } from "@/lib/utils";

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

  const qrValue = useMemo(() => {
    if (paymentUrl) return paymentUrl;
    if (!address || !amount || Number(amount) <= 0) return "";
    return buildPaymentUrl(formatPreferredRecipientInput(address), amount, token, memo);
  }, [address, amount, token, memo, paymentUrl]);

  function generate(e: React.FormEvent) {
    e.preventDefault();
    if (!address || !amount || Number(amount) <= 0) return;
    setPaymentUrl(buildPaymentUrl(formatPreferredRecipientInput(address), amount, token, memo));
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
    const serialized = new XMLSerializer().serializeToString(svg);
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
            <div className="wallet-connect-row radius-auth-button mt-8 p-0"><ConnectButton showBalance={false} chainStatus="none" accountStatus="address" /></div>
          </div>
        ) : (
          <>
            <form onSubmit={generate} className="text-center">
              <div className="mx-auto mb-5 inline-flex rounded-full bg-[#fff7dc] px-4 py-2 text-[11px] font-semibold text-[#c49322]">◌ Awaiting payment</div>
              <p className="text-xs font-medium text-[#8b8795]">You’re requesting</p>
              <div className="mt-3 flex items-center justify-center gap-3">
                <span className="text-4xl font-semibold tracking-[-0.06em]">$</span>
                <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" className="w-40 bg-transparent text-center text-4xl font-semibold tracking-[-0.06em] outline-none" />
                <select value={token} onChange={(e) => setToken(e.target.value as TokenKey)} className="rounded-full bg-white px-3 py-2 text-xs font-bold shadow-sm">
                  {(Object.keys(TOKENS) as TokenKey[]).map((key) => <option key={key}>{key}</option>)}
                </select>
              </div>
              <p className="mt-2 text-xs text-[#b2adba]">≈ {amount || "0.00"} {token}</p>

              <div className="soft-card mx-auto mt-7 rounded-[28px] p-5">
                <div ref={qrWrapRef} className="relative mx-auto w-fit rounded-[24px] bg-white p-4 shadow-[0_14px_38px_rgba(143,124,255,.16)]">
                  {qrValue ? <QRCodeSVG value={qrValue} size={218} level="M" bgColor="#ffffff" fgColor="#050505" includeMargin /> : <div className="grid h-[218px] w-[218px] place-items-center rounded-2xl bg-[#f7f5fb] text-center text-xs text-[#8b8795]">Enter an amount to generate QR</div>}
                  <div className="absolute left-1/2 top-1/2 grid h-12 w-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-2xl bg-white text-2xl font-black text-[#7a70d8] shadow-lg">R</div>
                </div>
                <p className="mt-3 text-xs text-[#9a94a3]">Scan to pay</p>

                <label className="mt-5 block text-left text-xs font-semibold text-[#8b8795]">Payment link</label>
                <div className="mt-2 flex items-center gap-2 rounded-2xl bg-[#f7f5fb] px-3 py-3 text-left text-xs text-[#686272]">
                  <span>🔗</span><span className="min-w-0 flex-1 truncate">{qrValue}</span><button type="button" onClick={copyLink} disabled={!qrValue}>›</button>
                </div>

                <input value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="Note" className="radius-input mt-3 text-sm" />

                <div className="mt-4 grid grid-cols-3 gap-3">
                  <button type="button" onClick={shareLink} className="ghost-btn text-xs">Share Link</button>
                  <button type="button" onClick={copyLink} className="ghost-btn text-xs">{copied ? "Copied" : "Copy Link"}</button>
                  <button type="button" onClick={saveQr} disabled={!qrValue} className="ghost-btn text-xs disabled:opacity-40">Save QR</button>
                </div>
              </div>
            </form>

            <p className="mx-auto mt-8 max-w-72 text-center text-[11px] leading-5 text-[#9a94a3]">♡ Only share this link with people you trust. Payments are secured on Arc Testnet.</p>
          </>
        )}
      </div>
    </AppShell>
  );
}
