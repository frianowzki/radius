"use client";

import { useMemo, useState } from "react";
import { useAccount } from "wagmi";
import { QRCodeSVG } from "qrcode.react";
import { AppShell } from "@/components/AppShell";
import { ReceiptCard } from "@/components/ReceiptCard";
import { PrivacyBadge } from "@/components/PrivacyBadge";
import { RequesterIdentityCard } from "@/components/RequesterIdentityCard";
import { TOKENS, type TokenKey } from "@/config/tokens";
import {
  buildPaymentUrl,
  formatContactLabel,
  formatPreferredRecipientInput,
  findContactByAddress,
  getIdentityLabel,
  getIdentityProfile,
} from "@/lib/utils";

export default function RequestPage() {
  const { address, isConnected } = useAccount();

  const [amount, setAmount] = useState("");
  const [token, setToken] = useState<TokenKey>("USDC");
  const [memo, setMemo] = useState("");
  const [paymentUrl, setPaymentUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);

  const matchedRequester = address ? findContactByAddress(address) : undefined;
  const identity = getIdentityProfile();

  const requestSummary = useMemo(() => {
    if (!address || !amount || Number(amount) <= 0) return null;
    return {
      recipient: address,
      shortRecipient: formatContactLabel(address),
      requesterLabel: getIdentityLabel(identity),
      amount,
      token,
      memo: memo.trim(),
    };
  }, [address, amount, token, memo, identity]);

  function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!address || !amount || Number(amount) <= 0) return;
    const url = buildPaymentUrl(formatPreferredRecipientInput(address), amount, token, memo);
    setPaymentUrl(url);
    setCopied(false);
    setShared(false);
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(paymentUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleShare() {
    if (!paymentUrl) return;

    const sharePayload = {
      title: "Arc Flow Payment Request",
      text: requestSummary
        ? `Pay ${requestSummary.amount} ${requestSummary.token} to ${requestSummary.requesterLabel}${requestSummary.memo ? ` for ${requestSummary.memo}` : ""}`
        : "Arc Flow payment request",
      url: paymentUrl,
    };

    try {
      if (navigator.share) {
        await navigator.share(sharePayload);
      } else {
        await navigator.clipboard.writeText(paymentUrl);
      }
      setShared(true);
      setTimeout(() => setShared(false), 2000);
    } catch {
      // user canceled share, ignore
    }
  }

  function handleReset() {
    setPaymentUrl("");
    setAmount("");
    setMemo("");
    setCopied(false);
    setShared(false);
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl">
        {!isConnected ? (
          <div className="glass-panel-strong mx-auto max-w-4xl rounded-[32px] p-10 text-center lg:p-14">
            <p className="mb-3 text-[11px] uppercase tracking-[0.3em] text-zinc-500">Payment requests</p>
            <h2 className="text-4xl font-semibold tracking-tight text-glow lg:text-5xl">
              Turn a wallet address into a payment moment.
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-zinc-400 lg:text-lg">
              Connect your wallet to generate a sharable Arc request link with a QR code, clean summary, and receipt-style presentation.
            </p>
          </div>
        ) : paymentUrl && requestSummary ? (
          <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="space-y-6">
              <div className="glass-panel-strong rounded-[32px] p-8">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.3em] text-zinc-500">Request created</p>
                    <p className="mt-3 text-4xl font-semibold tracking-tight text-glow">
                      {requestSummary.amount} {requestSummary.token}
                    </p>
                  </div>
                  <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400">
                    Ready to share
                  </span>
                </div>

                <p className="text-sm leading-7 text-zinc-400">
                  Share this request as a link or QR. This is the kind of payment surface that can actually feel social, not just functional.
                </p>

                <div className="mt-6 rounded-[28px] border border-white/8 bg-white/[0.04] p-6">
                  <div className="space-y-4 text-sm">
                    <div className="flex justify-between gap-4 border-b border-white/8 pb-4">
                      <span className="text-zinc-500">Recipient</span>
                      <span className="text-zinc-300">{requestSummary.shortRecipient}</span>
                    </div>
                    <div className="flex justify-between gap-4 border-b border-white/8 pb-4">
                      <span className="text-zinc-500">Token</span>
                      <span className="text-zinc-200">{TOKENS[requestSummary.token].name}</span>
                    </div>
                    <div className="flex justify-between gap-4 border-b border-white/8 pb-4">
                      <span className="text-zinc-500">Network</span>
                      <span className="text-zinc-200">Arc Testnet</span>
                    </div>
                    {requestSummary.memo && (
                      <div className="flex justify-between gap-4">
                        <span className="text-zinc-500">Memo</span>
                        <span className="text-right text-zinc-300">{requestSummary.memo}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="glass-panel rounded-[28px] p-5">
                <label className="mb-2 block text-sm font-medium text-zinc-400">
                  Payment link
                </label>
                <div className="mb-4 rounded-2xl border border-white/8 bg-black/20 px-4 py-4 font-mono text-xs text-zinc-300 break-all">
                  {paymentUrl}
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  <button
                    onClick={handleCopy}
                    className={`rounded-2xl px-4 py-3 text-sm font-medium transition-all ${
                      copied
                        ? "bg-emerald-500/20 text-emerald-400"
                        : "bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30"
                    }`}
                  >
                    {copied ? "Copied" : "Copy link"}
                  </button>
                  <button
                    onClick={handleShare}
                    className={`rounded-2xl px-4 py-3 text-sm font-medium transition-all ${
                      shared
                        ? "bg-emerald-500/20 text-emerald-400"
                        : "bg-white/8 text-zinc-200 hover:bg-white/12"
                    }`}
                  >
                    {shared ? "Shared" : "Share"}
                  </button>
                  <button
                    onClick={handleReset}
                    className="rounded-2xl bg-white/8 px-4 py-3 text-sm font-medium text-zinc-200 transition-colors hover:bg-white/12"
                  >
                    New request
                  </button>
                </div>
              </div>
            </div>

            <div className="glass-panel rounded-[32px] p-8 flex flex-col items-center justify-center">
              <div className="mb-5 w-full">
                <RequesterIdentityCard
                  title="Requester"
                  contact={matchedRequester}
                  profile={identity}
                  address={address}
                  tone="compact"
                />
              </div>
              <div className="rounded-[30px] bg-white p-5 shadow-2xl shadow-black/25">
                <QRCodeSVG
                  value={paymentUrl}
                  size={240}
                  level="M"
                  bgColor="#ffffff"
                  fgColor="#000000"
                  includeMargin
                />
              </div>
              <div className="mt-6 w-full">
                <ReceiptCard
                  title="Request preview"
                  amount={requestSummary.amount}
                  token={requestSummary.token}
                  status="Share"
                  fromLabel={requestSummary.requesterLabel}
                  note={requestSummary.memo || "Arc Testnet"}
                  metaLabel="Request by"
                  metaValue={requestSummary.requesterLabel}
                  shareText={`Payment request from ${requestSummary.requesterLabel}: ${requestSummary.amount} ${requestSummary.token}${requestSummary.memo ? ` for ${requestSummary.memo}` : ""}`}
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
            <form onSubmit={handleGenerate} className="space-y-5">
              <div className="glass-panel-strong rounded-[32px] p-8">
                <p className="mb-3 text-[11px] uppercase tracking-[0.3em] text-zinc-500">Request payment</p>
                <h2 className="text-4xl font-semibold tracking-tight text-glow">
                  Create a payment request that actually looks worth sharing.
                </h2>
                <p className="mt-4 text-base leading-7 text-zinc-400">
                  This should feel like a payment product, not a QR utility page. Amount, note, identity, then instant handoff to link and scan.
                </p>
              </div>

              <div className="glass-panel rounded-[28px] p-5">
                <label className="mb-3 block text-sm font-medium text-zinc-400">
                  Token
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.keys(TOKENS) as TokenKey[]).map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setToken(key)}
                      className={`rounded-2xl px-4 py-4 text-sm font-medium transition-all ${
                        token === key
                          ? "border border-indigo-400/30 bg-indigo-500/15 text-indigo-300"
                          : "border border-white/6 bg-white/[0.04] text-zinc-400 hover:bg-white/[0.06]"
                      }`}
                    >
                      {TOKENS[key].symbol}
                    </button>
                  ))}
                </div>
              </div>

              <div className="glass-panel rounded-[28px] p-5">
                <label className="mb-3 block text-sm font-medium text-zinc-400">
                  Amount
                </label>
                <div className="relative">
                  <input
                    type="number"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    min="0"
                    step="any"
                    className="w-full rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-4 pr-16 text-lg font-medium text-white placeholder-zinc-500 focus:border-emerald-500 focus:outline-none"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-medium text-zinc-400">
                    {token}
                  </span>
                </div>
              </div>

              <div className="glass-panel rounded-[28px] p-5">
                <label className="mb-3 block text-sm font-medium text-zinc-400">
                  Memo <span className="text-zinc-600">(optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Dinner split, design invoice, coffee run"
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                  maxLength={100}
                  className="w-full rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder-zinc-500 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={!amount || Number(amount) <= 0}
                className="w-full rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 px-4 py-4 font-semibold text-white shadow-lg shadow-emerald-500/20 transition-all hover:shadow-emerald-500/30 disabled:opacity-40 disabled:shadow-none"
              >
                Generate payment request
              </button>
            </form>

            <div className="space-y-5">
              <PrivacyBadge />

              <RequesterIdentityCard
                title="Product framing"
                contact={matchedRequester}
                profile={identity}
                address={address}
              />

              <div className="glass-panel rounded-[32px] p-6">
                <h3 className="mb-4 text-lg font-semibold">Preview</h3>
                <div className="space-y-4">
                  <div className="rounded-[24px] border border-white/8 bg-white/[0.04] p-5">
                    <p className="text-sm text-zinc-500 mb-1">Recipient</p>
                    <p className="text-sm text-zinc-300">
                      {address ? getIdentityLabel(identity) : "Connect wallet"}
                    </p>
                  </div>
                  <ReceiptCard
                    title="Requested"
                    amount={amount && Number(amount) > 0 ? amount : "0.00"}
                    token={token}
                    status="Preview"
                    fromLabel={address ? getIdentityLabel(identity) : "Connect wallet"}
                    note={memo.trim() || "No memo added"}
                    metaLabel="Request by"
                    metaValue={identity.handle ? `@${identity.handle}` : identity.displayName}
                    shareText={amount && Number(amount) > 0 ? `Payment request from ${getIdentityLabel(identity)}: ${amount} ${token}${memo.trim() ? ` for ${memo.trim()}` : ""}` : undefined}
                  />
                  <div className="rounded-[24px] border border-white/8 bg-white/[0.04] p-5">
                    <p className="text-sm text-zinc-500 mb-1">Memo</p>
                    <p className="text-sm text-zinc-300">
                      {memo.trim() || "No memo added"}
                    </p>
                  </div>
                  <p className="text-xs leading-6 text-zinc-500">
                    This generates a sharable Arc payment URL and QR code that opens the pay page directly.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
