# HHC Platform Architecture Completion Audit

## Purpose

This audit records whether the HHC web platform planning is complete enough to move from architecture planning into implementation planning.

It verifies the user's requested architecture scope:

- clone and analyze the current `hhc-web` website shape
- design the church website features visible from `hhc-web`
- use TypeScript frontend, Go backend, PostgreSQL, Redis, Azure/cloud runtime
- use microservice boundaries as a solution to ownership, reuse, and operational risk, not as a goal
- make `api-gateway` the first public gate
- keep all non-account APIs under `www.alive.org.tw/api/*`
- keep account APIs under `account.alive.org.tw`
- validate access JWTs locally at the gateway without per-request `account-api` introspection
- keep refresh-token revocation in `account-api`
- use `/priv/*` for internal-only service calls
- make `asset-api` reusable for weekly bulletins, news images, LINE group files, and future desktop cloud folders
- decide whether `hhc-web-api`, `cms-api`, `bulletin-api`, and `public-query-api` are separate services
- include notification/email, audit, background jobs, release, cloud, observability, backup, and future extension details
- produce roadmap and component sub-plans

This audit is about architecture planning. It does not claim the services are implemented, deployed, tested in runtime, or production-ready.

## Audit Result

Architecture planning status: complete for v1 implementation planning.

The current document set provides:

- a finite v1 deployable catalog
- explicit reusable capability boundaries
- explicit non-service decisions
- API contracts
- database and cache ownership
- asset lifecycle and access model
- publication and LINE bot weekly bulletin flow
- security, auth, authorization, and browser boundary rules
- cloud runtime, IaC, release, supply-chain, worker/job, backup/DR, observability, and runbook rules
- implementation roadmap and rollout verification matrix
- post-v1 extraction rules

Remaining work is implementation, not architecture discovery, unless a new product requirement is introduced.

## Authoritative Entry Points

| Area | File |
| --- | --- |
| Main architecture | `docs/superpowers/specs/2026-07-08-hhc-web-platform-detailed-architecture.md` |
| Service catalog | `docs/superpowers/specs/2026-07-08-hhc-service-catalog-and-ownership-design.md` |
| Implementation blueprint | `docs/superpowers/specs/2026-07-08-hhc-web-service-implementation-blueprint.md` |
| Platform roadmap | `docs/superpowers/plans/2026-07-08-hhc-web-platform-roadmap.md` |
| Rollout verification | `docs/superpowers/plans/2026-07-08-hhc-web-rollout-verification-matrix.md` |
| Phase 1 implementation plan | `docs/superpowers/plans/2026-07-08-hhc-web-cms-phase-1.md` |
| Frontend/admin roadmap | `docs/superpowers/plans/2026-07-08-hhc-web-frontend-admin-component-roadmap.md` |
| API contracts | `docs/api/*.md` |
| Runbooks | `docs/runbooks/*.md` |

## User Requirement Coverage

| Requirement | Status | Evidence |
| --- | --- | --- |
| Website features visible in `hhc-web` are mapped to backend/CMS design | Covered | content domain model, web API design, PostgreSQL schema, public API, frontend/admin roadmap |
| `api-gateway` is the first public gate | Covered | detailed architecture, gateway auth design, cloud runtime, rollout matrix |
| No `api.alive.org.tw`; non-account APIs stay under `www.alive.org.tw/api/*` | Covered | detailed architecture, service catalog, gateway auth, roadmap, API docs |
| `admin.alive.org.tw` is UI only | Covered | detailed architecture, cloud runtime, rendering/delivery, gateway auth, roadmap |
| `account.alive.org.tw` owns account/OIDC/token/JWKS APIs | Covered | detailed architecture, account token contract, account admin lifecycle, API docs |
| Gateway validates access JWT locally and does not call `account-api` per request | Covered | gateway auth design, account token contract, roadmap, rollout matrix |
| Refresh-token revocation stays in `account-api`; access tokens naturally expire | Covered | account token contract, gateway auth design, roadmap |
| Internal service APIs use `/priv/*` | Covered | internal service identity, service catalog, cloud runtime, API docs |
| FE TypeScript and BE Go are the planned implementation languages | Covered | roadmap, implementation blueprint, Phase 1 plan |
| PostgreSQL is source of truth and Redis is cache/ephemeral | Covered | cloud runtime, PostgreSQL schema design, public projection/cache design, service catalog |
| Azure/cloud runtime is designed without Azure-specific domain logic | Covered | cloud runtime, IaC governance, implementation blueprint |
| Microservices are not split for their own sake | Covered | service catalog, future domain extension strategy, detailed architecture |
| `hhc-web-api` is the main website backend | Covered | service catalog, web API design, roadmap |
| `cms-api`, `bulletin-api`, and `public-query-api` are not v1 services | Covered | service catalog, detailed architecture, roadmap |
| Weekly bulletin download works for website and LINE bot | Covered | public API, LINE bot integration, publication workflow, asset lifecycle |
| `asset-api` is reusable but does not own business meaning | Covered | asset lifecycle, asset ingestion, service catalog, detailed architecture |
| Public/private asset visibility is designed | Covered | asset lifecycle, asset API, authorization policy, data classification |
| News images, weekly PDFs, LINE group files, and desktop cloud-folder objects share file mechanics | Covered | asset lifecycle, asset ingestion, service catalog |
| Notification/email exists as internal reusable capability | Covered | notification API design, internal notification API, service catalog |
| Audit exists as internal append-only capability | Covered | audit-log design, internal audit API, service catalog |
| Roadmap includes components and sub-plans | Covered | platform roadmap, Phase 1 plan, frontend/admin roadmap, rollout matrix |

