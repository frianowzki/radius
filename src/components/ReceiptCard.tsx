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
  return value.replace(/[&<>\\\"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[char] || char));
}

function buildReceiptSvg(params: { title: string; amount: string; token: string; status: string; from: string; to: string; date: string; network: string }) {
  const { title, amount, token, status, from, to, date, network } = params;
  const rows: [string, string][] = [
    ["From", from],
    ["To", to],
    ["Date", date],
    ["Network", network],
  ];
  const svgHeight = 1120;
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="${svgHeight}" viewBox="0 0 1080 ${svgHeight}">
  <defs>
    <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1"><stop stop-color="#1d4ed8"/><stop offset="0.55" stop-color="#2563eb"/><stop offset="1" stop-color="#60a5fa"/></linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="26" stdDeviation="34" flood-color="#1e3a8a" flood-opacity="0.28"/></filter>
  </defs>
  <rect width="1080" height="${svgHeight}" fill="#eef2ff"/>
  <circle cx="130" cy="90" r="260" fill="#3b82f6" opacity="0.16"/>
  <circle cx="930" cy="160" r="240" fill="#60a5fa" opacity="0.22"/>
  <rect x="96" y="118" width="888" height="${svgHeight - 236}" rx="72" fill="white" filter="url(#shadow)"/>
  <rect x="156" y="178" width="768" height="338" rx="54" fill="url(#bg)"/>
  <text x="540" y="268" text-anchor="middle" fill="white" font-family="Inter, Arial, sans-serif" font-size="34" font-weight="800" letter-spacing="4">${escapeSvg(title)}</text>
  <text x="540" y="382" text-anchor="middle" fill="white" font-family="Inter, Arial, sans-serif" font-size="94" font-weight="900">${escapeSvg(amount || "0.00")}</text>
  <text x="540" y="445" text-anchor="middle" fill="white" opacity="0.88" font-family="Inter, Arial, sans-serif" font-size="36" font-weight="800">${escapeSvg(token)} • ${escapeSvg(status)}</text>
  ${rows.map(([label, value], index) => {
    const y = 625 + index * 130;
    return `<text x="170" y="${y}" fill="#9a94a3" font-family="Inter, Arial, sans-serif" font-size="30" font-weight="700">${escapeSvg(label)}</text><text x="910" y="${y}" text-anchor="end" fill="#17151f" font-family="Inter, Arial, sans-serif" font-size="32" font-weight="800">${escapeSvg(value).slice(0, 44)}</text><line x1="170" y1="${y + 48}" x2="910" y2="${y + 48}" stroke="#ece8f7" stroke-width="2"/>`;
  }).join("")}
</svg>`.trim();
}

function svgToPngBlob(svgString: string, scale = 2): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      const ctx = canvas.getContext("2d");
      if (!ctx) { URL.revokeObjectURL(url); reject(new Error("No canvas context")); return; }
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Canvas toBlob failed"));
      }, "image/png");
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Image load failed")); };
    img.src = url;
  });
}

export function ReceiptCard({ title, amount, token, status, fromLabel, toLabel, note, metaLabel, metaValue, shareText, txHash, createdAt, preview }: ReceiptCardProps) {
  const [fallbackCreatedAt] = useState(() => Date.now());
  const [downloading, setDownloading] = useState(false);
  const confirmedAt = createdAt || (txHash ? fallbackCreatedAt : undefined);
  const dateLabel = formatDate(confirmedAt);

  function getSvgString() {
    return buildReceiptSvg({
      title,
      amount: `$${amount || "0.00"}`,
      token,
      status: status || "Preview",
      from: fromLabel || "Connected wallet",
      to: toLabel || "Recipient",
      date: dateLabel,
      network: "Arc Testnet",
    });
  }

  async function downloadPng() {
    setDownloading(true);
    try {
      const svg = getSvgString();
      const blob = await svgToPngBlob(svg, 2);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `radius-receipt-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Receipt download failed:", err);
      const svg = getSvgString();
      const file = new File([new Blob([svg], { type: "image/svg+xml" })], `radius-receipt-${Date.now()}.svg`, { type: "image/svg+xml" });
      const url = URL.createObjectURL(file);
      const link = document.createElement("a");
      link.href = url;
      link.download = file.name;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    }
    setDownloading(false);
  }

  async function shareReceipt() {
    try {
      const svg = getSvgString();
      const blob = await svgToPngBlob(svg, 2);
      const file = new File([blob], `radius-receipt-${Date.now()}.png`, { type: "image/png" });
      const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
      const sharePayload: ShareData = {
        title: "Radius receipt",
        text: shareText || `${amount} ${token} on Radius${txHash ? `\nTx: ${txHash}` : ""}`,
        files: [file],
      };

      if (nav.share && (!nav.canShare || nav.canShare(sharePayload))) {
        await nav.share(sharePayload);
      } else if (nav.share) {
        await nav.share({ title: sharePayload.title, text: sharePayload.text });
      } else {
        await downloadPng();
      }
    } catch (err) {
      if ((err as Error)?.name !== "AbortError") {
        await downloadPng();
      }
    }
  }

  return (
    <div className="soft-card rounded-[30px] p-5 text-[#17151f]">
      <div className="text-center">
        <span className="inline-flex rounded-full bg-emerald-50 px-4 py-2 text-[11px] font-bold text-emerald-600">● {status || "Preview"}</span>
        <div className="mt-6 flex items-center justify-center gap-3">
          <TokenLogo symbol={token} size={42} />
          <p className="text-5xl font-semibold tracking-[-0.07em]">${amount || "0.00"}</p>
        </div>
        <p className="mt-2 text-sm font-semibold text-[var(--brand)]">{token}</p>
      </div>
      <div className="mt-7 space-y-3 text-sm">
        <div className="flex justify-between gap-4"><span className="text-[#9a94a3]">From</span><span className="text-right">{fromLabel || "Connected wallet"}</span></div>
        <div className="flex justify-between gap-4"><span className="text-[#9a94a3]">To</span><span className="text-right">{toLabel || "Recipient"}</span></div>
        <div className="flex justify-between gap-4"><span className="text-[#9a94a3]">Date</span><span className="text-right">{dateLabel}</span></div>
        <div className="flex justify-between"><span className="text-[#9a94a3]">Network</span><span className="text-[var(--brand)]">Arc Testnet</span></div>
        {metaLabel && metaValue && <div className="flex justify-between"><span className="text-[#9a94a3]">{metaLabel}</span><span>{metaValue}</span></div>}
      </div>
      {note && !preview && <div className="mt-5 rounded-2xl bg-white/70 p-4"><p className="text-[11px] text-[#9a94a3]">Note</p><p className="mt-1 text-sm">{note}</p></div>}
      <div className="mt-5 grid grid-cols-2 gap-3">
        <button type="button" onClick={downloadPng} disabled={downloading} className="ghost-btn grid place-items-center py-3 disabled:opacity-50" aria-label="Download receipt">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        </button>
        <button type="button" onClick={shareReceipt} className="primary-btn grid place-items-center py-3" aria-label="Share receipt">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
        </button>
      </div>
    </div>
  );
}
