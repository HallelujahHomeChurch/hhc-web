# HHC Audit Log Design

## Purpose

`audit-log` is the internal append-only accountability service for the HHC platform. It records protected writes, permission denials, asset grant changes, notification lifecycle transitions, account security events, gateway security decisions, and future sensitive-domain activity.

It is not an analytics service, a search index, an event bus, or a business-history replacement. Each domain still owns its own state and meaning. `audit-log` owns consistent capture, validation, storage, retention, query controls, and export of audit evidence.

Internal `/priv/audit/*` service identity, producer/query permission separation, caller app-id allowlists, and denied-call behavior are defined in `docs/superpowers/specs/2026-07-08-hhc-internal-service-identity-and-private-route-design.md`.

Audit append/query authorization, sensitive metadata field policy, route/action metadata, and authorization drift checks are defined in `docs/superpowers/specs/2026-07-08-hhc-authorization-policy-and-permission-governance-design.md`.

Audit metadata classification, redaction, retention, privacy request behavior, and backup restore expectations are defined in `docs/superpowers/specs/2026-07-08-hhc-platform-data-classification-privacy-retention-design.md`.

Producer outbox rows that carry audit intent follow the event envelope, schema, compatibility, replay, and classification rules in `docs/superpowers/specs/2026-07-08-hhc-event-contract-schema-and-replay-governance-design.md`. The `/priv/audit/*` append command remains an internal HTTP contract owned by `audit-log`.

Cross-service lifecycle ledger, legal hold, retention worker, privacy request, and restore reconciliation rules are defined in `docs/superpowers/specs/2026-07-08-hhc-data-lifecycle-deletion-retention-and-restore-orchestration-design.md`.

## Design Decision

Use a centralized append-only `audit-log` service, reached only through `/priv/audit/*`, with producer-side outbox retry.

Rejected alternatives:

- Per-service audit tables: easiest to start, but fragments query, retention, redaction, and incident response rules.
- Full event sourcing: powerful, but too heavy for the current website/CMS platform and would make audit records double as domain state.
- Provider log only: cheap, but cannot reliably answer church-admin questions such as who published a bulletin, who changed an asset grant, or which service requested a notification.

The chosen design gives reusable audit behavior without making every service depend synchronously on `audit-log` uptime.

## Ownership Boundary

`audit-log` owns:

- Audit event validation and schema versioning.
- Idempotent append by producer-provided `eventId`.
- Immutable audit storage.
- Retention classes and partition management.
- Query APIs for authorized internal/admin callers.
- Sensitive metadata policy enforcement.
- Optional export manifests for tamper-evidence and backup.

Producer services own:

- Whether a domain action requires an audit event.
- The business meaning of each action.
- Writing audit intent into their local outbox when the action is committed.
- Keeping secrets, tokens, raw request bodies, raw notification bodies, and excessive personal data out of metadata.

`audit-log` must not call `account-api`, `asset-api`, `notification-api`, or `hhc-web-api` to enrich events. If an admin UI wants display names or resource labels, `hhc-web-api` can enrich the read model separately while keeping raw audit evidence unchanged.

## Producers

Allowed v1 producers:

| Producer | Allowed reason |
| --- | --- |
| `hhc-web-api` | CMS writes, publish/unpublish, admin reads, public projection changes |
| `asset-api` | Upload lifecycle, scan result, grant create/revoke, deletion/retention events |
| `notification-api` | Notification requested/rendered/sent/delivered/failed/suppressed |
| `account-api` | Login security events, token revocation, role/scope/admin changes |
| `api-gateway` | JWT validation failures, blocked `/priv/*` attempts, route authorization denials when needed |

Future producers such as `event-api`, `member-api`, `pastoral-care-api`, and `donation-api` must define their action allowlist and metadata policy before they are granted append access.

## Write Path

For protected writes:

1. Producer validates the user/service authorization.
2. Producer commits its business state change and local `outbox_event` row in the same PostgreSQL transaction.
3. Producer outbox worker calls `POST /priv/audit/events`.
4. `audit-log` validates caller app id, event schema, action allowlist, metadata policy, and idempotency.
5. `audit-log` stores the event and returns `accepted`.
6. Producer marks its outbox event as processed.

If `audit-log` is unavailable, the producer outbox retries according to `docs/superpowers/specs/2026-07-08-hhc-platform-eventing-outbox-reliability.md`. The original business write must not disappear silently; the outbox backlog and failure metrics are operational signals.

