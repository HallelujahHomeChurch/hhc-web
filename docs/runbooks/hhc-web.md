# hhc-web Runbook

## Service Purpose

`hhc-web` serves the public church website at `www.alive.org.tw`. It is a Next.js standalone runtime and does not own business data or backend API behavior. `admin-fe` and `account-fe` are separate deployables from the same frontend monorepo.

## Owner And Escalation

- Primary owner: frontend engineering
- Escalate to platform owner for host routing, TLS, CDN, or gateway delivery issues
- Escalate to `hhc-web-api` owner for public data/API failures
- Escalate to account owner for admin login/session issues

## Dependencies

- `api-gateway` host and path routing
- `hhc-web-api` public read APIs and admin APIs
- Asset public URLs generated through owning service and `asset-api`
- Sitemap and metadata generation path

## Health And Ready Checks

- `GET /health`: Next.js process is healthy
- `hhc-web-api` health is monitored separately; dependency failure must not make process health fail
- Public home page smoke
- Sitemap and metadata smoke for public pages

## Dashboards And Logs

- page render success/failure
- server response latency for public and admin route classes
- public API dependency latency
- asset load error rate
- sitemap/metadata generation failures
- frontend build and deployment revision

## Page-Worthy Alerts

- public home page unavailable
- sitemap or metadata route broken after CMS-backed rendering cutover
- public pages rendering private/admin content
- high rate of failed public API calls from server rendering

## Common Failure Modes

- frontend revision has broken route or build artifact
- host-aware routing sends `www` to the wrong frontend service
- runtime rendering depends on unavailable public API
- sitemap includes stale, draft, private, or deleted route
- metadata references missing public asset URL

## Quick Triage

1. Confirm whether issue is public UI, sitemap, metadata, or API data.
2. Check gateway host/path routing before frontend code rollback.
3. Check `hhc-web-api` public read health when pages render without data.
4. Check latest frontend release and config fingerprint.
5. Inspect rendered page headers for cache/noindex mistakes.

## Mitigation Actions

- Roll back frontend revision if UI build regressed.
- Disable runtime CMS-backed rendering temporarily if public API dependency is unstable and stale public projection is safe.

## Rollback Path

- Restore the previous `hhc-web` ACA revision.
- Keep backend APIs unchanged for UI-only rollback.
- Rebuild sitemap after content rollback or site settings rollback.

## Data Recovery Notes

`hhc-web` does not own durable data. Recovery focuses on frontend revision, rendering config, sitemap output, and cache state.

## Secrets And Key Rotation Notes

Frontend code must not contain service secrets, provider keys, storage keys, or private service URLs. Browser-visible config is public.

## Degraded Modes

- Public pages can show last-known public content if `hhc-web-api` allows stale public projections.
- Missing asset URLs should render unavailable state, not raw Blob paths.

## Staging Drill

Run frontend rollback drill and sitemap parity check for `zh-Hant`, `zh-Hans`, and `en`. Evidence must include previous revision, route checks, metadata checks, and admin no-store/noindex checks.

## Production Verification

- Public home page renders.
- Public news or bulletin page renders.
- Sitemap contains only public routes.
- Metadata does not expose internal URLs, admin URLs, Blob/SAS URLs, or draft content.
