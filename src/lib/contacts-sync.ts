"use client";

import type { EIP1193Provider } from "viem";
import { getRegistryProof } from "@/lib/registry-proof";
import type { Contact } from "@/lib/utils";
import { dispatchSyncResult } from "@/lib/sync-status";

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
  } catch (err) {
    console.warn("[contacts-sync] fetchRemoteContacts failed:", err);
    return null;
  }
}

export async function pushRemoteContacts(owner: string, contacts: Contact[], options?: { provider?: EIP1193Provider | null; prompt?: boolean; signMessage?: (message: string) => Promise<string> }): Promise<RemoteContactsResponse | null> {
  try {
    const proof = await getRegistryProof(owner, "contacts", options);
    if (!proof) {
      dispatchSyncResult("contacts", "skipped");
      return null;
    }
    const res = await fetch(`/api/registry/contacts`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ owner, contacts, proof }),
    });
    if (!res.ok) {
      const msg = `Contacts sync failed (${res.status})`;
      dispatchSyncResult("contacts", "error", msg);
      return null;
    }
    const result = (await res.json()) as RemoteContactsResponse;
    dispatchSyncResult("contacts", "ok");
    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Contacts sync failed";
    console.warn("[contacts-sync] pushRemoteContacts failed:", err);
    dispatchSyncResult("contacts", "error", msg);
    return null;
  }
}

/** Merge local + remote, preferring local. Remote-only contacts (deleted locally) are excluded. */
export function mergeContacts(local: Contact[], remote: Contact[]): Contact[] {
  const byAddress = new Map<string, Contact>();
  const localAddresses = new Set<string>();
  for (const c of local) {
    if (!c?.address) continue;
    byAddress.set(c.address.toLowerCase(), c);
    localAddresses.add(c.address.toLowerCase());
  }
  // Only add remote contacts that also exist in local (were not deleted)
  for (const c of remote) {
    if (!c?.address) continue;
    const key = c.address.toLowerCase();
    if (!byAddress.has(key) && localAddresses.has(key)) {
      byAddress.set(key, c);
    }
  }
  return Array.from(byAddress.values());
}
