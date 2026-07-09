# HHC Web Service Implementation Blueprint

## Purpose

This blueprint standardizes how the HHC platform services should be created, configured, tested, deployed, and connected. It complements the detailed architecture spec by turning service boundaries into repeatable implementation rules.

Use this document when creating or modifying:

- `api-gateway`
- `hhc-web`
- `hhc-web-api`
- `asset-api`
- `notification-api`
- `audit-log`
- `hhc-line-function-bot`

Gateway auth implementation rules are specified in `docs/superpowers/specs/2026-07-08-hhc-api-gateway-authentication-design.md`.

Account token, refresh, JWKS, and browser token-handling contracts are specified in `docs/superpowers/specs/2026-07-08-hhc-account-token-contract-design.md`.

Account administrator identity lifecycle, invitations, role assignment, suspend/disable/offboarding, account-domain APIs, and emergency access removal are specified in `docs/superpowers/specs/2026-07-08-hhc-account-admin-identity-rbac-lifecycle-design.md`.

Browser security headers, CORS, CSRF, CSP, cookie boundaries, and route-class cache behavior are specified in `docs/superpowers/specs/2026-07-08-hhc-web-browser-security-boundary-and-http-headers-design.md`.

Service catalog, reusable capability boundaries, allowed caller matrix, explicit v1 non-services, service admission gates, and extraction playbooks are specified in `docs/superpowers/specs/2026-07-08-hhc-service-catalog-and-ownership-design.md`.

Azure runtime topology, public ingress, Dapr, environment separation, data stores, secrets, networking, rollout, rollback, observability, backup, and recovery are specified in `docs/superpowers/specs/2026-07-08-hhc-cloud-runtime-operations-design.md`.

Cloud Infrastructure as Code, resource naming/tagging, canonical environment names, Azure DevOps workload identity, managed identities, role assignments, drift checks, and infra release gates are specified in `docs/superpowers/specs/2026-07-08-hhc-cloud-infrastructure-iac-and-resource-governance-design.md`.

Software supply chain, SBOM/provenance, container image digests, ACR governance, vulnerability gates, release manifests, and artifact signing roadmap are specified in `docs/superpowers/specs/2026-07-08-hhc-software-supply-chain-artifact-provenance-and-release-security-design.md`.

Platform backup, restore, RPO/RTO targets, restore quarantine, data-store recovery rules, outbox/provider recovery, and DR evidence packets are specified in `docs/superpowers/specs/2026-07-08-hhc-platform-backup-restore-and-disaster-recovery-design.md`.

SLO targets, service-level indicators, alert policy, dashboards, runbooks, degraded modes, capacity tests, and cost guardrails are specified in `docs/superpowers/specs/2026-07-08-hhc-platform-slo-observability-and-runbook-design.md`.

Production incident command, service runbooks, SEV response behavior, evidence capture, operational drills, and promotion gates are specified in `docs/superpowers/specs/2026-07-08-hhc-production-runbook-and-incident-operations-design.md`.

Data classification, privacy, retention, deletion, redaction, logging, and backup restore privacy rules are specified in `docs/superpowers/specs/2026-07-08-hhc-platform-data-classification-privacy-retention-design.md`.

Data lifecycle ledger, retention workers, legal hold checks, restore quarantine, and post-restore reconciliation rules are specified in `docs/superpowers/specs/2026-07-08-hhc-data-lifecycle-deletion-retention-and-restore-orchestration-design.md`.

Background jobs, scheduled tasks, manual/backfill jobs, service-owned workers, ACA Jobs selection, job ledgers, leases, checkpoints, and scheduler non-service decisions are specified in `docs/superpowers/specs/2026-07-08-hhc-background-jobs-scheduled-tasks-and-worker-orchestration-design.md`.

Shared API envelope, errors, pagination, idempotency, optimistic concurrency, headers, versioning, and OpenAPI rules are specified in `docs/superpowers/specs/2026-07-08-hhc-platform-api-standards-design.md`.

Internal service identity, `/priv/*` authorization, app-id allowlists, idempotency behavior, and staging smoke tests are specified in `docs/superpowers/specs/2026-07-08-hhc-internal-service-identity-and-private-route-design.md`.

Authorization policy, permission catalog, role/scope governance, resource-level authorization, policy drift checks, and authorization release gates are specified in `docs/superpowers/specs/2026-07-08-hhc-authorization-policy-and-permission-governance-design.md`.

