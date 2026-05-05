"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAccount, useDisconnect } from "wagmi";
import { QRCodeSVG } from "qrcode.react";
import { AppShell } from "@/components/AppShell";
import { AvatarImage } from "@/components/AvatarImage";
import { ProfilePfpUpload } from "@/components/ProfilePfpUpload";
import { useRadiusAuth } from "@/lib/web3auth";
import { clearRadiusLocalSession, formatAddress, getIdentityProfile, saveIdentityProfile } from "@/lib/utils";
import { fetchRegistryProfile, registryProfileToIdentity, saveRegistryProfile } from "@/lib/registry-client";
import { useMounted } from "@/lib/useMounted";

function EyeIcon({ hidden }: { hidden: boolean }) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" className="h-5 w-5 fill-current">
      <path d="M24 11C12.5 11 5 24 5 24s7.5 13 19 13 19-13 19-13-7.5-13-19-13Zm0 20.5a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z" />
      <circle cx="24" cy="24" r="4.2" fill="white" opacity=".92" />
      {hidden && <path d="M8 42 42 8" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />}
    </svg>
  );
}

export default function ProfilePage() {
  const { isConnected: wagmiConnected, address: wagmiAddress } = useAccount();
  const { disconnect } = useDisconnect();
  const { authenticated, address: authAddress, provider: authProvider, signMessage, user, logout } = useRadiusAuth();
  const address = wagmiAddress ?? authAddress;
  const isConnected = wagmiConnected || authenticated;
  const [profile, setProfile] = useState<ReturnType<typeof getIdentityProfile>>({ displayName: "Arc user", authMode: "wallet" });
  const [displayName, setDisplayName] = useState("");
  const [handle, setHandle] = useState("");
  const [bio, setBio] = useState("");
  /* eslint-disable react-hooks/set-state-in-effect -- hydrate from localStorage on mount to avoid SSR mismatch */
  useEffect(() => {
    const p = getIdentityProfile();
    if (!p.avatar) {
      try {
        const cachedPfp = localStorage.getItem("pfpUrl");
        if (cachedPfp) p.avatar = cachedPfp;
      } catch { /* ignore */ }
    }
    setProfile(p);
    setDisplayName(p.displayName);
    setHandle(p.handle || "");
    setBio(p.bio || "");
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */
  const [saved, setSaved] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [registryStatus, setRegistryStatus] = useState("");
  const [hidePayQr, setHidePayQr] = useState(true);

  const mounted = useMounted();
  const payTarget = (profile.handle && `@${profile.handle.replace(/^@+/, "")}`) || address || "";
  const payLink = useMemo(() => {
    if (!mounted || !payTarget) return "";
    return `${window.location.origin}/send?to=${encodeURIComponent(payTarget)}`;
  }, [mounted, payTarget]);
  const publicProfileLink = useMemo(() => {
    if (!mounted || !profile.handle) return "";
    return `${window.location.origin}/u/${encodeURIComponent(profile.handle)}`;
  }, [mounted, profile.handle]);

  const normalizedHandle = handle.trim().replace(/^@+/, "").toLowerCase();
  useEffect(() => {
    if (!address) return;
    let cancelled = false;
    fetchRegistryProfile({ address })
      .then((remote) => {
        if (!remote || cancelled) return;
        const remoteIdentity = registryProfileToIdentity(remote);
        const local = getIdentityProfile();
        const next = { ...remoteIdentity, avatar: remoteIdentity.avatar || local.avatar };
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
      const remote = await saveRegistryProfile({ address, displayName: next.displayName, handle: next.handle, avatar: next.avatar, bio: next.bio }, { provider: authProvider, signMessage, prompt: true });
      const remoteIdentity = registryProfileToIdentity(remote);
      const synced = { ...remoteIdentity, avatar: remoteIdentity.avatar || next.avatar };
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
      const remote = await saveRegistryProfile({ address, displayName: next.displayName, handle: next.handle, avatar: url, bio: next.bio }, { provider: authProvider, signMessage, prompt: true });
      const remoteIdentity = registryProfileToIdentity(remote);
      const synced = { ...remoteIdentity, avatar: remoteIdentity.avatar || url };
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
        <section className="profile-hero-card relative">
          <div className="profile-stars" aria-hidden="true" />
          <div className="profile-orbit-line" aria-hidden="true" />
          {publicProfileLink && (
            <button
              type="button"
              onClick={() => { if (navigator.share) { navigator.share({ title: `${profile.displayName ?? "Radius"} on Radius`, url: publicProfileLink }).catch(() => undefined); } else { navigator.clipboard.writeText(publicProfileLink); } }}
              aria-label="Share profile"
              className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full bg-white/20 text-white shadow-sm"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
            </button>
          )}
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


        {address && profile.handle && (
          <Link href={`/u/${profile.handle}`} className="profile-public-btn soft-card flex items-center justify-center gap-2 rounded-[20px] p-4 text-center text-sm font-bold text-[var(--brand)]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
            Show public profile
          </Link>
        )}

        {address && (
          <section className="profile-qr-card">
            <div className="profile-qr-header relative flex items-center justify-center text-center">
              <div className="flex flex-col items-center">
                <h2 className="text-center">My pay QR</h2>
                <span className="text-center">{profile.handle ? `@${profile.handle}` : "address-based"}</span>
              </div>
              <button type="button" onClick={() => setHidePayQr((v) => !v)} aria-label={hidePayQr ? "Show My Pay QR" : "Hide My Pay QR"} className="profile-qr-toggle absolute right-0 top-1/2 -translate-y-1/2 grid h-10 w-10 place-items-center rounded-full bg-[var(--brand)]/10 text-[var(--brand)]">
                <EyeIcon hidden={hidePayQr} />
              </button>
            </div>
            {!hidePayQr && (
              <div className="profile-qr-frame">
                {payLink ? (
                  <QRCodeSVG value={payLink} size={224} level="M" bgColor="#ffffff" fgColor="#050505" includeMargin />
                ) : (
                  <div className="profile-qr-placeholder" />
                )}
              </div>
            )}
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
