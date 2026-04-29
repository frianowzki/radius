import { NextResponse } from "next/server";

export const runtime = "nodejs";

interface LogPayload {
  level?: string;
  message?: string;
  stack?: string;
  url?: string;
  userAgent?: string;
  context?: Record<string, unknown>;
  timestamp?: number;
}

function clean(value: unknown, max: number) {
  return typeof value === "string" ? value.slice(0, max) : "";
}

export async function POST(req: Request) {
  let body: LogPayload;
  try { body = (await req.json()) as LogPayload; } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const entry = {
    level: clean(body.level, 16) || "error",
    message: clean(body.message, 1000),
    stack: clean(body.stack, 4000),
    url: clean(body.url, 500),
    userAgent: clean(body.userAgent, 500),
    context: typeof body.context === "object" && body.context ? body.context : undefined,
    timestamp: typeof body.timestamp === "number" ? body.timestamp : Date.now(),
  };
  // Always log to Vercel runtime stdout for grep-ability.
  console.error("[radius-client-log]", JSON.stringify(entry));

  // Optional Sentry forwarding. Set SENTRY_DSN in env to enable; no SDK dependency.
  if (process.env.SENTRY_DSN) {
    forwardToSentry(entry).catch((err) => console.warn("[radius-sentry-forward-failed]", err));
  }

  return NextResponse.json({ ok: true });
}

interface SentryEntry {
  level: string;
  message: string;
  stack: string;
  url: string;
  userAgent: string;
  context?: Record<string, unknown>;
  timestamp: number;
}

async function forwardToSentry(entry: SentryEntry) {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;
  // DSN format: https://<key>@<host>/<projectId>
  const match = dsn.match(/^https:\/\/([^@]+)@([^/]+)\/(\d+)$/);
  if (!match) return;
  const [, key, host, projectId] = match;
  const auth = [
    "Sentry sentry_version=7",
    "sentry_client=radius/1.0",
    `sentry_key=${key}`,
  ].join(", ");
  const event = {
    event_id: crypto.randomUUID().replace(/-/g, ""),
    timestamp: entry.timestamp / 1000,
    level: entry.level,
    platform: "javascript",
    logger: "radius-client",
    message: entry.message,
    exception: entry.stack
      ? { values: [{ type: "Error", value: entry.message, stacktrace: { frames: parseStackFrames(entry.stack) } }] }
      : undefined,
    request: { url: entry.url, headers: { "User-Agent": entry.userAgent } },
    extra: entry.context,
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV || "production",
    release: process.env.VERCEL_GIT_COMMIT_SHA,
  };
  await fetch(`https://${host}/api/${projectId}/store/`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-sentry-auth": auth },
    body: JSON.stringify(event),
  });
}

function parseStackFrames(stack: string) {
  // Best-effort frame parser; Sentry tolerates partial information.
  return stack
    .split("\n")
    .slice(0, 30)
    .map((raw) => {
      const line = raw.trim();
      const m = line.match(/at\s+(?:(.+?)\s+\()?(.+?):(\d+):(\d+)\)?$/);
      if (!m) return { function: line };
      return { function: m[1] || "<anonymous>", filename: m[2], lineno: Number(m[3]), colno: Number(m[4]) };
    })
    .reverse();
}
