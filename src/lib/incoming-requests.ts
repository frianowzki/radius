"use client";

import type { TokenKey } from "@/config/tokens";

const KEY = "radius-incoming-requests";

export type IncomingRequestStatus = "pending" | "paid" | "dismissed";

export interface IncomingRequestRecord {
  id: string;
  /** Address of the user who saw / received this request (so multi-account local doesn't bleed). */
  recipientAddress: string;
  /** The @handle or 0x of the requester (the person being paid). */
  fromRecipient: string;
  amount: string;
  token: TokenKey;
  memo?: string;
  url: string;
  status: IncomingRequestStatus;
  createdAt: number;
  paidAt?: number;
  /** External request id from the URL (?rid=) if present. Used for dedupe. */
  remoteRequestId?: string;
}

export function getIncomingRequests(viewerAddress?: string): IncomingRequestRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    const all = raw ? (JSON.parse(raw) as IncomingRequestRecord[]) : [];
    if (!viewerAddress) return all;
    const v = viewerAddress.toLowerCase();
    return all.filter((r) => r.recipientAddress.toLowerCase() === v);
  } catch {
    return [];
  }
}

function writeAll(records: IncomingRequestRecord[]) {
  try { localStorage.setItem(KEY, JSON.stringify(records)); } catch { /* ignore */ }
}

/** Persist a request the viewer just received via a /pay link. Dedupes by (viewer, rid) or (viewer, url). */
export function recordIncomingRequest(input: {
  recipientAddress: string;
  fromRecipient: string;
  amount: string;
  token: TokenKey;
  memo?: string;
  url: string;
  remoteRequestId?: string | null;
}): IncomingRequestRecord {
  const all = getIncomingRequests();
  const viewerLower = input.recipientAddress.toLowerCase();
  const existing = all.find((r) =>
    r.recipientAddress.toLowerCase() === viewerLower &&
    ((input.remoteRequestId && r.remoteRequestId === input.remoteRequestId) || (!input.remoteRequestId && r.url === input.url))
  );
  if (existing) return existing;

  const record: IncomingRequestRecord = {
    id: crypto.randomUUID(),
    recipientAddress: input.recipientAddress,
    fromRecipient: input.fromRecipient,
    amount: input.amount,
    token: input.token,
    memo: input.memo,
    url: input.url,
    status: "pending",
    createdAt: Date.now(),
    remoteRequestId: input.remoteRequestId || undefined,
  };
  writeAll([record, ...all]);
  if (typeof window !== "undefined") window.dispatchEvent(new Event("radius-notifications-updated"));
  return record;
}

export function markIncomingRequestPaid(id: string, txHash?: string): IncomingRequestRecord | undefined {
  void txHash; // currently unused but accepted for future linkage
  const all = getIncomingRequests();
  let updated: IncomingRequestRecord | undefined;
  const next = all.map((r) => {
    if (r.id !== id) return r;
    updated = { ...r, status: "paid", paidAt: Date.now() };
    return updated;
  });
  writeAll(next);
  if (typeof window !== "undefined") window.dispatchEvent(new Event("radius-notifications-updated"));
  return updated;
}

export function dismissIncomingRequest(id: string): IncomingRequestRecord | undefined {
  const all = getIncomingRequests();
  let updated: IncomingRequestRecord | undefined;
  const next = all.map((r) => {
    if (r.id !== id) return r;
    updated = { ...r, status: "dismissed" };
    return updated;
  });
  writeAll(next);
  if (typeof window !== "undefined") window.dispatchEvent(new Event("radius-notifications-updated"));
  return updated;
}

export function deleteIncomingRequest(id: string) {
  writeAll(getIncomingRequests().filter((r) => r.id !== id));
  if (typeof window !== "undefined") window.dispatchEvent(new Event("radius-notifications-updated"));
}
