import { NextRequest, NextResponse } from "next/server";
import { RPC_ENDPOINTS_BY_SLUG, type RpcSlug } from "@/config/rpc";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// --- Rate limiting (per-IP, in-memory) ---
const ipHits = new Map<string, number[]>();
const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 120; // 120 req/min per IP (generous for wallet usage)

function getIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const hits = ipHits.get(ip);
  if (!hits) {
    ipHits.set(ip, [now]);
    return false;
  }
  // Prune old entries
  while (hits.length && now - hits[0] > WINDOW_MS) hits.shift();
  if (hits.length >= MAX_REQUESTS_PER_WINDOW) return true;
  hits.push(now);
  return false;
}

// --- Origin allowlist ---
const ALLOWED_ORIGINS = new Set([
  "https://radius-gules.vercel.app",
  "http://localhost:3000",
]);

function isAllowedOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  // Same-origin requests (no Origin header) and allowed origins pass
  if (!origin) return true;
  return ALLOWED_ORIGINS.has(origin);
}

type RpcParams = { chain: string };

type RpcBody = {
  jsonrpc?: string;
  method?: string;
  params?: unknown[];
  id?: string | number | null;
};

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function POST(request: NextRequest, context: { params: Promise<RpcParams> | RpcParams }) {
  // Rate limit
  const ip = getIp(request);
  if (isRateLimited(ip)) {
    return NextResponse.json(
      { jsonrpc: "2.0", id: null, error: { code: -32000, message: "Rate limited" } },
      { status: 429 },
    );
  }

  // Origin check
  if (!isAllowedOrigin(request)) {
    return NextResponse.json(
      { jsonrpc: "2.0", id: null, error: { code: -32000, message: "Forbidden" } },
      { status: 403 },
    );
  }

  const params = await context.params;
  const endpoints = RPC_ENDPOINTS_BY_SLUG[params.chain as RpcSlug];
  if (!endpoints) return badRequest("Unsupported RPC chain");

  let body: RpcBody | RpcBody[];
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON-RPC body");
  }

  const calls = Array.isArray(body) ? body : [body];
  if (!calls.length || calls.some((call) => call.jsonrpc !== "2.0" || typeof call.method !== "string")) {
    return badRequest("Invalid JSON-RPC request");
  }

  let lastError = "RPC upstream failed";
  for (const endpoint of endpoints) {
    try {
      const upstream = await fetch(endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "accept": "application/json",
          // Several public testnet RPCs, including Arbitrum Sepolia providers,
          // reject Node/undici's default fetch user-agent with 403. Browser
          // wallet flows hit this proxy first, so set an explicit app UA.
          "user-agent": "Radius/1.0 (+https://radius-gules.vercel.app)",
        },
        body: JSON.stringify(body),
        cache: "no-store",
      });
      const text = await upstream.text();
      if (!upstream.ok) {
        lastError = `${endpoint} returned ${upstream.status}`;
        continue;
      }
      // Some public RPCs return 200 with a JSON-RPC error body for rate limits
      // (e.g. {"error":{"code":-32005,"message":"limit exceeded"}}). Detect
      // transient errors and try the next endpoint instead of returning them.
      try {
        const parsed = JSON.parse(text);
        const checkOne = (c: { error?: { code?: number; message?: string } }) => {
          const err = c?.error;
          if (!err) return false;
          const code = typeof err.code === "number" ? err.code : 0;
          const msg = (err.message || "").toLowerCase();
          // -32005 = rate limit / limit exceeded (common across providers)
          // -32603 = internal error (often transient on public RPCs)
          if (code === -32005) return true;
          if (msg.includes("rate limit") || msg.includes("limit exceeded") || msg.includes("too many requests")) return true;
          return false;
        };
        const transient = Array.isArray(parsed) ? parsed.some(checkOne) : checkOne(parsed);
        if (transient) {
          lastError = `${endpoint} rate-limited`;
          continue;
        }
      } catch {
        // Non-JSON body — fall through and return as-is.
      }
      return new NextResponse(text, {
        status: 200,
        headers: {
          "content-type": upstream.headers.get("content-type") || "application/json",
          "cache-control": "no-store",
        },
      });
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
  }

  return NextResponse.json(
    { jsonrpc: "2.0", id: Array.isArray(body) ? null : body.id ?? null, error: { code: -32000, message: lastError } },
    { status: 502 }
  );
}