Cross-service dependency rules, query ownership, consumer-owned read models, anti-corruption adapters, dependency-chain budgets, and dependency tests are specified in `docs/superpowers/specs/2026-07-08-hhc-cross-service-dependency-query-and-read-model-governance-design.md`.

OpenAPI ownership, generated client boundaries, compatibility checks, gateway policy comparison, fixture strategy, and contract review workflow are specified in `docs/superpowers/specs/2026-07-08-hhc-api-contract-governance-and-client-generation.md`.

Local developer profiles, CI test dependencies, fakes, deterministic seeds, local JWKS, staging smoke tests, and safe reset rules are specified in `docs/superpowers/specs/2026-07-08-hhc-local-development-and-test-environment-design.md`.

Typed config, env examples, secret handling, domain settings, feature flags, kill switches, provider adapter selection, config fingerprints, and release controls are specified in `docs/superpowers/specs/2026-07-08-hhc-platform-configuration-feature-flag-and-release-control-design.md`.

Deployment compatibility, release manifests, migration protocol, API/client compatibility, gateway release gates, ACA revision strategy, and rollback/roll-forward rules are specified in `docs/superpowers/specs/2026-07-08-hhc-deployment-compatibility-migration-and-release-governance-design.md`.

Gateway route classes, service-owned quotas, Redis counter boundaries, abuse metrics, notification/asset/LINE protections, and future public form controls are specified in `docs/superpowers/specs/2026-07-08-hhc-platform-abuse-prevention-rate-limit-and-quota-design.md`.

HHC web API module boundaries, public/admin route behavior, projection rules, and service extraction triggers are specified in `docs/superpowers/specs/2026-07-08-hhc-web-api-design.md`.

HHC web API PostgreSQL schema, indexes, constraints, outbox rows, seed provenance, and migration rules are specified in `docs/superpowers/specs/2026-07-08-hhc-web-api-postgresql-schema-design.md`.

Publication workflow consistency, grant-before-visible publish, stale side-effect cancellation, emergency takedown, and reconciliation rules are specified in `docs/superpowers/specs/2026-07-08-hhc-publication-workflow-consistency-and-reconciliation-design.md`.

Site settings, navigation, footer links, social links, contact display, shared layout projections, and runtime-config separation are specified in `docs/superpowers/specs/2026-07-08-hhc-site-settings-navigation-and-shared-layout-design.md`.

CMS revision snapshots, restore to draft, rollback publish, and revision retention are specified in `docs/superpowers/specs/2026-07-08-hhc-cms-content-versioning-rollback-design.md`.

CMS admin preview, draft rendering, revision preview, protected draft asset preview, no-store/noindex behavior, and public-leak prevention are specified in `docs/superpowers/specs/2026-07-08-hhc-cms-admin-preview-and-draft-rendering-design.md`.

CMS structured content block schema, render-ready body projections, link validation, body asset references, schema migrations, and safe renderer rules are specified in `docs/superpowers/specs/2026-07-08-hhc-cms-structured-content-blocks-and-renderer-design.md`.

CMS localization, source locale, translation status, stale translation, fallback policy, per-locale publish, localized slug, SEO alternate, and weekly bulletin locale rules are specified in `docs/superpowers/specs/2026-07-08-hhc-cms-localization-translation-and-locale-fallback-governance-design.md`.

Content migration/bootstrap, seed manifests, asset import, public API fixtures, and parity checks are specified in `docs/superpowers/specs/2026-07-08-hhc-content-migration-bootstrap-design.md`.

HHC web rendering/delivery, static-export cutover, host-aware public/admin UI routing, no-Next-API route policy, and frontend rollback are specified in `docs/superpowers/specs/2026-07-08-hhc-web-rendering-and-delivery-design.md`.

Public/admin search ownership, projection-derived public search documents, admin CMS search, CJK tokenization, and `search-api` extraction triggers are specified in `docs/superpowers/specs/2026-07-08-hhc-public-and-admin-search-design.md`.

LINE bot consumer boundaries are specified in `docs/superpowers/specs/2026-07-08-hhc-line-bot-platform-integration.md`.

Asset lifecycle and access rules are specified in `docs/superpowers/specs/2026-07-08-hhc-asset-lifecycle-and-access-design.md`.

Asset upload, scan, derivative, download streaming, range request, and worker pipeline rules are specified in `docs/superpowers/specs/2026-07-08-hhc-asset-ingestion-processing-download-design.md`.