For permission denials and gateway security decisions that may not have a business transaction, direct append is acceptable. If direct append fails, the service must log structured error details and increment a metric. Services with a local database should still prefer an outbox for high-risk security decisions.

## API Surface

Internal only:

```text
POST /priv/audit/events
POST /priv/audit/events/batch
GET /priv/audit/events
GET /priv/audit/events/{eventId}
```

No public gateway route may forward to `/priv/audit/*`.

The admin console never calls `audit-log` directly. Admin audit screens call `hhc-web-api`, and `hhc-web-api` calls `audit-log` with internal service identity after verifying the admin has `audit:read`.

## Append Idempotency

`eventId` is generated by the producer and is globally unique. Recommended format:

```text
{sourceService}:{action}:{resourceType}:{resourceId}:{occurredAtEpochMillis}:{nonce}
```

Rules:

- First valid append stores the event.
- Retried append with the same `eventId` and same canonical payload returns `accepted`.
- Retried append with the same `eventId` and a different canonical payload returns `409 conflict`.
- Batch append is all-or-partial by item. Each item reports `accepted`, `duplicate`, `rejected`, or `conflict`.

## Data Model

Use PostgreSQL schema `audit`. Store events in a monthly partitioned table.

```sql
audit_event(
  id uuid primary key,
  event_id text not null unique,
  schema_version int not null,
  occurred_at timestamptz not null,
  received_at timestamptz not null,
  request_id text not null,
  correlation_id text null,
  trace_id text null,
  source_service text not null,
  source_environment text not null,
  actor_type text not null,
  actor_id text not null,
  actor_id_hash text null,
  action text not null,
  category text not null,
  resource_owner_service text not null,
  resource_type text not null,
  resource_id text not null,
  outcome text not null,
  severity text not null,
  metadata_json jsonb not null,
  metadata_classification text not null,
  source_ip_hash text null,
  user_agent_hash text null,
  retention_class text not null,
  payload_hash text not null,
  exported_at timestamptz null
)
```

Supporting tables:

```sql
audit_action_policy(
  action text primary key,
  allowed_source_services text[] not null,
  allowed_metadata_keys text[] not null,
  required_metadata_keys text[] not null,
  metadata_classification text not null,
  default_severity text not null,
  default_retention_class text not null,
  enabled boolean not null
)

audit_export_manifest(
  id uuid primary key,
  partition_name text not null,
  exported_at timestamptz not null,
  event_count bigint not null,
  manifest_hash text not null,
  storage_uri text not null
)
```

`payload_hash` is calculated from a canonical JSON representation of the accepted event. This does not prevent database tampering by itself, but it supports duplicate conflict detection, export verification, and incident checks.

## Field Rules

`actor_type`:

- `user`: authenticated account user.
- `service`: internal service identity.
- `system`: scheduled worker or automated system action.
- `provider`: external provider callback, such as email delivery webhook.

`actor_id`:

- For account users, use the account subject id.
- For services, use the Dapr app id.
- For external provider or LINE identifiers, store a stable hash unless the owning domain explicitly approves storing the raw id.

`outcome`:

- `success`
- `failure`
- `denied`
- `queued`
- `cancelled`

`severity`:

- `info`: normal administrative action.
- `warning`: denied, retried, suspicious, or recoverable failure.
- `critical`: security incident, privilege change, sensitive-domain failure, or data exposure risk.

`metadata_classification`:

- `public`: safe to display broadly inside admin tools.
- `internal`: operational metadata, admin-only.
- `sensitive`: restricted audit read; not shown to general CMS admins.

## Metadata Policy

Metadata is allowlisted per action. Rejected metadata should fail the append with `400 validation_error` so producers cannot accidentally leak sensitive material.

Never store:

- Access tokens, refresh tokens, ID tokens, API keys, SAS URLs, provider secrets, passwords, or one-time codes.
- Raw request bodies or response bodies.
- Full email/message bodies.
- Payment card data.
- Pastoral care notes, prayer details, counseling content, or other sensitive narrative text.
- Raw LINE user ids, group ids, or provider recipient ids unless a domain policy explicitly permits it.

Allowed examples:

