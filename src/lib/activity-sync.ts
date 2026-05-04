"use client";

import type { EIP1193Provider } from "viem";
import { getRegistryProof } from "@/lib/registry-proof";
import type { LocalTransferRecord, PaymentRequestRecord } from "@/lib/utils";
import { dispatchSyncResult } from "@/lib/sync-status";

export interface RemoteActivityResponse {
  owner: string;
  requests: PaymentRequestRecord[];
  transfers: LocalTransferRecord[];
  updatedAt: number;
}

export async function fetchRemoteActivity(owner: string): Promise<RemoteActivityResponse | null> {
  try {
    const res = await fetch(`/api/registry/activity?owner=${encodeURIComponent(owner)}`, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as RemoteActivityResponse;
  } catch (err) {
    console.warn("[activity-sync] fetchRemoteActivity failed:", err);
    return null;
  }
}

export async function pushRemoteActivity(owner: string, data: { requests: PaymentRequestRecord[]; transfers: LocalTransferRecord[] }, options?: { provider?: EIP1193Provider | null; prompt?: boolean; signMessage?: (message: string) => Promise<string> }): Promise<RemoteActivityResponse | null> {
  try {
    const proof = await getRegistryProof(owner, "activity", options);
    if (!proof) {
      dispatchSyncResult("activity", "skipped");
      return null;
    }
    const res = await fetch(`/api/registry/activity`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ owner, ...data, proof }),
    });
    if (!res.ok) {
      const msg = `Sync failed (${res.status})`;
      dispatchSyncResult("activity", "error", msg);
      return null;
    }
    const result = (await res.json()) as RemoteActivityResponse;
    dispatchSyncResult("activity", "ok");
    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Sync failed";
    console.warn("[activity-sync] pushRemoteActivity failed:", err);
    dispatchSyncResult("activity", "error", msg);
    return null;
  }
}

export function getDeletedRequestIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem("radius-deleted-request-ids");
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

export function addDeletedRequestId(id: string) {
  const set = getDeletedRequestIds();
  set.add(id);
  localStorage.setItem("radius-deleted-request-ids", JSON.stringify([...set]));
}

export function mergePaymentRequests(local: PaymentRequestRecord[], remote: PaymentRequestRecord[]): PaymentRequestRecord[] {
  const deleted = getDeletedRequestIds();
  const byId = new Map<string, PaymentRequestRecord>();
  for (const request of [...remote, ...local]) {
    if (!request?.id) continue;
    if (deleted.has(request.id)) continue;
    const existing = byId.get(request.id);
    if (!existing || (request.paidAt || request.createdAt || 0) >= (existing.paidAt || existing.createdAt || 0)) {
      byId.set(request.id, request);
    }
  }
  return Array.from(byId.values()).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

export function mergeTransfers(local: LocalTransferRecord[], remote: LocalTransferRecord[]): LocalTransferRecord[] {
  const byKey = new Map<string, LocalTransferRecord>();
  for (const transfer of [...remote, ...local]) {
    if (!transfer?.txHash) continue;
    const key = `${transfer.txHash.toLowerCase()}-${transfer.direction}`;
    const existing = byKey.get(key);
    if (!existing || (transfer.createdAt || 0) >= (existing.createdAt || 0)) byKey.set(key, transfer);
  }
  return Array.from(byKey.values()).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}