Eventing, outbox, worker retry, and idempotency rules are specified in `docs/superpowers/specs/2026-07-08-hhc-platform-eventing-outbox-reliability.md`.

Event envelope, event naming, JSON Schema, compatibility, replay, privacy classification, and event release gates are specified in `docs/superpowers/specs/2026-07-08-hhc-event-contract-schema-and-replay-governance-design.md`.

Notification templates, providers, suppression, webhook, and delivery lifecycle rules are specified in `docs/superpowers/specs/2026-07-08-hhc-notification-api-design.md`.

Audit append, query, metadata, retention, and tamper-resistance rules are specified in `docs/superpowers/specs/2026-07-08-hhc-audit-log-design.md`.

Post-v1 domain split triggers are specified in `docs/superpowers/specs/2026-07-08-hhc-web-future-domain-extension-strategy.md`.

## Repository And Service Registry

| Service | Repo | Runtime | Public Ingress | Owns DB Schema | Main Responsibility |
| --- | --- | --- | --- | --- | --- |
| `api-gateway` | `C:\Users\IT\projects\api-gateway` | Nginx + Go verifier | yes | no | Public routing, local JWT verification, CORS/rate limit |
| `hhc-web` | `C:\Users\IT\projects\hhc-web` | Next.js/TypeScript | via gateway only, UI only | no | Public website and admin console frontend; Next server after CMS cutover |
| `account-api` | separate repo | Go or existing account runtime | account host via gateway only | `account` | Login, OIDC, token, refresh, profile, roles/scopes, invitations, admin identity lifecycle, JWKS |
| `hhc-web-api` | new repo | Go | via gateway only | `hhc_web` | Website CMS core, site settings, public read APIs, projections |
| `asset-api` | new repo | Go | via gateway only | `asset` | Uploads, metadata, grants, visibility, download policy |
| `notification-api` | new repo | Go | commands no; provider webhook via gateway optional | `notification` | Internal notification commands, templates, retry |
| `audit-log` | new repo | Go | no | `audit` | Internal append-only audit trail |
| `hhc-line-function-bot` | `C:\Users\IT\projects\hhc-line-function-bot` | Node/TypeScript | LINE webhook via gateway | existing app tables | LINE interactions and function router |

Do not create a standalone `cms-api` for v1. CMS modules live inside `hhc-web-api`.

## Standard Go Service Layout

Every new Go service should use the same layout unless there is a strong reason not to:

```text
api/events/
cmd/server/main.go
cmd/worker/main.go
cmd/job/main.go
internal/config/config.go
internal/http/routes.go
internal/http/middleware.go
internal/health/health.go
internal/db/db.go
internal/db/migrations/
internal/auth/identity.go
internal/authz/context.go
internal/authz/policy.go
internal/authz/decision.go
internal/dapr/client.go
internal/integrations/
internal/outbox/outbox.go
internal/jobs/registry.go
internal/jobs/runner.go
internal/jobs/ledger.go
internal/observability/logging.go
internal/observability/metrics.go
internal/clock/clock.go
internal/testutil/
README.md
azure-pipelines.yml
```

Service-specific packages should be domain-based, not technical-layer-only. Example for `hhc-web-api`:

```text
internal/news/
internal/pages/
internal/bulletins/
internal/site/
internal/blocks/
internal/preview/
internal/projections/
internal/search/
internal/assets/
internal/integrations/assetapi/
internal/integrations/notificationapi/
internal/integrations/auditlog/
internal/audit/
internal/seed/
```

Generated OpenAPI clients and provider-specific DTOs should stay inside `internal/integrations/{provider}/`. Domain packages depend on local interfaces and local DTOs so provider contract churn does not leak into service internals.

Example for `asset-api`:

```text
internal/assets/
internal/uploads/
internal/grants/
internal/downloads/
internal/blob/
internal/scanning/
```

## Common Runtime Conventions

### HTTP

Every service exposes:

- `GET /healthz`: process alive.
- `GET /readyz`: dependencies ready.
- `GET /metrics`: metrics endpoint when the runtime supports scraping.

All JSON APIs use the shared envelope:

```json
{
  "data": {},
  "meta": {
    "requestId": "req_123"
  },
  "error": null
}
```

### Logging

Logs must be structured JSON and include:

- `timestamp`
- `level`
- `service`
- `environment`
- `request_id`
- `route`
- `method`
- `status`
- `duration_ms`
- `caller_app_id` for internal calls
- `user_id` for protected user calls when available

