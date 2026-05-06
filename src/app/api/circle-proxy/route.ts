import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_HOSTS = new Set([
  "iris-api.circle.com",
  "iris-api-sandbox.circle.com",
  "api.circle.com",
  "gateway-api.circle.com",
  "gateway-api-testnet.circle.com",
]);

const ALLOWED_ORIGINS = new Set([
  "https://radius-gules.vercel.app",
  "https://radiusdex.vercel.app",
  "http://localhost:3000",
]);

const ALLOWED_METHODS = new Set(["GET", "POST", "OPTIONS"]);

const ALLOWED_RESPONSE_CT = new Set([
  "application/json",
  "text/plain",
  "application/problem+json",
]);

const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
  "host",
  "content-length",
  "accept-encoding",
  "content-encoding",
  "authorization",
  "cookie",
]);

const MAX_BODY_SIZE = 256 * 1024; // 256 KB

function buildHeaders(req: NextRequest) {
  const headers = new Headers();
  req.headers.forEach((value, key) => {
    if (HOP_BY_HOP_HEADERS.has(key.toLowerCase())) return;
    if (key.toLowerCase() === "origin" || key.toLowerCase() === "referer") return;
    headers.set(key, value);
  });
  return headers;
}

function corsHeaders(origin: string | null) {
  const h = new Headers();
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    h.set("Access-Control-Allow-Origin", origin);
  } else {
    h.set("Access-Control-Allow-Origin", "https://radius-gules.vercel.app");
  }
  h.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  h.set("Access-Control-Allow-Headers", "Content-Type");
  h.set("Access-Control-Max-Age", "86400");
  return h;
}

async function proxy(req: NextRequest) {
  const origin = req.headers.get("origin");

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new NextResponse(null, { status: 204, headers: corsHeaders(origin) });
  }

  // Restrict HTTP methods
  if (!ALLOWED_METHODS.has(req.method)) {
    return NextResponse.json(
      { error: "Method not allowed" },
      { status: 405, headers: corsHeaders(origin) }
    );
  }

  const target = req.nextUrl.searchParams.get("url");
  if (!target) {
    return NextResponse.json({ error: "Missing url query parameter" }, { status: 400, headers: corsHeaders(origin) });
  }

  let parsed: URL;
  try {
    parsed = new URL(target);
  } catch {
    return NextResponse.json({ error: "Invalid url" }, { status: 400, headers: corsHeaders(origin) });
  }

  if (parsed.protocol !== "https:" || !ALLOWED_HOSTS.has(parsed.hostname)) {
    return NextResponse.json({ error: "Host not allowed" }, { status: 400, headers: corsHeaders(origin) });
  }

  // Validate body size for POST
  if (req.method === "POST") {
    const contentLength = req.headers.get("content-length");
    if (contentLength && parseInt(contentLength, 10) > MAX_BODY_SIZE) {
      return NextResponse.json(
        { error: "Request body too large" },
        { status: 413, headers: corsHeaders(origin) }
      );
    }
  }

  const init: RequestInit = {
    method: req.method,
    headers: buildHeaders(req),
    redirect: "manual",
  };

  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = await req.arrayBuffer();
  }

  let upstream: Response;
  try {
    upstream = await fetch(parsed.toString(), init);
  } catch (err) {
    return NextResponse.json(
      { error: "Upstream fetch failed", detail: err instanceof Error ? err.message : String(err) },
      { status: 502, headers: corsHeaders(origin) }
    );
  }

  const responseHeaders = new Headers(corsHeaders(origin));
  const upstreamCt = upstream.headers.get("content-type") || "";

  // Content-Type allowlist for proxied responses
  const ctBase = upstreamCt.split(";")[0].trim().toLowerCase();
  if (ctBase && !ALLOWED_RESPONSE_CT.has(ctBase)) {
    return NextResponse.json(
      { error: "Upstream returned unexpected content type" },
      { status: 502, headers: corsHeaders(origin) }
    );
  }

  upstream.headers.forEach((value, key) => {
    if (HOP_BY_HOP_HEADERS.has(key.toLowerCase())) return;
    if (key.toLowerCase() === "access-control-allow-origin") return; // we set our own
    responseHeaders.set(key, value);
  });

  return new NextResponse(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}

export const GET = proxy;
export const POST = proxy;
export const OPTIONS = proxy;
