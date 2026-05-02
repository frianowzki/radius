"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { useRadiusAuth } from "@/lib/web3auth";
import { getIdentityProfile, saveIdentityProfile } from "@/lib/utils";
import { saveRegistryProfile } from "@/lib/registry-client";

const FLAG = "radius-onboarding-done";

type Step = "welcome" | "profile" | "fund" | "done";

export function OnboardingWizard() {
  const { address: wagmiAddress, isConnected: wagmiConnected } = useAccount();
  const { authenticated, address: authAddress, provider: authProvider, user } = useRadiusAuth();
  const address = wagmiAddress ?? authAddress;
  const isConnected = wagmiConnected || authenticated;

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("welcome");
  const [displayName, setDisplayName] = useState("");
  const [handle, setHandle] = useState("");
  const [saving, setSaving] = useState(false);

  /* eslint-disable react-hooks/set-state-in-effect -- hydrate from localStorage on mount */
  useEffect(() => {
    if (!isConnected || !address) return;
    if (localStorage.getItem(FLAG) === "1") return;
    const p = getIdentityProfile();
    // Only show for users who don't already have a customized display name.
    if (p.displayName && p.displayName !== "Arc user") {
      localStorage.setItem(FLAG, "1");
      return;
    }
    setDisplayName(user?.name || p.displayName === "Arc user" ? (user?.name || "") : p.displayName);
    setOpen(true);
  }, [isConnected, address, user?.name]);
  /* eslint-enable react-hooks/set-state-in-effect */

  function close(markDone = true) {
    if (markDone) localStorage.setItem(FLAG, "1");
    setOpen(false);
  }

  async function saveProfile() {
    if (!address || !displayName.trim()) { setStep("fund"); return; }
    setSaving(true);
    const normalizedHandle = handle.trim().replace(/^@+/, "").toLowerCase() || undefined;
    const next = { displayName: displayName.trim(), handle: normalizedHandle, authMode: "wallet" as const };
    try { saveIdentityProfile(next); } catch { /* noop */ }
    try { await saveRegistryProfile({ address, displayName: next.displayName, handle: next.handle }, { provider: authProvider, prompt: true }); } catch { /* registry optional */ }
    setSaving(false);
    setStep("fund");
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[110] grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true">
      <div className="soft-card w-full max-w-sm rounded-[28px] p-5">
        {step === "welcome" && (
          <>
            <div className="orb mx-auto mb-4 h-16 w-16 rounded-full" />
            <h2 className="text-center text-xl font-semibold tracking-[-0.03em]">Welcome to Radius</h2>
            <p className="mx-auto mt-2 max-w-72 text-center text-xs leading-5 text-[#8b8795]">Send and request stablecoins on Arc Testnet. Three quick steps and you&rsquo;re ready.</p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button type="button" onClick={() => close()} className="ghost-btn py-3 text-xs">Skip</button>
              <button type="button" onClick={() => setStep("profile")} className="primary-btn py-3 text-xs">Get started</button>
            </div>
          </>
        )}
        {step === "profile" && (
          <>
            <h2 className="text-lg font-bold">Claim your handle</h2>
            <p className="mt-1 text-xs text-[#8b8795]">Friends can pay you by username instead of a 0x address.</p>
            <div className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-[11px] font-bold text-[#8b8795]">Display name</label>
                <input className="radius-input text-sm" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Your name" />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-bold text-[#8b8795]">Username</label>
                <input className="radius-input text-sm" value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="@yourname" />
              </div>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button type="button" onClick={() => setStep("fund")} className="ghost-btn py-3 text-xs">Skip</button>
              <button type="button" onClick={saveProfile} disabled={saving || !displayName.trim()} className="primary-btn py-3 text-xs disabled:opacity-40">{saving ? "Saving..." : "Save & continue"}</button>
            </div>
          </>
        )}
        {step === "fund" && (
          <>
            <h2 className="text-lg font-bold">Get test funds</h2>
            <p className="mt-1 text-xs text-[#8b8795]">Drip free USDC/EURC on Arc Testnet so you can send your first payment.</p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button type="button" onClick={() => close()} className="ghost-btn py-3 text-xs">Maybe later</button>
              <Link href="/faucet" onClick={() => close()} className="primary-btn py-3 text-center text-xs">Open faucet</Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