| Action | Useful metadata |
| --- | --- |
| `cms.bulletin.publish` | `locale`, `issueDate`, `versionId`, `assetId` |
| `asset.grant.create` | `ownerService`, `visibility`, `permission`, `resourceType`, `resourceId` |
| `notification.message.failed` | `templateKey`, `channel`, `provider`, `providerStatusCode`, `failureClass` |
| `cms.site_settings.publish` | `locale`, `version`, `changedSections` |
| `cms.preview.denied` | `resourceType`, `resourceId`, `mode`, `reason` |
| `auth.permission.denied` | `requiredScope`, `routePattern`, `method` |
| `gateway.priv_path.blocked` | `host`, `pathPrefix`, `method`, `reason` |

## Action Catalog

V1 required categories:

| Category | Actions |
| --- | --- |
| `cms.content` | `cms.content.create`, `cms.content.update`, `cms.content.publish`, `cms.content.unpublish`, `cms.content.revision.created`, `cms.content.restore_to_draft`, `cms.content.rollback_publish` |
| `cms.bulletin` | `cms.bulletin.create`, `cms.bulletin.version.create`, `cms.bulletin.publish`, `cms.bulletin.unpublish`, `cms.bulletin.revision.created`, `cms.bulletin.restore_to_draft`, `cms.bulletin.rollback_publish` |
| `cms.site_settings` | `cms.site_settings.update`, `cms.site_settings.publish`, `cms.site_settings.unpublish`, `cms.site_settings.revision.created`, `cms.site_settings.restore_to_draft`, `cms.site_settings.rollback_publish` |
| `cms.preview` | `cms.preview.denied`, `cms.preview.unsafe_content_blocked` |
| `asset` | `asset.upload.create`, `asset.upload.complete`, `asset.scan.complete`, `asset.grant.create`, `asset.grant.revoke`, `asset.retention.apply` |
| `auth` | `auth.login.failed`, `auth.permission.denied`, `auth.role.assign`, `auth.role.revoke`, `auth.refresh_token.revoke` |
| `gateway` | `gateway.jwt.invalid`, `gateway.jwt.expired`, `gateway.priv_path.blocked`, `gateway.route.denied` |
| `notification` | `notification.message.requested`, `notification.message.rendered`, `notification.message.sent`, `notification.message.delivered`, `notification.message.failed`, `notification.message.suppressed` |
| `audit` | `audit.query.read`, `audit.export.created`, `audit.policy.changed` |

Future domains must add action catalog entries before production rollout. Donation, member, group, and pastoral-care audit actions require separate metadata rules because they are more sensitive than CMS content.

## Query Authorization

`GET /priv/audit/events` is internal-only and must enforce both caller service identity and user authorization context.

Allowed query callers:

- `hhc-web-api` for admin console audit screens.
- `account-api` for account security/admin screens if needed.
- Explicit incident tooling with a dedicated service identity.

Query requirements:

- Caller service must be allowlisted.
- User context must include `audit:read`.
- Sensitive metadata requires `audit:sensitive_read`.
- Time range is required.
- Default maximum range is 90 days.
- Absolute maximum range is 366 days for online queries.
- Page size is capped by `AUDIT_QUERY_MAX_PAGE_SIZE`.
- Queries must support filters by `eventId`, `requestId`, `correlationId`, `sourceService`, `actorType`, `actorId`, `action`, `category`, `resourceType`, `resourceId`, `outcome`, and `severity`.

Audit reads should themselves be audited as `audit.query.read` with query shape metadata, not full result contents.

## Read Response Redaction

Audit query responses return raw evidence fields only when authorized. For normal `audit:read`:

- `metadata_classification=public` and `internal` can be returned.
- `metadata_classification=sensitive` is returned with sensitive keys redacted.
- `source_ip_hash`, `user_agent_hash`, and `actor_id_hash` can be returned.
- Raw external identifiers are not returned.

With `audit:sensitive_read`, sensitive metadata can be returned only for allowed categories and must generate an `audit.query.read` event with `severity=warning`.

## Retention

Default retention classes:

| Retention class | Default | Examples |
| --- | --- | --- |
| `admin_standard` | 2555 days | CMS writes, asset grants, role changes |
| `security` | 2555 days | token revocation, permission denial, gateway blocks |
| `notification_operational` | 730 days | notification provider statuses, retry outcomes |
| `high_volume_operational` | 180 days | future download/read telemetry if enabled |
| `sensitive_domain` | domain-defined | member, pastoral, donation, or care workflows |

The retention worker operates on partitions. There is no public or internal delete route for arbitrary audit events. Expired partitions can be archived and dropped only by a scheduled maintenance job that writes `audit.retention.apply` lifecycle evidence and export manifests before deletion.

