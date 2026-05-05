"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { AppShell } from "@/components/AppShell";
import { AvatarImage } from "@/components/AvatarImage";
import { TokenLogo } from "@/components/TokenLogo";
import { fetchRegistryProfile, type RegistryProfile } from "@/lib/registry-client";
import { formatAddress } from "@/lib/utils";

export default function PublicProfilePage({ params }: { params: Promise<{ handle: string }> }) {
  const [handle, setHandle] = useState<string>("");
  const [profile, setProfile] = useState<RegistryProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    params.then((p) => {
      const h = decodeURIComponent(p.handle).replace(/^@+/, "");
      setHandle(h);
      fetchRegistryProfile({ handle: h })
        .then((p) => {
          setProfile(p);
          if (!p) setError("Profile not found");
        })
        .catch(() => setError("Could not load profile"))
        .finally(() => setLoading(false));
    });
  }, [params]);

  const payLink = useMemo(() => {
    if (!profile) return "";
    const target = profile.handle ? `@${profile.handle}` : profile.address;
    return `${typeof window !== "undefined" ? window.location.origin : ""}/send?to=${encodeURIComponent(target)}`;
  }, [profile]);

  async function copyAddress() {
    if (!profile?.address) return;
    await navigator.clipboard.writeText(profile.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <AppShell>
      <div className="screen-pad">
        <header className="mb-7 flex items-center justify-between">
          <Link
            href="/"
            aria-label="Back"
            className="grid h-9 w-9 place-items-center rounded-full bg-white/40 text-[var(--brand)] backdrop-blur transition-colors hover:bg-white/60"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </Link>
          <h1 className="text-sm font-bold">@{handle}</h1>
          <span className="w-9" />
        </header>

        {loading ? (
          <div className="flex flex-col items-center justify-center pt-20">
            <div className="orb mb-6 h-20 w-20 rounded-full" />
            <p className="text-sm text-[#8b8795]">Loading profile…</p>
          </div>
        ) : error || !profile ? (
          <div className="flex flex-col items-center justify-center pt-20 text-center">
            <div className="mb-6 grid h-20 w-20 place-items-center rounded-full bg-red-500/10 text-red-400">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M15 9l-6 6" />
                <path d="M9 9l6 6" />
              </svg>
            </div>
            <h2 className="text-2xl font-semibold">{error || "Profile not found"}</h2>
            <p className="mt-3 text-sm text-[#8b8795]">
              The username @{handle} is not registered on Radius yet.
            </p>
            <Link href="/" className="primary-btn mt-6 inline-block rounded-2xl px-6 py-3 text-sm font-semibold text-white">
              Go home
            </Link>
          </div>
        ) : (
          <div className="mx-auto max-w-md space-y-5">
            {/* Hero card */}
            <div className="soft-card rounded-[28px] p-6 text-center">
              <div className="mx-auto mb-4 h-24 w-24 overflow-hidden rounded-full ring-4 ring-[var(--brand)]/20">
                <AvatarImage
                  src={profile.avatar}
                  fallback={profile.displayName || profile.handle || "R"}
                  className="h-full w-full object-cover"
                />
              </div>
              <h2 className="text-2xl font-bold tracking-tight">{profile.displayName}</h2>
              {profile.handle && (
                <p className="mt-1 text-sm text-[var(--brand)]">@{profile.handle}</p>
              )}
              {profile.bio && (
                <p className="mt-3 text-sm leading-relaxed text-[#8b8795]">{profile.bio}</p>
              )}
              <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/50 px-4 py-2 text-xs text-[#8b8795]">
                <span className="font-mono">{formatAddress(profile.address)}</span>
                <button
                  type="button"
                  onClick={copyAddress}
                  className="text-[var(--brand)] hover:underline"
                >
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
            </div>

            {/* Pay QR */}
            {payLink && (
              <div className="soft-card rounded-[28px] p-5 text-center">
                <div className="mb-3 flex items-center justify-center gap-2">
                  <TokenLogo symbol="USDC" size={28} />
                  <TokenLogo symbol="EURC" size={28} />
                </div>
                <h3 className="text-lg font-bold">Pay @{profile.handle}</h3>
                <p className="mt-1 text-xs text-[#8b8795]">Scan to send stablecoins on Arc Testnet</p>
                <div className="mx-auto mt-4 w-fit rounded-[24px] bg-white p-4 shadow-[0_14px_38px_rgba(143,124,255,.16)]">
                  <QRCodeSVG value={payLink} size={200} level="M" bgColor="#ffffff" fgColor="#050505" includeMargin />
                </div>
                <Link
                  href={`/send?to=${encodeURIComponent(profile.handle ? `@${profile.handle}` : profile.address)}`}
                  className="primary-btn mt-4 inline-block w-full rounded-2xl py-3 text-sm font-semibold text-white"
                >
                  Send to @{profile.handle || "user"}
                </Link>
              </div>
            )}

            {/* Share */}
            <div className="text-center">
              <p className="text-[11px] text-[#9a94a3]">
                Share this profile:{" "}
                <button
                  type="button"
                  onClick={() => {
                    const url = `${window.location.origin}/u/${profile.handle || profile.address}`;
                    navigator.clipboard.writeText(url);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  }}
                  className="text-[var(--brand)] hover:underline"
                >
                  radius-gules.vercel.app/u/{profile.handle || formatAddress(profile.address)}
                </button>
              </p>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
