import { get, put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { isAddress } from "viem";
import { verifyRegistryProof } from "@/lib/registry-proof-core";
import { normalizeHandle } from "@/lib/utils";

export const runtime = "nodejs";

const writeRateLimit = new Map<string, number>();
const WRITE_COOLDOWN_MS = 5_000; // 5 seconds between writes per address

function isWriteRateLimited(address: string): boolean {
  const now = Date.now();
  const key = address.toLowerCase();
  const last = writeRateLimit.get(key) ?? 0;
  if (now - last < WRITE_COOLDOWN_MS) return true;
  // Prune if too large
  if (writeRateLimit.size > 5000) {
    writeRateLimit.forEach((ts, k) => { if (now - ts > 60_000) writeRateLimit.delete(k); });
  }
  writeRateLimit.set(key, now);
  return false;
}

function jsonNoStore(body: unknown, init?: ResponseInit) {
  const res = NextResponse.json(body, init);
  res.headers.set("Cache-Control", "no-store");
  return res;
}

const REGISTRY_PATH = "registry/profiles.json";
const HANDLE_RE = /^[a-z0-9_][a-z0-9_.-]{1,29}$/;

interface RegistryProfile {
  address: string;
  displayName: string;
  handle?: string;
  avatar?: string;
  bio?: string;
  updatedAt: number;
}

interface RegistryTable {
  version: 1;
  profiles: RegistryProfile[];
  updatedAt: number;
}

function emptyTable(): RegistryTable {
  return { version: 1, profiles: [], updatedAt: Date.now() };
}

function cleanText(value: unknown, max = 120) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

async function readTable(): Promise<RegistryTable> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return emptyTable();

  const blob = await get(REGISTRY_PATH, { access: "private", useCache: false }).catch(() => null);
  if (!blob || blob.statusCode !== 200) return emptyTable();

  const parsed = await new Response(blob.stream).json().catch(() => emptyTable());
  if (!parsed || !Array.isArray(parsed.profiles)) return emptyTable();
  return {
    version: 1,
    profiles: parsed.profiles.filter((profile: RegistryProfile) => profile?.address && isAddress(profile.address)),
    updatedAt: Number(parsed.updatedAt) || Date.now(),
  };
}

async function writeTable(table: RegistryTable) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error("BLOB_READ_WRITE_TOKEN is not configured");
  }

  await put(REGISTRY_PATH, JSON.stringify(table, null, 2), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
    cacheControlMaxAge: 60,
  });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const address = url.searchParams.get("address");
  const handle = url.searchParams.get("handle");
  const table = await readTable();

  const profile = address && isAddress(address)
    ? table.profiles.find((item) => item.address.toLowerCase() === address.toLowerCase())
    : handle
      ? table.profiles.find((item) => item.handle === normalizeHandle(handle))
      : null;

  if (!profile) return jsonNoStore({ profile: null }, { status: 404 });
  return jsonNoStore({ profile });
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonNoStore({ error: "Invalid JSON" }, { status: 400 });
  }

  const address = cleanText(body.address, 64);
  const displayName = cleanText(body.displayName, 80);
  const handle = normalizeHandle(cleanText(body.handle, 40));
  const avatarRaw = cleanText(body.avatar, 600) || undefined;
  // Allow http(s) URLs and our own /api/profile/pfp endpoint — block javascript: and other XSS vectors.
  const avatar = avatarRaw && (/^https?:\/\//i.test(avatarRaw) || /^\/api\/profile\/pfp(\?|$)/i.test(avatarRaw)) ? avatarRaw : undefined;
  const bio = cleanText(body.bio, 180) || undefined;

  if (!isAddress(address)) return jsonNoStore({ error: "Invalid wallet address" }, { status: 400 });
  if (isWriteRateLimited(address)) return jsonNoStore({ error: "Too many requests. Please wait." }, { status: 429 });
  if (!(await verifyRegistryProof(address, "profile", body.proof))) return jsonNoStore({ error: "wallet signature required" }, { status: 401 });
  if (!displayName) return jsonNoStore({ error: "Display name is required" }, { status: 400 });
  if (handle && !HANDLE_RE.test(handle)) {
    return jsonNoStore({ error: "Username must be 2-30 chars: letters, numbers, _, ., -" }, { status: 400 });
  }

  try {
    const table = await readTable();
    const existingHandle = handle
      ? table.profiles.find((item) => item.handle === handle && item.address.toLowerCase() !== address.toLowerCase())
      : undefined;
    if (existingHandle) return jsonNoStore({ error: "Username is already taken" }, { status: 409 });

    const profile: RegistryProfile = {
      address,
      displayName,
      handle: handle || undefined,
      avatar,
      bio,
      updatedAt: Date.now(),
    };

    const index = table.profiles.findIndex((item) => item.address.toLowerCase() === address.toLowerCase());
    if (index >= 0) table.profiles[index] = profile;
    else table.profiles.push(profile);
    table.updatedAt = Date.now();

    await writeTable(table);
    return jsonNoStore({ profile });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Registry unavailable";
    return jsonNoStore({ error: message }, { status: 503 });
  }
}