Never log:

- Access tokens.
- Refresh tokens.
- Authorization headers.
- Upload URLs.
- Blob SAS URLs.
- Provider secrets.

### Request ID

Priority order:

1. Use `X-HHC-Request-ID` from gateway or internal caller.
2. Use W3C `traceparent` if present and derive a request id.
3. Generate a new request id.

Every service-to-service call must propagate request id.

## Common Environment Variables

All Go services:

```text
SERVICE_NAME=hhc-web-api
ENVIRONMENT=prod
HOST=0.0.0.0
PORT=8080
LOG_LEVEL=info
DATABASE_URL=...
DATABASE_SSL=true
REDIS_URL=...
REDIS_KEY_PREFIX=prod:hhc-web-api
DAPR_HTTP_PORT=3500
OTEL_EXPORTER_OTLP_ENDPOINT=...
```

Only set `REDIS_URL` for services that actually use Redis. `audit-log` should not require Redis in v1.

Only set caller allowlists per internal route group. Do not use one shared `ALLOWED_CALLER_APP_IDS` value for every service. Examples:

```text
ASSET_ALLOWED_CALLER_APP_IDS=hhc-web-api,hhc-line-function-bot
NOTIFICATION_ALLOWED_CALLER_APP_IDS=account-api,hhc-web-api
AUDIT_APPEND_ALLOWED_CALLER_APP_IDS=account-api,hhc-web-api,asset-api,notification-api,api-gateway
AUDIT_QUERY_ALLOWED_CALLER_APP_IDS=hhc-web-api
```

### Worker And Job Entry Points

Services with background work should expose explicit commands:

```text
SERVICE_NAME=hhc-web-api
WORKER_QUEUES=publication,projection,audit
JOB_NAME=publication-reconciliation
JOB_DRY_RUN=true
```

Rules:

- HTTP server, continuous worker, and finite job modes share code and image digest but use separate commands.
- Continuous workers use service-owned outbox/workflow tables.
- Manual and scheduled jobs write service-owned `job_run` ledger rows.
- Worker apps and ACA jobs have no public ingress.
- Production job params must not contain secrets.

### `api-gateway`

```text
OIDC_ISSUER=https://account.alive.org.tw
OIDC_AUDIENCE=hhc-api
JWKS_URL=https://account.alive.org.tw/.well-known/jwks.json
JWKS_CACHE_TTL=15m
JWKS_MAX_STALE=24h
JWT_VERIFIER_ADDR=127.0.0.1:10001
HHC_WEB_API_APP_ID=hhc-web-api
ASSET_API_APP_ID=asset-api
LINE_BOT_APP_ID=hhc-line-function-bot
```

### `account-api`

```text
OIDC_ISSUER=https://account.alive.org.tw
OIDC_AUDIENCE=hhc-api
ACCESS_TOKEN_TTL_SECONDS=900
REFRESH_TOKEN_TTL_DAYS=30
JWKS_KEY_ROTATION_ENABLED=true
ACCOUNT_INVITATION_TTL_HOURS=168
ACCOUNT_ADMIN_CORS_ORIGINS=https://admin.alive.org.tw
NOTIFICATION_API_APP_ID=notification-api
AUDIT_LOG_APP_ID=audit-log
```

Refresh token storage, rotation, revocation, JWKS rotation, and browser token handling follow `docs/superpowers/specs/2026-07-08-hhc-account-token-contract-design.md`. Invitation, role, session revocation, suspend, disable, and offboarding behavior follows `docs/superpowers/specs/2026-07-08-hhc-account-admin-identity-rbac-lifecycle-design.md`.

### `hhc-web-api`

```text
PUBLIC_BASE_URL=https://www.alive.org.tw
ASSET_API_APP_ID=asset-api
NOTIFICATION_API_APP_ID=notification-api
AUDIT_LOG_APP_ID=audit-log
CACHE_DEFAULT_TTL_SECONDS=1800
PUBLIC_CACHE_PREFIX=prod:hhc-web-api:public
ADMIN_CACHE_DISABLED=true
```

### `asset-api`

```text
PUBLIC_BASE_URL=https://www.alive.org.tw
AZURE_STORAGE_ACCOUNT_URL=https://<account>.blob.core.windows.net
AZURE_STORAGE_CONTAINER=assets
UPLOAD_URL_TTL_MINUTES=15
PUBLIC_DOWNLOAD_CACHE_SECONDS=600
MAX_UPLOAD_BYTES_DEFAULT=20000000
SCAN_MODE=async
AUDIT_LOG_APP_ID=audit-log
```

