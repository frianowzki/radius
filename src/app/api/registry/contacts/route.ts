import { get, put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { isAddress } from "viem";

export const runtime = "nodejs";

interface ContactPayload {
  id: string;
  name: string;
  address: string;
  handle?: string;
  note?: string;
  avatar?: string;
}

interface ContactsTable {
  version: 1;
  owner: string;
  contacts: ContactPayload[];
  updatedAt: number;
}

function path(owner: string) {
  return `registry/contacts/${owner.toLowerCase()}.json`;
}

function clean(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function sanitize(raw: unknown): ContactPayload | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const address = clean(r.address, 64);
  if (!isAddress(address)) return null;
  const id = clean(r.id, 64) || address.toLowerCase();
  const name = clean(r.name, 80);
  if (!name) return null;
  const handle = clean(r.handle, 40) || undefined;
  const note = clean(r.note, 180) || undefined;
  const avatar = clean(r.avatar, 600) || undefined;
  return { id, name, address, handle, note, avatar };
}

async function readTable(owner: string): Promise<ContactsTable> {
  const empty: ContactsTable = { version: 1, owner: owner.toLowerCase(), contacts: [], updatedAt: 0 };
  if (!process.env.BLOB_READ_WRITE_TOKEN) return empty;
  const blob = await get(path(owner), { access: "private", useCache: false }).catch(() => null);
  if (!blob || blob.statusCode !== 200) return empty;
  const parsed = await new Response(blob.stream).json().catch(() => empty);
  if (!parsed || !Array.isArray(parsed.contacts)) return empty;
  return {
    version: 1,
    owner: owner.toLowerCase(),
    contacts: parsed.contacts.map(sanitize).filter((c: ContactPayload | null): c is ContactPayload => !!c),
    updatedAt: Number(parsed.updatedAt) || 0,
  };
}

async function writeTable(table: ContactsTable) {
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
  if (!owner || !isAddress(owner)) return NextResponse.json({ error: "owner address required" }, { status: 400 });
  const table = await readTable(owner);
  return NextResponse.json({ owner: table.owner, contacts: table.contacts, updatedAt: table.updatedAt });
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const owner = clean(body.owner, 64);
  if (!isAddress(owner)) return NextResponse.json({ error: "invalid owner address" }, { status: 400 });
  const incoming = Array.isArray(body.contacts) ? body.contacts : [];
  if (incoming.length > 500) return NextResponse.json({ error: "too many contacts (max 500)" }, { status: 400 });
  const contacts = incoming.map(sanitize).filter((c): c is ContactPayload => !!c);
  // Dedupe by address (lowercased) keeping last occurrence.
  const byAddress = new Map<string, ContactPayload>();
  for (const c of contacts) byAddress.set(c.address.toLowerCase(), c);
  const table: ContactsTable = {
    version: 1,
    owner: owner.toLowerCase(),
    contacts: Array.from(byAddress.values()),
    updatedAt: Date.now(),
  };
  try {
    await writeTable(table);
    return NextResponse.json({ owner: table.owner, contacts: table.contacts, updatedAt: table.updatedAt });
  } catch (err) {
    const message = err instanceof Error ? err.message : "registry unavailable";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
