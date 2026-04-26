"use client";

import { useEffect, useState } from "react";
import { useAccount, useDisconnect } from "wagmi";
import Image from "next/image";
import { AppShell } from "@/components/AppShell";
import { ProfilePfpUpload } from "@/components/ProfilePfpUpload";
import { useRadiusAuth } from "@/lib/web3auth";
import { formatAddress, getIdentityProfile, saveIdentityProfile } from "@/lib/utils";
import { fetchRegistryProfile, registryProfileToIdentity, saveRegistryProfile } from "@/lib/registry-client";

export default function ProfilePage() {
  const { isConnected: wagmiConnected, address: wagmiAddress } = useAccount();
  const { disconnect } = useDisconnect();
  const { authenticated, address: authAddress, user, logout } = useRadiusAuth();
  const address = wagmiAddress ?? authAddress;
  const isConnected = wagmiConnected || authenticated;
  const [profile, setProfile] = useState(() => getIdentityProfile());
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [handle, setHandle] = useState(profile.handle || "");
  const [bio, setBio] = useState(profile.bio || "");
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

  function handleAvatarUploaded(url: string) {
    const next = { ...profile, avatar: url };
    saveIdentityProfile(next);
    setProfile(next);
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
  }



  return (
    <AppShell>
      <div className="screen-pad space-y-5">
        <section className="gradient-card rounded-[30px] p-6 text-center">
          <div className="mx-auto grid h-20 w-20 place-items-center overflow-hidden rounded-full bg-white/20 text-3xl font-black text-white shadow-lg">
            {profile.avatar ? <Image src={profile.avatar} alt="Profile" width={80} height={80} className="h-full w-full object-cover" unoptimized={profile.avatar.startsWith("data:")} /> : (profile.handle || profile.displayName || user?.name || "R").slice(0, 1).toUpperCase()}
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
