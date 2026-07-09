# HHC Background Jobs, Scheduled Tasks, And Worker Orchestration Design

## Purpose

This spec defines how HHC platform services run asynchronous, scheduled, manual, reconciliation, retention, scan, projection, and backfill work without creating a premature central scheduler service.

It covers:

- service-owned worker boundaries
- continuous workers vs Azure Container Apps jobs
- scheduled task policy
- publication scheduling
- reconciliation and backfill jobs
- job run ledgers, leases, checkpoints, idempotency, retries, and dead-letter behavior
- worker deployment and scaling
- security, observability, release gates, and incident response

This spec complements:

- `docs/superpowers/specs/2026-07-08-hhc-platform-eventing-outbox-reliability.md`
- `docs/superpowers/specs/2026-07-08-hhc-event-contract-schema-and-replay-governance-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-publication-workflow-consistency-and-reconciliation-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-asset-ingestion-processing-download-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-data-lifecycle-deletion-retention-and-restore-orchestration-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-platform-backup-restore-and-disaster-recovery-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-cloud-runtime-operations-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-cloud-infrastructure-iac-and-resource-governance-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-deployment-compatibility-migration-and-release-governance-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-software-supply-chain-artifact-provenance-and-release-security-design.md`

External alignment:

- Azure Container Apps jobs: `https://learn.microsoft.com/en-us/azure/container-apps/jobs`
- Azure Architecture Center background jobs best practices: `https://learn.microsoft.com/en-us/azure/architecture/best-practices/background-jobs`
- Azure Container Apps scale rules and KEDA behavior: `https://learn.microsoft.com/en-us/azure/container-apps/scale-app`
- Azure cloud application best practices and patterns: `https://learn.microsoft.com/en-us/azure/architecture/best-practices/index-best-practices`

## Core Decision

Do not create a v1 `scheduler-api`, `job-api`, `workflow-api`, `worker-api`, `cron-api`, or central job database.

Workers are runtime shapes owned by the service that owns the data and business decision. A worker deployment can be separate from the HTTP app for scaling and isolation, but it is not a new domain service.

V1 uses four worker patterns:

| Pattern | Use For | Runtime | Owner |
| --- | --- | --- | --- |
| Service outbox worker | short side effects tied to local transactions | service-owned worker process or worker Container App | owning service |
| Continuous backlog worker | scan, send, projection, retry queues that need near-real-time draining | separate internal Container App when scale differs from HTTP | owning service |
| Scheduled maintenance job | retention, reconciliation, cleanup, dependency review, cache rebuild | Azure Container Apps scheduled job or single-instance worker loop | owning service plus platform runtime |
| Manual/backfill job | imports, one-time migrations, projection rebuilds, repair jobs | Azure Container Apps manual job started by protected pipeline/operator | owning service |

Azure Service Bus, event-driven ACA jobs, or a central workflow engine can be added later only when PostgreSQL outbox plus service-owned workers no longer satisfy fan-out, delayed delivery, isolation, volume, or operational requirements.

## What Is Not A Service

These are operational/runtime capabilities, not v1 microservices:

- scheduler
- worker runner
- job history
- retry queue
- dead-letter queue
- projection rebuild command
- retention scheduler
- scan runner
- backfill runner

They become a service only if they own an independent product/domain decision, not because they run code in the background.

## Runtime Selection

### Continuous Worker Inside The HTTP App

Allowed for low-volume v1 workers when:

- the worker shares the same release cadence as the HTTP service
- worker load is small and predictable
- losing a replica only delays work
- HTTP latency is not affected by worker spikes
- the worker can stop cleanly on shutdown

Examples:

- low-volume audit outbox dispatch
- small cache invalidation queue
- simple notification retry in non-production

### Separate Worker Container App

Use a separate internal Container App under the same service ownership when:

- worker throughput needs a different scale rule than HTTP
- worker CPU/memory could affect public/admin requests
- the worker should scale from backlog age/count
- the worker needs separate alerts or rollout control
- draining backlog during incidents must not change HTTP capacity

Recommended names:

```text
ca-hhcweb-hhc-web-api-worker-prod-ea-001
ca-hhcweb-asset-api-worker-prod-ea-001
ca-hhcweb-notification-api-worker-prod-ea-001
ca-hhcweb-audit-log-worker-prod-ea-001
```

