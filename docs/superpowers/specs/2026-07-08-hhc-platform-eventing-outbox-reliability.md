# HHC Platform Eventing, Outbox, And Reliability

This spec defines how HHC platform services publish events, process side effects, retry failures, and avoid duplicate outcomes across `hhc-web-api`, `asset-api`, `notification-api`, `audit-log`, `hhc-line-function-bot`, and future services.

Event envelope, JSON Schema, event type naming, compatibility, replay, privacy, and event release gates are specified in `docs/superpowers/specs/2026-07-08-hhc-event-contract-schema-and-replay-governance-design.md`.

Cross-service dependency-chain budgets, query ownership, read-model duplication rules, and anti-corruption adapter boundaries are specified in `docs/superpowers/specs/2026-07-08-hhc-cross-service-dependency-query-and-read-model-governance-design.md`.

Background jobs, scheduled tasks, finite manual/backfill jobs, service-owned worker deployments, ACA Jobs selection, and job run ledgers are specified in `docs/superpowers/specs/2026-07-08-hhc-background-jobs-scheduled-tasks-and-worker-orchestration-design.md`.

## Purpose

Microservices fail at boundaries. The platform should not rely on a CMS write, asset grant, notification send, audit append, and projection refresh all succeeding in one request path. Each service should commit its own domain transaction and record follow-up work in the same database transaction through an outbox.

The default reliability model is:

```text
at-least-once delivery + idempotent handlers + observable retries
```

Do not design around cross-service exactly-once delivery.

## Core Decisions

- Use PostgreSQL outbox tables first.
- Each service owns and processes its own outbox.
- Side-effect commands must be idempotent.
- Consumers must tolerate duplicate events.
- Workers use leases to avoid parallel processing of the same row.
- Failed work retries with bounded exponential backoff.
- Dead-letter state is explicit and observable.
- Azure Service Bus is added only when fan-out, delayed delivery, isolation, or volume justifies it.
- Finite scheduled/manual/backfill work records a service-owned `job_run` ledger; do not overload outbox rows as the only evidence for long-running jobs.

## Command, Event, And Projection Terms

| Term | Meaning | Example |
| --- | --- | --- |
| Command | Imperative request to do work | `POST /priv/assets/{assetId}/grants` |
| Domain event | Fact that something happened | `bulletin.version.published` |
| Integration event | Cross-service message derived from domain event | `asset.public_read_grant.requested` |
| Projection | Read model for public/admin queries | `public_projection` home/news/bulletin payload |
| Outbox row | Durable work item written with the domain transaction | send audit event, refresh projection, call asset-api |

## When To Use Synchronous Calls

Use synchronous internal calls only when the caller needs the decision before committing or responding:

- create asset upload session
- validate asset exists and belongs to caller before attaching it
- create payment checkout session in future `donation-api`
- validate event registration capacity in future `event-api`

Synchronous calls must stay within the dependency-chain budget defined by the cross-service dependency governance spec. Public content reads should not fan out to other services at request time.

Avoid synchronous calls for follow-up side effects:

- send notification
- append audit event
- refresh public projection
- grant/revoke public asset access after publish
- rebuild search index
- send LINE/admin alert

If the side effect can safely happen after the core transaction, put it in outbox.

## Standard Outbox Table

Each service that has side effects should use a table like:

```sql
outbox_event(
  id uuid primary key,
  cloud_event_id text not null,
  cloud_event_source text not null,
  cloud_event_type text not null,
  cloud_event_subject text not null,
  data_schema text not null,
  event_type text not null,
  aggregate_type text not null,
  aggregate_id text not null,
  aggregate_version bigint,
  destination text not null,
  idempotency_key text not null,
  classification text not null,
  visibility text not null,
  payload_json jsonb not null,
  status text not null,
  attempts int not null default 0,
  max_attempts int not null default 12,
  next_attempt_at timestamptz not null,
  locked_by text,
  locked_until timestamptz,
  last_error text,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  processed_at timestamptz,
  dead_lettered_at timestamptz,
  unique(destination, idempotency_key),
  unique(cloud_event_source, cloud_event_id)
)
```

`payload_json` should store the full CloudEvents-compatible envelope for cross-service events. The duplicated envelope columns are for worker selection, idempotency, compatibility checks, and operations.

Recommended `destination` values:

- `projection-worker`
- `asset-api`
- `notification-api`
- `audit-log`
- `search-worker`
- `line-bot`
- `service-bus`

## Outbox Status State Machine

Statuses:

- `pending`
- `leased`
- `succeeded`
- `retry_scheduled`
- `dead_lettered`
- `cancelled`

Allowed transitions:

```text
pending -> leased
leased -> succeeded
leased -> retry_scheduled
retry_scheduled -> leased
leased -> dead_lettered
pending -> cancelled
retry_scheduled -> cancelled
```

