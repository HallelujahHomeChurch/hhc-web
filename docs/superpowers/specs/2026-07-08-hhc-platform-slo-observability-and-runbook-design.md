# HHC Platform SLO, Observability, And Runbook Design

This spec defines production operability expectations for the HHC web platform. It turns "the services run in Azure" into measurable reliability, alerting, runbook, capacity, and cost rules.

It complements:

- `docs/superpowers/specs/2026-07-08-hhc-cloud-runtime-operations-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-web-service-implementation-blueprint.md`
- `docs/superpowers/specs/2026-07-08-hhc-platform-eventing-outbox-reliability.md`
- `docs/superpowers/specs/2026-07-08-hhc-event-contract-schema-and-replay-governance-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-web-security-rbac-threat-model.md`
- `docs/superpowers/specs/2026-07-08-hhc-platform-abuse-prevention-rate-limit-and-quota-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-data-lifecycle-deletion-retention-and-restore-orchestration-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-platform-backup-restore-and-disaster-recovery-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-publication-workflow-consistency-and-reconciliation-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-deployment-compatibility-migration-and-release-governance-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-production-runbook-and-incident-operations-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-public-and-admin-search-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-public-web-accessibility-performance-and-media-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-background-jobs-scheduled-tasks-and-worker-orchestration-design.md`
- `docs/superpowers/plans/2026-07-08-hhc-web-rollout-verification-matrix.md`

## Purpose

Microservices create more failure modes than a single app. This design keeps the service split practical by requiring every deployable component to have:

- clear service-level objectives
- measurable service-level indicators
- actionable alerts
- runbooks for common failure modes
- graceful degradation rules
- capacity and load-test expectations
- backup/restore evidence
- cost and quota guardrails

The goal is not high-enterprise ceremony. The goal is to prevent a small church platform from becoming hard to operate because the architecture has too many moving parts.

## Core Decision

Use lightweight, route-class SLOs and service-level runbooks from day one.

Do not wait for full production scale before adding SLOs. SLOs guide design decisions:

- whether an API can depend synchronously on another service
- whether a worker needs an outbox
- whether public pages can serve stale projections
- whether an alert should wake someone or become a dashboard-only signal
- whether a service split has created too much operational cost

## Service Criticality

| Tier | Component | Reason |
| --- | --- | --- |
| Tier 0 | `api-gateway`, `account-api` JWKS/token validation path | Protected APIs and admin access depend on them |
| Tier 1 | `hhc-web`, `hhc-web-api`, `asset-api` public download path | Public website, published content, and bulletin PDFs depend on them |
| Tier 2 | `audit-log`, `notification-api`, workers | Important for accountability and workflow, but most user reads should degrade or retry |
| Tier 3 | `hhc-line-function-bot` optional functions | Useful integration; public website remains the source of truth |

Tier does not mean security importance. For example, `audit-log` is security-sensitive even if many user-facing reads can continue while audit append retries through outbox.

## SLO Targets

Initial monthly targets for production:

| Surface | Availability Target | Latency Target | Notes |
| --- | --- | --- | --- |
| Public website HTML | 99.5% | p95 server response under 800 ms excluding CDN/client network | Public pages may serve stale projections during backend incidents |
| Public content API | 99.5% | p95 under 500 ms for cached/projection reads | `GET /api/home`, `GET /api/site-layout`, news, locations, videos, bulletins |
| Public search when enabled | 99.0% | p95 under 800 ms for capped queries | Search may return empty/stale-safe results rather than leak inactive projections |
| Public asset download routing | 99.5% | p95 first-byte under 800 ms excluding Blob transfer size | Large file transfer time measured separately |
| Admin read API | 99.0% | p95 under 800 ms | Admin can tolerate short outage more than public site |
| Admin write API | 99.0% | p95 under 1500 ms | Includes validation, DB write, outbox insert |
| Account login/token/JWKS | 99.5% | p95 token/JWKS under 500 ms | JWKS cache lets gateway survive short account read outages |
| Internal command APIs | 99.0% | p95 under 1000 ms excluding provider calls | Side effects should be idempotent and retryable |
| Notification delivery request accepted | 99.0% | p95 enqueue under 1000 ms | Provider delivery is a separate external dependency |
| Audit append accepted or queued | 99.5% | p95 local append/outbox insert under 500 ms | Business writes should not lose audit intent silently |
| LINE weekly bulletin lookup | 99.0% | p95 under 1500 ms | Uses public `hhc-web-api`, no direct Blob coupling |