Use Azure managed identity for Blob access when possible. If a key is unavoidable in early development, store it in Azure Key Vault or ACA secrets and remove it from source-controlled config.

### `notification-api`

```text
NOTIFICATION_PROVIDER=azure-communication-email
NOTIFICATION_FROM_EMAIL=no-reply@alive.org.tw
NOTIFICATION_MAX_ATTEMPTS=5
NOTIFICATION_RETRY_BASE_SECONDS=30
AUDIT_LOG_APP_ID=audit-log
```

Provider-specific secrets must live in ACA secrets or Key Vault.

### `audit-log`

```text
AUDIT_RETENTION_DAYS=2555
AUDIT_QUERY_MAX_PAGE_SIZE=100
```

Seven-year retention is a reasonable default for admin/content audit unless the church chooses a different policy.

### `hhc-line-function-bot`

```text
HHC_WEB_API_BASE_URL=https://www.alive.org.tw/api
```

The weekly bulletin function uses the public API for public bulletins. Do not add `asset-api` credentials to the bot for public weekly downloads.

Add `asset-api` service invocation settings to the bot only when implementing LINE group file storage. That feature uses `asset-api /priv/assets/*` with app id `hhc-line-function-bot`, not public asset routes.

## Dapr App IDs And Internal ACLs

Use stable app ids:

| App ID | Service |
| --- | --- |
| `api-gateway` | gateway |
| `hhc-web` | public website and admin UI frontend |
| `hhc-web-api` | main website backend |
| `account-api` | account and token service |
| `asset-api` | asset service |
| `notification-api` | notification service |
| `audit-log` | audit service |
| `hhc-line-function-bot` | LINE bot |

Internal routes must check caller app id.

| Callee | Allowed Callers |
| --- | --- |
| `hhc-web-api /priv/*` | none in v1 unless a route-specific contract is added |
| `asset-api /priv/assets/*` | `hhc-web-api`, `hhc-line-function-bot`, future trusted app ids |
| `notification-api /priv/notifications/*` | `account-api`, `hhc-web-api`, future event services |
| `audit-log /priv/audit/*` | `hhc-web-api`, `asset-api`, `notification-api`, `account-api`, `api-gateway` when needed |

Public gateway must reject `/priv/*` and `/api/priv/*` before upstream routing.

Only `api-gateway` should have external ingress for platform API traffic in v1. Backend API services should use internal ingress and Dapr/app-id authorization.

## Database And Migrations

### Ownership

Each service owns one schema:

- `hhc-web-api`: `hhc_web`
- `asset-api`: `asset`
- `notification-api`: `notification`
- `audit-log`: `audit`
- `account-api`: `account`

Services must not query another service's schema directly.

Services must not read another service's Redis key prefix, Blob path convention, migration files, or private read model directly. Cross-service data access goes through public APIs, `/priv/*` commands, events, or explicitly owned read models.

`hhc-web-api` migrations must create the hybrid shared-content plus module-detail schema defined in `docs/superpowers/specs/2026-07-08-hhc-web-api-postgresql-schema-design.md`.

### Migration Rules

Use expand-contract:

1. Add nullable columns/tables/indexes first.
2. Deploy code that writes both old and new fields when needed.
3. Backfill in a separate job.
4. Switch reads to new fields.
5. Remove old fields in a later release.

Production migrations must be:

- Idempotent or migration-tool tracked.
- Backed by automated tests.
- Run before app rollout when they are additive.
- Run in a controlled maintenance step when they are large or locking.
- Classified in the release manifest with rollback or roll-forward strategy.

Do not run destructive migrations automatically in the same deploy that introduces the replacement.

## OpenAPI And Client Generation

Each Go service that exposes HTTP contracts must publish an OpenAPI document:

```text
api/openapi.yaml
```

Rules:

- Public/admin route contracts must match `docs/api/*.md`.
- OpenAPI changes must pass compatibility checks before service rollout.
- Generated client code must compile in each consumer repo before promotion.
- Gateway route metadata should be comparable with OpenAPI `x-hhc-*` extensions.
- Generated TypeScript clients should live in `hhc-web` only after contracts stabilize.
- Internal `/priv/*` clients can be hand-written in Go first; generate later if duplication appears.
- Breaking API changes require either additive migration or a new route version.

