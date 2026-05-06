"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useAccount } from "wagmi";
import { useRadiusAuth } from "@/lib/web3auth";
import { markNotificationsRead, useNotificationFeed, type NotificationItem } from "@/lib/notifications-feed";

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return "just now";
  const min = Math.round(diff / 60_000);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.round(hr / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString();
}

function iconForKind(kind: NotificationItem["kind"]) {
  if (kind === "received") {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="19 12 12 19 5 12"/><line x1="12" y1="5" x2="12" y2="19"/></svg>
    );
  }
  if (kind === "request_paid") {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
    );
  }
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
  );
}

export function NotificationBell() {
  const { address: wagmiAddress } = useAccount();
  const { address: authAddress } = useRadiusAuth();
  const address = wagmiAddress ?? authAddress;
  const { items, unreadCount } = useNotificationFeed(address ?? undefined);
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("mousedown", onClick);
    window.addEventListener("keydown", onEscape);
    return () => {
      window.removeEventListener("mousedown", onClick);
      window.removeEventListener("keydown", onEscape);
    };
  }, [open]);

  function handleOpen() {
    setOpen((v) => {
      const next = !v;
      if (next && unreadCount > 0) markNotificationsRead();
      return next;
    });
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={handleOpen}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
        className="relative grid h-10 w-10 place-items-center rounded-full bg-white/20 text-[var(--brand)] shadow-sm"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
        {unreadCount > 0 && (
          <span aria-hidden="true" className="absolute -right-0.5 -top-0.5 grid h-4 min-w-[16px] place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-bold leading-none text-white shadow-sm">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-50 w-[min(86vw,340px)] rounded-2xl border border-white/40 p-3 shadow-2xl" style={{ background: "rgba(255,255,255,0.72)", backdropFilter: "blur(24px) saturate(1.4)", WebkitBackdropFilter: "blur(24px) saturate(1.4)" }}>
          <div className="mb-2 flex items-center justify-between px-1">
            <h3 className="text-sm font-bold text-[#1e293b]">Notifications</h3>
            <Link href="/history" onClick={() => setOpen(false)} className="text-[11px] font-semibold text-[var(--brand)]">View history</Link>
          </div>
          {items.length === 0 ? (
            <p className="px-2 py-6 text-center text-xs text-[#8b8795]">You&apos;re all caught up.</p>
          ) : (
            <ul className="max-h-[60vh] space-y-1 overflow-y-auto pr-1">
              {items.slice(0, 25).map((item) => {
                const content = (
                  <div className="flex items-start gap-3 rounded-xl px-2 py-2 transition hover:bg-[#f3f1ff]">
                    <span className={`mt-0.5 grid h-7 w-7 flex-none place-items-center rounded-full ${item.kind === "received" ? "bg-emerald-500/15 text-emerald-600" : item.kind === "request_paid" ? "bg-sky-500/15 text-sky-600" : "bg-amber-500/15 text-amber-600"}`}>
                      {iconForKind(item.kind)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-xs font-bold text-[#1e293b]">{item.title}</p>
                        {item.unread && <span className="h-1.5 w-1.5 rounded-full bg-rose-500" aria-label="Unread" />}
                      </div>
                      <p className="truncate text-[11px] text-[#5b5666]">{item.body}</p>
                      <p className="mt-0.5 text-[10px] text-[#9a94a3]">{relativeTime(item.timestamp)}</p>
                    </div>
                  </div>
                );
                return (
                  <li key={item.id}>
                    {item.href ? (
                      <Link href={item.href} onClick={() => setOpen(false)}>{content}</Link>
                    ) : (
                      content
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
