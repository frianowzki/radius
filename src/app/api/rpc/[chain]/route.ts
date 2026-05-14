import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RPC_ENDPOINTS: Record<string, string[]> = {
  sepolia: [
    "https://11155111.rpc.thirdweb.com",
    "https://sepolia.drpc.org",
    "https://ethereum-sepolia.publicnode.com",
  ],
};

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
  const endpoints = RPC_ENDPOINTS[params.chain];
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