Do not introduce `/api/v1` unless an actual breaking versioning need appears. Keep paths stable and evolve additively first.

## CI/CD Standards

Every service pipeline should include:

1. Format check.
2. Lint/static analysis.
3. Unit tests.
4. Integration tests with ephemeral PostgreSQL/Redis/Blob adapters or explicit fakes from the local/test environment spec.
5. Migration dry-run or migration test.
6. OpenAPI validation and compatibility check for API-owning services.
7. Event JSON Schema validation and compatibility check for event-producing services.
8. Authorization policy drift check for role bundles, gateway route policy, service action registry, OpenAPI route metadata, docs, and admin UI capability map.
9. Generated client compile check for consumer repos when contracts changed.
10. Secret, dependency, license, Dockerfile, and IaC/config scans where applicable.
11. Container build.
12. SBOM/provenance metadata generation.
13. Image vulnerability scan.
14. Push to private ACR and capture immutable image digest.
15. Staging deployment by image digest.
16. Smoke tests.
17. Release manifest generation.
18. Manual or protected production promotion by the same image digest for high-impact services.
19. Worker/job smoke when worker commands, schedules, job definitions, or outbox destinations changed.

Path filters should prevent unrelated deployments.

Production-impacting releases must produce a release manifest with image repository, image tag, immutable image digest, source commit, pipeline run id, SBOM/provenance artifact reference, scan results, signature status, OpenAPI version, migration version, config fingerprint, affected feature flags, gateway route policy version, rollback target, and smoke evidence.

Production promotion deploys the same image digest that passed staging. Do not rebuild for production after staging approval.

When a release changes authorization behavior, the manifest must include `authz_policy` evidence: policy diff, affected route/action list, role/scope diff, gateway comparison, service authorization tests, object-level access tests, field-level redaction tests, and rollback or roll-forward plan.

When a change adds or modifies a service dependency, CI must also verify:

- dependency register updated
- adapter package has timeout, retry, idempotency, and error mapping tests
- provider-down path is covered
- no new public request path creates multi-service fan-out unless explicitly approved
- read model schema includes source service, source version, data classification, freshness, rebuild, and deletion/redaction fields when duplicated data is introduced

When a change adds or modifies a worker or job, CI must also verify:

- job owner and runtime pattern are documented
- job ledger migration exists for manual/scheduled/backfill jobs
- lease, idempotency, retry, dead-letter, and checkpoint tests exist
- schedule has concurrency and missed-run policy
- worker pause/kill switch is documented when production risk requires it
- staging worker/job smoke produces run evidence

Production-impacting services:

- `api-gateway`
- `account-api`
- `hhc-web-api`
- `asset-api`
- `notification-api`
- `audit-log`
- `hhc-line-function-bot`

Gateway changes need extra caution because route mistakes affect all public APIs.

Future services such as `engagement-api`, `event-api`, `member-api`, `group-api`, `pastoral-care-api`, `donation-api`, and `search-api` must not be added to deployment pipelines until their split trigger is met and their API contract, schema ownership, route policy, and rollback plan are documented.

They must also pass the service catalog admission gate: source-of-truth ownership, caller allowlist, data classification, authorization policy, SLO tier, runbook, release manifest, and dependency-register updates.

CI must not require production secrets or live provider credentials. Use the documented local JWKS issuer, Testcontainers or ephemeral containers, Azurite/fake Blob, fake notification providers, fake scanners, and deterministic seed fixtures for repeatable verification.

## Test Matrix

### Unit Tests

Required for:

- JWT claim parsing and route policy.
- Authorization policy registry, unknown action deny, missing scope deny, object-level access, and field-level redaction.
- CMS validation.
- Structured content block validation, link validation, schema-version handling, render model conversion, and body asset reference extraction.
- Search text extraction, CJK token generation, public/admin search document validation, and stale projection-version filtering when search is enabled.
- Site settings validation for public links, route policy, SEO defaults, and secret/internal URL exclusion.
- CMS preview validation for draft/revision mode, structured blocks, asset preview eligibility, and no public side effects.
- Content seed manifest validation and idempotent upsert rules.
- Bulletin publish state machine.
- Publication workflow state transitions, required-asset classification, stale workflow cancellation, and emergency takedown policy.
- Content revision snapshot, restore, and rollback rules.
- Asset visibility and grant decisions.
- Notification retry policy.
- Audit event validation.
- CloudEvents-compatible envelope construction, event type naming, classification, visibility, and schema validation for produced events.
- LINE bot weekly bulletin argument parsing and reply formatting.