These deployments still belong to `hhc-web-api`, `asset-api`, `notification-api`, and `audit-log`. They are not added to the service catalog as new domain services.

### Azure Container Apps Scheduled Job

Use scheduled jobs for finite, recurring work:

- upload session cleanup
- publication reconciliation
- asset grant reconciliation
- retention eligibility sweep
- audit export/partition maintenance
- stale outbox/dead-letter summary
- scheduled dependency or secret-age review report

Schedules are defined in IaC. The service database records the run ledger and actual effects.

Use UTC for infrastructure cron expressions. If the business rule is church-local time, store the intended time zone, such as `Asia/Taipei`, in the service-owned schedule record or domain record and compute the next due time explicitly.

### Azure Container Apps Manual Job

Use manual jobs for controlled operator or pipeline-triggered work:

- content seed/import
- projection rebuild
- search index rebuild
- one-time schema backfill
- asset metadata repair
- restore reconciliation
- privacy/deletion reconciliation after restore

Manual jobs must be started through a protected pipeline, Azure RBAC, or a break-glass runbook step. Do not expose a public or admin route that can start arbitrary manual jobs in v1.

### Event-Driven Jobs

Use event-driven ACA jobs only after a real event source exists, such as Azure Service Bus or Storage Queue, and the work is naturally finite per message or small batch.

Do not add Service Bus just to imitate a scheduler. Start with PostgreSQL outbox and service-owned workers; add a broker when fan-out, delayed delivery, cross-service isolation, or queue-based scaling justifies it.

## Service-Owned Worker Catalog

| Owner | Worker/Job | Trigger | Runtime Pattern | Purpose |
| --- | --- | --- | --- | --- |
| `hhc-web-api` | publication workflow worker | outbox/workflow rows | continuous worker | grant-before-visible publish, rollback publish, revoke grants |
| `hhc-web-api` | projection worker | outbox rows | continuous worker | public projections, ETags, sitemap/search updates |
| `hhc-web-api` | publication reconciliation | schedule/manual | scheduled/manual job | repair missing grants, stale projections, sitemap/search drift |
| `hhc-web-api` | scheduled publish/unpublish | due domain rows | scheduled job or single worker loop | publish or unpublish content at approved times |
| `hhc-web-api` | content seed/import | manual | manual job | import current content and generate parity evidence |
| `asset-api` | scan worker | asset state | continuous worker | malware/content scan state transitions |
| `asset-api` | derivative worker | asset state | continuous worker | image/PDF derivative generation |
| `asset-api` | upload session cleanup | schedule | scheduled job | expire abandoned upload sessions and temporary objects |
| `asset-api` | retention/hard-delete worker | schedule | scheduled job | delete only after policy, legal hold, grants, and owner refs allow it |
| `notification-api` | send/retry worker | outbox/send queue | continuous worker | render, send, retry, and dead-letter notifications |
| `notification-api` | provider callback reconciliation | schedule | scheduled job | repair provider status drift where supported |
| `audit-log` | partition/export worker | schedule | scheduled job | archive/export partitions and produce evidence |
| `audit-log` | retention worker | schedule | scheduled job | expire only eligible partitions with legal-hold checks |
| `account-api` | invitation/session cleanup | schedule | scheduled job | expire invitations and old session/token records |
| `account-api` | JWKS/key lifecycle job | schedule/manual | scheduled/manual job | prepare, rotate, retire, and audit signing keys |
| `hhc-line-function-bot` | webhook dedupe cleanup | schedule | scheduled job | remove expired LINE dedupe rows and temporary state |

This catalog is not exhaustive, but every new worker must declare an owner, trigger, runtime pattern, data boundary, idempotency key, metrics, and runbook.

## Standard Repository Layout

Every Go service with background work should use explicit worker entry points:

```text
cmd/server/main.go
cmd/worker/main.go
cmd/job/main.go
internal/jobs/
  registry.go
  runner.go
  ledger.go
  lease.go
  checkpoint.go
internal/outbox/
internal/scheduler/
internal/reconciliation/
```

One image can contain all commands. The deployed command decides whether the revision runs HTTP, continuous workers, or a finite job.

Example commands:

```text
hhc-web-api server
hhc-web-api worker --queues publication,projection,audit
hhc-web-api job run publication-reconciliation --dry-run=false
hhc-web-api job run projection-rebuild --resource-type=bulletin --locale=zh-Hant
```

Node/TypeScript services can follow the same logical split with script entry points:

```text
pnpm start:webhook
pnpm start:worker
pnpm job -- webhook-dedupe-cleanup
```

## Job Definition And Run Ledger

Each service owns its job ledger in its own PostgreSQL schema. Do not create a shared platform job database in v1.

Recommended tables:

```sql
job_run(
  id uuid primary key,
  job_name text not null,
  job_type text not null,
  trigger_type text not null,
  environment text not null,
  requested_by text not null,
  idempotency_key text not null,
  status text not null,
  params_json jsonb not null,
  checkpoint_json jsonb not null default '{}',
  dry_run boolean not null default false,
  attempts int not null default 0,
  locked_by text,
  locked_until timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  last_error text,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  unique(job_name, idempotency_key)
)
```

Statuses:

- `requested`
- `leased`
- `running`
- `succeeded`
- `retry_scheduled`
- `failed_terminal`
- `cancelled`

Rules:

- Every manual, scheduled, and backfill job writes a `job_run`.
- Every run has an idempotency key.
- Every run records sanitized params, checkpoint, status, and summary.
- Long jobs checkpoint progress after bounded batches.
- Jobs must be resumable or explicitly restart-safe.
- `last_error` is sanitized and short; detailed logs use correlation ids.

Outbox rows still use the standard outbox table. The `job_run` ledger is for finite/manual/scheduled work and operator evidence.

## Scheduling Model

There are two types of schedules:

### Infrastructure Schedule

Owned by IaC and ACA scheduled jobs.

Use for:

- predictable maintenance
- cleanup
- retention sweep
- reconciliation scan

The cron expression starts the job. The service database decides what rows are eligible and records job evidence.

### Domain Schedule

Owned by the domain service data model.

Use for:

- scheduled content publish
- scheduled unpublish
- future event reminder
- future notification campaign send window

Domain schedules store:

- intended time zone
- due time
- owner/resource
- desired action
- approval state
- cancellation state
- idempotency key

The worker picks due rows and executes the same domain workflow as a manual action. Scheduled publishing must still use grant-before-visible when a required public asset is involved.

Do not let the infrastructure cron expression become business truth. It is only a wake-up mechanism.

## Misfire And Concurrency Policy

Every scheduled job declares:

- concurrency policy
- missed-run policy
- max runtime
- max catch-up window
- owner alert threshold

Recommended defaults:

| Job Type | Concurrency | Missed Run Policy | Reason |
| --- | --- | --- | --- |
| retention sweep | forbid | run once on next wake | avoid double deletes |
| publication reconciliation | forbid | run once on next wake | repair latest state, not historical runs |
| projection rebuild | forbid by resource key | explicit manual rerun | avoid stale overwrites |
| asset scan | allow by asset partition | queue/backlog driven | independent assets can parallelize |
| notification send | allow by message partition | queue/backlog driven | independent messages can parallelize |
| scheduled publish | forbid per resource/version | run if due and still approved | prevents duplicate publication |
| provider status reconciliation | forbid | run once on next wake | drift repair is current-state based |

Unbounded catch-up is not allowed. A missed hourly cleanup after an outage should run one bounded repair pass, not 72 overlapping historical runs.

## Leases And Shutdown

All workers and jobs use leases for shared work:

- lease owner includes service, runtime, revision, and instance id
- lease duration is longer than normal batch time but short enough for crash recovery
- long jobs renew leases between batches
- expired leases can be claimed by another worker
- workers stop claiming new work on shutdown
- workers finish or checkpoint the current item before exit where the platform grace period allows

Workers must handle duplicate execution as normal. Lease failure is a coordination issue, not a correctness guarantee.

## Idempotency And Checkpoints

Every worker action must be idempotent at the business boundary.

Examples:

| Work | Idempotency Key |
| --- | --- |
| scheduled publish | `scheduled-publish:{resourceType}:{resourceId}:{locale}:{version}:{dueAt}` |
| projection rebuild | `projection-rebuild:{resourceType}:{resourceId}:{locale}:{targetVersion}` |
| asset scan | `asset-scan:{assetId}:{objectChecksum}` |
| derivative generation | `asset-derivative:{assetId}:{kind}:{objectChecksum}` |
| upload cleanup | `upload-cleanup:{sessionId}:{expiresAt}` |
| retention delete | `retention-delete:{resourceType}:{resourceId}:{policyVersion}` |
| notification send | `{templateId}:{recipient}:{resourceId}:{domainVersion}` |
| audit partition export | `audit-export:{partition}:{policyVersion}` |

