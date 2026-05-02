"use client";

import type { EIP1193Provider } from "viem";
import { getRegistryProof } from "@/lib/registry-proof";
import type { Contact } from "@/lib/utils";

export interface RemoteContactsResponse {
  owner: string;
  contacts: Contact[];
  updatedAt: number;
}

export async function fetchRemoteContacts(owner: string): Promise<RemoteContactsResponse | null> {
  try {
    const res = await fetch(`/api/registry/contacts?owner=${encodeURIComponent(owner)}`, { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as RemoteContactsResponse;
    return data;
  } catch {
    return null;
  }
}

export async function pushRemoteContacts(owner: string, contacts: Contact[], options?: { provider?: EIP1193Provider | null; prompt?: boolean; signMessage?: (message: string) => Promise<string> }): Promise<RemoteContactsResponse | null> {
  try {
    const proof = await getRegistryProof(owner, "contacts", options);
    if (!proof) return null;
    const res = await fetch(`/api/registry/contacts`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ owner, contacts, proof }),
    });
    if (!res.ok) return null;
    return (await res.json()) as RemoteContactsResponse;
  } catch {
    return null;
  }
}

/** Merge local + remote, preferring the most-recently edited copy per address. */
export function mergeContacts(local: Contact[], remote: Contact[]): Contact[] {
  const byAddress = new Map<string, Contact>();
  for (const c of [...remote, ...local]) {
    if (!c?.address) continue;
    byAddress.set(c.address.toLowerCase(), c);
  }
  return Array.from(byAddress.values());
}
