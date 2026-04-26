"use client";

import { useState } from "react";

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

function formatDate(value?: number) {
  if (!value) return "Not confirmed yet";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function ReceiptCard({ amount, token, status, fromLabel, toLabel, note, metaLabel, metaValue, txHash, explorerUrl, createdAt, preview }: ReceiptCardProps) {
  const [fallbackCreatedAt] = useState(() => Date.now());
  const confirmedAt = createdAt || (txHash ? fallbackCreatedAt : undefined);

  return (
    <div className="soft-card rounded-[30px] p-5 text-[#17151f]">
      <div className="text-center">
        <span className="inline-flex rounded-full bg-emerald-50 px-4 py-2 text-[11px] font-bold text-emerald-600">● {status || "Preview"}</span>
        <p className="mt-6 text-5xl font-semibold tracking-[-0.07em]">${amount || "0.00"}</p>
        <p className="mt-2 text-sm font-semibold text-[#6f60d5]">{token}</p>
      </div>
      <div className="mt-7 space-y-3 text-sm">
        <div className="flex justify-between gap-4"><span className="text-[#9a94a3]">From</span><span className="text-right">{fromLabel || "Connected wallet"}</span></div>
        <div className="flex justify-between gap-4"><span className="text-[#9a94a3]">To</span><span className="text-right">{toLabel || "Recipient"}</span></div>
        <div className="flex justify-between gap-4"><span className="text-[#9a94a3]">Date</span><span className="text-right">{formatDate(confirmedAt)}</span></div>
        <div className="flex justify-between"><span className="text-[#9a94a3]">Network</span><span className="text-[#6f60d5]">Arc Testnet</span></div>
        {txHash && <div className="flex justify-between gap-4"><span className="text-[#9a94a3]">Transaction Hash</span><a href={explorerUrl} target="_blank" rel="noopener noreferrer" className="font-mono text-xs text-[#6f60d5]">{txHash.slice(0, 6)}...{txHash.slice(-4)}</a></div>}
        {metaLabel && metaValue && <div className="flex justify-between"><span className="text-[#9a94a3]">{metaLabel}</span><span>{metaValue}</span></div>}
      </div>
      {note && !preview && <div className="mt-5 rounded-2xl bg-white/70 p-4"><p className="text-[11px] text-[#9a94a3]">Note</p><p className="mt-1 text-sm">{note}</p></div>}
    </div>
  );
}