Backfill and repair jobs process in bounded chunks:

```text
read next batch after checkpoint
process idempotently
write checkpoint and summary
commit
repeat until complete
```

Do not run a production backfill that cannot resume from a checkpoint unless the dataset is tiny and the release manifest documents why.

## Retry And Dead Letter

Continuous workers follow the platform outbox retry policy.

Finite jobs follow:

- short retries inside one execution only for transient provider/network errors
- durable retry through `job_run.status=retry_scheduled` for retryable job-level failures
- terminal failure for validation/config/authz errors
- dead-letter or failed-terminal rows are visible in dashboards
- operator retry creates a new attempt or new run with the previous run id referenced

Do not retry:

- unauthorized caller/app id
- invalid job parameters
- missing required migration
- domain validation failure
- unsafe production config

Retry:

- temporary network failure
- provider `429`
- provider `5xx`
- expired lease
- transient DB lock timeout after safe rollback

## Backfill And Repair Jobs

Backfills are production-impacting when they alter durable state or public projections.

Required controls:

- release class recorded as `data_backfill`, `schema_behavioral`, `worker_or_event`, or stricter
- dry-run mode when practical
- bounded batch size
- checkpoint and resume
- row counts and reconciliation output
- rate limit for downstream services
- kill switch or stop flag
- rollback or roll-forward plan
- owner approval
- runbook entry

Never backfill by cross-service SQL. If a job needs data from another service, use an approved API, event export, or migration file owned by the source service.

## Publication Scheduling

Scheduled publish/unpublish belongs to `hhc-web-api`, not a central scheduler.

This is an architectural rule for when scheduled publishing is enabled. It does not require the Phase 1 admin UI to ship scheduled publishing if the frontend/admin roadmap keeps that workflow out of scope.

Admin UI may let an authorized editor set:

- scheduled publish time
- scheduled unpublish time
- locale
- intended time zone
- required asset readiness policy
- cancellation reason

The scheduled worker:

1. Claims due approved rows.
2. Revalidates permissions policy and source state.
3. Revalidates required asset eligibility.
4. Executes the normal publication workflow.
5. Uses grant-before-visible for required public assets.
6. Writes audit events for requested, executed, skipped, cancelled, and failed states.

If the content changed after scheduling, the worker must either use the approved version or skip and require re-approval. Do not publish a newer unapproved draft because the clock fired.

## Asset Scan And Processing

Asset scan and derivative jobs belong to `asset-api`.

Rules:

- no public/protected download before scan permits it
- scan and derivative workers use asset state, checksum, and lease
- duplicate workers can safely re-run
- derivative workers start only after clean scan unless namespace policy says otherwise
- infected assets trigger grants denial/removal and audit
- failed scan does not silently become public
- operator retry is explicit and audited

Asset processing workers may scale separately from asset HTTP routes when large files or derivative bursts would affect upload/download latency.

## Retention And Deletion Workers

Retention jobs are service-owned and policy-driven.

Rules:

- legal hold blocks deletion
- restore quarantine blocks public exposure until reconciliation passes
- deletion/redaction emits lifecycle evidence
- hard delete requires owner-reference checks
- audit retention/export follows audit-log policy and does not expose arbitrary delete routes

Retention jobs default to single-instance execution per service/environment.

## Worker Security

Workers and jobs have no public ingress.

Rules:

- Manual jobs start through protected pipeline, Azure RBAC, or break-glass runbook.
- Worker identities are separate from deployment identities.
- Worker identities get only the data-plane permissions their job needs.
- A worker cannot read another service's schema, Redis prefix, Blob namespace, or Key Vault secrets.
- Job params must not contain secrets.
- Job logs must not contain tokens, upload URLs, Blob/SAS URLs, provider secrets, private member data, or raw notification bodies.
- Privileged repair jobs require owner approval and audit evidence.

If a worker needs broader permissions than the HTTP service, deploy it with a separate managed identity and document why.

## Deployment And Release

Worker code ships with the owning service's image and release manifest.

Rules:

- Continuous worker and job deployments use the same immutable image digest policy as services.
- Production job changes require release manifest evidence.
- Schema migrations must be compatible with old and new workers during rollout.
- Do not run destructive migrations until old workers that read old fields are stopped or upgraded.
- New outbox destinations must be deployed with workers disabled or no-op safe until the provider is ready.
- Enable worker traffic/processing through config or kill switch after staging smoke.
- Worker pause/resume controls are documented per service.

