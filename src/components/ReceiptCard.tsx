"use client";

import { useState } from "react";
import { TokenLogo } from "@/components/TokenLogo";

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

function escapeSvg(value: string) {
  return value.replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[char] || char));
}

function buildReceiptSvg(params: { title: string; amount: string; token: string; status: string; from: string; to: string; date: string; network: string }) {
  const { title, amount, token, status, from, to, date, network } = params;
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350">
  <defs>
    <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1"><stop stop-color="#756dff"/><stop offset="0.55" stop-color="#9b7cff"/><stop offset="1" stop-color="#85cfff"/></linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="26" stdDeviation="34" flood-color="#281f5f" flood-opacity="0.28"/></filter>
  </defs>
  <rect width="1080" height="1350" fill="#f7f4ff"/>
  <circle cx="130" cy="90" r="260" fill="#8f7cff" opacity="0.18"/>
  <circle cx="930" cy="160" r="240" fill="#85cfff" opacity="0.22"/>
  <rect x="96" y="118" width="888" height="1114" rx="72" fill="white" filter="url(#shadow)"/>
  <rect x="156" y="178" width="768" height="338" rx="54" fill="url(#bg)"/>
  <text x="540" y="268" text-anchor="middle" fill="white" font-family="Inter, Arial, sans-serif" font-size="34" font-weight="800" letter-spacing="4">${escapeSvg(title)}</text>
  <text x="540" y="382" text-anchor="middle" fill="white" font-family="Inter, Arial, sans-serif" font-size="94" font-weight="900">${escapeSvg(amount || "0.00")}</text>
  <text x="540" y="445" text-anchor="middle" fill="white" opacity="0.88" font-family="Inter, Arial, sans-serif" font-size="36" font-weight="800">${escapeSvg(token)} • ${escapeSvg(status)}</text>
  ${[
    ["From", from],
    ["To", to],
    ["Date", date],
    ["Network", network],
  ].map(([label, value], index) => {
    const y = 625 + index * 130;
    return `<text x="170" y="${y}" fill="#9a94a3" font-family="Inter, Arial, sans-serif" font-size="30" font-weight="700">${escapeSvg(label)}</text><text x="910" y="${y}" text-anchor="end" fill="#17151f" font-family="Inter, Arial, sans-serif" font-size="32" font-weight="800">${escapeSvg(value).slice(0, 44)}</text><line x1="170" y1="${y + 48}" x2="910" y2="${y + 48}" stroke="#ece8f7" stroke-width="2"/>`;
  }).join("")}
  <text x="540" y="1160" text-anchor="middle" fill="#6f60d5" font-family="Inter, Arial, sans-serif" font-size="32" font-weight="900">Radius</text>
</svg>`.trim();
}

export function ReceiptCard({ title, amount, token, status, fromLabel, toLabel, note, metaLabel, metaValue, shareText, txHash, explorerUrl, createdAt, preview }: ReceiptCardProps) {
  const [fallbackCreatedAt] = useState(() => Date.now());
  const [shared, setShared] = useState(false);
  const confirmedAt = createdAt || (txHash ? fallbackCreatedAt : undefined);
  const dateLabel = formatDate(confirmedAt);

  async function shareReceipt() {
    const svg = buildReceiptSvg({
      title,
      amount: `$${amount || "0.00"}`,
      token,
      status: status || "Preview",
      from: fromLabel || "Connected wallet",
      to: toLabel || "Recipient",
      date: dateLabel,
      network: "Arc Testnet",
    });
    const file = new File([new Blob([svg], { type: "image/svg+xml" })], `radius-receipt-${Date.now()}.svg`, { type: "image/svg+xml" });
    const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };

    if (nav.share && (!nav.canShare || nav.canShare({ files: [file] }))) {
      await nav.share({ title: "Radius receipt", text: shareText || `${amount} ${token} on Radius`, files: [file] });
    } else if (nav.share) {
      await nav.share({ title: "Radius receipt", text: shareText || `${amount} ${token} on Radius` });
    } else {
      const url = URL.createObjectURL(file);
      const link = document.createElement("a");
      link.href = url;
      link.download = file.name;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    }

    setShared(true);
    window.setTimeout(() => setShared(false), 1600);
  }

  return (
    <div className="soft-card rounded-[30px] p-5 text-[#17151f]">
      <div className="text-center">
        <span className="inline-flex rounded-full bg-emerald-50 px-4 py-2 text-[11px] font-bold text-emerald-600">● {status || "Preview"}</span>
        <div className="mt-6 flex items-center justify-center gap-3">
          <TokenLogo symbol={token} size={42} />
          <p className="text-5xl font-semibold tracking-[-0.07em]">${amount || "0.00"}</p>
        </div>
        <p className="mt-2 text-sm font-semibold text-[#6f60d5]">{token}</p>
      </div>
      <div className="mt-7 space-y-3 text-sm">
        <div className="flex justify-between gap-4"><span className="text-[#9a94a3]">From</span><span className="text-right">{fromLabel || "Connected wallet"}</span></div>
        <div className="flex justify-between gap-4"><span className="text-[#9a94a3]">To</span><span className="text-right">{toLabel || "Recipient"}</span></div>
        <div className="flex justify-between gap-4"><span className="text-[#9a94a3]">Date</span><span className="text-right">{dateLabel}</span></div>
        <div className="flex justify-between"><span className="text-[#9a94a3]">Network</span><span className="text-[#6f60d5]">Arc Testnet</span></div>
        {txHash && <div className="flex justify-between gap-4"><span className="text-[#9a94a3]">Transaction Hash</span><a href={explorerUrl} target="_blank" rel="noopener noreferrer" className="font-mono text-xs text-[#6f60d5]">{txHash.slice(0, 6)}...{txHash.slice(-4)}</a></div>}
        {metaLabel && metaValue && <div className="flex justify-between"><span className="text-[#9a94a3]">{metaLabel}</span><span>{metaValue}</span></div>}
      </div>
      {note && !preview && <div className="mt-5 rounded-2xl bg-white/70 p-4"><p className="text-[11px] text-[#9a94a3]">Note</p><p className="mt-1 text-sm">{note}</p></div>}
      <button type="button" onClick={shareReceipt} className="ghost-btn mt-5 w-full text-sm">
        {shared ? "Receipt ready" : preview ? "Download receipt preview" : "Share receipt"}
      </button>
    </div>
  );
}
