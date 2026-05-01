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

  const mounted = useMounted();
  const payTarget = (profile.handle && `@${profile.handle.replace(/^@+/, "")}`) || address || "";
  const payLink = useMemo(() => {
    if (!mounted || !payTarget) return "";
    return `${window.location.origin}/send?to=${encodeURIComponent(payTarget)}`;
  }, [mounted, payTarget]);

  const normalizedHandle = handle.trim().replace(/^@+/, "").toLowerCase();
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
      <div className="profile-reference-screen">
        <section className="profile-hero-card">
          <div className="profile-stars" aria-hidden="true" />
          <div className="profile-orbit-line" aria-hidden="true" />
          <div className="profile-hero-avatar">
            <AvatarImage src={profile.avatar} fallback={profile.handle || profile.displayName || user?.name || "R"} />
            <span className="profile-verified" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 1l2.39 4.84L20 7l-3.5 3.41.83 4.83L12 12.93 6.67 15.24 7.5 10.41 4 7l5.61-1.16L12 1z"/></svg>
            </span>
          </div>
          <h1>{profile.displayName || "Radius user"}</h1>
          <p className="profile-handle">{profile.handle ? `@${profile.handle}` : "Claim a username below"}</p>
          <p className="profile-bio">{profile.bio || "Hello World"}</p>
          <div className="profile-address-pill">{address ? formatAddress(address) : "No wallet connected"}</div>
          {address && (
            <div className="profile-hero-actions">
              <button type="button" onClick={copyAddress}>
                {copiedAddress ? (
                  <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Copied</>
                ) : (
                  <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy address</>
                )}
              </button>
              <button type="button" onClick={disconnectAll}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                Disconnect
              </button>
            </div>
          )}
        </section>


        {address && (
          <section className="profile-qr-card">
            <div className="profile-qr-header">
              <h2>My pay QR</h2>
              <span>{profile.handle ? `@${profile.handle}` : "address-based"}</span>
            </div>
            <div className="profile-qr-frame">
              {payLink ? (
                <QRCodeSVG value={payLink} size={224} level="M" bgColor="#ffffff" fgColor="#050505" includeMargin />
              ) : (
                <div className="profile-qr-placeholder" />
              )}
            </div>
          </section>
        )}

        <form onSubmit={handleSave} className="profile-form-card">
          <div>
            <p className="mb-2 text-xs font-bold text-[#8b8795]">Profile picture</p>
            <ProfilePfpUpload initialUrl={profile.avatar} onUploaded={handleAvatarUploaded} />
          </div>
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
