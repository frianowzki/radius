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
}

function Avatar({ label, color }: { label?: string; color: string }) {
  return <div className="grid h-12 w-12 place-items-center rounded-full text-sm font-bold text-white" style={{ background: color }}>{(label || "U").slice(0, 1).toUpperCase()}</div>;
}

export function ReceiptCard({ title, amount, token, status, fromLabel, toLabel, note, metaLabel, metaValue, shareText, txHash, explorerUrl }: ReceiptCardProps) {
  const [feedback, setFeedback] = useState("");
  const receiptText = useMemo(() => [shareText || `${title}: ${amount} ${token}`, fromLabel && `From: ${fromLabel}`, toLabel && `To: ${toLabel}`, note && `Note: ${note}`, txHash && `Tx: ${txHash}`, explorerUrl].filter(Boolean).join("\n"), [amount, explorerUrl, fromLabel, note, shareText, title, toLabel, token, txHash]);

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
        <span className="inline-flex rounded-full bg-emerald-50 px-4 py-2 text-[11px] font-bold text-emerald-600">● {status || "Completed"}</span>
        <p className="mt-6 text-5xl font-semibold tracking-[-0.07em]">${amount}</p>
        <p className="mt-2 text-sm font-semibold text-[#6f60d5]">◎ {token}</p>
      </div>

      <div className="mt-7 rounded-[22px] bg-white/78 p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3"><Avatar label={fromLabel} color="#d89b72" /><div><p className="text-[11px] text-[#9a94a3]">From</p><p className="text-sm font-bold">{fromLabel || "Jamie Lee"}</p></div></div>
          <span className="text-[#9a94a3]">→</span>
          <div className="flex items-center gap-3"><Avatar label={toLabel} color="#506fd9" /><div><p className="text-[11px] text-[#9a94a3]">To</p><p className="text-sm font-bold">{toLabel || "Alex Kim"}</p></div></div>
        </div>
      </div>

      <div className="mt-5 space-y-3 text-sm">
        <div className="flex justify-between"><span className="text-[#9a94a3]">Date</span><span>May 21, 2024 at 9:41 AM</span></div>
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
        {["Requested", "Paid", "Confirmed"].map((item, i) => <div key={item} className="flex gap-3 pb-3 text-sm"><span className="mt-1 grid h-5 w-5 place-items-center rounded-full bg-emerald-50 text-[10px] text-emerald-600">✓</span><div><p className="font-semibold">{item}</p><p className="text-xs text-[#9a94a3]">May 21, 9:{39 + i} AM</p></div></div>)}
      </div>
      <button onClick={copyReceipt} className="mt-2 text-xs font-semibold text-[#8f7cff]">Copy receipt text</button>
      {feedback && <p className="mt-2 text-xs text-[#9a94a3]">{feedback}</p>}
    </div>
  );
}