Targets can be tightened after real traffic and operational evidence exist. Do not set 99.99% targets unless staffing, cost, and architecture actually support them.

## Service-Level Indicators

Measure SLOs from the gateway and service perspective.

Gateway SLIs:

- request count by host, route class, method, status
- p50/p95/p99 latency by route class
- upstream timeout count
- JWT verification failures by reason
- blocked `/priv/*` attempts
- request body limit rejections
- rate-limit rejections

Service SLIs:

- HTTP request count, latency, status by route group
- dependency latency/error for PostgreSQL, Redis, Blob, provider APIs, and Dapr calls
- worker backlog count
- oldest outbox age
- job run status count by job name
- scheduled job lag and missed-run count
- worker lease owner, lease age, and expired-lease recovery count
- job checkpoint progress and last successful run age
- event schema validation failure count by producer and event type
- event replay failure count by consumer and event type
- retention worker due item count and oldest overdue age
- lifecycle reconciliation failure count
- retry count and dead-letter count
- publication workflow waiting/failed count by status
- publication reconciliation repair/failure count
- release revision, config fingerprint, migration version, and active feature/kill-switch state
- idempotency conflict count
- cache hit/miss/error
- ready-check status by dependency

Business SLIs:

- latest bulletin exists and is downloadable
- required-asset publication workflows become public-visible only after asset grant confirmation
- public home projection exists for `zh-Hant`, `zh-Hans`, and `en`
- public search index freshness and stale-result omission work when search is enabled
- lifecycle retention, legal-hold, deletion, and restore reconciliation jobs complete for stateful services
- sitemap data generation succeeds
- admin publish succeeds and updates public projection
- published asset has clean scan and public download grant
- notification send request reaches queued/sent/failed terminal state
- audit events can be queried for a known admin action

## Error Budget Policy

Use SLO error budgets to prevent unreliable changes.

Rules:

- If a Tier 0 or Tier 1 surface burns more than 50% of its monthly error budget in 7 days, freeze non-urgent feature deploys touching that surface.
- If a surface violates its SLO for a full month, the next sprint must prioritize reliability fixes before new feature work for that surface.
- Security fixes, data-loss prevention, and urgent incident remediation can still deploy during a freeze.
- Documentation-only changes and isolated admin UI changes can continue if they do not touch the affected runtime path.

This should be a practical engineering rule, not bureaucracy. The point is to stop adding features while users are seeing reliability problems.

## Alert Policy

Alerts must be actionable. A page should mean someone can do something specific.

### Page-Worthy Alerts

