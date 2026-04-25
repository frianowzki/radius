"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { AppShell } from "@/components/AppShell";
import { IdentityCard } from "@/components/IdentityCard";
import { ProfilePfpUpload } from "@/components/ProfilePfpUpload";
import {
  getIdentityProfile,
  saveIdentityProfile,
  isHandleAvailable,
} from "@/lib/utils";

export default function ProfilePage() {
  const { isConnected } = useAccount();
  const [profile, setProfile] = useState(() => getIdentityProfile());
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [handle, setHandle] = useState(profile.handle || "");
  const [bio, setBio] = useState(profile.bio || "");

  const normalizedHandle = handle.trim().replace(/^@+/, "").toLowerCase();
  const handleAvailable = isHandleAvailable(normalizedHandle);

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!displayName.trim()) return;
    if (normalizedHandle && !handleAvailable) return;

    const next = {
      displayName: displayName.trim(),
      handle: normalizedHandle || undefined,
      avatar: profile.avatar,
      bio: bio.trim() || undefined,
      authMode: "wallet" as const,
    };

    saveIdentityProfile(next);
    setProfile(next);
  }

  return (
    <AppShell>
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-6">
          <div className="glass-panel-strong rounded-[32px] p-8">
            <p className="mb-3 text-[11px] uppercase tracking-[0.3em] text-zinc-500">
              Profile
            </p>
            <h2 className="text-4xl font-semibold tracking-tight text-glow">
              Claim your app identity before global usernames land.
            </h2>
            <p className="mt-4 text-base leading-7 text-zinc-400">
              This is the first identity layer: display name, app username, profile picture, and bio. Local app identity now, shared registry later.
            </p>
          </div>

          <ProfilePfpUpload />

          <form onSubmit={handleSave} className="glass-panel rounded-[28px] p-6 space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-zinc-400">
                Display name
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your name"
                className="w-full rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder-zinc-500 focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-zinc-400">
                Username
              </label>
              <input
                type="text"
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                placeholder="@yourname"
                className="w-full rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder-zinc-500 focus:border-[var(--accent)] focus:outline-none"
              />
              {normalizedHandle && !handleAvailable && (
                <p className="mt-2 text-xs text-amber-400">
                  This username is already used by a local contact in this app.
                </p>
              )}
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-zinc-400">
                Bio
              </label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="How you want to show up in payment requests and receipts"
                rows={4}
                className="w-full rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder-zinc-500 focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={!displayName.trim() || (!!normalizedHandle && !handleAvailable)}
              className="w-full rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition-all hover:shadow-indigo-500/30 disabled:opacity-40"
            >
              Save identity
            </button>
          </form>
        </div>

        <div className="space-y-5">
          <IdentityCard profile={profile} />

          <div className="glass-panel rounded-[32px] p-6">
            <p className="mb-3 text-[11px] uppercase tracking-[0.3em] text-zinc-500">
              Auth direction
            </p>
            <h3 className="text-2xl font-semibold tracking-tight text-zinc-100">
              Social and wallet identity, cleaner now.
            </h3>
            <p className="mt-3 text-sm leading-7 text-zinc-500">
              The current profile is tied to this app on this device. Social login gives you a wallet address now; global username ownership can come later with a shared registry.
            </p>
            <div className="mt-4 rounded-[24px] border border-white/8 bg-white/[0.04] p-4 text-sm">
              <p className="text-zinc-400">Current auth mode</p>
              <p className="mt-1 font-medium text-zinc-100">
                {isConnected ? "Wallet connected" : "Wallet not connected"}
              </p>
              <p className="mt-2 text-xs leading-6 text-zinc-500">
                Use the profile picture uploader above and copy your address from Request when you need to receive funds.
              </p>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}