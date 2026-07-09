# HHC Production Go-Live, Edge Routing, And Cutover Design

This spec defines how the HHC web platform should move from local/staging readiness to production traffic on `www.alive.org.tw`, `admin.alive.org.tw`, and `account.alive.org.tw`.

It ties together DNS, TLS, custom domains, edge routing, HSTS, content seed, first administrator access, smoke tests, traffic switch, rollback, and post-launch monitoring. These concerns are intentionally cross-cutting: they should not become a new runtime service.

## Related Specs

- `docs/superpowers/specs/2026-07-08-hhc-web-platform-detailed-architecture.md`
- `docs/superpowers/specs/2026-07-08-hhc-cloud-runtime-operations-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-cloud-infrastructure-iac-and-resource-governance-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-deployment-compatibility-migration-and-release-governance-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-production-runbook-and-incident-operations-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-web-rendering-and-delivery-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-api-gateway-authentication-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-web-browser-security-boundary-and-http-headers-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-account-admin-identity-rbac-lifecycle-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-content-migration-bootstrap-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-public-projection-cache-invalidation-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-platform-slo-observability-and-runbook-design.md`
- `docs/superpowers/plans/2026-07-08-hhc-web-rollout-verification-matrix.md`

External alignment:

- Azure Container Apps custom domains and certificates: `https://learn.microsoft.com/en-us/azure/container-apps/custom-domains-certificates`
- Azure Container Apps managed certificates: `https://learn.microsoft.com/en-us/azure/container-apps/custom-domains-managed-certificates`
- Azure Container Apps blue-green deployment: `https://learn.microsoft.com/en-us/azure/container-apps/blue-green-deployment`
- Azure Well-Architected safe deployment practices: `https://learn.microsoft.com/en-us/azure/well-architected/operational-excellence/safe-deployments`
- Azure Well-Architected operational excellence principles: `https://learn.microsoft.com/en-us/azure/well-architected/operational-excellence/principles`
- Azure Front Door end-to-end TLS: `https://learn.microsoft.com/en-us/azure/frontdoor/end-to-end-tls`

## Core Decision

Use a documented go-live procedure owned by platform operations and release owners. Do not create a `launch-api`, `dns-api`, `edge-api`, `certificate-api`, or `go-live-service`.

V1 edge model:

- `api-gateway` remains the first public application gate.
- `www.alive.org.tw` routes public website UI and all non-account public APIs.
- `admin.alive.org.tw` routes admin console UI only.
- `account.alive.org.tw` routes account UI, OIDC, token, account APIs, and JWKS.
- Backend API services do not receive direct public ingress.
- `api.alive.org.tw` is not created.

V1 can bind custom domains directly to the public gateway/runtime if that keeps launch simple. Azure Front Door, CDN, and WAF can be added later when their benefits justify the operational surface.

## Non-Goals

- No generic launch orchestration service.
- No separate public API host.
- No permanent portal-only configuration.
- No CDN or Front Door requirement for the first release.
- No DNS or certificate secrets in source control.
- No traffic switch that depends on unverified admin-only manual checks.

## Ownership

| Concern | Owner | Evidence |
| --- | --- | --- |
| DNS records | platform/infra owner | DNS change plan, before/after resolution, TTL evidence |
| TLS certificates | platform/infra owner | certificate binding, expiry/renewal owner, HTTPS smoke |
| Gateway route policy | `api-gateway` owner | route policy version, route smoke, rollback target |
| Custom domain binding | platform/runtime owner | bound hostnames and certificate status |
| First admin and break-glass users | `account-api` owner plus platform owner | named users, expiry/revocation plan, audit evidence |
| Content seed and public projections | `hhc-web-api` owner | seed run id, checksums, projection parity |
| Frontend cutover | `hhc-web` owner | data mode, public route smoke, rollback target |
| Production approval | release owner | go-live checklist, known risks, rollback decision point |
| Incident command during launch | platform incident commander | launch bridge/log and decision timestamps |

## Launch Architecture

Production traffic path:

```text
Browser / LINE / provider callback
  -> public DNS
  -> TLS endpoint / custom domain binding
  -> api-gateway
  -> hhc-web, account-api, hhc-web-api, asset-api, or approved provider callback service
```

Route ownership:

