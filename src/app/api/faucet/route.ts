import { NextResponse } from "next/server";
import { isAddress } from "viem";

const SUPPORTED_BLOCKCHAINS = new Set([
  "ARC-TESTNET",
  "ETH-SEPOLIA",
  "BASE-SEPOLIA",
  "ARB-SEPOLIA",
]);

// Simple in-memory rate limiter (per-address cooldown).
// Resets on cold deploy, which is fine for a throttle — not a security boundary.
const lastDrip = new Map<string, number>();
const COOLDOWN_MS = 60_000; // 1 drip per address per minute
const MAX_DRIP_ENTRIES = 5000;

function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

export async function POST(req: Request) {
  const apiKey = process.env.CIRCLE_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(
      {
        error: "Circle API key is not configured on the server.",
        fallbackUrl: "https://faucet.circle.com/",
      },
      { status: 501 }
    );
  }

  const body = (await req.json().catch(() => null)) as {
    address?: string;
    blockchain?: string;
    token?: "usdc" | "eurc";
  } | null;

  const address = body?.address?.trim();
  const blockchain = body?.blockchain?.trim().toUpperCase();
  const token = body?.token === "eurc" ? "eurc" : "usdc";

  if (!address || !isAddress(address)) {
    return NextResponse.json({ error: "Valid EVM address required." }, { status: 400 });
  }

  if (!blockchain || !SUPPORTED_BLOCKCHAINS.has(blockchain)) {
    return NextResponse.json({ error: "Unsupported faucet chain." }, { status: 400 });
  }

  // Rate limit: per-address cooldown + per-IP throttle.
  const now = Date.now();
  // Prune stale entries to prevent unbounded memory growth.
  if (lastDrip.size > MAX_DRIP_ENTRIES) {
    const staleThreshold = now - COOLDOWN_MS;
    lastDrip.forEach((ts, key) => {
      if (ts < staleThreshold) lastDrip.delete(key);
    });
  }
  const addrKey = `${address.toLowerCase()}:${blockchain}:${token}`;
  const ipKey = `ip:${clientIp(req)}`;

  const lastAddr = lastDrip.get(addrKey) ?? 0;
  const lastIp = lastDrip.get(ipKey) ?? 0;
  if (now - lastAddr < COOLDOWN_MS) {
    return NextResponse.json({ error: "Please wait before requesting another drip for this address." }, { status: 429 });
  }
  if (now - lastIp < COOLDOWN_MS / 2) {
    return NextResponse.json({ error: "Too many requests. Try again shortly." }, { status: 429 });
  }

  const res = await fetch("https://api.circle.com/v1/faucet/drips", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      address,
      blockchain,
      usdc: token === "usdc",
      eurc: token === "eurc",
    }),
  });

  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { message: text };
  }

  if (!res.ok) {
    return NextResponse.json(
      { error: "Circle faucet request failed.", details: data },
      { status: res.status }
    );
  }

  // Only record rate limit after a successful upstream drip.
  lastDrip.set(addrKey, now);
  lastDrip.set(ipKey, now);

  return NextResponse.json({ ok: true, data });
}
