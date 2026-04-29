"use client";

interface LogInput {
  level?: "error" | "warn" | "info";
  message: string;
  stack?: string;
  context?: Record<string, unknown>;
}

const RECENT: string[] = [];
const RECENT_MAX = 12;

function isDuplicate(key: string) {
  if (RECENT.includes(key)) return true;
  RECENT.push(key);
  while (RECENT.length > RECENT_MAX) RECENT.shift();
  return false;
}

export function logToServer(input: LogInput) {
  if (typeof window === "undefined") return;
  const key = `${input.level || "error"}::${input.message}`;
  if (isDuplicate(key)) return;
  const payload = {
    level: input.level || "error",
    message: input.message,
    stack: input.stack,
    url: window.location.href,
    userAgent: navigator.userAgent,
    context: input.context,
    timestamp: Date.now(),
  };
  // Prefer keepalive POST so it survives navigations / unloads.
  try {
    fetch("/api/log", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    /* swallow — never throw from the logger */
  }
}

export function installGlobalErrorHandlers() {
  if (typeof window === "undefined") return;
  if ((window as Window & { __radiusErrorHandlersInstalled?: boolean }).__radiusErrorHandlersInstalled) return;
  (window as Window & { __radiusErrorHandlersInstalled?: boolean }).__radiusErrorHandlersInstalled = true;

  window.addEventListener("error", (event) => {
    logToServer({
      message: event.message || "window.onerror",
      stack: event.error instanceof Error ? event.error.stack : undefined,
      context: { source: event.filename, line: event.lineno, col: event.colno },
    });
  });
  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    const message = reason instanceof Error ? reason.message : typeof reason === "string" ? reason : "unhandledrejection";
    const stack = reason instanceof Error ? reason.stack : undefined;
    logToServer({ message, stack, context: { kind: "unhandledrejection" } });
  });
}
