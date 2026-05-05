"use client";

import { useEffect, useState } from "react";
import { getLocalTransfers, getPaymentRequests, formatContactLabel } from "@/lib/utils";
import { dueSchedules, type ScheduledPaymentRecord } from "@/lib/scheduled-payments";
import { TOKENS } from "@/config/tokens";
import { formatAmount } from "@/lib/utils";

const LAST_SEEN_KEY = "radius-notifications-last-seen";
const RECENT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000; // last 7 days

export type NotificationKind = "received" | "request_paid" | "schedule_due";

export interface NotificationItem {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  timestamp: number;
  href?: string;
  unread: boolean;
}

function getLastSeen(): number {
  if (typeof window === "undefined") return 0;
  try { return Number(localStorage.getItem(LAST_SEEN_KEY)) || 0; } catch { return 0; }
}

export function markNotificationsRead() {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(LAST_SEEN_KEY, String(Date.now())); } catch { /* ignore */ }
  if (typeof window !== "undefined") window.dispatchEvent(new Event("radius-notifications-updated"));
}

function buildFeed(address?: string): NotificationItem[] {
  if (!address) return [];
  const items: NotificationItem[] = [];
  const lastSeen = getLastSeen();
  const since = Date.now() - RECENT_WINDOW_MS;

  // Recently received transfers
  const transfers = getLocalTransfers(address);
  for (const t of transfers) {
    if (t.direction !== "received") continue;
    if (t.createdAt < since) continue;
    const tokenInfo = TOKENS[t.token];
    if (!tokenInfo) continue;
    let amount = "0";
    try { amount = formatAmount(BigInt(t.value), tokenInfo.decimals); } catch { /* ignore */ }
    items.push({
      id: `recv-${t.id}`,
      kind: "received",
      title: "Payment received",
      body: `+${amount} ${t.token} from ${formatContactLabel(t.from)}`,
      timestamp: t.createdAt,
      href: "/history",
      unread: t.createdAt > lastSeen,
    });
  }

  // Recently paid payment requests (your asks that got paid)
  const requests = getPaymentRequests(address);
  for (const r of requests) {
    if (r.status !== "paid" || !r.paidAt) continue;
    if (r.paidAt < since) continue;
    items.push({
      id: `req-${r.id}`,
      kind: "request_paid",
      title: "Request paid",
      body: `${r.amount} ${r.token}${r.memo ? ` — ${r.memo}` : ""}`,
      timestamp: r.paidAt,
      href: "/request",
      unread: r.paidAt > lastSeen,
    });
  }

  // Due scheduled payments
  const due: ScheduledPaymentRecord[] = dueSchedules();
  for (const s of due) {
    items.push({
      id: `sched-${s.id}`,
      kind: "schedule_due",
      title: "Scheduled payment due",
      body: `${s.amount} ${s.token} → ${formatContactLabel(s.recipient)}`,
      timestamp: s.nextRunAt,
      href: "/scheduled",
      unread: s.nextRunAt > lastSeen,
    });
  }

  return items.sort((a, b) => b.timestamp - a.timestamp);
}

export function useNotificationFeed(address?: string) {
  const [items, setItems] = useState<NotificationItem[]>([]);

  /* eslint-disable react-hooks/set-state-in-effect -- aggregate localStorage-driven feed on mount and at intervals */
  useEffect(() => {
    if (!address) { setItems([]); return; }
    const refresh = () => setItems(buildFeed(address));
    refresh();
    const interval = window.setInterval(refresh, 30_000);
    const onStorage = (e: StorageEvent) => {
      if (!e.key || ["radius-p2p-local-transfers", "radius-payment-requests", "radius-scheduled-payments", LAST_SEEN_KEY].includes(e.key)) refresh();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener("radius-notifications-updated", refresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("radius-notifications-updated", refresh);
    };
  }, [address]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const unreadCount = items.filter((i) => i.unread).length;
  return { items, unreadCount };
}