### Contract Tests

Required for:

- `hhc-web` client against public API envelope.
- `hhc-web` client against `GET /api/site-layout` for header/footer/navigation/social/contact display.
- `hhc-web` rich content renderer against public/admin render model fixtures for every v1 structured block type.
- `hhc-web` public search adapter against `GET /api/search` fixtures when search UI is enabled.
- `hhc-web` rendering/delivery host rules: public/admin UI hosts, no Next platform API routes, admin no-store/noindex.
- Admin client against admin API errors.
- Admin preview client against `GET /api/admin/preview/*`.
- Gateway/OpenAPI/service authorization metadata consistency for protected routes.
- `hhc-line-function-bot` against `GET /api/bulletins/latest` and `GET /api/bulletins/{issueDate}`.
- `hhc-web-api` internal client against `asset-api` grant/public-url commands.
- Event producers against committed event JSON Schemas and examples.
- Event consumers against old and current event fixtures within the compatibility window.
- Seed-generated public API fixtures against current `hhc-web` TypeScript feature shapes.

### Integration Tests

Required for:

- `hhc-web-api` with PostgreSQL and Redis.
- `hhc-web-api` protected routes reject missing trusted headers, missing scopes, object-level probing, and disallowed resource states.
- `hhc-web-api` seed import with PostgreSQL, Redis, and asset-api test double.
- `hhc-web-api` structured content publish with body asset refs, public grants, and render-ready projection payloads.
- `hhc-web-api` weekly bulletin publish stays hidden from public latest until `asset-api` grant succeeds.
- `hhc-web-api` stale publish workflow after unpublish or rollback does not recreate public projection or grant.
- `hhc-web-api` publication reconciliation repairs missing required grants and removes stale projections/search/sitemap rows.
- `hhc-web-api` public search document generation from active public projections when search is enabled.
- `hhc-web-api` restore-to-draft and rollback-publish with PostgreSQL, Redis, and asset-api test double.
- `hhc-web-api` site settings publish/rollback with PostgreSQL and Redis.
- `hhc-web-api` admin preview with PostgreSQL, Redis assertion for no public writes, and asset-api test double.
- `asset-api` with PostgreSQL and Blob adapter test double.
- `notification-api` with PostgreSQL and provider test double.
- `audit-log` with PostgreSQL.
- Outbox replay with current and previous event fixtures proves idempotent consumers do not re-run unsafe external side effects.

### End-To-End Smoke Tests

Staging smoke tests must prove:

- `GET https://www.alive.org.tw/api/home` returns public data.
- `GET https://www.alive.org.tw/api/site-layout` returns public layout data and no secret/internal/admin/private route values.
- `GET https://www.alive.org.tw/zh-Hant` renders through `hhc-web`.
- `GET https://admin.alive.org.tw/zh-Hant/admin` renders the admin shell.
- `GET https://admin.alive.org.tw/api/anything` is rejected.
- `GET /api/bulletins/latest` returns published bulletin or clean `404`.
- `GET /api/assets/public/{assetId}` downloads a published, clean asset.
- `GET /api/admin/content` without token returns `401`.
- `GET /api/admin/preview/content/{id}` returns no-store/noindex render model for an authorized draft and no public route exposes that draft.
- Public content routes render structured body blocks without raw HTML, unsafe links, Blob/SAS URLs, or unsupported block types.
- Valid admin token reaches `hhc-web-api`.
- Public `/priv/*` returns blocked status.
- LINE bot weekly bulletin function can fetch a known published bulletin in test.
- Seeded public projections render current website routes for `zh-Hant`, `zh-Hans`, and `en`.

## Security Standards

- Store secrets in ACA secrets or Key Vault.
- Enforce authorization in backend services even when gateway already checked route scopes.
- Prefer managed identity for Azure Blob and Azure Database where feasible.
- Never pass Blob SAS URLs to public clients.
- Never log tokens, secrets, upload URLs, or SAS URLs.
- Rate-limit public APIs and webhooks at gateway.
- Validate MIME type using server-side detection, not only client-provided header.
- Scan assets before granting public read.
- Use least-privilege app-id allowlists for `/priv/*`.
- Require idempotency keys for side-effecting internal commands.

## Observability Standards

Metrics:

