"use client";

/**
 * Global sync status tracker.
 * Sync functions dispatch events here; the SyncToast component listens and shows toasts.
 */

export type SyncKind = "contacts" | "activity";
export type SyncResult = "ok" | "error" | "skipped";

interface SyncEventDetail {
  kind: SyncKind;
  result: SyncResult;
  error?: string;
}

const SYNC_EVENT = "radius-sync-result";

export function dispatchSyncResult(kind: SyncKind, result: SyncResult, error?: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<SyncEventDetail>(SYNC_EVENT, { detail: { kind, result, error } }));
}

export function onSyncResult(handler: (detail: SyncEventDetail) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const listener = (e: Event) => handler((e as CustomEvent<SyncEventDetail>).detail);
  window.addEventListener(SYNC_EVENT, listener);
  return () => window.removeEventListener(SYNC_EVENT, listener);
}
