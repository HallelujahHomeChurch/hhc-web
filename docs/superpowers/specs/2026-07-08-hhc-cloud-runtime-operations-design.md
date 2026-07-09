# HHC Cloud Runtime And Operations Design

## Purpose

This spec defines how the HHC web platform should run on Azure without weakening the service boundaries defined in the application architecture.

It covers:

- Azure Container Apps topology.
- Public ingress and custom domains.
- Dapr service invocation.
- PostgreSQL, Redis, Blob Storage, and Key Vault ownership.
- Secrets and managed identity.
- Environment separation.
- CI/CD, migrations, rollout, rollback, observability, backup, and recovery.

The goal is not to make Azure-specific business logic. Domain services should stay portable at the code level while the runtime uses Azure-managed infrastructure.

## Core Runtime Decision

Use Azure Container Apps for `api-gateway`, `hhc-web`, `account-api`, `hhc-web-api`, `asset-api`, `notification-api`, `audit-log`, and `hhc-line-function-bot`.

The finite v1 deployable set, reusable capability boundaries, allowed caller matrix, explicit non-services, and service admission/extraction gates are specified in `docs/superpowers/specs/2026-07-08-hhc-service-catalog-and-ownership-design.md`. Cloud runtime topology must not add a new app that has not passed that catalog gate.

Infrastructure as Code, resource naming/tagging, canonical environment names, Azure DevOps workload identity, managed identities, role assignments, drift checks, and infra release gates are specified in `docs/superpowers/specs/2026-07-08-hhc-cloud-infrastructure-iac-and-resource-governance-design.md`.

Production go-live, DNS, TLS, custom domains, first admin bootstrap, HSTS staging, traffic cutover, Front Door/CDN adoption gates, and launch rollback rules are specified in `docs/superpowers/specs/2026-07-08-hhc-production-go-live-edge-routing-and-cutover-design.md`.

Platform backup, restore, RPO/RTO targets, restore quarantine, data-store recovery, and DR drill evidence are specified in `docs/superpowers/specs/2026-07-08-hhc-platform-backup-restore-and-disaster-recovery-design.md`.

`hhc-web` rendering, host-aware public/admin UI delivery, static-export cutover, and frontend rollback rules are specified in `docs/superpowers/specs/2026-07-08-hhc-web-rendering-and-delivery-design.md`.

Internal service identity, `/priv/*` authorization, app-id allowlists, and Dapr caller rules are specified in `docs/superpowers/specs/2026-07-08-hhc-internal-service-identity-and-private-route-design.md`.

SLO targets, alert policy, dashboards, runbooks, degraded modes, capacity tests, and cost guardrails are specified in `docs/superpowers/specs/2026-07-08-hhc-platform-slo-observability-and-runbook-design.md`.

Production incident command, service runbooks, incident evidence, operational drills, and promotion gates are specified in `docs/superpowers/specs/2026-07-08-hhc-production-runbook-and-incident-operations-design.md`.

Data lifecycle, deletion, retention, legal hold, restore quarantine, and post-restore reconciliation are specified in `docs/superpowers/specs/2026-07-08-hhc-data-lifecycle-deletion-retention-and-restore-orchestration-design.md`.

Background jobs, scheduled tasks, manual/backfill jobs, service-owned worker deployments, ACA Jobs selection, worker leases, job ledgers, and scheduler non-service decisions are specified in `docs/superpowers/specs/2026-07-08-hhc-background-jobs-scheduled-tasks-and-worker-orchestration-design.md`.

Local developer profiles, CI test dependencies, deterministic seeds, local JWKS, fakes, and staging smoke behavior are specified in `docs/superpowers/specs/2026-07-08-hhc-local-development-and-test-environment-design.md`.

Typed config, secret handling, provider adapters, feature flags, kill switches, config fingerprints, and release controls are specified in `docs/superpowers/specs/2026-07-08-hhc-platform-configuration-feature-flag-and-release-control-design.md`.

Deployment compatibility, release manifests, migration protocol, API/client compatibility, gateway release gates, ACA revision strategy, and rollback/roll-forward rules are specified in `docs/superpowers/specs/2026-07-08-hhc-deployment-compatibility-migration-and-release-governance-design.md`.

Software supply chain, SBOM, provenance, container image digest promotion, ACR governance, vulnerability gates, and release artifact security are specified in `docs/superpowers/specs/2026-07-08-hhc-software-supply-chain-artifact-provenance-and-release-security-design.md`.

Abuse prevention, route-class limits, Redis counter boundaries, WAF adoption criteria, asset egress protection, and provider-facing quota rules are specified in `docs/superpowers/specs/2026-07-08-hhc-platform-abuse-prevention-rate-limit-and-quota-design.md`.

