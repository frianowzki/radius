import { get, put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { isAddress } from "viem";

export const runtime = "nodejs";

function jsonNoStore(body: unknown, init?: ResponseInit) {
  const res = NextResponse.json(body, init);
  res.headers.set("Cache-Control", "no-store");
  return res;
}

type TokenKey = "USDC" | "EURC";
type PaymentRequestStatus = "pending" | "paid" | "expired";

interface PaymentRequestPayload {
  id: string;
  recipient: string;
  amount: string;
  token: TokenKey;
  memo?: string;
  url: string;
  status: PaymentRequestStatus;
  createdAt: number;
  paidAt?: number;
  split?: { targetUnits: string; paidUnits: string; participants?: number };
}

interface TransferPayload {
  id: string;
  from: string;
  to: string;
  value: string;
  token: TokenKey;
  txHash: string;
  direction: "sent" | "received";
  routeLabel?: string;
  createdAt: number;
}

interface ActivityTable {
  version: 1;
  owner: string;
  requests: PaymentRequestPayload[];
  transfers: TransferPayload[];
  updatedAt: number;
}

function path(owner: string) {
  return `registry/activity/${owner.toLowerCase()}.json`;
}

function clean(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function sanitizeToken(value: unknown): TokenKey | null {
  return value === "USDC" || value === "EURC" ? value : null;
}

function sanitizeRequest(raw: unknown): PaymentRequestPayload | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = clean(r.id, 80);
  const recipient = clean(r.recipient, 80);
  const token = sanitizeToken(r.token);
  const amount = clean(r.amount, 40);
  const url = clean(r.url, 1200);
  const status = r.status === "paid" || r.status === "expired" ? r.status : "pending";
  const createdAt = Number(r.createdAt) || Date.now();
  if (!id || !recipient || !token || !amount || !url) return null;
  const splitRaw = r.split as Record<string, unknown> | undefined;
  const split = splitRaw && typeof splitRaw === "object"
    ? {
        targetUnits: clean(splitRaw.targetUnits, 80),
        paidUnits: clean(splitRaw.paidUnits, 80) || "0",
        participants: Number(splitRaw.participants) || undefined,
      }
    : undefined;
  return {
    id,
    recipient,
    amount,
    token,
    memo: clean(r.memo, 180) || undefined,
    url,
    status,
    createdAt,
    paidAt: Number(r.paidAt) || undefined,
    ...(split?.targetUnits ? { split } : {}),
  };
}

function sanitizeTransfer(raw: unknown): TransferPayload | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = clean(r.id, 80);
  const from = clean(r.from, 64);
  const to = clean(r.to, 64);
  const token = sanitizeToken(r.token);
  const value = clean(r.value, 100);
  const txHash = clean(r.txHash, 100);
  const direction = r.direction === "received" ? "received" : "sent";
  if (!id || !isAddress(from) || !isAddress(to) || !token || !value || !txHash) return null;
  return {
    id,
    from,
    to,
    value,
    token,
    txHash,
    direction,
    routeLabel: clean(r.routeLabel, 80) || undefined,
    createdAt: Number(r.createdAt) || Date.now(),
  };
}

async function readTable(owner: string): Promise<ActivityTable> {
  const empty: ActivityTable = { version: 1, owner: owner.toLowerCase(), requests: [], transfers: [], updatedAt: 0 };
  if (!process.env.BLOB_READ_WRITE_TOKEN) return empty;
  const blob = await get(path(owner), { access: "private", useCache: false }).catch(() => null);
  if (!blob || blob.statusCode !== 200) return empty;
  const parsed = await new Response(blob.stream).json().catch(() => empty);
  return {
    version: 1,
    owner: owner.toLowerCase(),
    requests: Array.isArray(parsed.requests) ? parsed.requests.map(sanitizeRequest).filter(Boolean) : [],
    transfers: Array.isArray(parsed.transfers) ? parsed.transfers.map(sanitizeTransfer).filter(Boolean) : [],
    updatedAt: Number(parsed.updatedAt) || 0,
  } as ActivityTable;
}

async function writeTable(table: ActivityTable) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) throw new Error("BLOB_READ_WRITE_TOKEN is not configured");
  await put(path(table.owner), JSON.stringify(table, null, 2), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
    cacheControlMaxAge: 30,
  });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const owner = url.searchParams.get("owner");
  if (!owner || !isAddress(owner)) return jsonNoStore({ error: "owner address required" }, { status: 400 });
  const table = await readTable(owner);
  return jsonNoStore({ owner: table.owner, requests: table.requests, transfers: table.transfers, updatedAt: table.updatedAt });
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return jsonNoStore({ error: "invalid JSON" }, { status: 400 });
  }
  const owner = clean(body.owner, 64);
  if (!isAddress(owner)) return jsonNoStore({ error: "invalid owner address" }, { status: 400 });
  const current = await readTable(owner);
  const requests = [...current.requests, ...(Array.isArray(body.requests) ? body.requests : []).map(sanitizeRequest).filter((r): r is PaymentRequestPayload => !!r)];
  const transfers = [...current.transfers, ...(Array.isArray(body.transfers) ? body.transfers : []).map(sanitizeTransfer).filter((t): t is TransferPayload => !!t)];
  const byRequest = new Map<string, PaymentRequestPayload>();
  for (const r of requests) {
    const prev = byRequest.get(r.id);
    if (!prev || (r.paidAt || r.createdAt) >= (prev.paidAt || prev.createdAt)) byRequest.set(r.id, r);
  }
  const byTransfer = new Map<string, TransferPayload>();
  for (const t of transfers) byTransfer.set(`${t.txHash.toLowerCase()}-${t.direction}`, t);
  const table: ActivityTable = {
    version: 1,
    owner: owner.toLowerCase(),
    requests: Array.from(byRequest.values()).sort((a, b) => b.createdAt - a.createdAt).slice(0, 300),
    transfers: Array.from(byTransfer.values()).sort((a, b) => b.createdAt - a.createdAt).slice(0, 500),
    updatedAt: Date.now(),
  };
  try {
    await writeTable(table);
    return jsonNoStore({ owner: table.owner, requests: table.requests, transfers: table.transfers, updatedAt: table.updatedAt });
  } catch (err) {
    const message = err instanceof Error ? err.message : "activity registry unavailable";
    return jsonNoStore({ error: message }, { status: 503 });
  }
}