Rules:

- `succeeded`, `dead_lettered`, and `cancelled` are terminal.
- `leased` rows must have `locked_by` and `locked_until`.
- Expired leases can be claimed by another worker.
- `attempts` increments only when processing actually starts.
- A duplicate insert with the same `destination + idempotency_key` should return the existing row.

## Worker Leasing

Workers should claim rows with database locking:

```sql
select id
from outbox_event
where status in ('pending', 'retry_scheduled')
  and next_attempt_at <= now()
  and (locked_until is null or locked_until < now())
order by created_at
limit 50
for update skip locked;
```

Then update selected rows:

```sql
update outbox_event
set status = 'leased',
    attempts = attempts + 1,
    locked_by = $worker_id,
    locked_until = now() + interval '2 minutes',
    updated_at = now()
where id = any($ids);
```

Lease duration should exceed normal processing time but be short enough for crash recovery.

## Retry Policy

Default backoff:

| Attempt | Delay |
| --- | --- |
| 1 | 30 seconds |
| 2 | 2 minutes |
| 3 | 5 minutes |
| 4 | 15 minutes |
| 5 | 1 hour |
| 6+ | 6 hours |

Rules:

- Add jitter to prevent synchronized retries.
- Retry network failures, `429`, and `5xx`.
- Do not retry validation errors, unauthorized caller, unknown template, or malformed payload.
- Dead-letter after `max_attempts`.
- Dead-letter immediately for permanent domain errors.
- Keep `last_error` short and sanitized.

## Idempotency

Every command that causes a side effect must have an idempotency key.

Recommended keys:

| Side Effect | Idempotency Key |
| --- | --- |
| Public asset grant | `asset-grant:{domain}:{resourceId}:{assetId}:public-read:{domainVersion}` |
| Asset grant revoke | `asset-revoke:{domain}:{resourceId}:{assetId}:public-read:{domainVersion}` |
| Audit append | producer-generated `eventId` |
| Notification send | `{templateId}:{recipient}:{resourceId}:{domainVersion}` |
| Projection refresh | `projection:{resourceType}:{resourceId}:{locale}:{version}` |
| Search index update | `search:{resourceType}:{resourceId}:{version}` |
| LINE reply side effect | LINE event id or message id plus function name |

Idempotency storage belongs to the service performing the side effect:

- `asset-api` dedupes grants.
- `notification-api` dedupes messages.
- `audit-log` dedupes `eventId`.
- `hhc-web-api` dedupes projections.
- `hhc-line-function-bot` dedupes LINE events.

Cross-service event consumers dedupe by `cloud_event_source + cloud_event_id` and use aggregate version checks when rebuilding projections or read models.

## Ordering

Do not assume global ordering.

Use aggregate-level ordering where needed:

- `aggregate_type`
- `aggregate_id`
- `aggregate_version`

For publish/unpublish race conditions, the owning domain service decides final desired state. Downstream services should accept commands with domain version and ignore stale versions when applicable.

Example:

- `bulletin.version.published` version 7 grants public read.
- `bulletin.version.unpublished` version 8 revokes public read.
- If version 7 retry arrives after version 8, `hhc-web-api` should not re-grant public access. Either cancel stale outbox rows or include final-state checks before retrying.

## Publish Flow Example

Simple content publish without required remote side effects can behave like:

1. Admin requests publish through `hhc-web-api`.
2. `hhc-web-api` validates role, source state, locale, and render model.
3. `hhc-web-api` commits one PostgreSQL transaction:
   - set source version published
   - upsert public projection
   - insert outbox row to append audit event
   - optionally insert outbox row for notification
4. Request returns success after domain transaction commits.
5. Worker processes audit outbox.
6. Worker processes optional notification outbox.

If a public projection depends on a required file URL, use the grant-before-visible pattern below.

Weekly PDFs must use grant-before-visible semantics so users and the LINE bot do not receive a broken latest bulletin link.

## Grant-Before-Visible Pattern

Use when a public projection depends on a file being downloadable.

Flow:

1. Domain transaction marks content as `publishing`.
2. Outbox grants public asset read.
3. Worker confirms grant success.
4. Worker transitions content to `published`.
5. Worker refreshes public projection.
6. Worker emits audit event.

This is more complex but avoids public content pointing to inaccessible assets.

Detailed publication workflow state, rollback publish, emergency takedown, stale side-effect cancellation, and reconciliation rules are specified in `docs/superpowers/specs/2026-07-08-hhc-publication-workflow-consistency-and-reconciliation-design.md`.

Use for:

- weekly bulletin PDF
- required news cover image if public page must render it

Use simpler publish-and-retry when:

- asset is optional
- UI can handle asset pending state
- public projection does not include the asset until it is ready

