"use client";

import { AppShell } from "@/components/AppShell";

export default function SwapPage() {
  return (
    <AppShell>
      <div className="bridge-v2">
        <header className="bridge-v2-header">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--brand)]">Arc swap</p>
            <h1 className="text-2xl font-black tracking-tight text-[#17151f]">Swap</h1>
          </div>
        </header>
        <section className="bridge-premium-card p-6 text-center">
          <p className="text-lg font-bold text-[#17151f]">Coming soon</p>
          <p className="mt-2 text-sm text-[#8b8795]">Token swaps require mainnet liquidity. This feature will be available when Radius launches on mainnet.</p>
        </section>
      </div>
    </AppShell>
  );
}
