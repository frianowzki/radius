"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";

export default function ScanPage() {
  const router = useRouter();
  const [value, setValue] = useState("");

  function openLink(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    try {
      const url = new URL(trimmed);
      router.push(`${url.pathname}${url.search}`);
    } catch {
      if (trimmed.startsWith("/pay")) router.push(trimmed);
    }
  }

  return (
    <AppShell>
      <div className="screen-pad">
        <header className="mb-7 flex items-center justify-between">
          <Link href="/" className="text-2xl">‹</Link>
          <h1 className="text-sm font-bold">Scan</h1>
          <span className="w-6" />
        </header>
        <div className="soft-card rounded-[30px] p-6 text-center">
          <div className="mx-auto grid h-32 w-32 place-items-center rounded-[30px] bg-white/70 text-5xl text-[#8f7cff]">⌗</div>
          <h2 className="mt-6 text-2xl font-semibold tracking-[-0.04em]">QR scanner coming next</h2>
          <p className="mt-3 text-sm leading-6 text-[#8b8795]">For now, paste a Radius payment link and we’ll open it directly.</p>
          <form onSubmit={openLink} className="mt-6 space-y-3 text-left">
            <input value={value} onChange={(e) => setValue(e.target.value)} placeholder="Paste request link" className="radius-input text-sm" />
            <button type="submit" className="primary-btn w-full text-sm disabled:opacity-40" disabled={!value.trim()}>Open payment link</button>
          </form>
        </div>
      </div>
    </AppShell>
  );
}