## Service Boundary Audit

| Boundary | Decision | Evidence |
| --- | --- | --- |
| `api-gateway` | public ingress, routing, JWT validation, coarse limits, trusted headers | gateway auth, cloud runtime, service catalog |
| `account-api` | identity, token, refresh, JWKS, admin identity lifecycle | account token, account admin lifecycle |
| `hhc-web` | public and admin UI only | rendering/delivery, frontend roadmap |
| `hhc-web-api` | website backend, CMS core, public projections, admin workflows | web API design, schema design, CMS workflow |
| `asset-api` | bytes, metadata, scan, grants, visibility, stable download URLs | asset lifecycle, asset ingestion |
| `notification-api` | internal notification commands, templates, providers, retry | notification API, internal notification API |
| `audit-log` | append-only audit and protected query/export | audit-log design, internal audit API |
| `hhc-line-function-bot` | LINE adapter and published-data consumer | LINE bot integration |

## Data And Consistency Audit

| Concern | Status | Evidence |
| --- | --- | --- |
| Service-owned PostgreSQL schemas | Covered | cloud runtime, service catalog, schema design |
| No cross-service table reads | Covered | service catalog, cross-service dependency governance |
| Redis only for cache/ephemeral state | Covered | cloud runtime, public projection/cache design |
| Public projections are rebuildable | Covered | public projection/cache design, web API schema |
| Grant-before-visible publication for required public assets | Covered | publication workflow, asset lifecycle, public API |
| Stale publish side effects are cancelled or compensated | Covered | publication workflow, outbox reliability |
| Event envelope and schema governance | Covered | event contract/schema/replay governance |
| Outbox reliability and idempotency | Covered | platform eventing/outbox reliability |
| Background jobs, scheduled jobs, and backfills | Covered | background jobs/worker orchestration |
| Restore reconciliation and lifecycle ledgers | Covered | data lifecycle/restore orchestration, backup/DR |

## Security And Governance Audit

| Concern | Status | Evidence |
| --- | --- | --- |
| Gateway-local JWT verification | Covered | API gateway authentication design |
| Trusted identity headers and header stripping | Covered | gateway auth, auth headers API doc |
| Route-level and service-level authorization | Covered | authorization policy governance, web security/RBAC |
| Object-level authorization and field redaction | Covered | authorization policy governance |
| Browser security headers, CORS, CSRF, CSP, cookies | Covered | browser security boundary |
| Public third-party script/embed governance | Covered | third-party analytics/consent governance |
| Data classification, privacy, retention | Covered | data classification/privacy/retention |
| Abuse prevention, rate limits, quotas | Covered | abuse prevention/rate limit/quota design |
| Supply chain, SBOM, provenance, image digest promotion | Covered | software supply chain/release security |
| Release compatibility, migrations, rollback/roll-forward | Covered | deployment compatibility/release governance |

## Operations Audit

| Concern | Status | Evidence |
| --- | --- | --- |
| Azure Container Apps runtime | Covered | cloud runtime |
| Dapr service invocation | Covered | cloud runtime, internal service identity |
| Environment separation | Covered | cloud runtime, IaC governance |
| IaC, naming, tagging, identities, drift checks | Covered | cloud infrastructure/IaC governance |
| SLOs, SLIs, alerts, dashboards | Covered | platform SLO/observability/runbook design |
| Production incident command | Covered | production runbook/incident operations, runbooks |
| Backup, restore, DR, RPO/RTO | Covered | backup/restore/DR design |
| Go-live, DNS, TLS, custom domains, cutover | Covered | production go-live/cutover |
| Local development and CI test dependencies | Covered | local development/test environment |
| Runbooks for v1 deployables | Covered | `docs/runbooks/*.md` |