| Alert | Trigger | First Runbook |
| --- | --- | --- |
| Public API high 5xx | 5xx above threshold for 5 minutes | Check gateway upstream health, `hhc-web-api /readyz`, DB health |
| Public website unavailable | HTML route failure above threshold for 5 minutes | Check `hhc-web`, gateway host routing, recent deployment |
| JWKS refresh failure with no usable key | Protected routes fail closed | Check `account-api`, JWKS endpoint, gateway verifier cache |
| PostgreSQL saturation | connection usage or latency above threshold | Check DB connections, replica count, slow queries, rollout |
| Blob operation failures | upload/download errors above threshold | Check storage account, managed identity, asset-api dependency health |
| Outbox oldest age critical | oldest pending row exceeds threshold | Check worker leases, downstream service, dead-letter rows |
| Scheduled job missed | required scheduled job has no successful run inside tolerance | Check ACA job schedule, job ledger, lease, missed-run policy |
| Manual/backfill job failed | production-impacting job enters failed-terminal or stalls past max runtime | Check job params, checkpoint, image digest, migration compatibility, runbook |
| Lifecycle worker overdue | retention or lifecycle worker overdue beyond threshold | Check worker lease, legal-hold policy, DB locks, dead-letter rows |
| Restore reconciliation failed | quarantine restore cannot replay lifecycle events or rebuild public projections | Keep public ingress disabled; check lifecycle ledger, projection rebuild, asset grants |
| Publication workflow stuck | required-asset workflow waits too long or enters retryable failure | Check asset-api grant command, workflow version, outbox, stale cancellation |
| Emergency takedown revoke failed | takedown cannot revoke or deny public asset access | Check asset-api, public-download kill switch, namespace/asset deny override |
| New revision error budget burn | newly promoted revision burns error budget faster than threshold | Roll traffic back, check release manifest, config fingerprint, migration/version compatibility |
| Audit append unavailable without local outbox | protected writes cannot record audit intent | Check audit-log health and caller outbox behavior |
| Provider callback signature failures spike | possible abuse or provider config drift | Check route, secret version, provider dashboard |
| Public `/priv/*` blocked spike | possible probing | Check source IP, WAF/gateway logs, rate limits |

### Dashboard-Only Signals

- normal 404s on public content routes
- validation errors on admin forms
- expected rate-limit rejections at low volume
- single notification provider permanent failures
- Redis cache misses when DB is healthy

Dashboard-only signals can become alerts if they correlate with user-visible failure.

## Default Alert Thresholds

Initial thresholds should be conservative and adjusted after staging/prod baselines exist.

| Signal | Initial Threshold |
| --- | --- |
| Public route 5xx | greater than 2% for 5 minutes and at least 20 requests |
| Admin route 5xx | greater than 5% for 10 minutes and at least 10 requests |
| p95 public API latency | over 1500 ms for 10 minutes |
| p95 admin API latency | over 2500 ms for 10 minutes |
| PostgreSQL connection usage | over 80% for 10 minutes |
| Outbox oldest age | warning at 10 minutes, critical at 30 minutes |
| Notification permanent failure | warning at 5 in 30 minutes by provider/template |
| Asset scan backlog | warning at 15 minutes, critical at 60 minutes |
| JWKS refresh failure | warning on first failure, critical when no usable key remains |
| Blocked `/priv/*` attempts | warning at 20 in 10 minutes from same source or 100 globally |

Do not use these thresholds blindly in production forever. Tune from observed traffic and church event patterns.

## Dashboards

Required dashboards:

| Dashboard | Audience | Must Show |
| --- | --- | --- |
| Executive health | non-engineering/admin | public website up, latest bulletin downloadable, admin login up |
| Gateway | engineering | host routing, route classes, latency, status, JWT failures, blocked paths |
| Public content | engineering | `hhc-web-api` reads, projection freshness, Redis hit rate, DB latency |
| Assets | engineering | upload sessions, download status, scan backlog, Blob latency, grant failures |
| Admin/CMS | engineering/admin support | admin reads/writes, publish success, validation failures, optimistic conflicts |
| Workers/outbox | engineering | backlog, oldest age, retries, dead-letter, lease holders |
| Account/security | engineering/security owner | login/token/JWKS, refresh reuse, role changes, denied admin routes |
| LINE bot | engineering/support | bulletin lookup success, reply failures, API dependency latency |

Every dashboard should include environment filters and request/correlation id lookup.

## Runbooks

Each deployable service must have a runbook before production routing.

Production incident command, runbook ownership, severity response behavior, incident evidence, drill cadence, and the required v1 runbook set are specified in `docs/superpowers/specs/2026-07-08-hhc-production-runbook-and-incident-operations-design.md`.

Recommended location:

```text
docs/runbooks/{service-name}.md
```

Minimum runbook sections:

- service purpose
- owners or escalation contacts
- dependencies
- health and ready checks
- dashboards
- alerts
- common failure modes
- verification commands
- rollback steps
- data recovery notes
- secrets/keys rotation notes
- known degraded modes

Required runbooks for v1:

