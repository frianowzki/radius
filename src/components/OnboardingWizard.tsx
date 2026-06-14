"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { useRadiusAuth } from "@/lib/web3auth";
import { getIdentityProfile, saveIdentityProfile } from "@/lib/utils";
import { fetchRegistryProfile, registryProfileToIdentity, saveRegistryProfile } from "@/lib/registry-client";

const FLAG = "radius-onboarding-done";

type Step = "welcome" | "profile" | "fund" | "done";

export function OnboardingWizard({ forceOpen = false, requireProfile = false, onRegistered }: { forceOpen?: boolean; requireProfile?: boolean; onRegistered?: () => void } = {}) {
  const { address: wagmiAddress, isConnected: wagmiConnected } = useAccount();
  const { authenticated, walletReady, address: authAddress, provider: authProvider, signMessage, user } = useRadiusAuth();
  const address = wagmiAddress ?? authAddress;
  const isConnected = wagmiConnected || authenticated;
  const signingReady = wagmiConnected || walletReady;

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("welcome");
  const [displayName, setDisplayName] = useState("");
  const [handle, setHandle] = useState("");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");

  /* eslint-disable react-hooks/set-state-in-effect -- hydrate from localStorage on mount */
  useEffect(() => {
    if (!isConnected || !address) return;
    let cancelled = false;
    const p = getIdentityProfile();
    setDisplayName(user?.name || (p.displayName === "Arc user" ? "" : p.displayName));
    setHandle(p.handle || "");

    fetchRegistryProfile({ address })
      .then((remote) => {
        if (cancelled) return;
        if (remote?.handle) {
          saveIdentityProfile(registryProfileToIdentity(remote));
          localStorage.setItem(FLAG, "1");
          setOpen(false);
          onRegistered?.();
          return;
        }
        if (!forceOpen && localStorage.getItem(FLAG) === "1" && !p.handle) return;
        setStep("profile");
        setOpen(true);
      })
      .catch(() => {
        if (cancelled) return;
        if (!forceOpen && localStorage.getItem(FLAG) === "1" && !p.handle) return;
        setStep("profile");
        setOpen(true);
      });
    return () => { cancelled = true; };
  }, [isConnected, address, user?.name, forceOpen, onRegistered]);
  /* eslint-enable react-hooks/set-state-in-effect */

  function close(markDone = true) {
    if (requireProfile) return;
    if (markDone) localStorage.setItem(FLAG, "1");
    setOpen(false);
  }

  async function saveProfile() {
    if (!signingReady) return;
    const normalizedHandle = handle.trim().replace(/^@+/, "").toLowerCase();
    if (!address || !displayName.trim() || !normalizedHandle) {
      setStatus("Display name and username are required to register globally.");
      return;
    }
    setSaving(true);
    setStatus("Claiming username globally...");
    const next = { displayName: displayName.trim(), handle: normalizedHandle, authMode: "wallet" as const };
    try {
      const remote = await saveRegistryProfile({ address, displayName: next.displayName, handle: next.handle }, { provider: authProvider, signMessage, prompt: true });
      saveIdentityProfile(registryProfileToIdentity(remote));
      localStorage.setItem(FLAG, "1");
      try { sessionStorage.setItem(`radius-registered-${address.toLowerCase()}`, "1"); } catch { /* storage may be blocked */ }
      setStatus("");
      onRegistered?.();
      if (requireProfile) {
        setOpen(false);
      } else {
        setStep("fund");
      }
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Could not claim username. Try another one.");
    } finally {
      setSaving(false);
    }
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
            <h2 className="text-lg font-bold">Claim your permanent username</h2>
            <p className="mt-1 text-xs text-[#8b8795]">Friends can find and add you from Contacts by searching this username. It cannot be changed after saving.</p>
            {!signingReady ? (
              <div className="mt-6 flex flex-col items-center gap-3 py-4">
                <div className="orb h-10 w-10 rounded-full" />
                <p className="text-xs text-[#8b8795]">Setting up your wallet&hellip;</p>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                <div>
                  <label className="mb-1 block text-[11px] font-bold text-[#8b8795]">Display name</label>
                  <input className="radius-input text-sm" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Your name" />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-bold text-[#8b8795]">Permanent username</label>
                  <input className="radius-input text-sm" value={handle} onChange={(e) => { setHandle(e.target.value); setStatus(""); }} placeholder="@yourname" />
                  <p className="mt-1 text-[11px] text-[#8b8795]">2-30 chars: letters, numbers, underscore, dot, dash.</p>
                </div>
              </div>
            )}
            {status && <p className="mt-3 rounded-2xl bg-[var(--brand)]/10 p-3 text-xs text-[var(--foreground)]">{status}</p>}
            <div className="mt-5 grid grid-cols-2 gap-3">
              {!requireProfile && <button type="button" onClick={() => setStep("fund")} className="ghost-btn py-3 text-xs">Skip</button>}
              <button type="button" onClick={saveProfile} disabled={saving || !signingReady || !displayName.trim() || !handle.trim()} className={`primary-btn py-3 text-xs disabled:opacity-40 ${requireProfile ? "col-span-2" : ""}`}>{saving ? "Saving..." : "Claim & continue"}</button>
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