| Host / Path | Launch Owner | Upstream |
| --- | --- | --- |
| `www.alive.org.tw/*` non-API | `api-gateway` route to `hhc-web` | `hhc-web` |
| `www.alive.org.tw/api/public-or-feature` | `api-gateway` route to owning service | mostly `hhc-web-api`; asset routes to `asset-api` |
| `www.alive.org.tw/api/admin/*` | `api-gateway` protected route | `hhc-web-api` |
| `www.alive.org.tw/api/assets/*` | `api-gateway` asset route | `asset-api` |
| `www.alive.org.tw/api/line/webhook/*` | provider callback route | `hhc-line-function-bot` or gateway-approved bot ingress |
| `admin.alive.org.tw/*` | UI route only | `hhc-web` |
| `admin.alive.org.tw/api/*` | blocked | none |
| `account.alive.org.tw/*` | account route | `account-api` |
| `/priv/*` and `/api/priv/*` | blocked publicly | internal Dapr only |

## DNS And Custom Domain Rules

DNS records must be treated as production-impacting infrastructure changes.

Rules:

- Lower TTL before cutover only as part of a documented launch window.
- Record current DNS state before changes.
- Do not point production hostnames to staging/test resources.
- Do not expose backend service FQDNs as public canonical URLs.
- Do not create `api.alive.org.tw`.
- Keep `www`, `admin`, and `account` hostnames independently smoke-testable.
- Use staging/test hostnames for pre-production validation.
- Avoid wildcard records for platform application hosts unless there is a documented host-routing policy.

Required DNS evidence:

```text
www.alive.org.tw     -> production public edge target
admin.alive.org.tw   -> production public edge target
account.alive.org.tw -> production public edge target
```

If Azure Container Apps direct custom domains are used, each domain must have an associated TLS certificate and ingress-enabled app binding. If Azure Front Door is inserted later, DNS should target Front Door and the gateway should verify original host behavior through forwarded headers according to the gateway spec.

## TLS And Certificate Rules

Every public hostname requires a valid TLS certificate before production traffic.

Rules:

- Use managed certificates when they reduce operational burden and support the required hostnames.
- Use bring-your-own certificates only when managed certificates cannot satisfy the requirement.
- Certificate private keys are secret material and never live in repo, docs, incident notes, or normal logs.
- Certificate expiry must have an owner and alert before launch.
- TLS smoke tests must cover `www`, `admin`, and `account`.
- Do not enable HSTS preload until all relevant subdomains and redirects are stable.

Minimum TLS evidence:

- certificate subject/SAN covers the hostname
- certificate is not near expiry
- HTTPS request succeeds
- HTTP redirects to HTTPS where applicable
- no mixed-content public assets
- account refresh cookies, if enabled, are host-only on `account.alive.org.tw`

## HSTS Policy

HSTS should be staged.

Initial production:

```http
Strict-Transport-Security: max-age=300
```

After production HTTPS behavior is stable:

```http
Strict-Transport-Security: max-age=31536000; includeSubDomains
```

Do not submit preload until:

- `www`, `admin`, `account`, and any apex redirect are permanently HTTPS-ready
- staging/test host decision is explicit
- rollback no longer depends on serving HTTP
- certificate renewal path is proven
- security owner approves the risk

## CDN, Front Door, And WAF Decision

Do not require CDN, Azure Front Door, or WAF for v1 launch unless the operational team has already committed to owning it.

Start without Front Door/CDN if:

- traffic is low
- public pages are already cacheable through app/gateway headers
- asset downloads are controlled by `asset-api`
- WAF rules are not yet tuned
- the team needs fewer moving parts for the first launch

Add Azure Front Door/CDN/WAF when one or more are true:

- public traffic grows enough that edge caching materially helps
- global latency becomes important
- WAF protection is needed for public forms, donation checkout, or broader attack exposure
- centralized TLS/custom domain management is worth the added layer
- asset egress cost/performance needs edge caching
- blue/green routing across multiple origins is needed

If Front Door/CDN is added:

- preserve `api-gateway` as the application policy gate
- do not cache admin, account, protected asset, preview, or webhook responses
- cache public HTML/API only according to projection cache rules
- ensure purge/invalidation is tied to publish/unpublish/rollback
- forward the original host and scheme in a controlled way
- add route-specific WAF exclusions only with evidence
- include CDN purge and bypass steps in rollback

## Environment Bootstrap Sequence

This sequence creates a production-capable environment without exposing it prematurely.

1. Create or verify resource groups, managed identities, Key Vault, logging, networking, PostgreSQL, Redis, Blob, and Container Apps through IaC.
2. Create service schemas and run migrations in production with no public traffic.
3. Deploy `api-gateway`, `account-api`, `hhc-web`, `hhc-web-api`, `asset-api`, `notification-api`, `audit-log`, and required integrations to production revisions.
4. Keep backend service direct public ingress disabled.
5. Bind staging/test hostnames first when available.
6. Load runtime config and secret references.
7. Verify config fingerprints.
8. Bootstrap first named admin users or invitations through `account-api` procedure.
9. Configure emergency named users with expiry and secret-store handling, if needed.
10. Run deterministic content seed/import for current public website content.
11. Import public assets through `asset-api` or an approved seed adapter.
12. Build public projections and Redis cache.
13. Verify sitemap, robots, public APIs, admin login, account flows, and asset routes before DNS cutover.