Production release evidence includes:

- image digest
- worker command/version
- migration compatibility
- job definitions changed
- schedule changes
- runbook update
- staging worker smoke
- rollback or roll-forward plan

## Observability

Every worker/job emits:

- structured logs with `job_run_id`, `worker_id`, `lease_owner`, `request_id`, `correlation_id`
- metrics for pending count, oldest age, attempts, success/failure count, duration, throughput, and dead-letter count
- dependency latency and error metrics
- checkpoint progress for long jobs
- audit events for high-risk actions

Required alerts:

- outbox oldest age over threshold
- job run stuck in `running` past max runtime
- scheduled job missed beyond tolerance
- dead-letter count above threshold
- repeated terminal failures for same job
- asset scan backlog or infected asset
- notification send backlog
- publication workflow stuck before public visibility
- retention job skipped while deletion SLA is exceeded

Dashboards should separate:

- HTTP health
- worker backlog
- finite job history
- schedule lag
- dead-letter and retry state

## Local Development And Tests

Every worker has a local one-shot mode.

Required test support:

- fake clock
- deterministic seed data
- dry-run mode for backfills where practical
- local command to run one job once
- unit tests for lease, idempotency, retry, dead-letter, and checkpoint behavior
- integration tests with PostgreSQL and fake providers
- shutdown test for graceful stop/checkpoint
- duplicate execution test
- old/new event fixture replay when events are consumed

Example:

```text
go run ./cmd/job -- run publication-reconciliation --dry-run
go run ./cmd/worker -- once --queue projection-worker
```

## Service Bus Adoption Gate

Add Azure Service Bus only when at least one is true:

- one event has multiple independent consumers and PostgreSQL polling creates coupling
- queue depth/backlog scaling needs broker-native metrics
- delayed delivery requirements exceed simple `next_attempt_at`
- cross-service isolation is needed for incident containment
- provider callbacks or external events need durable decoupling
- retention/replay requirements exceed local outbox table practicality

When adopted:

- the producing service still owns the source transaction and local outbox
- the worker publishes to Service Bus from the outbox
- consumers dedupe by CloudEvents `source + id`
- schemas remain producer-owned
- no service reads another service database

## Anti-Patterns

Do not:

- add `scheduler-api`, `job-api`, `worker-api`, or `workflow-api` in v1
- use a single central cron service to mutate every domain
- make infrastructure cron the source of business truth
- expose a public/admin endpoint that runs arbitrary jobs
- use Redis as the only queue for unrecoverable work
- rely on CPU scaling for queue-heavy workers
- run unbounded catch-up after downtime
- run production backfills without checkpoints
- perform cross-service SQL in a repair job
- let job parameters contain secrets
- silently skip failed scheduled work without metrics and run ledger evidence
- treat leases as exactly-once guarantees
- deploy destructive migrations while old workers can still run

## Implementation Tests

Required tests for services with workers:

- lease claim and expired lease recovery
- duplicate execution produces one business effect
- retryable error schedules retry
- permanent error becomes terminal/dead-letter
- long job checkpoints and resumes
- shutdown stops claiming new work and checkpoints current work
- scheduled job misfire policy
- single-instance jobs do not overlap
- worker kill switch/pause behavior
- job params reject secrets and unsafe production defaults
- backfill dry-run emits counts without durable mutation

## Acceptance Criteria

- V1 does not introduce a central scheduler or job microservice.
- Every worker is owned by the service that owns the data and business decision.
- Continuous, scheduled, manual, and event-driven work have clear runtime selection rules.
- Service-owned job ledgers record scheduled/manual/backfill execution evidence.
- Outbox workers remain the default for transactional side effects.
- Scheduled publishing belongs to `hhc-web-api` and reuses the normal publication workflow.
- Asset scan, derivative, cleanup, and retention workers belong to `asset-api`.
- Notification send/retry workers belong to `notification-api`.
- Audit export/retention workers belong to `audit-log`.
- Jobs are idempotent, lease-based, observable, retryable, and checkpointed when long-running.
- Production backfills have dry-run/checkpoint/reconciliation evidence where practical.
- Worker deployments and job definitions follow the same image digest, release manifest, IaC, and runbook gates as services.