## Audit Reliability

Audit is required for accountability but should not create distributed transactions.

Rules:

- Services write domain data and outbox audit event in the same transaction.
- Audit worker calls `audit-log /priv/audit/events`.
- `audit-log` dedupes by `eventId`.
- If `audit-log` is unavailable, the source service retains the outbox event and retries.
- Sensitive admin actions should surface a warning in operations if audit backlog grows.
- Do not silently drop audit events.

For extremely sensitive future domains, such as donations or pastoral care, the service may fail the user-facing action if its local audit outbox insert fails. It should not require remote `audit-log` to be online inside the transaction.

## Notification Reliability

`notification-api` should split request acceptance from provider delivery.

1. Internal caller sends `POST /priv/notifications/send` with idempotency key.
2. `notification-api` stores message as `queued`.
3. Worker renders template and calls provider.
4. Provider accepted state becomes `sent`.
5. Delivery webhook or provider polling can update `delivered`, `bounced`, or `failed`.
6. Final status emits audit event.

Provider failures:

- transient provider/network failure: retry
- permanent invalid recipient: `failed`
- suppression/bounce: `suppressed`
- duplicate idempotency key: return existing message

`notification-api` does not own subscriber consent or recipient selection. Those belong to the calling domain, such as future `engagement-api` or `event-api`.

## Projection Reliability

Public projections must be rebuildable.

Rules:

- Source-of-truth records stay in `hhc_web`.
- Projection rows can be deleted and rebuilt from source records.
- Redis cache is disposable.
- Publish/unpublish should version-bump or invalidate keys.
- Projection worker should be idempotent by `{resourceType, resourceId, locale, version}`.

Rebuild command should exist for operators:

```text
POST /priv/projections/rebuild
```

Scope should allow:

- one resource
- one content type
- all public projections
- one locale

## Dead-Letter Handling

Dead-lettered outbox rows are not deleted automatically.

Operator actions:

- view dead-letter rows
- inspect sanitized error
- retry after fixing configuration/data
- cancel obsolete row
- mark as manually resolved with audit note

Dead-letter examples:

- unknown notification template
- asset id does not belong to owner service
- audit payload schema invalid
- provider permanently rejects message
- stale publish version should be cancelled

Dead-letter counts must be visible in metrics and alerts.

## Azure Service Bus Adoption Criteria

Do not introduce Azure Service Bus in v1 unless one of these becomes true:

- Many services need the same event independently.
- Outbox polling causes unacceptable database load.
- Delayed delivery needs are significant.
- Cross-service fan-out grows beyond simple worker calls.
- A service needs independent message retention or replay.
- Operational isolation is more valuable than fewer moving parts.

When introduced, keep the PostgreSQL outbox as the source of truth for publish intent. A relay worker publishes outbox rows to Service Bus and marks them succeeded after broker acceptance.

## Observability

Metrics:

- `outbox.pending.count`
- `outbox.leased.count`
- `outbox.retry_scheduled.count`
- `outbox.dead_lettered.count`
- `outbox.processing.duration`
- `outbox.processing.failures`
- `outbox.oldest_pending_age_seconds`
- `notification.message.queued`
- `notification.message.sent`
- `notification.message.failed`
- `audit.append.accepted`
- `audit.append.duplicate`
- `projection.rebuild.count`

Alerts:

- oldest pending outbox age exceeds threshold
- dead-letter count increases
- retry backlog grows for more than 15 minutes
- audit outbox backlog grows for sensitive services
- notification provider error rate spikes
- projection rebuild repeatedly fails

## Testing Requirements

Each service with an outbox should test:

- domain write and outbox insert happen in same transaction
- worker retry after transient failure
- worker does not duplicate side effect when retried
- expired lease can be reclaimed
- permanent error dead-letters
- duplicate idempotency key returns existing result
- stale aggregate version does not overwrite newer state
- old and new event fixtures validate against supported schemas
- replay never reruns unsafe external side effects such as notification send or LINE reply
- metrics include pending/retry/dead-letter state

End-to-end smoke should cover:

- bulletin publish grants asset and refreshes projection
- audit-log unavailable causes retry, not event loss
- notification provider failure retries and then dead-letters or succeeds
- public projection can be rebuilt after Redis flush

## Acceptance Criteria

- No cross-service transaction is required for normal CMS publish.
- Every remote side effect is idempotent.
- Every retryable side effect is durable in a service-owned outbox.
- Cross-service event payloads have schema, examples, compatibility rules, and replay tests.
- Workers can recover from crash by lease expiry.
- Dead-letter state is visible and actionable.
- Public projections and Redis cache can be rebuilt from PostgreSQL.
- Azure Service Bus remains optional until fan-out, volume, or delayed delivery justify it.
