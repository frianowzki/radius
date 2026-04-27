"use client";

const PROXIED_HOSTS = new Set([
  "iris-api.circle.com",
  "iris-api-sandbox.circle.com",
  "api.circle.com",
  "gateway-api.circle.com",
  "gateway-api-testnet.circle.com",
]);

const PROXY_PATH = "/api/circle-proxy";
const FLAG = "__radiusCircleFetchProxyInstalled";

function shouldProxy(url: string): boolean {
  if (!url.startsWith("https://")) return false;
  try {
    const parsed = new URL(url);
    return PROXIED_HOSTS.has(parsed.hostname);
  } catch {
    return false;
  }
}

function rewriteUrl(originalUrl: string): string {
  return `${PROXY_PATH}?url=${encodeURIComponent(originalUrl)}`;
}

export function installCircleFetchProxy() {
  if (typeof window === "undefined") return;
  const w = window as Window & { [FLAG]?: boolean };
  if (w[FLAG]) return;
  w[FLAG] = true;

  const originalFetch = window.fetch.bind(window);
  window.fetch = async function patchedFetch(input: RequestInfo | URL, init?: RequestInit) {
    try {
      let urlString = "";
      if (typeof input === "string") urlString = input;
      else if (input instanceof URL) urlString = input.toString();
      else if (input instanceof Request) urlString = input.url;

      if (urlString && shouldProxy(urlString)) {
        const proxied = rewriteUrl(urlString);
        if (input instanceof Request) {
          const cloned = new Request(proxied, input);
          return originalFetch(cloned, init);
        }
        return originalFetch(proxied, init);
      }
    } catch {
      // fall through to original fetch
    }
    return originalFetch(input as RequestInfo, init);
  };
}
