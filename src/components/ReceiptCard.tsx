"use client";

import { useMemo, useState } from "react";

interface ReceiptCardProps {
  title: string;
  amount: string;
  token: string;
  status: string;
  fromLabel?: string;
  toLabel?: string;
  note?: string;
  metaLabel?: string;
  metaValue?: string;
  shareText?: string;
  txHash?: string;
  explorerUrl?: string;
  createdAt?: number;
  preview?: boolean;
}

function Avatar({ label, color }: { label?: string; color: string }) {
  return <div className="grid h-12 w-12 place-items-center rounded-full text-sm font-bold text-white" style={{ background: color }}>{(label || "U").slice(0, 1).toUpperCase()}</div>;
}

function formatDate(value?: number) {
  if (!value) return "Not confirmed yet";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function formatTime(value?: number) {
  if (!value) return "Pending";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

export function ReceiptCard({ title, amount, token, status, fromLabel, toLabel, note, metaLabel, metaValue, shareText, txHash, explorerUrl, createdAt, preview }: ReceiptCardProps) {
  const [feedback, setFeedback] = useState("");
  const [fallbackCreatedAt] = useState(() => Date.now());
  const confirmedAt = createdAt || (txHash ? fallbackCreatedAt : undefined);
  const receiptText = useMemo(() => [shareText || `${title}: ${amount || "0.00"} ${token}`, fromLabel && `From: ${fromLabel}`, toLabel && `To: ${toLabel}`, note && `Note: ${note}`, confirmedAt && `Date: ${formatDate(confirmedAt)}`, txHash && `Tx: ${txHash}`, explorerUrl].filter(Boolean).join("\n"), [amount, confirmedAt, explorerUrl, fromLabel, note, shareText, title, toLabel, token, txHash]);

  async function copyReceipt() {
    try { await navigator.clipboard.writeText(receiptText); setFeedback("Receipt copied"); } catch { setFeedback("Copy unavailable"); }
  }
  async function handleShare() {
    try {
      if (navigator.share) await navigator.share({ title: `${title} receipt`, text: receiptText, url: explorerUrl });
      else await copyReceipt();
      setFeedback("Receipt shared");
    } catch {}
  }
  function downloadReceipt() {
    const blob = new Blob([receiptText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `radius-receipt-${txHash ? txHash.slice(0, 10) : Date.now()}.txt`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setFeedback("Receipt downloaded");
  }

  return (
    <div className="soft-card rounded-[30px] p-5 text-[#17151f]">
      <div className="mb-6 flex items-center justify-between">
        <span className="text-xl">‹</span>
        <p className="text-sm font-bold">Receipt</p>
        <span className="text-lg">⇧</span>
      </div>
      <div className="text-center">
        <span className="inline-flex rounded-full bg-emerald-50 px-4 py-2 text-[11px] font-bold text-emerald-600">● {status || (preview ? "Preview" : "Completed")}</span>
        <p className="mt-6 text-5xl font-semibold tracking-[-0.07em]">${amount || "0.00"}</p>
        <p className="mt-2 text-sm font-semibold text-[#6f60d5]">◎ {token}</p>
      </div>

      <div className="mt-7 rounded-[22px] bg-white/78 p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3"><Avatar label={fromLabel} color="#d89b72" /><div><p className="text-[11px] text-[#9a94a3]">From</p><p className="text-sm font-bold">{fromLabel || "Connected wallet"}</p></div></div>
          <span className="text-[#9a94a3]">→</span>
          <div className="flex items-center gap-3"><Avatar label={toLabel} color="#506fd9" /><div><p className="text-[11px] text-[#9a94a3]">To</p><p className="text-sm font-bold">{toLabel || "Recipient"}</p></div></div>
        </div>
      </div>

      <div className="mt-5 space-y-3 text-sm">
        <div className="flex justify-between gap-4"><span className="text-[#9a94a3]">Date</span><span className="text-right">{formatDate(confirmedAt)}</span></div>
        <div className="flex justify-between"><span className="text-[#9a94a3]">Network</span><span className="text-[#6f60d5]">● Arc Testnet</span></div>
        {txHash && <div className="flex justify-between"><span className="text-[#9a94a3]">Transaction Hash</span><span className="font-mono text-xs">{txHash.slice(0, 6)}...{txHash.slice(-4)}</span></div>}
        {metaLabel && metaValue && <div className="flex justify-between"><span className="text-[#9a94a3]">{metaLabel}</span><span>{metaValue}</span></div>}
      </div>

      {note && <div className="mt-5 rounded-2xl bg-white/70 p-4"><p className="text-[11px] text-[#9a94a3]">Note</p><p className="mt-1 text-sm">{note}</p></div>}

      <div className="mt-5 grid grid-cols-2 gap-3">
        <button onClick={downloadReceipt} className="ghost-btn text-xs">⇩ Download Receipt</button>
        <button onClick={handleShare} className="ghost-btn text-xs">⇧ Share Receipt</button>
      </div>
      <div className="mt-6">
        <p className="mb-3 text-sm font-bold">Timeline</p>
        {[
          [preview ? "Drafted" : "Created", confirmedAt],
          [txHash ? "Submitted" : "Waiting for payment", confirmedAt],
          [txHash ? "Confirmed" : "Not confirmed", confirmedAt],
        ].map(([item, time]) => <div key={String(item)} className="flex gap-3 pb-3 text-sm"><span className="mt-1 grid h-5 w-5 place-items-center rounded-full bg-emerald-50 text-[10px] text-emerald-600">{txHash || preview ? "✓" : "•"}</span><div><p className="font-semibold">{item}</p><p className="text-xs text-[#9a94a3]">{formatTime(time as number | undefined)}</p></div></div>)}
      </div>
      <button onClick={copyReceipt} className="mt-2 text-xs font-semibold text-[#8f7cff]">Copy receipt text</button>
      {feedback && <p className="mt-2 text-xs text-[#9a94a3]">{feedback}</p>}
    </div>
  );
}