Asset upload target issuance, Blob key layout, scan/processing workers, download streaming, range requests, and asset pipeline failure modes are specified in `docs/superpowers/specs/2026-07-08-hhc-asset-ingestion-processing-download-design.md`.

Recommended v1 topology:

```text
Internet
  -> api-gateway external ingress
      -> hhc-web internal app for UI routes
      -> account-api internal app for account host routes
      -> hhc-web-api internal app for /api/home, /api/admin, /api/bulletins, ...
      -> asset-api internal app for /api/assets/*
      -> hhc-line-function-bot internal app for /api/line/webhook/*
      -> notification-api internal app for signed provider callbacks only if enabled
```

Internal service calls:

```text
service -> Dapr service invocation -> callee /priv/*
```

Service-owned worker Container Apps and ACA Jobs may be deployed for the same owning service when worker scaling or finite scheduled/manual work needs isolation. They are runtime shapes under the owning service, not new microservices.

Rejected alternatives:

- Public ingress on every API service: easier to debug, but increases exposure and makes `/priv/*` harder to prove internal-only.
- Kubernetes from day one: more control, but unnecessary operational load for the current platform size.
- Azure Functions for every service: good for isolated jobs, but less natural for long-lived service boundaries, Dapr invocation, and shared Go service patterns.

## Public Ingress

`api-gateway` is the only Azure Container App with external ingress for platform traffic in v1.

Custom domain handling:

| Host | Gateway behavior |
| --- | --- |
| `www.alive.org.tw` | Serve public website UI routes and all non-account `/api/*` routes |
| `admin.alive.org.tw` | Serve admin UI only; reject or redirect `/api/*` |
| `account.alive.org.tw` | Route account UI/API/OIDC/JWKS to `account-api` |

DNS, TLS certificate, HSTS, custom-domain binding, Front Door/CDN adoption, and production traffic switch details follow the production go-live design. This runtime spec defines the steady-state topology; the go-live design defines the controlled cutover procedure.

Rules:

- Do not create or use `api.alive.org.tw`.
- All non-account API routes stay under `www.alive.org.tw/api/*`.
- `admin.alive.org.tw` must not expose backend API routes.
- Public gateway blocks `/priv/*` and `/api/priv/*` before upstream selection.
- Client-supplied identity headers are stripped at gateway.
- Only gateway-produced `X-HHC-*` headers may reach upstream services.

If a future static hosting or CDN option serves UI assets directly, the same API rules remain: non-account APIs still go through `www.alive.org.tw/api/*`, and UI hosts must not expose independent backend routes.

## Container Apps

Recommended apps:

| App | Ingress | Dapr app id | Scale trigger |
| --- | --- | --- | --- |
| `api-gateway` | external | `api-gateway` | HTTP concurrency |
| `hhc-web` | internal | `hhc-web` | Next.js server HTTP concurrency |
| `account-api` | internal behind gateway | `account-api` | HTTP concurrency |
| `hhc-web-api` | internal behind gateway | `hhc-web-api` | HTTP concurrency + worker backlog |
| `asset-api` | internal behind gateway | `asset-api` | HTTP concurrency + worker backlog |
| `notification-api` | internal, optional signed callback through gateway | `notification-api` | queue/outbox backlog + HTTP concurrency |
| `audit-log` | internal only | `audit-log` | HTTP concurrency |
| `hhc-line-function-bot` | internal behind gateway for webhook | `hhc-line-function-bot` | HTTP concurrency |

Service-owned worker deployments and jobs:

| Runtime Shape | Owner | Ingress | Scale/Trigger |
| --- | --- | --- | --- |
| `hhc-web-api-worker` | `hhc-web-api` | none | outbox/workflow backlog |
| `asset-api-worker` | `asset-api` | none | scan/derivative/cleanup backlog |
| `notification-api-worker` | `notification-api` | none | send/retry backlog |
| `audit-log-worker` | `audit-log` | none | retention/export schedule |
| service-owned ACA job | owning service | none | manual, schedule, or event trigger |

Only deploy separate workers when the worker design spec's selection rules justify independent scaling, isolation, or finite execution. Otherwise, low-volume workers can start inside the owning service app.

Container requirements:

- Expose `/healthz` for liveness.
- Expose `/readyz` for dependency readiness.
- Emit structured JSON logs to stdout.
- Use OpenTelemetry-compatible tracing/metrics.
- Run as non-root where image/runtime allows it.
- Use read-only filesystem where practical.
- Do not bake secrets into images.

## Dapr And Internal Calls

