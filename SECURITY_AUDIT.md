# Radius DeFi App — Security Audit Report

**Date:** 2026-05-06
**Scope:** `/home/frio/arc` — all source, config, API, and dependency files
**App:** Next.js 16 DeFi app (swap/bridge/send) on Vercel

---

## Summary

| Severity | Count |
|----------|-------|
| Critical | 2     |
| High     | 3     |
| Medium   | 5     |
| Low      | 4     |

---

## CRITICAL

### C1 — Sensitive API Keys Present in `.env.local`

- **File:** `/home/frio/arc/.env.local` (lines 1–7)
- **Description:** The file contains **real, live API keys and tokens** including `BLOB_READ_WRITE_TOKEN` (Vercel Blob storage read/write), `CIRCLE_API_KEY`, `NEXT_PUBLIC_CIRCLE_KIT_KEY`, `NEXT_PUBLIC_PRIVY_APP_ID`, `NEXT_PUBLIC_PRIVY_CLIENT_ID`, and `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`. While `.gitignore` correctly excludes `.env.local`, the file exists on disk and could be leaked via backup, disk image, or developer error.
- **Risk:** An attacker with `BLOB_READ_WRITE_TOKEN` can read/overwrite all user profiles, contacts, activity logs, and profile photos. `CIRCLE_API_KEY` enables abuse of Circle's faucet API. `NEXT_PUBLIC_*` keys are already in the client bundle.
- **Fix:** Rotate all exposed keys immediately. Use Vercel's encrypted environment variables (Settings → Environment Variables) rather than local `.env` files. Add pre-commit hooks (e.g., `gitleaks` or `detect-secrets`) to prevent accidental commits of secrets.

### C2 — `NEXT_PUBLIC_CIRCLE_KIT_KEY` Exposed in Client Bundle

- **File:** `/home/frio/arc/src/lib/appkit.ts` (line 25)
- **Description:** `NEXT_PUBLIC_CIRCLE_KIT_KEY` is a `NEXT_PUBLIC_` env var, meaning it is embedded verbatim into the browser JavaScript bundle. Any user can extract it via DevTools or by inspecting the bundled JS. The key is also logged to `console.info` (line 38).
- **Risk:** The key can be extracted and used to impersonate the app with Circle's SDK, potentially abusing swap/bridge quotas or analytics.
- **Fix:** If Circle supports server-side key usage, move the kit key to a server-only env var and proxy SDK calls through a server route. At minimum, remove the `console.info` logging of the key and consider whether this key truly needs to be public.

---

## HIGH

### H1 — CSP Allows `'unsafe-inline'` and `'unsafe-eval'`

- **File:** `/home/frio/arc/next.config.ts` (lines 14–26)
- **Description:** The `Content-Security-Policy` header includes `script-src 'unsafe-inline' 'unsafe-eval'`. Both directives significantly weaken CSP's XSS protection — `'unsafe-eval'` allows `eval()`, `new Function()`, etc., and `'unsafe-inline'` allows inline `<script>` tags and event handlers.
- **Risk:** A successful XSS payload (e.g., via an unescaped user input or a compromised third-party script) would execute without CSP blocking.
- **Fix:** Replace `'unsafe-inline'` with nonce-based or hash-based script allowlisting. Remove `'unsafe-eval'` — check if any dependency actually requires it (Circle SDK, RainbowKit, or WalletConnect). For the theme-detection inline script in `layout.tsx` (line 74), use a nonce or move it to an external file.

### H2 — No CORS Policy on API Routes

- **Files:** All `/src/app/api/*/route.ts` files
- **Description:** None of the API routes (`/api/faucet`, `/api/log`, `/api/circle-proxy`, `/api/profile/pfp`, `/api/registry/*`) set `Access-Control-Allow-Origin` headers or check the `Origin` header. Next.js defaults to no CORS headers, which means same-origin only, but there is no explicit validation or restriction.
- **Risk:** While same-origin policy provides baseline protection, any XSS vulnerability would allow full API access. For a DeFi app, explicit CORS restrictions add defense-in-depth. The proxy endpoint (`/api/circle-proxy`) is particularly sensitive — it forwards requests to Circle's API with the server's API key.
- **Fix:** Add explicit CORS headers or middleware that restricts `Access-Control-Allow-Origin` to the production domain(s). For the circle-proxy, ensure `Origin` is validated against an allowlist.

### H3 — In-Memory Rate Limiting Resets on Cold Deploy