- Request count, latency, status code by route group.
- DB latency and error count.
- Redis hit/miss/error.
- Blob operation latency/error.
- Outbox pending count and retry count.
- Notification queued/sent/failed.
- Asset scan pending/infected/failed.

Alerts:

- Gateway 5xx above threshold.
- JWT verifier cannot refresh JWKS.
- `hhc-web-api` ready check fails.
- Asset download 5xx spike.
- Outbox retry backlog growing.
- Notification permanent failure spike.
- Audit-log write failures.

Dashboards:

- Public API health.
- Admin API health.
- Asset service health.
- Worker/outbox health.
- LINE bot dependency health.

## Backup And Recovery

Detailed backup, restore, RPO/RTO, and DR drill requirements live in `docs/superpowers/specs/2026-07-08-hhc-platform-backup-restore-and-disaster-recovery-design.md`. Service implementations must provide the service-owned reconciliation pieces required by that spec.

PostgreSQL:

- Enable point-in-time restore.
- Record backup retention and backup redundancy decisions in IaC.
- Test restore in non-production at least quarterly.
- Keep migration rollback notes for every production release.
- Restore into quarantine first and run lifecycle reconciliation before enabling public ingress.
- Services with deletion/redaction/retention behavior keep lifecycle ledger events long enough to replay privacy state after restore.

Blob:

- Enable container soft delete and blob soft delete for production asset storage.
- Enable versioning or point-in-time restore where cost and storage-account constraints justify it.
- Keep retention/lifecycle policy aligned with asset namespace.
- Reconcile restored bytes with asset metadata, grants, scan state, deleted state, legal holds, and owner references before public downloads.

Redis:

- Treat Redis as cache/ephemeral state.
- Public projections must be rebuildable from PostgreSQL.
- Do not store unrecoverable queue state, role state, asset grants, or publication truth only in Redis.

Audit:

- Append-only.
- Backed up with PostgreSQL.
- Corrections are new events, not edits.
- Audit exports may use immutable Blob storage when retention policy requires it.

## Service Creation Checklist

Before a new backend service is considered ready:

- Repo exists with standard layout.
- `/healthz` and `/readyz` implemented.
- Config validates required env vars at startup.
- Safe env examples, config fingerprint, feature flag registry, and kill-switch registry exist where applicable.
- Local profile and test-harness requirements are documented.
- Database schema migration exists.
- IaC resource, identity, tag, and role-assignment changes are represented in the infra repo or service-local IaC as allowed by the infrastructure governance spec.
- No cross-schema DB access.
- No direct cross-service Redis, Blob, or private read-model access exists.
- Service catalog entry or service-local equivalent exists for every deployable and every new internal dependency.
- Service dependency register lists every synchronous dependency and outbox destination.
- Cross-service clients live behind `internal/integrations/*` anti-corruption adapters.
- Authorization registry exists for protected route actions, object-level resource checks, field-level redaction, and denied-path tests.
- Event producers own `api/events/` JSON Schemas, examples, compatibility tests, replay tests, and data classification review.
- Structured logs include request id.
- Internal routes enforce app-id allowlist.
- Public routes, if any, are only reachable through gateway.
- Unit, integration, and smoke tests exist.
- Rate-limit and quota behavior is documented and tested for public, admin, internal, asset, notification, LINE, or provider-facing routes as applicable.
- Azure pipeline has path filters.
- Production-impacting pipeline can produce release manifest, compatibility evidence, image digest, SBOM/provenance reference, and scan evidence.
- Production deployments use immutable image digests, not mutable tags such as `latest`, `main`, `staging`, or `prod`.
- Worker/job changes can produce job definition, schedule, command, staging run, job ledger, and rollback/roll-forward evidence.
- Pipeline deployment identity uses workload identity federation or another approved secretless model for Azure access.
- Secrets are not in repo.
- Fake providers, local hosts, wildcard CORS, and disabled-auth defaults are rejected in production config.
- SLO target, dashboard, page-worthy alerts, and runbook exist.
- Dependency latency, dependency error, circuit-breaker, outbox, and read-model-lag metrics exist where applicable.
- Field-level data classification and retention rules exist for non-public data.
- Lifecycle ledger, retention worker, legal hold, and restore reconciliation behavior exist where the service stores non-public or recoverable data.
- Publication workflow, grant-before-visible behavior, stale side-effect cancellation, and reconciliation exist where the service exposes CMS content with required public assets.
- Runbook documents deploy, rollback, and dependency checks.
