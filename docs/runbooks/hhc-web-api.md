# hhc-web-api Runbook

## Service Purpose

`hhc-web-api` is the backend facade for the main website and admin CMS workflows. It owns public projections, CMS content state, site settings, editorial publish behavior, search documents when enabled, and the public contract consumed by `hhc-web` and `hhc-line-function-bot`.

## Owner And Escalation

- Primary owner: web/content domain engineering
- Escalate to platform owner for gateway, database, Redis, or deployment issues
- Escalate to `asset-api` owner for asset grants or public URL failures
- Escalate to `audit-log` owner for protected write audit failures

## Dependencies

- PostgreSQL `hhc_web` schema
- Redis public cache
- `asset-api` for public asset grants and public URL generation
- `audit-log` for protected admin writes
- `notification-api` for future editorial notifications
- Gateway trusted identity headers for admin APIs

## Health And Ready Checks

- `GET /healthz`: process health
- `GET /readyz`: PostgreSQL reachable, Redis reachable or safe fallback enabled, required internal dependencies reachable
- Public projection smoke: home/news/bulletin read
- Admin publish smoke in staging
- Worker backlog checks for publish/reconciliation jobs

## Dashboards And Logs

- public read rate, p95 latency, 4xx, 5xx
- admin write and publish latency
- PostgreSQL dependency latency and connection usage
- Redis hit rate, miss rate, and errors
- projection rebuild count and failure count
- publish workflow state transitions
- asset grant request failures
- audit intent failures

## Page-Worthy Alerts

- public read route class unavailable
- admin publish unavailable
- projection rebuild failure affecting public pages
- Redis unavailable with PostgreSQL fallback also failing
- publish workflow stuck after grant-before-visible step
- asset grant failure blocks required public content
- audit intent unavailable for protected write

## Common Failure Modes

- PostgreSQL outage or connection saturation
- Redis flush, eviction, or namespace mismatch
- stale publish workflow exposes old projection
- unpublish or rollback fails to remove public projection/search document
- asset grant not created before content becomes public
- site settings publish breaks header/footer or sitemap metadata

## Quick Triage

1. Determine route class: public read, admin read, admin write, publish worker, search, or site settings.
2. Check gateway trusted identity headers for protected admin routes.
3. Check PostgreSQL health and migration version.
4. Check Redis namespace and cache rebuild status.
5. Check publish workflow id, projection version, and related asset grants.
6. Preserve content id, revision id, projection version, request id, and correlation id.

## Mitigation Actions

- Serve last-known public projection when safe and explicitly public.
- Rebuild public projections after Redis flush or cache corruption.
- Cancel stale publish workflow after unpublish or rollback.
- Revoke or repair asset grant before making content visible.
- Fail closed for admin writes when audit intent cannot be recorded.
- Use emergency takedown for unsafe public content.

## Rollback Path

- Roll back app revision for code regression.
- Use expand/contract migration protocol; prefer roll-forward for schema fixes after writes.
- Roll back publish by creating a new public projection from a selected revision.
- Invalidate Redis namespace after rollback publish.
- Rebuild sitemap and search documents after site settings or content rollback.

## Data Recovery Notes

Restore into quarantine first. Before public promotion, verify content state, draft/published separation, deletion/redaction/legal-hold state, public projections, search documents, sitemap, Redis rebuild, and asset grants.

## Secrets And Key Rotation Notes

`hhc-web-api` should not hold provider keys unless a feature explicitly needs them. Database and Redis credentials come from environment/managed identity/secret references. Do not log trusted identity headers with sensitive claims.

## Degraded Modes

- Public reads can use last-known public projections.
- Admin writes fail closed if PostgreSQL, audit, or authorization context is unsafe.
- Search can be disabled while exact public pages remain available.
- Public pages can omit unavailable assets instead of exposing Blob/SAS URLs.

## Staging Drill

Run Redis flush/rebuild, publish rollback, emergency takedown, and LINE bulletin lookup drills. Evidence must include projection version before/after, Redis rebuild result, asset grant state, public route result, and bot command result.

## Production Verification

- Public home/news/bulletin routes return expected public data.
- Latest bulletin API returns a public asset URL or unavailable state.
- Selected bulletin API returns correct issue by identifier.
- Admin publish creates audit intent and public projection.
- Unpublish/rollback removes stale public projection/search entries.
- Redis can be flushed and rebuilt from PostgreSQL projections.
