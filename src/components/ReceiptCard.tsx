"use client";

import { useMemo, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";

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

export function ReceiptCard({
  title,
  amount,
  token,
  status,
  fromLabel,
  toLabel,
  note,
  metaLabel,
  metaValue,
  shareText,
  txHash,
  explorerUrl,
}: ReceiptCardProps) {
  const [feedback, setFeedback] = useState("");
  const receiptText = useMemo(() => {
    const parts = [
      shareText || `${title}: ${amount} ${token}`,
      fromLabel ? `From: ${fromLabel}` : undefined,
      toLabel ? `To: ${toLabel}` : undefined,
      note ? `Note: ${note}` : undefined,
      txHash ? `Tx: ${txHash}` : undefined,
      explorerUrl,
    ].filter(Boolean);

    return parts.join("\n");
  }, [amount, explorerUrl, fromLabel, note, shareText, title, toLabel, token, txHash]);

  async function copyReceipt() {
    try {
      await navigator.clipboard.writeText(receiptText);
      setFeedback("Receipt copied");
    } catch {
      setFeedback("Copy unavailable");
    }
  }

  async function handleShare() {
    try {
      if (navigator.share) {
        await navigator.share({
          title: `${title} receipt`,
          text: receiptText,
          url: explorerUrl,
        });
        setFeedback("Receipt shared");
        return;
      }

      await copyReceipt();
    } catch {
      // ignore canceled native shares
    }
  }

  function downloadReceipt() {
    const blob = new Blob([receiptText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `arc-receipt-${txHash ? txHash.slice(0, 10) : Date.now()}.txt`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setFeedback("Receipt downloaded");
  }

  return (
    <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(99,102,241,0.16),rgba(24,24,27,0.38))] p-6 shadow-2xl shadow-indigo-500/10">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-zinc-400">{title}</p>
          <p className="mt-1 text-2xl font-semibold text-zinc-50">
            {amount} {token}
          </p>
        </div>
        <div className="rounded-2xl bg-white/10 px-3 py-2 text-xs uppercase tracking-[0.22em] text-zinc-300">
          {status}
        </div>
      </div>

      <div className="mt-8 space-y-3 text-sm">
        {fromLabel && (
          <div className="flex items-center justify-between gap-4">
            <span className="text-zinc-500">From</span>
            <span className="text-zinc-200">{fromLabel}</span>
          </div>
        )}
        {toLabel && (
          <div className="flex items-center justify-between gap-4">
            <span className="text-zinc-500">To</span>
            <span className="text-zinc-200">{toLabel}</span>
          </div>
        )}
        {note && (
          <div className="flex items-center justify-between gap-4">
            <span className="text-zinc-500">Note</span>
            <span className="text-right text-zinc-200">{note}</span>
          </div>
        )}
        {metaLabel && metaValue && (
          <div className="flex items-center justify-between gap-4">
            <span className="text-zinc-500">{metaLabel}</span>
            <span className="text-right text-zinc-200">{metaValue}</span>
          </div>
        )}
        {txHash && (
          <div className="flex items-center justify-between gap-4">
            <span className="text-zinc-500">Tx</span>
            <span className="font-mono text-xs text-zinc-200">
              {txHash.slice(0, 10)}...{txHash.slice(-6)}
            </span>
          </div>
        )}
      </div>

      {(txHash || explorerUrl) && (
        <div className="mt-6 flex items-center gap-4 rounded-[24px] border border-white/8 bg-white/[0.04] p-4">
          <div className="rounded-2xl bg-white p-2">
            <QRCodeCanvas value={explorerUrl || receiptText} size={88} marginSize={1} />
          </div>
          <div>
            <p className="text-sm font-medium text-zinc-200">Receipt QR</p>
            <p className="mt-1 text-xs leading-5 text-zinc-500">
              Scan to open the transaction receipt.
            </p>
          </div>
        </div>
      )}

      <div className="mt-6 grid gap-2 sm:grid-cols-3">
        <button
          onClick={handleShare}
          className="rounded-2xl bg-white/10 px-4 py-3 text-sm font-medium text-zinc-100 transition-colors hover:bg-white/14"
        >
          Share
        </button>
        <button
          onClick={copyReceipt}
          className="rounded-2xl bg-white/8 px-4 py-3 text-sm font-medium text-zinc-200 transition-colors hover:bg-white/12"
        >
          Copy
        </button>
        <button
          onClick={downloadReceipt}
          className="rounded-2xl bg-white/8 px-4 py-3 text-sm font-medium text-zinc-200 transition-colors hover:bg-white/12"
        >
          Download
        </button>
      </div>
      {feedback && <p className="mt-3 text-xs text-zinc-500">{feedback}</p>}
    </div>
  );
}
