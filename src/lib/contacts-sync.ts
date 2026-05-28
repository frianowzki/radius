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

/** Merge local + remote contacts by address, keeping remote-only contacts so username contacts survive reload/logout. Local wins on conflicts. Filters out deleted addresses. */
export function mergeContacts(local: Contact[], remote: Contact[]): Contact[] {
  // Read deleted addresses from localStorage
  let deleted = new Set<string>();
  try {
    const raw = localStorage.getItem("radius-deleted-contacts");
    if (raw) deleted = new Set(JSON.parse(raw) as string[]);
  } catch { /* empty */ }

  const byAddress = new Map<string, Contact>();
  for (const c of remote) {
    if (!c?.address) continue;
    const addr = c.address.toLowerCase();
    if (deleted.has(addr)) continue;
    byAddress.set(addr, c);
  }
  for (const c of local) {
    if (!c?.address) continue;
    const addr = c.address.toLowerCase();
    if (deleted.has(addr)) continue;
    byAddress.set(addr, c);
  }
  return Array.from(byAddress.values());
}
