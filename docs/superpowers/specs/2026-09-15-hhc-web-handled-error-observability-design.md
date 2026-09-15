# HHC Web Handled Error Observability Design

## Goal

Make every user-visible or operationally significant `hhc-web` failure diagnosable in Sentry without reporting expected control flow or exposing account data, credentials, or URL secrets.

## Confirmed Baseline

- Production already initializes `@sentry/react`, publishes release metadata, and uploads browser source maps.
- The current SDK is client-only. Server Component failures and caught client failures are not explicitly captured.
- No production source calls `captureException` or `captureMessage`.
- The browser account client caches and deduplicates access tokens for one loaded JavaScript document.
- Account API limits access-token issuance per hashed session to 10 requests per minute and 60 per hour.
- Post-fix 429 clusters coincide with many complete document loads across pages and locales. They do not show a normal in-document retry loop.

## Decisions

### Sentry runtime coverage

Use `@sentry/nextjs` at the existing `10.69.0` version for browser and Next.js server error capture. Keep the existing release/source-map pipeline instead of adding a second Sentry build plugin. Keep browser tracing at 10%, server tracing disabled, Session Replay disabled, and `sendDefaultPii: false`.

Add one shared handled-error function:

```ts
type ErrorContext = {
  operation: string;
  level?: 'warning' | 'error';
  tags?: Record<string, string | number | boolean | null | undefined>;
};

export function captureHandledError(error: unknown, context: ErrorContext): string;
```

The helper creates a local scope, sets the operation and bounded scalar tags, and calls `captureException`. Global sanitizers remain the final outbound privacy boundary.

### Reportable failures

Capture errors which lead to a user-visible error/unavailable state, a silent content fallback, incomplete authentication, or background feature degradation:

- weekly latest/archive/download;
- Account session cleanup, bulletin authorization, authorization start, and logout;
- OAuth transaction/callback failures, without state, code, verifier, or callback query values;
- Web Push setup and user-initiated subscribe/unsubscribe failures;
- active statement and newsletter network/server failures;
- home/news/history/location/site-layout/sitemap/bulletin-access server fallbacks.

### Expected control flow

Do not report aborts, deliberately unpublished 404s, expected validation failures, user-denied notification permission, passive `login_required`, user-cancelled OAuth, storage restrictions, parsing fallbacks for untrusted filenames/structured data, or CSP reports already retained in Log Analytics.

### Access-token 429

Keep the current in-memory token cache and in-flight request deduplication. Do not persist bearer tokens, broadcast them between tabs, raise backend limits, or add automatic token retries.

When the access-token endpoint returns 429, retain the server `Retry-After` deadline in document memory. Calls before that deadline fail locally with the same typed status rather than sending another mint request. Existing UI remains retryable and Sentry receives the user-facing operation and status. This protects a loaded document without pretending to solve intentionally parallel full-document automation.

## Privacy Boundary

Allowed Sentry context is limited to operation name, runtime, HTTP status, stable non-sensitive error code, locale, member/public mode, and retry attempt. Never attach user IDs, email, cookies, authorization headers, OAuth state/code/verifier, access tokens, request/response bodies, complete URLs, queries, fragments, push endpoints, or bulletin download URLs.

## Verification

- Unit-test sanitizer and handled-error context.
- Unit-test access-token cache, concurrent deduplication, and Retry-After cooldown.
- Component-test representative weekly, OAuth, Account, download, push, statement, and unsubscribe error paths.
- Run `pnpm test:run`, `pnpm lint`, and `pnpm build`.