Because the service should avoid raw personal data, normal user data deletion requests should not require deleting audit evidence. If a future legal or pastoral policy requires stronger redaction, the platform must use a dedicated maintenance procedure that appends `audit.redaction.apply`, records the lifecycle event id, and only redacts approved fields. Corrections are new events; existing audit events are not silently rewritten.

Backup and restore:

- Restored audit partitions must stay unavailable to admin query until retention, redaction, and legal-hold events newer than the restore point are reconciled.
- Redaction events must be replayed before sensitive query routes are enabled.
- Partition export manifests are evidence for restore validation, not a replacement for service-owned lifecycle state.

## Tamper Resistance

V1 controls:

- No update/delete application route.
- Database role for the service can insert and read, but routine app code must not update or delete rows.
- Monthly partitions reduce accidental large-scope changes.
- `payload_hash` is stored for every accepted event.
- Admin audit reads are audited.
- PostgreSQL backups include the audit schema.

Hardening path:

- Export closed partitions to Azure Blob Storage with immutable retention when the cloud policy is ready.
- Store `audit_export_manifest` with event count and manifest hash.
- Alert if a closed partition changes after export.
- Add database-level row-level update/delete guards where supported by the managed PostgreSQL setup.

## Availability And Failure Modes

`audit-log` down:

- Producer protected write can still commit if its local outbox row is committed.
- Outbox retries continue until accepted or dead-lettered.
- Dead-lettered audit events must page the operator because audit evidence is missing.

Producer database down:

- Protected writes fail with the business transaction. Do not perform a protected write if its audit outbox row cannot be committed.

Invalid metadata:

- `audit-log` rejects the event.
- Producer outbox marks the event failed after retry policy and exposes the error for operator correction.
- Fix by changing producer metadata policy or payload, not by weakening validation globally.

Duplicate event:

- Same canonical payload returns `accepted`.
- Different payload returns `409 conflict` and must be investigated.

## Observability

Metrics:

- `audit_events_accepted_total`
- `audit_events_duplicate_total`
- `audit_events_rejected_total`
- `audit_events_conflict_total`
- `audit_append_latency_ms`
- `audit_query_latency_ms`
- `audit_outbox_oldest_age_seconds` from producers
- `audit_export_lag_seconds`

Alerts:

- Reject or conflict spike.
- Producer audit outbox older than the configured threshold.
- No audit events received from an active producer for an abnormal period.
- Export lag for closed partitions.
- Query failures or sensitive-query spike.

Logs must include `requestId`, `correlationId`, `sourceService`, `action`, `resourceType`, `resourceId`, and outcome. Logs must not include raw metadata when metadata is sensitive.

## Tests

Unit tests:

- Action allowlist validation.
- Metadata key allowlist and required-key validation.
- Secret/token pattern rejection.
- Canonical payload hash stability.
- Retention class selection.

Contract tests:

- Allowed producer can append.
- Disallowed producer is rejected.
- Duplicate same-payload append is accepted.
- Duplicate conflicting append returns `409`.
- Batch append reports per-item status.
- Query requires caller allowlist and `audit:read`.
- Sensitive query requires `audit:sensitive_read`.

Integration tests:

- `hhc-web-api` publish writes local outbox and eventually creates `cms.bulletin.publish`.
- `asset-api` grant create/revoke emits audit events.
- `notification-api` requested/final-status events are captured.
- `account-api` role/scope changes are captured.
- `api-gateway` blocked `/priv/*` attempt can be captured without exposing `/priv/*`.

Operational tests:

- `audit-log` outage causes producer outbox retry, not silent loss.
- Retention worker archives/drops only expired partitions.
- Export manifest event count and hash match exported partition.

## Roadmap

Phase A:

- Create `audit-log` Go service.
- Add `audit` schema migrations.
- Implement `POST /priv/audit/events`.
- Implement event validation, action policy, metadata policy, and idempotency.
- Add producer client library conventions for Go services.

Phase B:

- Add `GET /priv/audit/events` and `GET /priv/audit/events/{eventId}`.
- Route admin audit reads through `hhc-web-api`.
- Audit admin audit reads as `audit.query.read`.
- Add query redaction.

Phase C:

- Add batch append.
- Add monthly partition retention worker.
- Add export manifests.
- Add Azure Blob immutable archive when cloud retention policy is ready.

Phase D:

- Extend action catalogs for future domains.
- Add higher-sensitivity policies for donations, member data, pastoral care, and group management before those domains launch.