Use Dapr service invocation for service-to-service calls.

The detailed authorization model for these calls is `docs/superpowers/specs/2026-07-08-hhc-internal-service-identity-and-private-route-design.md`. Dapr proves the caller app id; each callee still enforces route-specific authorization and domain ownership.

Required behavior:

- Every service has a stable app id.
- Internal `/priv/*` handlers validate caller app id.
- Dapr/mTLS/app-id identity is separate from browser user identity.
- Public gateway never forwards external traffic to `/priv/*`.
- Request id and trace context propagate through Dapr calls.

Allowed internal call map:

| Callee | Allowed callers |
| --- | --- |
| `asset-api /priv/assets/*` | `hhc-web-api`, `hhc-line-function-bot`, future approved owners |
| `notification-api /priv/notifications/*` | `account-api`, `hhc-web-api`, future event/engagement services |
| `audit-log /priv/audit/*` | `account-api`, `hhc-web-api`, `asset-api`, `notification-api`, `api-gateway` for security events |
| `hhc-web-api /priv/*` | none in v1 unless a specific contract is added |

Do not use Dapr as a way to bypass domain ownership. Dapr handles transport identity; each service still owns authorization and business validation.

## Environment Separation

Use at least:

- `dev`: local developer environment.
- `staging`: production-like Azure environment for verification.
- `prod`: production Azure environment.

Recommended Azure separation:

| Resource type | Staging | Production |
| --- | --- | --- |
| Container Apps environment | separate | separate |
| PostgreSQL database | separate DB or server | separate server preferred |
| Redis | separate instance/database | separate instance preferred |
| Blob storage | separate account/container | separate account/container preferred |
| Key Vault | separate vault | separate vault |
| Managed identities | separate identities | separate identities |

Never share production PostgreSQL, Redis, Blob containers, or Key Vault secrets with staging.

Use environment-specific prefixes:

```text
ENVIRONMENT=staging
REDIS_KEY_PREFIX=staging:hhc-web-api
BLOB_CONTAINER=assets-staging
PUBLIC_BASE_URL=https://www-test.alive.org.tw
```

Production uses:

```text
ENVIRONMENT=prod
REDIS_KEY_PREFIX=prod:hhc-web-api
BLOB_CONTAINER=assets
PUBLIC_BASE_URL=https://www.alive.org.tw
```

## Data Stores

### PostgreSQL

Use Azure Database for PostgreSQL Flexible Server.

Rules:

- Each service owns one schema.
- Services must not cross-query another service's schema.
- Migrations are service-owned and deployed with the service pipeline.
- Backward-compatible migrations are required before traffic shifts.
- Destructive migrations require a documented rollback and backup point.
- Outbox tables live in the producer service schema.

Recommended schemas:

| Service | Schema |
| --- | --- |
| `account-api` | `account` |
| `hhc-web-api` | `hhc_web` |
| `asset-api` | `asset` |
| `notification-api` | `notification` |
| `audit-log` | `audit` |
| `hhc-line-function-bot` | existing bot schema or bot-owned schema |

Connection rules:

- Use TLS.
- Prefer managed identity authentication where feasible.
- Otherwise store credentials in Key Vault or ACA secrets.
- Use connection pooling appropriate to ACA replica count.
- Set per-service max connection budgets so autoscaling cannot exhaust PostgreSQL.

### Redis

Use Azure Cache for Redis for:

- public projection cache
- short-lived JWKS/denylist cache if kept gateway-owned
- rate-limit or ephemeral coordination if needed

Do not store source-of-truth data in Redis.

Rules:

- All keys include environment and service prefix.
- Public projections can be rebuilt from PostgreSQL.
- Redis flush must not cause data loss.
- Admin APIs are never CDN-cacheable and should not rely on Redis for authorization truth.

### Blob Storage

Use Azure Blob Storage behind `asset-api`.

Rules:

- Only `asset-api` accesses Blob for platform-managed assets.
- Public clients receive gateway URLs, not Blob URLs or SAS URLs.
- Prefer managed identity for Blob access.
- Blob container names are environment-specific.
- Enable soft delete/versioning where cost is acceptable.
- Virus scan/processing state lives in `asset-api` PostgreSQL, not Blob metadata alone.

### Key Vault And Secrets

Use Azure Key Vault or ACA secrets for:

- database credentials when managed identity is not available
- provider API keys
- notification provider secrets
- LINE channel secrets and tokens
- account signing key material if managed outside a dedicated key service
- webhook signing secrets

Rules:

- Prefer managed identity over static keys.
- Never store secrets in repo, image, profile JSON, or normal app config.
- Rotate provider and signing secrets through a documented procedure.
- App code logs secret references, not secret values.