Do not run production seed as ad hoc SQL. Use the `hhc-web-api` seed/import path so seed provenance, revisions, audit events, and rollback behavior are preserved.

## First Administrator Bootstrap

The first admin problem must be solved explicitly because normal invitations require an existing admin.

Allowed v1 options:

1. **Account-owned bootstrap command:** one-time `account-api` administrative command creates an invitation or named admin from approved input.
2. **Manual database operation:** allowed only under break-glass procedure, with dual approval, exact SQL captured, and immediate audit backfill.
3. **Existing identity provider group:** acceptable if account-role mapping is already implemented and tested.

Recommended v1 option: account-owned bootstrap command.

Rules:

- The bootstrap command is disabled after first use or gated by a production-only launch secret and approval.
- It creates `account.admin` and/or `cms.admin` role bundles intentionally; do not grant broad roles by accident.
- It emits audit evidence or a bootstrap audit backfill event.
- It creates no long-lived shared root account.
- Emergency users must be named humans, expire when possible, and be reviewed after launch.
- The gateway still does not call `account-api` per request.

First admin launch checks:

- Admin can complete login through `account.alive.org.tw`.
- Admin can access `admin.alive.org.tw`.
- Admin can call `www.alive.org.tw/api/admin/*` with bearer token.
- Missing token returns `401`.
- Missing role returns `403`.
- `admin.alive.org.tw/api/*` remains blocked.
- Account admin routes remain on `account.alive.org.tw`.

## Content Seed And Publish Readiness

Public content must be ready before production DNS cutover.

Required evidence:

- seed manifest version
- source commit and checksums
- row counts by content type and locale
- asset import counts
- warnings and editor review decisions
- public projection counts
- `GET /api/home`, `/api/site-layout`, `/api/bulletins/latest`, `/api/news`, `/api/videos`, `/api/locations`, and `/api/history` smoke results
- sitemap route count
- locale alternate checks
- no Blob/SAS URLs in public HTML/API
- weekly bulletin latest and selected issue checks
- LINE bot weekly download smoke if the bot integration is enabled

Do not switch production traffic if the seeded CMS-backed site is materially different from the current site unless that difference is an approved launch change.

## Go-Live Freeze

Start a temporary launch freeze before DNS cutover.

Freeze applies to:

- gateway route policy
- production secrets and config fingerprints
- migrations
- DNS/TLS/custom domain changes
- CMS publish changes
- account role changes
- third-party provider allowlists

Allowed during freeze:

- critical security fix
- launch blocker fix approved by release owner
- rollback or roll-forward action
- content correction explicitly included in launch notes

The freeze ends after post-launch monitoring passes and the release owner records the decision.

## Pre-Cutover Checklist

Do not cut traffic until every item has evidence.

Infrastructure:

- IaC deployment succeeded.
- Drift check has no unapproved difference.
- Production custom domains are bound or ready to bind.
- TLS certificates are valid.
- DNS TTL has been prepared.
- Logging and dashboards are receiving production telemetry.

Gateway:

- `www` routes public UI and public APIs.
- `admin` routes UI only.
- `account` routes account only.
- `/priv/*` and `/api/priv/*` are blocked publicly.
- `api.alive.org.tw` is absent.
- Client-supplied trusted identity headers are stripped.

Account:

- OIDC metadata and JWKS are reachable.
- JWKS rotation smoke passes.
- Admin login works.
- First admin and emergency users are documented.
- Refresh-token revocation smoke passes.

Web/CMS:

- Public routes render in all supported locales.
- Admin shell loads.
- Admin protected API calls work with valid token.
- Preview is no-store/noindex.
- Publish/unpublish smoke passes in staging or production dry-run.
- Site settings do not expose secrets/internal URLs.

Assets:

- Public asset route works.
- Protected asset route requires authorization.
- Weekly PDF download works.
- Blob/SAS URLs are not exposed.

Operations:

- Release manifest exists.
- Rollback target is known.
- Incident commander is assigned.
- Runbooks are linked.
- Page-worthy alerts are active for Tier 0/Tier 1 surfaces.
- Synthetic smoke checks are ready.

## Traffic Cutover Sequence

Use a controlled sequence with a clear stop point.