- **Files:** `/src/app/api/faucet/route.ts` (line 13), `/src/app/api/log/route.ts` (line 6), `/src/app/api/registry/profile/route.ts` (line 9), `/src/app/api/registry/contacts/route.ts` (line 8), `/src/app/api/registry/activity/route.ts` (line 8)
- **Description:** All rate limiting is implemented via in-memory `Map` objects. On Vercel, serverless functions are ephemeral — each cold start creates a fresh map. Rate limits also don't share state across concurrent instances.
- **Risk:** An attacker can bypass rate limits by triggering function cold starts or by distributing requests across Vercel's edge. The faucet endpoint is particularly vulnerable to abuse.
- **Fix:** Use a shared rate-limiting store (Redis/Upstash, Vercel KV, or a rate-limiting service like `@upstash/ratelimit`). For the faucet, add server-side IP reputation checks.

---

## MEDIUM

### M1 — Missing `rel="noopener noreferrer"` on `target="_blank"` Link

- **File:** `/home/frio/arc/src/app/send/page.tsx` (line 238)
- **Description:** The "View tx" link uses `target="_blank"` without `rel="noopener noreferrer"`:
  ```html
  <a href=".../tx/${txHash}" target="_blank" className="...">View tx</a>
  ```
- **Risk:** The opened page gains access to `window.opener`, enabling reverse tabnapping or redirect attacks.
- **Fix:** Add `rel="noopener noreferrer"` to the anchor tag. Note: all other `target="_blank"` links in the codebase correctly include this attribute.

### M2 — SVG Injection Potential in ReceiptCard

- **File:** `/home/frio/arc/src/components/ReceiptCard.tsx` (line 30)
- **Description:** The `escapeSvg()` function escapes `&`, `<`, `>`, `"` but does NOT escape `'` (single quotes). While this is unlikely to be exploitable in the current SVG context (attribute values use double quotes), it's an incomplete escaping implementation.
- **Risk:** Low but present — if SVG attribute quoting conventions change, a single-quote injection could break out of an attribute.
- **Fix:** Add `'` to the escape map: `"'": "&#39;"`.

### M3 — OG Image Route Renders User-Controlled Query Params

- **File:** `/home/frio/arc/src/app/api/og/pay/route.tsx` (lines 6–11)
- **Description:** The `amount`, `token`, `to`, and `memo` query parameters are taken directly from the URL and rendered into the OG image. While `next/og`'s `ImageResponse` renders JSX (not raw HTML), the values are passed directly as children without explicit sanitization.
- **Risk:** If `ImageResponse` does not fully escape children, a crafted `memo` parameter could inject SVG/HTML into the rendered image.
- **Fix:** Validate/sanitize inputs — e.g., `amount` should match `/^[\d.,]+$/`, `token` should be from a known set, `to` should be an address or short string, `memo` should be length-limited and stripped of control characters.

### M4 — Proxy Endpoint Can Be Used as an Open Relay to Circle API

- **File:** `/home/frio/arc/src/app/api/circle-proxy/route.ts` (lines 42–97)
- **Description:** The proxy forwards ANY HTTP method (GET, POST, PUT, PATCH, DELETE, OPTIONS) to whitelisted Circle API hosts using the server's `CIRCLE_API_KEY`. While the host allowlist is good, the proxy doesn't check the `Origin`/`Referer` headers and has no rate limiting.
- **Risk:** An attacker could use the proxy to make arbitrary requests to Circle's API through the server's API key, potentially exhausting quotas or discovering API behavior.
- **Fix:** Add origin validation, rate limiting (per IP or per session), and restrict HTTP methods to only those needed (likely GET and POST). Consider adding request path restrictions.

### M5 — Registry Profile `avatar` Field Allows `/api/profile/pfp` Paths

- **File:** `/home/frio/arc/src/app/api/registry/profile/route.ts` (line 115)
- **Description:** The avatar URL validation allows both `https?://` URLs AND `/api/profile/pfp?...` paths. While the `/api/profile/pfp` endpoint validates path traversal, allowing relative paths creates a potential SSRF vector if any downstream consumer fetches the avatar URL server-side.
- **Risk:** A user could set their avatar to a crafted `/api/profile/pfp?path=...` URL that, when fetched server-side (e.g., for OG image generation), could access private blob storage entries.
- **Fix:** Store only the blob path in the profile, not a full URL. Resolve avatar URLs to public blob URLs at read time. Or restrict avatars to `https://` URLs only.

---

## LOW

### L1 — Client-Side `localStorage` Stores Sensitive Data in Plaintext