## Networking

Recommended:

- Put Container Apps environment, PostgreSQL, Redis, and storage private access inside a controlled network where feasible.
- Use private endpoints for PostgreSQL, Redis, Blob, and Key Vault when the Azure subscription/network setup supports it.
- Restrict PostgreSQL and Redis firewall rules to the application environment.
- Keep only gateway external ingress public.
- Provider callbacks, if needed, enter through gateway routes with signed verification.

If private endpoints are not available in the first rollout, document the temporary public firewall rules and remove them after private networking is ready.

## CI/CD

Use Azure DevOps pipelines with path filters.

Artifact trust, SBOM/provenance evidence, vulnerability gates, ACR access, and digest-based promotion follow `docs/superpowers/specs/2026-07-08-hhc-software-supply-chain-artifact-provenance-and-release-security-design.md`.

Each service pipeline should include:

1. lint
2. unit tests
3. build
4. secret, dependency, license, Dockerfile, and IaC/config scans where applicable
5. migration dry-run
6. integration tests with service dependencies or explicit test doubles
7. container build
8. SBOM and provenance metadata generation
9. image vulnerability scan
10. push image to private ACR and capture immutable digest
11. deploy the captured digest to staging
12. staging smoke tests
13. release manifest generation with image digest, SBOM, scan result, config fingerprint, and rollback target
14. protected production promotion using the same image digest

Path filter principle:

- Gateway changes deploy gateway only.
- `hhc-web` UI changes deploy UI only unless API contract changes.
- A service changes deploy that service only.
- Shared docs do not auto-deploy production.

Gateway, account token contract, asset grants, and audit changes are production-impacting and require explicit promotion.

CI must run without production secrets. Local/test dependencies should follow the shared environment design: ephemeral PostgreSQL and Redis, Azurite or fake Blob, fake notification providers, fake scanners, fake LINE API fixtures, and a generated local JWKS issuer. Staging smoke tests are the first layer that may touch staging cloud resources.

Production promotion must deploy the same image digest that passed staging. Do not rebuild for production after staging approval unless a new release manifest and approval are produced.

Production deployment must fail fast if typed config validation detects fake providers, local/test resource URLs, missing Key Vault-backed secrets, wildcard credentialed CORS, disabled auth defaults, or unknown environment names.

## Migration And Rollout Pattern

Detailed release class, manifest, compatibility window, migration, contract, gateway, feature flag, and rollback/roll-forward rules are specified in `docs/superpowers/specs/2026-07-08-hhc-deployment-compatibility-migration-and-release-governance-design.md`.

Use expand/contract migrations:

1. Add new nullable columns/tables/indexes.
2. Deploy code that writes both old and new shapes when needed.
3. Backfill in a worker or migration job.
4. Switch reads to new shape.
5. Remove old shape only after one stable production release.

Rollout order:

1. Create release manifest and classify release risk.
2. Deploy additive database migration.
3. Deploy service revision with zero or low traffic.
4. Run `/readyz`.
5. Run smoke tests.
6. Shift traffic gradually where ACA revision routing is used.
7. Monitor errors, latency, dependency health, workers, and release-specific business signals.
8. Keep rollback revision until the release is stable.

Do not deploy gateway route changes to production until the upstream service revision is live and verified in staging.

## Scaling

Baseline:

- `api-gateway`: minimum 1 production replica, scale by HTTP concurrency.
- `hhc-web`: minimum 1 production replica, scale by HTTP concurrency.
- `account-api`: minimum 1 production replica, scale by HTTP concurrency.
- `hhc-web-api`: minimum 1 production replica, scale by HTTP concurrency and outbox backlog.
- `asset-api`: minimum 1 production replica, scale by HTTP concurrency and upload/processing backlog.
- `notification-api`: can scale to zero in non-prod, but production should keep enough capacity for retry workers if notifications are enabled.
- `audit-log`: minimum 1 production replica if protected write auditing is enabled.
- service-owned worker apps: scale on backlog age/count, queue depth, or schedule/job execution rules, not public HTTP concurrency.
- service-owned ACA jobs: finite execution only; manual/scheduled/event triggers are declared in IaC and recorded in service-owned job ledgers.

Scaling constraints:

- Set PostgreSQL connection budgets before increasing replica limits.
- Workers must use leases so multiple replicas do not process the same outbox row.
- Audit and notification workers must be idempotent.
- Scheduled jobs must declare concurrency and missed-run policy.
- Blob upload/download limits must protect app replicas from large request exhaustion.

## Observability

Every service must emit:

- structured logs
- request metrics
- dependency latency/error metrics
- OpenTelemetry traces
- worker backlog metrics if it has workers

Required dimensions:

- service
- environment
- route
- status
- request id
- correlation id
- caller app id for internal calls
- user id only when protected route and safe to log

Alerts:

- gateway 5xx spike
- gateway JWT validation failure spike
- JWKS refresh failure
- protected route missing trusted headers
- PostgreSQL connection saturation
- Redis unavailable
- Blob operation failures
- outbox oldest age over threshold
- audit append failures
- notification permanent failure spike
- provider callback signature failures

Never log:

- access tokens
- refresh tokens
- authorization headers
- cookies
- Blob SAS URLs
- provider API keys
- raw notification body
- sensitive audit metadata

## Backup And Recovery

Detailed backup, restore, RPO/RTO, restore quarantine, and disaster recovery drill rules live in `docs/superpowers/specs/2026-07-08-hhc-platform-backup-restore-and-disaster-recovery-design.md`. This section is the runtime summary.

PostgreSQL:

- Enable automated backups.
- Use point-in-time restore where available.
- Record backup retention and geo-redundancy decision in IaC before production launch.
- Test restore in non-production at least quarterly.
- Keep migration rollback notes for every production release.
- Record RPO/RTO target and actual restore duration for each drill.
- Restore into a quarantined environment first; do not attach public gateway routes until lifecycle reconciliation, projection rebuild, asset grant checks, and smoke tests pass.

Blob:

- Enable container soft delete and blob soft delete for production asset storage.
- Enable versioning or point-in-time restore where cost and storage-account constraints justify it.
- Retention and delete policy are driven by `asset-api`.
- Audit closed partitions can be exported to Blob immutable storage when cloud policy is ready.
- Blob restore must be reconciled with `asset-api` metadata, grants, deleted state, legal holds, and owner references before public download routes are enabled.

Redis:

- Treat as disposable cache.
- Recovery is cache rebuild from PostgreSQL/public projections.
- Do not store source-of-truth data or unrecoverable queue state in Redis.

Key Vault:

- Enable secret versioning.
- Document signing-key rotation and emergency rollback.

## Disaster Recovery Priorities

Restore order:

1. `api-gateway` with route policy.
2. `account-api` token/JWKS availability.
3. PostgreSQL.
4. `hhc-web-api` public read APIs.
5. `asset-api` public asset access.
6. `audit-log` append.
7. `notification-api` retry workers.
8. LINE bot optional functions.

Read-only degraded mode:

- Public website can serve cached or last-known projections when PostgreSQL is temporarily unavailable.
- Admin writes should fail closed when PostgreSQL is unavailable.
- Asset downloads should continue if `asset-api` and Blob are healthy.
- Notification sends can queue or retry later.

Production restore promotion gates:

- lifecycle ledger events newer than restore point are replayed
- deletion/redaction/legal-hold state is re-applied
- public projections, search documents, and sitemap are rebuilt
- Redis is flushed or rebuilt from PostgreSQL
- asset grants match current owner-domain references
- providers and webhooks remain disabled until smoke tests pass

## Verification Checklist

Infrastructure:

- Cloud resources, managed identities, role assignments, resource tags, and public ingress settings are represented in IaC.
- IaC drift check passes or has approved reconciliation notes.
- Only `api-gateway` has external ingress for platform traffic.
- `/priv/*` and `/api/priv/*` are unreachable externally.
- Every internal app has Dapr app id configured.
- Caller app id allowlists match service contracts.
- PostgreSQL, Redis, Blob, and Key Vault are environment-separated.
- Secrets are not present in repo, image, or logs.

Runtime:

- `/healthz` succeeds for every deployed app.
- `/readyz` checks required dependencies.
- Gateway can route UI and API hosts correctly.
- Gateway strips client `X-HHC-*`.
- Gateway injects trusted headers only after JWT verification.
- Internal service calls propagate request id and trace context.

Data:

- Each service migration runs only against its schema.
- Redis keys include environment prefix.
- Public asset response never contains Blob/SAS URL.
- Public projections can be rebuilt after Redis flush.

Operations:

- Staging smoke tests pass before production promotion.
- Release evidence includes image digest, SBOM/provenance artifact, scan results, release manifest, and protected production approval.
- Worker/job release evidence includes worker command/version, job definition or schedule changes, job ledger behavior, and staging worker smoke.
- Rollback revision exists for every app release.
- Restore test evidence exists for PostgreSQL.
- Restore reconciliation evidence proves deleted/redacted/held records are not exposed before promotion.
- Outbox backlog alerts are configured.
- Gateway/account key rotation is tested without gateway restart.