1. Announce launch window to stakeholders.
2. Confirm freeze is active.
3. Record current DNS and app revision state.
4. Run final pre-cutover smoke against production runtime via temporary/staging host or direct controlled route.
5. Bind or switch custom domain routing.
6. Update DNS records if needed.
7. Wait for expected DNS propagation based on TTL.
8. Run public smoke:
   - `https://www.alive.org.tw/zh-Hant`
   - `https://www.alive.org.tw/zh-Hant/literature-ministry`
   - `https://www.alive.org.tw/sitemap.xml`
   - `https://www.alive.org.tw/api/home?locale=zh-Hant`
   - `https://www.alive.org.tw/api/bulletins/latest?locale=zh-Hant`
   - `https://www.alive.org.tw/api/assets/public/{knownAssetId}`
9. Run admin/account smoke:
   - `https://admin.alive.org.tw/zh-Hant/admin`
   - `https://admin.alive.org.tw/api/anything` returns blocked
   - `https://account.alive.org.tw/.well-known/openid-configuration`
   - admin login and admin API call
10. Run negative security smoke:
    - missing admin token returns `401`
    - bad token returns `401`
    - valid token missing role returns `403`
    - public `/priv/*` is blocked
    - spoofed trusted identity headers are stripped
11. Run SEO/content smoke:
    - canonical host is `www.alive.org.tw`
    - locale alternates exist for published locales
    - robots policy is correct
    - no noindex on public pages
12. Monitor error rate, latency, auth failures, gateway 5xx, DB connections, Redis errors, asset download errors, and account token errors.
13. Decide continue, rollback, or hold.

## Rollback Strategy

Rollback must be chosen based on failure type.

| Failure | Preferred Rollback |
| --- | --- |
| Bad frontend rendering only | rollback `hhc-web` revision or enable approved mock/static data mode |
| Bad public API route | gateway route rollback or `hhc-web-api` revision rollback |
| Bad auth/JWKS behavior | gateway verifier rollback, JWKS cache refresh, account-api key rollback window |
| Bad content seed | switch frontend data mode only if approved, or rollback publish/projections; do not hand-edit DB |
| Bad DNS/custom domain | revert DNS or domain binding if propagation window allows |
| Bad TLS certificate | revert domain binding or restore previous certificate |
| Bad asset downloads | route rollback, asset-api revision rollback, or disable affected public grant |
| Data corruption risk | stop writes, disable public/admin write paths, follow data recovery runbook |

Rollback rules:

- Record decision time and reason.
- Prefer application revision rollback over DNS rollback when DNS propagation would extend the incident.
- Do not rollback migrations destructively unless the release manifest explicitly proves it is safe.
- If content changed during launch, reconcile public projections, Redis, search, sitemap, and asset grants after rollback.
- If account roles or emergency users were created for launch, review and revoke what is no longer needed.
- If HSTS max-age was increased, rollback options are constrained; keep initial HSTS conservative.

## Post-Launch Monitoring

Monitor for at least the agreed stabilization window.

Minimum signals:

- gateway request rate, 4xx, 5xx, latency
- public page 5xx and rendering errors
- public API error rate by route
- account login/token/JWKS failures
- admin API 401/403/5xx trends
- DB connection saturation and slow queries
- Redis errors and cache rebuild events
- asset download errors and egress spikes
- CSP violations
- noindex/robots accidental exposure
- LINE bot weekly bulletin errors if enabled
- notification provider errors if account invitations or alerts are enabled

Post-launch evidence:

- launch start/end timestamps
- DNS/TLS verification
- smoke results
- metrics snapshot
- incidents or known issues
- rollback decision result
- freeze end decision
- emergency users and elevated roles review
- next follow-up tasks

## Front Door / CDN Later Adoption Playbook

When adopting Front Door/CDN later, treat it as a production-impacting edge release.

Required before enabling:

- route-by-route cache policy
- origin host/header policy
- TLS certificate plan
- WAF mode decision: detection first, then prevention after tuning
- purge/invalidation integration for publish/unpublish/rollback
- admin/account/protected/webhook no-cache proof
- asset caching policy and range request behavior
- failure mode: bypass CDN or route to previous origin
- synthetic checks through CDN and direct origin

Do not let CDN become a second source of route policy. `api-gateway` remains the application gateway and authorization boundary.

## Acceptance Criteria

- Production launch has a documented, repeatable checklist covering DNS, TLS, gateway routes, account/admin login, seed/projection readiness, assets, and monitoring.
- `www`, `admin`, and `account` host routing is explicit and tested.
- `api.alive.org.tw` remains absent.
- First admin bootstrap has an account-owned, auditable path without long-lived shared root accounts.
- Content seed/projection readiness is proven before public DNS cutover.
- HSTS rollout is staged and does not block rollback.
- Front Door/CDN/WAF are optional v1 enhancements with explicit adoption gates.
- Rollback paths are chosen by failure type and include content/projection/asset reconciliation where needed.
- Post-launch monitoring and freeze end decisions are captured as release evidence.
