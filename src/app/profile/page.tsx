"use client";

import { useEffect, useState } from "react";
import { useAccount, useDisconnect } from "wagmi";
import { AppShell } from "@/components/AppShell";
import { AvatarImage } from "@/components/AvatarImage";
import { ProfilePfpUpload } from "@/components/ProfilePfpUpload";
import { useRadiusAuth } from "@/lib/web3auth";
import { clearRadiusLocalSession, formatAddress, getIdentityProfile, saveIdentityProfile } from "@/lib/utils";
import { fetchRegistryProfile, registryProfileToIdentity, saveRegistryProfile } from "@/lib/registry-client";

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
            <span className="profile-verified" aria-hidden="true">✦</span>
          </div>
          <h1>{profile.displayName || "Radius user"}</h1>
          <p className="profile-handle">{profile.handle ? `@${profile.handle}` : "Claim a username below"}</p>
          <p className="profile-bio">{profile.bio || "Hello World"}</p>
          <div className="profile-address-pill">{address ? formatAddress(address) : "No wallet connected"}</div>
          {address && (
            <div className="profile-hero-actions">
              <button type="button" onClick={copyAddress}>⧉ {copiedAddress ? "Copied" : "Copy address"}</button>
              <button type="button" onClick={disconnectAll}>↻ Disconnect</button>
            </div>
          )}
        </section>

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
