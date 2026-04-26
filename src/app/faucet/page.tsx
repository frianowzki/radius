"use client";

import { useEffect } from "react";
import { AppShell } from "@/components/AppShell";

const CIRCLE_FAUCET = "https://faucet.circle.com/";

export default function FaucetPage() {
  useEffect(() => {
    window.location.replace(CIRCLE_FAUCET);
  }, []);

  return (
    <AppShell>
      <div className="screen-pad">
        <section className="soft-card rounded-[30px] p-6 text-center">
          <div className="mx-auto grid h-20 w-20 place-items-center rounded-[26px] bg-white/60 text-3xl text-[#8f7cff]">＋</div>
          <h1 className="mt-5 text-3xl font-semibold tracking-[-0.04em]">Opening Circle faucet</h1>
          <p className="mx-auto mt-3 max-w-64 text-sm leading-6 text-[#8b8795]">Radius now sends add-funds directly to the official Circle faucet.</p>
          <a href={CIRCLE_FAUCET} target="_blank" rel="noopener noreferrer" className="primary-btn mt-6 block text-sm">Open faucet.circle.com</a>
        </section>
      </div>
    </AppShell>
  );
}
