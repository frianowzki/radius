import { NextRequest, NextResponse } from "next/server";
import { RPC_ENDPOINTS_BY_SLUG, type RpcSlug } from "@/config/rpc";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
        headers: { "content-type": "application/json" },
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
