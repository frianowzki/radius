"use client";

import { useEffect, useMemo, useState } from "react";
import { useAccount, useDisconnect } from "wagmi";
import { QRCodeSVG } from "qrcode.react";
import { AppShell } from "@/components/AppShell";
import { AvatarImage } from "@/components/AvatarImage";
import { ProfilePfpUpload } from "@/components/ProfilePfpUpload";
import { useRadiusAuth } from "@/lib/web3auth";
import { clearRadiusLocalSession, formatAddress, getIdentityProfile, saveIdentityProfile } from "@/lib/utils";
import { fetchRegistryProfile, registryProfileToIdentity, saveRegistryProfile } from "@/lib/registry-client";
import { useMounted } from "@/lib/useMounted";

export default function ProfilePage() {
  const { isConnected: wagmiConnected, address: wagmiAddress } = useAccount();
  const { disconnect } = useDisconnect();
  const { authenticated, address: authAddress, user, logout } = useRadiusAuth();
  const address = wagmiAddress ?? authAddress;
  const isConnected = wagmiConnected || authenticated;
  const [profile, setProfile] = useState<ReturnType<typeof getIdentityProfile>>({ displayName: "Arc user", authMode: "wallet" });
  const [displayName, setDisplayName] = useState("");
  const [handle, setHandle] = useState("");
  const [bio, setBio] = useState("");
  /* eslint-disable react-hooks/set-state-in-effect -- hydrate from localStorage on mount to avoid SSR mismatch */
  useEffect(() => {
    const p = getIdentityProfile();
    setProfile(p);
    setDisplayName(p.displayName);
    setHandle(p.handle || "");
    setBio(p.bio || "");
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */
  const [saved, setSaved] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [registryStatus, setRegistryStatus] = useState("");

  const normalizedHandle = handle.trim().replace(/^@+/, "").toLowerCase();
  const mounted = useMounted();
  const [copiedLink, setCopiedLink] = useState(false);
  const payTarget = (profile.handle && `@${profile.handle.replace(/^@+/, "")}`) || address || "";
  const payLink = useMemo(() => {
    if (!mounted || !payTarget) return "";
    return `${window.location.origin}/send?to=${encodeURIComponent(payTarget)}`;
  }, [mounted, payTarget]);

  async function copyPayLink() {
    if (!payLink) return;
    try {
      await navigator.clipboard.writeText(payLink);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 1500);
    } catch { /* noop */ }
  }
  async function sharePayLink() {
    if (!payLink) return;
    const text = `Pay me on Radius${profile.handle ? ` (@${profile.handle})` : ""}`;
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try { await (navigator as Navigator).share({ title: "Radius", text, url: payLink }); return; } catch { /* user cancel */ }
    }
    await copyPayLink();
  }

  useEffect(() => {
    if (!address) return;
    let cancelled = false;
    fetchRegistryProfile({ address })
      .then((remote) => {
        if (!remote || cancelled) return;
        const next = registryProfileToIdentity(remote);
        saveIdentityProfile(next);
        setProfile(next);
        setDisplayName(next.displayName);
        setHandle(next.handle || "");
        setBio(next.bio || "");
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [address]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!displayName.trim() || !address) return;
    const next = { displayName: displayName.trim(), handle: normalizedHandle || undefined, avatar: profile.avatar, bio: bio.trim() || undefined, authMode: "wallet" as const };
    saveIdentityProfile(next);
    setProfile(next);
    setRegistryStatus("Saving global profile...");
    try {
      const remote = await saveRegistryProfile({ address, displayName: next.displayName, handle: next.handle, avatar: next.avatar, bio: next.bio });
      const synced = registryProfileToIdentity(remote);
      saveIdentityProfile(synced);
      setProfile(synced);
      setRegistryStatus("Global profile saved");
      setSaved(true);
      setTimeout(() => setSaved(false), 1600);
    } catch (err) {
      setRegistryStatus(err instanceof Error ? err.message : "Could not save global profile");
    }
  }

  async function handleAvatarUploaded(url: string) {
    const next = { ...profile, displayName: displayName.trim() || profile.displayName || "Radius user", handle: normalizedHandle || profile.handle, bio: bio.trim() || profile.bio, avatar: url };
    saveIdentityProfile(next);
    setProfile(next);
    if (!address) return;
    setRegistryStatus("Syncing global picture...");
    try {
      const remote = await saveRegistryProfile({ address, displayName: next.displayName, handle: next.handle, avatar: url, bio: next.bio });
      const synced = registryProfileToIdentity(remote);
      saveIdentityProfile(synced);
      setProfile(synced);
      setRegistryStatus("Global picture saved");
    } catch (err) {
      setRegistryStatus(err instanceof Error ? err.message : "Could not sync global picture");
    }
  }

  async function copyAddress() {
    if (!address) return;
    await navigator.clipboard.writeText(address);
    setCopiedAddress(true);
    setTimeout(() => setCopiedAddress(false), 1500);
  }

  async function disconnectAll() {
    disconnect();
    await logout();
    clearRadiusLocalSession();
    window.location.replace("/");
  }



  return (
    <AppShell>
      <div className="screen-pad space-y-5">
        <section className="gradient-card rounded-[30px] p-6 text-center">
          <div className="mx-auto grid h-20 w-20 place-items-center overflow-hidden rounded-full bg-white/20 text-3xl font-black text-white shadow-lg">
            <AvatarImage src={profile.avatar} fallback={profile.handle || profile.displayName || user?.name || "R"} />
          </div>
          <h1 className="mt-4 text-2xl font-semibold tracking-[-0.04em]">{profile.displayName || "Radius user"}</h1>
          <p className="mt-1 text-sm text-white/78">{profile.handle ? `@${profile.handle}` : "Claim a username below"}</p>
          <p className="mx-auto mt-3 max-w-64 text-xs leading-5 text-white/72">{profile.bio || "Your Radius profile is used for requests, receipts, and username sending on this device."}</p>
          <div className="mt-4 rounded-2xl bg-white/16 px-3 py-2 font-mono text-[11px] text-white/82">
            {address ? formatAddress(address) : "No wallet connected"}
          </div>
          {address && (
            <div className="mt-3 grid grid-cols-2 gap-3 text-xs font-semibold">
              <button type="button" onClick={copyAddress} className="rounded-2xl bg-white/16 py-3 text-white/90">{copiedAddress ? "Copied" : "Copy address"}</button>
              <button type="button" onClick={disconnectAll} className="rounded-2xl bg-white/16 py-3 text-white/90">Disconnect</button>
            </div>
          )}
        </section>

        {address && (
          <section className="soft-card rounded-[28px] p-5">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-bold">My pay QR</p>
              <span className="text-[11px] text-[#8b8795]">{profile.handle ? `@${profile.handle}` : "address-based"}</span>
            </div>
            <div className="mx-auto w-fit rounded-2xl bg-white p-3 shadow-[0_10px_28px_rgba(143,124,255,.18)]">
              {payLink ? (
                <QRCodeSVG value={payLink} size={196} level="M" bgColor="#ffffff" fgColor="#050505" includeMargin />
              ) : (
                <div className="h-[196px] w-[196px] rounded-xl bg-[#f7f5fb]" />
              )}
            </div>
            <p className="mt-3 break-all text-center text-[11px] text-[#9a94a3]">{payLink || ""}</p>
            <div className="mt-3 grid grid-cols-2 gap-3 text-xs font-semibold">
              <button type="button" onClick={copyPayLink} disabled={!payLink} className="ghost-btn py-3 disabled:opacity-40">{copiedLink ? "Copied" : "Copy link"}</button>
              <button type="button" onClick={sharePayLink} disabled={!payLink} className="primary-btn py-3 disabled:opacity-40">Share</button>
            </div>
          </section>
        )}

        <section className="soft-card rounded-[28px] p-5">
          <p className="mb-3 text-sm font-bold">Profile picture</p>
          <ProfilePfpUpload initialUrl={profile.avatar} onUploaded={handleAvatarUploaded} />
        </section>

        <form onSubmit={handleSave} className="soft-card rounded-[28px] p-5 space-y-3">
          <div>
            <label className="mb-2 block text-xs font-bold text-[#8b8795]">Display name</label>
            <input className="radius-input text-sm" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Your name" />
          </div>
          <div>
            <label className="mb-2 block text-xs font-bold text-[#8b8795]">Username for sending</label>
            <input className="radius-input text-sm" value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="@yourname" />
            {normalizedHandle && <p className="mt-2 text-xs text-[#8b8795]">@{normalizedHandle} will be checked against the global registry on save.</p>}
          </div>
          <div>
            <label className="mb-2 block text-xs font-bold text-[#8b8795]">Bio</label>
            <textarea className="radius-input min-h-24 text-sm" value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Short profile bio" />
          </div>
          {registryStatus && <p className="text-xs text-[#8b8795]">{registryStatus}</p>}
          <button type="submit" disabled={!displayName.trim() || !address} className="primary-btn w-full text-sm disabled:opacity-40">{saved ? "Saved globally" : "Save global profile"}</button>
        </form>

        <p className="text-center text-[11px] leading-5 text-[#9a94a3]">{isConnected ? "Profile is connected to your current wallet/social wallet." : "Connect first to use this profile in payments."}</p>
      </div>
    </AppShell>
  );
}