## Intentional V1 Non-Services

These are explicitly rejected for v1 and are not planning gaps:

- `cms-api`
- `bulletin-api`
- `public-query-api`
- `query-api` / GraphQL gateway
- `search-api`
- `authorization-api`
- `config-api`
- `abuse-api`
- `privacy-api` / `retention-api` / `recovery-api`
- `backup-api` / `restore-api` / `dr-api`
- `analytics-api`
- `consent-api`
- `tag-manager-api`
- `launch-api` / `dns-api` / `certificate-api`
- `email-api`
- `asset-cdn-api`
- `supply-chain-api` / `artifact-api` / `sbom-api` / `vulnerability-api` / `release-security-api`
- `scheduler-api` / `job-api` / `worker-api` / `workflow-api` / `cron-api`
- `incident-api` / `runbook-api`
- `seo-api`
- `translation-api`

The reason is consistent across the architecture: these are either owned by an existing service, a pipeline artifact, a runtime capability, an IaC/runbook operation, a browser preference, or a post-v1 domain candidate.

## Intentional Deferrals

These are intentionally post-v1 or optional and do not block v1 architecture planning:

| Deferred Item | Reason | Guardrail |
| --- | --- | --- |
| Full LINE bot business workflows | Website platform only needs weekly bulletin consumer first | future LINE group file storage uses `asset-api /priv/assets/*` with bot-owned meaning |
| Scheduled publishing UI | Phase 1 CMS uses explicit publish/unpublish | when enabled, `hhc-web-api` scheduled workflow owns it |
| Public search activation | Can start with projections and PostgreSQL search design | `search-api` extraction requires real trigger |
| Contact forms, event registration, member/group/pastoral/donation domains | Not visible v1 website foundation | future domain extension strategy defines boundaries |
| Azure Service Bus | PostgreSQL outbox is enough first | adopt only when fan-out, delayed delivery, isolation, or volume justifies it |
| Front Door/CDN hard dependency | Go-live can start without it | adoption gates in production go-live and cloud runtime specs |
| Formal SLSA certification / enforced image signatures | V1 can start with SBOM/provenance evidence | release manifest carries signature status and future enforcement path |
| Public preview tokens | No v1 editorial sharing workflow requires it | future design requires expiry, revocation, audit, leak response |
| Tag manager / broad analytics | Not needed for v1 public website | provider registry, consent, CSP, and release controls required before enabling |

## Completion Criteria For Architecture Planning

Planning is complete only if all of the following stay true:

- Every explicit user requirement is mapped to at least one authoritative design artifact.
- Every v1 service has an owner, route surface, data boundary, caller model, runtime model, release gate, and runbook expectation.
- Every reusable capability has a clear mechanical boundary and consumer-owned business meaning.
- Every rejected service has an explicit reason and an extraction gate if it becomes justified later.
- API, route, host, auth, data, cache, asset, worker, release, and operations decisions agree across documents.
- There are no placeholder markers for unfinished design work.
- There are no docs requiring `api.alive.org.tw`, public `/priv/*`, direct Blob/SAS URLs to public clients, gateway business aggregation, cross-service table reads, mutable production image tags, or a central scheduler/job API.
- All docs under `docs/superpowers/specs`, `docs/superpowers/plans`, `docs/api`, and `docs/runbooks` are referenced from a main index or owning document.

## Final Verification Commands

Run before claiming architecture planning is complete:

```powershell
git diff --check
rg -n "<standard unfinished-placeholder pattern>" docs\superpowers docs\api docs\runbooks
rg -n "[ \t]+$" docs\superpowers docs\api docs\runbooks
rg --pcre2 -n "(?i)(api\.alive\.org\.tw(?!.*(Do not|There is no|prohibition|explicit prohibition))|public.{0,40}/priv|Blob SAS|SAS URL.*public client|cross-service SQL|gateway.{0,60}compose business|deploy.{0,80}(latest|mutable tag).{0,80}production|production.{0,80}mutable tag)" docs\superpowers docs\api docs\runbooks
```

Expected result:

- `git diff --check` exits 0, allowing only line-ending warnings.
- placeholder and trailing-whitespace searches have no matches.
- anti-pattern search has no matches except explicit prohibition/guardrail text.

## Completion Decision

If final verification passes, the architecture planning goal can be considered complete for v1 planning purposes.

The next phase is implementation planning and repo work:

- `api-gateway`
- `account-api`
- `hhc-web`
- `hhc-web-api`
- `asset-api`
- `notification-api`
- `audit-log`
- `hhc-line-function-bot`
- platform infra/IaC
