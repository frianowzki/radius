# Sentry integration

Radius forwards all client-side errors to Sentry **without** the official SDK — the `/api/log` route in `src/app/api/log/route.ts` POSTs directly to Sentry's HTTP store endpoint. Zero extra dependencies, zero client bundle bloat.

## Enable forwarding

Set `SENTRY_DSN` in your Vercel project (or `.env.local`) to the form:

```
SENTRY_DSN=https://<key>@<host>/<projectId>
```

Once set:

- Every entry POSTed to `/api/log` is mirrored to Sentry.
- Each event is tagged with `release = $VERCEL_GIT_COMMIT_SHA` and `environment = $VERCEL_ENV`.
- The Next build switches on `productionBrowserSourceMaps` so `.map` files end up in `.next/static`.

## Symbolicate stack traces

Stack frames forwarded by the client are minified by default. To get readable frames in Sentry, upload source maps for each release.

### GitHub Actions — recommended

```yaml
name: deploy
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    env:
      SENTRY_DSN: ${{ secrets.SENTRY_DSN }}
      SENTRY_AUTH_TOKEN: ${{ secrets.SENTRY_AUTH_TOKEN }}
      SENTRY_ORG: ${{ secrets.SENTRY_ORG }}
      SENTRY_PROJECT: ${{ secrets.SENTRY_PROJECT }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npm run build

      # Upload .next/static to the matching Sentry release.
      - name: Upload source maps to Sentry
        uses: getsentry/action-release@v1
        with:
          environment: production
          version: ${{ github.sha }}
          sourcemaps: ./.next/static
          url_prefix: "~/_next/static"
          ignore_missing: true

      # Then deploy with your provider of choice (Vercel, Netlify, etc.).
```

### Manual upload

```bash
SENTRY_AUTH_TOKEN=... SENTRY_ORG=... SENTRY_PROJECT=... \
  npx @sentry/cli releases new "$VERCEL_GIT_COMMIT_SHA"
npx @sentry/cli releases files "$VERCEL_GIT_COMMIT_SHA" upload-sourcemaps \
  ./.next/static --url-prefix '~/_next/static'
npx @sentry/cli releases finalize "$VERCEL_GIT_COMMIT_SHA"
```

## Disable Sentry

Unset `SENTRY_DSN`. The route falls back to writing to Vercel runtime stdout only.
