import { NextResponse } from "next/server";

const ALLOWED_ORIGINS = new Set([
  "https://radius-gules.vercel.app",
  "https://radiusdex.vercel.app",
  "http://localhost:3000",
]);

export function getCorsHeaders(origin: string | null) {
  const headers: Record<string, string> = {};
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  } else {
    headers["Access-Control-Allow-Origin"] = "https://radius-gules.vercel.app";
  }
  headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS";
  headers["Access-Control-Allow-Headers"] = "Content-Type";
  return headers;
}

export function corsJson(data: unknown, init?: ResponseInit, origin?: string | null) {
  const headers = new Headers(getCorsHeaders(origin ?? null));
  headers.set("Content-Type", "application/json");
  if (init?.headers) {
    new Headers(init.headers).forEach((v, k) => headers.set(k, v));
  }
  return new NextResponse(JSON.stringify(data), { ...init, headers });
}
