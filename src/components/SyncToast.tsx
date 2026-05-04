"use client";

import { useEffect, useState, useCallback } from "react";
import { onSyncResult } from "@/lib/sync-status";

interface ToastItem {
  id: number;
  message: string;
}

/**
 * Mount once in the app layout. Listens for sync failure events and shows toasts.
 * Self-contained — no external toast library needed.
 */
export function SyncToast() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  let nextId = 0;

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    let lastToastAt = 0;

    return onSyncResult(({ kind, result, error }) => {
      if (result === "ok" || result === "skipped") return;

      // Debounce: max one toast per 10s
      const now = Date.now();
      if (now - lastToastAt < 10_000) return;
      lastToastAt = now;

      const label = kind === "contacts" ? "Contacts" : "Activity";
      const msg = `${label} sync failed${error ? `: ${error}` : ""}`;
      const id = ++nextId;

      setToasts((prev) => [...prev, { id, message: msg }]);
      setTimeout(() => dismiss(id), 5000);
    });
  }, [dismiss]);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-20 left-1/2 z-50 -translate-x-1/2 space-y-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="flex items-center gap-3 rounded-2xl border border-red-500/20 bg-[#1a1a2e]/95 px-4 py-3 text-sm text-red-400 shadow-lg backdrop-blur-sm"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><path d="M12 8v4" /><path d="M12 16h.01" />
          </svg>
          <span className="max-w-64 truncate">{t.message}</span>
          <button type="button" onClick={() => dismiss(t.id)} className="ml-1 shrink-0 text-red-400/60 hover:text-red-400">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>
      ))}
    </div>
  );
}
