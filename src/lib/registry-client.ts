import { isAddress } from "viem";
import { normalizeHandle, type UserIdentityProfile } from "@/lib/utils";

export interface RegistryProfile {
  address: string;
  displayName: string;
  handle?: string;
  avatar?: string;
  bio?: string;
  updatedAt: number;
}

export function registryProfileToIdentity(profile: RegistryProfile): UserIdentityProfile {
  return {
    displayName: profile.displayName || "Arc user",
    handle: profile.handle,
    avatar: profile.avatar && (!profile.avatar.startsWith("data:") || profile.avatar.length > 1000) ? profile.avatar : undefined,
    bio: profile.bio,
    authMode: "wallet",
  };
}

export async function fetchRegistryProfile(params: { address?: string; handle?: string }): Promise<RegistryProfile | null> {
  const search = new URLSearchParams();
  if (params.address && isAddress(params.address)) search.set("address", params.address);
  if (params.handle) search.set("handle", normalizeHandle(params.handle));
  if (!search.toString()) return null;

  const res = await fetch(`/api/registry/profile?${search.toString()}`, { cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("Registry lookup failed");
  const data = await res.json();
  return data.profile ?? null;
}

export async function saveRegistryProfile(input: {
  address: string;
  displayName: string;
  handle?: string;
  avatar?: string;
  bio?: string;
}): Promise<RegistryProfile> {
  const res = await fetch("/api/registry/profile", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...input, avatar: input.avatar?.startsWith("data:") ? undefined : input.avatar }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Could not save registry profile");
  return data.profile;
}
