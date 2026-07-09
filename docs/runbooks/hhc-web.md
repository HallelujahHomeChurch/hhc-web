# hhc-web Runbook

## Service Purpose

`hhc-web` serves the public church website and admin UI. It is the UI layer for `www.alive.org.tw` and the admin console path/host selected by the gateway design. It should not own business data or backend API behavior.

## Owner And Escalation

- Primary owner: frontend engineering
- Escalate to platform owner for host routing, TLS, CDN, or gateway delivery issues
- Escalate to `hhc-web-api` owner for public data/API failures
- Escalate to account owner for admin login/session issues

## Dependencies

- `api-gateway` host and path routing
- `hhc-web-api` public read APIs and admin APIs
- Account login flow for admin UI
- Asset public URLs generated through owning service and `asset-api`
- Sitemap and metadata generation path

## Health And Ready Checks

- `GET /healthz`: UI server or static delivery path is healthy
- `GET /readyz`: public API dependency reachable if runtime rendering is enabled
- Public home page smoke
- Admin shell smoke with no-store/noindex headers
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
- admin UI unavailable during active admin operations
- sitemap or metadata route broken after CMS-backed rendering cutover
- public pages rendering private/admin content
- high rate of failed public API calls from server rendering

## Common Failure Modes

- frontend revision has broken route or build artifact
- host-aware routing sends admin UI to public route or public UI to admin route
- runtime rendering depends on unavailable public API
- sitemap includes stale, draft, private, or deleted route
- metadata references missing public asset URL

## Quick Triage

1. Confirm whether issue is public UI, admin UI, sitemap, metadata, or API data.
2. Check gateway host/path routing before frontend code rollback.
3. Check `hhc-web-api` public read health when pages render without data.
4. Check latest frontend release and config fingerprint.
5. Inspect rendered page headers for cache/noindex mistakes.

## Mitigation Actions

- Roll back frontend revision if UI build regressed.
- Use static-export fallback only if it serves approved public content and does not hide active safety notices.
- Disable runtime CMS-backed rendering temporarily if public API dependency is unstable and stale public projection is safe.
- Block admin UI route if admin shell exposes unsafe behavior.

## Rollback Path

- Restore previous ACA revision or static artifact set.
- Keep backend APIs unchanged for UI-only rollback.
- Rebuild sitemap after content rollback or site settings rollback.
- Confirm admin no-store/noindex headers after rollback.

## Data Recovery Notes

`hhc-web` does not own durable data. Recovery focuses on frontend revision, rendering config, sitemap output, and cache state.

## Secrets And Key Rotation Notes

Frontend code must not contain service secrets, provider keys, storage keys, or private service URLs. Browser-visible config is public.

## Degraded Modes

- Public pages can show last-known public content if `hhc-web-api` allows stale public projections.
- Admin UI should show unavailable state rather than pretending writes succeeded.
- Missing asset URLs should render unavailable state, not raw Blob paths.

## Staging Drill

Run frontend rollback drill and sitemap parity check for `zh-Hant`, `zh-Hans`, and `en`. Evidence must include previous revision, route checks, metadata checks, and admin no-store/noindex checks.

## Production Verification

- Public home page renders.
- Public news or bulletin page renders.
- Admin shell requires login.
- Sitemap contains only public routes.
- Metadata does not expose internal URLs, admin URLs, Blob/SAS URLs, or draft content.