- **File:** `/home/frio/arc/src/lib/utils.ts` (lines 20–24, 62–75, 447–492)
- **Description:** Contacts (with wallet addresses), payment request records, local transfer history, and identity profiles are stored in `localStorage` as plaintext JSON.
- **Risk:** Any XSS vulnerability exposes all locally-stored user data. Malicious browser extensions can read `localStorage` freely.
- **Fix:** For sensitive data, consider encrypting values before storage. At minimum, sanitize all data read from `localStorage` before rendering to prevent stored XSS.

### L2 — `console.info` Logs Key Prefix in Production

- **File:** `/home/frio/arc/src/lib/appkit.ts` (lines 34–41)
- **Description:** The Circle Kit key is logged (masked) to `console.info` in the browser. While `keyLogged` prevents repeated logging, the masked prefix and length are still exposed.
- **Risk:** Information disclosure — an attacker with browser access can narrow down which key is in use.
- **Fix:** Remove or conditionally disable console logging in production builds.

### L3 — No `Content-Type` Validation on Circle Proxy Responses

- **File:** `/home/frio/arc/src/app/api/circle-proxy/route.ts` (lines 79–89)
- **Description:** The proxy forwards all response headers (except hop-by-hop) from the upstream, including `Content-Type`. If the upstream returns unexpected content types (e.g., `text/html`), they are passed through to the client.
- **Risk:** If Circle's API ever returns HTML or script content, it could be rendered as-is in the browser context.
- **Fix:** Add a `Content-Type` allowlist for proxied responses (e.g., `application/json`, `text/plain`).

### L4 — `AvatarImage` Component Uses `<img>` Instead of Next.js `<Image>`

- **File:** `/home/frio/arc/src/components/AvatarImage.tsx` (line 26)
- **Description:** The component uses a raw `<img>` tag (with an eslint-disable comment) instead of Next.js's optimized `<Image>` component. This bypasses Next.js image optimization and domain validation.
- **Risk:** External avatar URLs are loaded without domain restrictions, which could be used for tracking or loading malicious content.
- **Fix:** Use Next.js `<Image>` with configured `remotePatterns` for avatar sources, or validate avatar URLs against an allowlist before rendering.

---

## Positive Findings (Well-Done)

- ✅ **Wallet signature verification** on all registry write endpoints (`verifyRegistryProof`)
- ✅ **Input validation** on faucet endpoint (address validation via `viem.isAddress()`, blockchain allowlist)
- ✅ **Path traversal protection** on profile photo upload (`safePathPart`, `..` and `\0` checks)
- ✅ **File type and size validation** on uploads (4MB max, JPEG/PNG/WebP/GIF only)
- ✅ **SVG escaping** in receipt generation (though incomplete, see M2)
- ✅ **Circle proxy host allowlist** prevents arbitrary SSRF
- ✅ **Hop-by-hop header stripping** in proxy (including `Authorization` and `Cookie`)
- ✅ **No `eval()` or `new Function()`** usage in source code
- ✅ **No `dangerouslySetInnerHTML` with user data** (only hardcoded theme script)
- ✅ **X-Frame-Options: DENY** prevents clickjacking
- ✅ **X-Content-Type-Options: nosniff** prevents MIME sniffing
- ✅ **Referrer-Policy: strict-origin-when-cross-origin**
- ✅ **`.env.local` properly gitignored** and not tracked in git
- ✅ **Server-only secrets** (`CIRCLE_API_KEY`, `BLOB_READ_WRITE_TOKEN`) correctly use non-NEXT_PUBLIC env vars
- ✅ **All `target="_blank"` links** (except one) include `rel="noopener noreferrer"`
- ✅ **Rate limiting** on faucet and log endpoints (though ephemeral)
- ✅ **Payment request expiry and confirmation** flow requires user wallet signature

---

## Recommendations Summary

1. **Immediately rotate** all API keys/tokens in `.env.local`
2. **Remove `'unsafe-eval'` and `'unsafe-inline'`** from CSP; use nonces/hashes
3. **Add CORS policy** to all API routes, especially the circle-proxy
4. **Upgrade rate limiting** to a shared store (Redis/Upstash)
5. **Add origin validation** to the circle-proxy endpoint
6. **Fix the missing `rel="noopener noreferrer"`** on send page tx link
7. **Sanitize OG image query parameters** strictly
8. **Remove console logging** of API keys in production
9. **Run `npm audit`** regularly and keep dependencies updated
10. **Add a WAF/rate-limit middleware** (`middleware.ts`) for all `/api/*` routes