| Runbook | Required Scenarios |
| --- | --- |
| `api-gateway.md` | bad route deploy, JWT verifier down, JWKS stale, host misroute, `/priv/*` probing |
| `account-api.md` | signing key rotation, refresh token reuse spike, login outage, JWKS outage |
| `hhc-web.md` | frontend rollback, admin host issue, sitemap/metadata issue |
| `hhc-web-api.md` | DB outage, Redis flush, projection rebuild, publish failure, seed rollback |
| `asset-api.md` | Blob outage, infected asset, scan backlog, bad grant, public URL failure |
| `notification-api.md` | provider outage, template error, retry backlog, callback signature issue |
| `audit-log.md` | append failure, query failure, partition issue, retention/export issue |
| `hhc-line-function-bot.md` | public API failure, command parse issue, reply failure |

Runbooks must be tested in staging for every production rollout phase that introduces a new service or critical route.

## Degraded Modes

The platform should fail closed for protected writes and security decisions, but can degrade for public reads.

| Failure | Allowed Degraded Mode | Not Allowed |
| --- | --- | --- |
| Redis unavailable | Read PostgreSQL/projections directly or rebuild cache | Returning stale private/draft content |
| PostgreSQL unavailable for public reads | Serve last-known public projection if available | Admin writes pretending to succeed |
| `asset-api` unavailable | Public pages render with missing/download-unavailable asset state | Exposing raw Blob URLs |
| Blob unavailable | Asset downloads return clear 503/temporary unavailable | Marking asset deleted or changing grants automatically |
| `notification-api` unavailable | Caller records outbox row and retries later | Dropping notification intent silently |
| `audit-log` unavailable | Caller records audit intent in local outbox | Protected write with no audit intent when the action requires audit |
| `account-api` unavailable | Gateway uses valid cached JWKS until max stale | Gateway calls account-api per request or accepts unknown keys |
| LINE bot dependency failure | Reply with temporary failure and support fallback | Directly scraping Blob or bypassing public API contract |

## Capacity And Load Testing

Load testing should focus on route classes, not every endpoint equally.

Required pre-production load tests:

- public home/news/bulletin reads
- public asset download route with small and PDF-sized files
- admin publish/unpublish flow at low concurrency
- asset upload session and complete flow
- worker retry under downstream outage simulation
- LINE weekly bulletin lookup

Initial sizing assumptions:

- Public API reads should be mostly projection/cache reads.
- Admin writes are low volume but must preserve correctness.
- Weekly bulletin downloads may spike after church communication or LINE bot use.
- Video content should remain external/provider linked unless a real need for video asset hosting appears.

Capacity rules:

- Document expected peak RPS before production launch.
- Keep PostgreSQL connection pool per replica within a global DB connection budget.
- Add a load-test gate before increasing ACA replica max.
- Prove workers use leases before scaling worker replicas above one.
- Confirm Blob egress and transaction costs before serving large files broadly.

## Cost And Quota Guardrails

Architecture should not accidentally create unmanaged cloud spend.

Guardrails:

- Set Blob lifecycle rules by asset namespace.
- Set max upload size by namespace.
- Keep video hosting outside `asset-api` unless explicitly approved.
- Use Redis for cache/ephemeral state only; avoid treating it as durable storage.
- Use ACA min replicas intentionally; allow non-critical non-prod services to scale down.
- Monitor Blob egress and storage growth monthly.
- Monitor notification provider spend by channel/template.
- Put hard or soft quotas on LINE group file storage before enabling it broadly.
- Review PostgreSQL storage, index bloat, and backup growth monthly.

Namespace examples:

| Namespace | Max Size | Retention/Cost Notes |
| --- | --- | --- |
| `cms.weekly.pdf` | 25 MB initial limit | Public downloads; keep indefinitely unless policy changes |
| `cms.news.cover` | 10 MB initial upload, derivative generated | Optimize images before public serving |
| `cms.page.image` | 10 MB initial upload, derivative generated | Avoid unbounded editor uploads |
| `line.group.file` | 25 MB initial limit | Must have per-group quota before broad launch |
| `desktop.cloud-folder.object` | not enabled in v1 | Requires explicit quota, sync, and retention design |

