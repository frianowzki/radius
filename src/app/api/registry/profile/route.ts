import { get, list, put } from "@vercel/blob";
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

async function latestAvatarForAddress(address: string) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return undefined;
  const prefix = `pfp/${address.toLowerCase()}-`;
  const result = await list({ prefix, limit: 100 }).catch(() => null);
  const latest = result?.blobs
    ?.filter((blob) => blob.pathname.startsWith(prefix))
    .sort((a, b) => (b.uploadedAt?.getTime?.() ?? 0) - (a.uploadedAt?.getTime?.() ?? 0))[0];
  return latest ? `/api/profile/pfp?path=${encodeURIComponent(latest.pathname)}` : undefined;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const address = url.searchParams.get("address");
  const handle = url.searchParams.get("handle");
  const q = normalizeHandle(url.searchParams.get("q") || "");
  const table = await readTable();

  if (q) {
    const profiles = table.profiles
      .filter((item) => {
        const handleValue = item.handle || "";
        return handleValue.includes(q) || item.displayName.toLowerCase().includes(q) || item.address.toLowerCase().includes(q.toLowerCase());
      })
      .sort((a, b) => {
        const ah = a.handle || "";
        const bh = b.handle || "";
        const aExact = ah === q ? 0 : ah.startsWith(q) ? 1 : 2;
        const bExact = bh === q ? 0 : bh.startsWith(q) ? 1 : 2;
        return aExact - bExact || b.updatedAt - a.updatedAt;
      })
      .slice(0, 8);
    return jsonNoStore({ profiles });
  }

  const profile = address && isAddress(address)
    ? table.profiles.find((item) => item.address.toLowerCase() === address.toLowerCase())
    : handle
      ? table.profiles.find((item) => item.handle === normalizeHandle(handle))
      : null;

  if (!profile) return jsonNoStore({ profile: null }, { status: 404 });
  if (!profile.avatar) {
    const avatar = await latestAvatarForAddress(profile.address);
    if (avatar) return jsonNoStore({ profile: { ...profile, avatar } });
  }
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
  // Allow http(s) URLs and our own pfp endpoint — block javascript: and other XSS vectors.
  const avatar = avatarRaw && (/^https?:\/\//i.test(avatarRaw) || /^\/api\/profile\/pfp\?path=/i.test(avatarRaw)) ? avatarRaw : undefined;
  const bio = cleanText(body.bio, 180) || undefined;

  if (!isAddress(address)) return jsonNoStore({ error: "Invalid wallet address" }, { status: 400 });
  if (!(await verifyRegistryProof(address, "profile", body.proof))) return jsonNoStore({ error: "wallet signature required" }, { status: 401 });
  if (isWriteRateLimited(address)) return jsonNoStore({ error: "Too many requests. Please wait." }, { status: 429 });
  if (!displayName) return jsonNoStore({ error: "Display name is required" }, { status: 400 });
  if (handle && !HANDLE_RE.test(handle)) {
    return jsonNoStore({ error: "Username must be 2-30 chars: letters, numbers, _, ., -" }, { status: 400 });
  }

  try {
    const table = await readTable();
    const index = table.profiles.findIndex((item) => item.address.toLowerCase() === address.toLowerCase());
    const existingProfile = index >= 0 ? table.profiles[index] : undefined;
    const existingHandle = handle
      ? table.profiles.find((item) => item.handle === handle && item.address.toLowerCase() !== address.toLowerCase())
      : undefined;
    if (existingHandle) return jsonNoStore({ error: "Username is already taken" }, { status: 409 });
    if (existingProfile?.handle && handle && handle !== existingProfile.handle) {
      return jsonNoStore({ error: `@${existingProfile.handle} is permanent and cannot be changed` }, { status: 409 });
    }
    if (existingProfile?.handle && !handle) {
      return jsonNoStore({ error: `@${existingProfile.handle} is permanent and cannot be removed` }, { status: 409 });
    }

    const profile: RegistryProfile = {
      address,
      displayName,
      handle: handle || existingProfile?.handle || undefined,
      avatar,
      bio,
      updatedAt: Date.now(),
    };

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
