"use client";

import type { TokenKey } from "@/config/tokens";

const KEY = "radius-scheduled-payments";

export type ScheduleCadence = "daily" | "weekly" | "monthly";

export interface ScheduledPaymentRecord {
  id: string;
  recipient: string; // address or @handle
  amount: string;
  token: TokenKey;
  memo?: string;
  cadence: ScheduleCadence;
  startAt: number; // epoch ms of first run
  nextRunAt: number; // epoch ms
  lastRunAt?: number;
  paused?: boolean;
  createdAt: number;
  /**
   * When true, the /send page will auto-fire the transaction on arrival
   * (still requires the user's wallet session to sign — no silent execution).
   */
  autoConfirm?: boolean;
}

export function getScheduledPayments(): ScheduledPaymentRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as ScheduledPaymentRecord[]) : [];
  } catch {
    return [];
  }
}

function writeAll(records: ScheduledPaymentRecord[]) {
  localStorage.setItem(KEY, JSON.stringify(records));
}

export function saveScheduledPayment(
  input: Omit<ScheduledPaymentRecord, "id" | "nextRunAt" | "createdAt"> & { id?: string }
): ScheduledPaymentRecord {
  const records = getScheduledPayments();
  const id = input.id || crypto.randomUUID();
  const record: ScheduledPaymentRecord = {
    ...input,
    id,
    nextRunAt: input.startAt,
    createdAt: Date.now(),
  };
  writeAll([record, ...records.filter((r) => r.id !== id)]);
  return record;
}

export function removeScheduledPayment(id: string) {
  writeAll(getScheduledPayments().filter((r) => r.id !== id));
}

export function setSchedulePaused(id: string, paused: boolean) {
  writeAll(
    getScheduledPayments().map((r) => (r.id === id ? { ...r, paused } : r))
  );
}

export function advanceSchedule(id: string, ranAt: number): ScheduledPaymentRecord | undefined {
  const records = getScheduledPayments();
  let updated: ScheduledPaymentRecord | undefined;
  const next = records.map((r) => {
    if (r.id !== id) return r;
    const advancedNextRun = computeNextRun(r.nextRunAt, r.cadence);
    updated = { ...r, lastRunAt: ranAt, nextRunAt: advancedNextRun };
    return updated;
  });
  writeAll(next);
  return updated;
}

export function computeNextRun(from: number, cadence: ScheduleCadence): number {
  const d = new Date(from);
  switch (cadence) {
    case "daily":
      d.setDate(d.getDate() + 1);
      return d.getTime();
    case "weekly":
      d.setDate(d.getDate() + 7);
      return d.getTime();
    case "monthly":
      d.setMonth(d.getMonth() + 1);
      return d.getTime();
  }
}

export function dueSchedules(now = Date.now()): ScheduledPaymentRecord[] {
  return getScheduledPayments().filter((r) => !r.paused && r.nextRunAt <= now);
}