## Release Readiness Gate

Before a service receives production traffic, verify:

- SLO target is documented for its route classes.
- `/healthz` and `/readyz` are implemented.
- dashboard exists for the service.
- page-worthy alerts exist for critical failure modes.
- runbook exists.
- rollback steps are tested in staging.
- dependency failure behavior is tested.
- database migration rollback notes exist.
- restore test evidence exists for stateful services or is scheduled before production launch.
- cost-sensitive limits are configured.
- route policy and OpenAPI compatibility gates pass.

## Incident Severity

Use simple severity levels.

| Severity | Definition | Examples |
| --- | --- | --- |
| SEV1 | Public website, account/JWKS, or admin security path is broadly down or unsafe | Public site outage, gateway accepting invalid tokens, data exposure |
| SEV2 | Major feature down or important workflow blocked | Bulletin downloads fail, admin publish fails, asset download route fails |
| SEV3 | Degraded but workaround exists | Notification provider delayed, LINE bot command failing while website works |
| SEV4 | Low-risk defect or documentation/runbook gap | Dashboard missing one panel, noisy non-page alert |

SEV1 and SEV2 require a short post-incident note:

- impact window
- user-visible effect
- root cause
- mitigation
- follow-up owner
- prevention check

## Data Recovery Evidence

Detailed backup and DR evidence packet requirements live in `docs/superpowers/specs/2026-07-08-hhc-platform-backup-restore-and-disaster-recovery-design.md`.

Backups are not enough. The platform needs restore evidence.

Required evidence:

- PostgreSQL point-in-time restore tested in non-production at least quarterly.
- One service schema restore drill documented before production launch.
- Blob soft-delete/versioning behavior tested before public asset launch.
- Redis flush/rebuild test for public projections.
- Audit partition export/retention procedure tested before enabling partition drop.
- Account signing-key rollback tested without breaking active gateway validation.
- Restore drills start in quarantine with public ingress, provider sends, LINE webhooks, and retention workers disabled until lifecycle reconciliation finishes.
- Restore evidence records RPO target, actual recovery point, RTO target, actual restore duration, lifecycle replay result, public leakage checks, and promotion decision.
- Backup/DR evidence records PostgreSQL retention/redundancy posture, Blob data-protection posture, Redis rebuild result, outbox/provider side-effect classification, and promote/abandon/degraded decision.

## Best-Practice Guardrails Against Over-Splitting

Operational cost is part of architecture cost.

Before adding a new microservice, require:

- clear domain ownership separate from `hhc-web-api`
- independent data schema
- separate security/retention rules or external provider integration
- documented SLO and runbook
- deployment and rollback path
- alert ownership
- contract tests
- reason the capability cannot remain a module inside an existing service

If those cannot be answered, keep the feature as a module inside `hhc-web-api` or another owning service until the split is justified.

## Acceptance Criteria

- Every production deployable has a documented runbook path.
- Every Tier 0 and Tier 1 route class has an SLO target and alert policy.
- Alert list distinguishes page-worthy alerts from dashboard-only signals.
- Public read degraded mode is defined without exposing private/draft data.
- Protected writes fail closed or persist outbox/audit intent.
- Capacity tests cover public reads, asset downloads, admin publish, and worker retry.
- Worker/event releases include event schema compatibility, replay safety, dedupe, and classification evidence before production traffic.
- Cost guardrails exist for Blob, notification providers, Redis, ACA replicas, and future LINE group files.
- Stateful services expose lifecycle worker, legal-hold, retention, and restore-reconciliation health signals before production traffic.
- Backup/DR drills produce evidence packets with measured RPO/RTO, restore quarantine proof, negative leakage checks, and side-effect review before production traffic.
- `hhc-web-api` exposes publication workflow, grant-before-visible, stale cancellation, emergency takedown, and reconciliation signals before CMS publish traffic.
- Production-impacting releases expose revision, migration, config fingerprint, active flags/kill switches, and release manifest id in deployment evidence.
- Rollout matrix requires SLO/runbook/alert evidence before production traffic.
