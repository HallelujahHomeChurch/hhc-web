# HHC Data Lifecycle, Deletion, Retention, And Restore Orchestration Design

## Purpose

This spec defines how HHC services coordinate data lifecycle operations across service boundaries: soft delete, hard delete, redaction, anonymization, legal hold, retention workers, backup restore, and post-restore privacy reconciliation.

The goal is to make privacy and recovery behavior operationally reliable without creating a premature centralized privacy service.

This spec complements:

- `docs/superpowers/specs/2026-07-08-hhc-platform-data-classification-privacy-retention-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-cloud-runtime-operations-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-web-service-implementation-blueprint.md`
- `docs/superpowers/specs/2026-07-08-hhc-asset-lifecycle-and-access-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-audit-log-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-account-admin-identity-rbac-lifecycle-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-platform-slo-observability-and-runbook-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-platform-backup-restore-and-disaster-recovery-design.md`
- `docs/superpowers/plans/2026-07-08-hhc-web-rollout-verification-matrix.md`

## Core Decision

Use service-owned lifecycle procedures plus a shared platform contract.

Do not create a v1 `privacy-api`, `retention-api`, or `recovery-api`.

Reasons:

- V1 stores mostly public content, admin operational data, assets, audit evidence, and account/security records.
- Future sensitive domains such as engagement, events, members, pastoral care, and donations do not exist yet.
- A central privacy service would need broad authority over many schemas before the domain workflows justify it.
- Service-owned lifecycle procedures preserve data ownership and prevent one generic service from directly deleting another service's rows.

Every service that stores non-public or recoverable data must implement:

- field-level data classification
- retention class mapping
- soft-delete behavior where recovery is needed
- hard-delete or anonymization procedure where policy allows
- legal-hold checks before destructive deletion
- lifecycle audit events
- restore reconciliation steps
- non-production restore sanitization rules

## Alternatives Considered

### Central Privacy Service In V1

Pros:

- One workflow for operator privacy requests.
- One UI could show cross-service status.

Cons:

- Requires high privilege across services.
- Encourages cross-schema deletion or overly broad internal APIs.
- Adds a production dependency before multiple personal-data domains exist.
- Can become a sensitive data catalog if it stores raw identifiers and request details.

Reject for v1.

### Service-Owned Lifecycle Only, No Shared Contract

Pros:

- Simple per service.
- Fast to implement.

Cons:

- Different services will define retention and restore differently.
- Privacy requests become manual and inconsistent.
- Old backup restore can accidentally revive deleted or redacted data.
- Asset bytes can outlive domain records without a clear owner decision.

Reject as incomplete.

### Service-Owned Lifecycle With Shared Contract

Pros:

- Keeps domain ownership.
- Gives common lifecycle states and evidence.
- Makes restore safety testable.
- Allows future privacy orchestration without data model rewrites.

Use this.

## Lifecycle States

Use these logical states even if each service stores them with service-specific columns:

| State | Meaning | Public Exposure |
| --- | --- | --- |
| `active` | normal current record | according to visibility/publish rules |
| `soft_deleted` | hidden immediately, retained for recovery window | none |
| `redacted` | sensitive fields replaced or removed, evidence remains | only safe fields |
| `anonymized` | personal identity irreversibly removed, aggregate record may remain | only non-personal aggregate |
| `hard_deleted` | record and bytes removed after retention policy | none |
| `legal_hold` | destructive lifecycle actions paused | according to domain policy |
| `restored_pending_reconciliation` | restored from backup but not approved for traffic | none |

Public routes must hide `soft_deleted`, `hard_deleted`, quarantined, scan-failed, and non-public records immediately.

Admin routes can show soft-deleted records only when a scoped recovery workflow exists.

## Required Columns For Non-Public Data

Services that store non-public, personal, or recoverable records should include:

```text
created_at
updated_at
deleted_at
delete_after
retention_class
legal_hold_until
legal_hold_reason
redaction_version
last_lifecycle_event_id
```

Guidance:

- `deleted_at` hides the record immediately.
- `delete_after` is the earliest hard-delete time.
- `retention_class` maps to service policy.
- `legal_hold_until` pauses retention workers.
- `legal_hold_reason` must be short and avoid sensitive narrative text.
- `redaction_version` lets restored data reapply the latest redaction rules.
- `last_lifecycle_event_id` points to the latest service-owned lifecycle ledger event.

Public-only content tables do not need every column if the existing CMS lifecycle already provides draft/published/archive/delete behavior. Sensitive or personal domains must add the full set before launch.

## Lifecycle Ledger

Every service with deletion, redaction, or retention behavior must maintain a lifecycle ledger in its own schema.

Suggested table:

```sql
create table service_schema.lifecycle_event (
  id uuid primary key,
  event_type text not null,
  resource_type text not null,
  resource_id text not null,
  resource_version bigint null,
  subject_type text null,
  subject_hash text null,
  retention_class text not null,
  occurred_at timestamptz not null,
  effective_at timestamptz null,
  requested_by text not null,
  reason_code text not null,
  metadata_json jsonb not null default '{}'::jsonb,
  idempotency_key text not null,
  created_at timestamptz not null,
  constraint lifecycle_event_metadata_is_object check (jsonb_typeof(metadata_json) = 'object')
);

create unique index lifecycle_event_idempotency_uq
  on service_schema.lifecycle_event(idempotency_key);

create index lifecycle_event_resource_idx
  on service_schema.lifecycle_event(resource_type, resource_id, occurred_at desc);
```

Event types:

- `soft_delete_requested`
- `soft_deleted`
- `restore_requested`
- `restored`
- `redaction_requested`
- `redacted`
- `anonymization_requested`
- `anonymized`
- `hard_delete_due`
- `hard_deleted`
- `legal_hold_applied`
- `legal_hold_released`
- `restore_reconciliation_started`
- `restore_reconciliation_completed`

Rules:

- The lifecycle ledger is not a replacement for `audit-log`.
- The ledger is operational state owned by the service so restore jobs can replay privacy actions.
- `audit-log` receives accountability events with minimal metadata.
- Lifecycle metadata must not store raw personal request text, tokens, provider secrets, Blob URLs, or sensitive narrative content.
- Retain lifecycle ledger rows at least as long as the maximum backup retention window plus the longest restore verification window.

## Retention Workers

Every service that stores data with expiration must own a retention worker.

Worker behavior:

1. Select records where `delete_after <= now()`.
2. Exclude records with active `legal_hold_until`.
3. Re-check domain state and references.
4. Run dry-run mode in staging and before first production enablement.
5. Apply hard delete, redaction, or anonymization according to policy.
6. Append a lifecycle ledger event.
7. Emit audit event through producer outbox.
8. Emit metrics for scanned, skipped, held, deleted, redacted, failed.

Retention workers must be idempotent. Re-running after a crash must not recreate public visibility, duplicate deletes, or remove records that newly entered legal hold.

## Privacy Request Workflow

V1 can use an operator runbook instead of a public self-service privacy portal.

Workflow:

1. Verify requester identity and authority outside public APIs.
2. Create an operator case in the owning operational system or secure admin note.
3. Identify owner services by stable identifiers such as account id, email hash, LINE source hash, or domain resource id.
4. Ask each owner service to report matching records through scoped admin/internal procedures.
5. Classify each record: retain, soft delete, hard delete after retention, anonymize, redact, or legal hold.
6. Execute service-owned lifecycle commands with idempotency keys.
7. Append audit events for operator actions.
8. Verify public/protected APIs no longer expose deleted or redacted data.
9. Record evidence without storing raw sensitive request text in audit metadata.

Do not let one service directly delete another service's rows.

## Service-Specific Rules

### `account-api`

Account lifecycle:

- Disable or suspend is not the same as deletion.
- Refresh token families must be revoked on disable, offboarding, role downgrade, password reset, and suspected compromise.
- Account deletion or anonymization must preserve minimal audit referential integrity through stable non-reversible actor hashes.
- Access JWTs expire naturally; emergency denylist is only for high-risk incidents.

### `hhc-web-api`

CMS lifecycle:

- Unpublish removes public projections, sitemap entries, public search documents, and public asset grants when no other published content references the asset.
- Archive keeps admin history but removes public exposure.
- Soft delete hides admin default views and public routes immediately.
- Hard delete of CMS source should be rare for published church history; prefer archive plus retention policy unless policy owner approves removal.
- Restore from soft delete does not automatically publish; it returns to draft or archived state according to admin workflow.

### `asset-api`

Asset lifecycle:

- Owner service decides whether an asset is still needed.
- `asset-api` enforces namespace retention, grants, scan state, and hard-delete mechanics.
- Public grants must be revoked before or with public content unpublish.
- Hard delete requires no active grants, no active owner references, no legal hold, and namespace retention eligibility.
- Blob soft delete/versioning protects against accidental deletion but does not override service retention policy.
- Orphan assets must be reported to owner services before hard delete unless namespace policy allows automatic cleanup.

### `audit-log`

Audit lifecycle:

- Audit events are append-only.
- Corrections are new events, not edits.
- Redaction is allowed only for explicitly approved metadata fields and must append an `audit.redaction.apply` event.
- Audit partitions can be exported for tamper-evidence before cold retention.
- Audit retention should be long enough for admin accountability, but metadata must stay minimal so audit evidence can outlive account deletion.

### `notification-api`

Notification lifecycle:

- Delivery status can be retained for troubleshooting and audit windows.
- Full rendered message bodies should not be stored by default.
- Recipient identifiers should be hashed or minimized where possible.
- Suppression records are personal/operational records and require scoped admin access.
- Provider callbacks must follow short-retention diagnostic logging unless an incident requires longer hold.

### `hhc-line-function-bot`

LINE lifecycle:

- Weekly bulletin download does not need LINE identity storage.
- Future group file storage must define group-level retention and deletion policy before broad launch.
- LINE source ids should be hashed or provider-scoped where possible.
- Group file metadata deletion must coordinate with `asset-api` asset grants and retention.

## Asset Reference Cleanup

Owner services must maintain normalized asset references.

Required behavior:

- On publish, owner service records active public references and asks `asset-api` for public grants.
- On unpublish/delete, owner service updates references and asks `asset-api` to revoke public grants when no other published resource needs the asset.
- On hard delete of owner resource, owner service either deletes related private assets or marks them for retention cleanup according to namespace policy.
- `asset-api` can run orphan detection, but it must not infer business meaning beyond owner service, namespace, grants, and references.

## Legal Hold

Legal hold pauses destructive lifecycle actions.

Rules:

- Legal hold must be scoped to resource, subject, namespace, or case.
- Hold reason should use a short reason code, not sensitive narrative text.
- Hold application and release are audited.
- Retention workers must skip held records and emit held-count metrics.
- Public exposure rules still apply. Legal hold does not make deleted or private records public.
- Restored environments must import active legal holds before retention workers run.

## Backup And Restore Reconciliation

Platform-level backup settings, data-store recovery choices, RPO/RTO targets, restore quarantine controls, and DR evidence packets are defined in `docs/superpowers/specs/2026-07-08-hhc-platform-backup-restore-and-disaster-recovery-design.md`. This section defines the service-owned lifecycle reconciliation that must run after those platform restore steps.

Backups preserve old data. A backup restore can revive data that was deleted or redacted after the restore point unless reconciliation runs before traffic.

Restore environments must start quarantined:

- no public gateway route
- provider callbacks disabled
- notification sends disabled or fake provider only
- LINE webhooks disabled
- admin access limited to recovery operators
- retention workers disabled until reconciliation imports current legal holds

Restore sequence:

1. Restore PostgreSQL to a chosen point.
2. Restore or connect Blob data according to environment policy.
3. Keep Redis empty or flush it.
4. Import lifecycle ledger events newer than the restore point from the authoritative source or exported lifecycle/audit evidence.
5. Reapply soft deletes, hard deletes, redactions, anonymizations, and legal holds.
6. Rebuild public projections, search documents, and sitemap data from reconciled state.
7. Re-run asset grant consistency checks.
8. Run public leakage tests.
9. Run smoke tests.
10. Promote only after reconciliation evidence is captured.

If lifecycle ledger events cannot be recovered, do not promote the restored environment to production until the privacy risk is reviewed and accepted by the policy owner.

## RPO And RTO Defaults

Initial engineering targets:

| Data/Surface | RPO | RTO | Notes |
| --- | --- | --- | --- |
| Account auth/JWKS | 15 minutes | 2 hours | Gateway JWKS cache can cover short account outage |
| Public CMS content/projections | 15 minutes | 4 hours | Projections rebuild from PostgreSQL |
| Public asset metadata | 15 minutes | 4 hours | Blob restore may dominate large-file recovery |
| Blob bytes | storage policy-defined | 8 hours | Use soft delete/versioning where cost allows |
| Audit append evidence | 15 minutes | 8 hours | Producer outboxes retain audit intent |
| Notification delivery state | 1 hour | 24 hours | Provider delivery can be retried or reconciled |
| LINE optional functions | 24 hours | 24 hours | Public website remains source of truth |

These are starting points. Production RPO/RTO must be reviewed against cost, staffing, and ministry impact.

## Non-Production Restores

Production data restored to non-production must be sanitized unless the environment is explicitly approved for incident response.

Rules:

- Disable public ingress.
- Disable provider sends and callbacks.
- Replace secrets with non-production secrets.
- Redact or hash personal identifiers where the test does not require them.
- Do not expose production Blob URLs or SAS URLs.
- Record who approved the restore, purpose, start/end time, and cleanup evidence.

## Future Privacy Orchestrator Trigger

Create a dedicated privacy/lifecycle orchestrator only when at least one is true:

- multiple personal-data domains are live
- privacy requests become frequent enough to need workflow tracking
- legal hold cases span several services
- operators need a single case view with service-level status
- regulatory obligations require formal request deadlines and evidence packets

Even then, the orchestrator should coordinate service-owned APIs. It should not directly query or delete another service's database.

## Tests

Required tests:

- Soft-deleted records disappear from public APIs immediately.
- Public projections, sitemap, and search documents are removed or refreshed after unpublish/delete.
- Retention worker skips legal-hold records.
- Retention worker is idempotent across retries.
- Asset hard delete requires no active grants and no active owner references.
- Audit redaction applies only allowlisted fields and appends a redaction event.
- Restore reconciliation replays deletion/redaction events newer than restore point.
- Restored public projections do not expose records deleted before promotion.
- Non-production restore uses fake providers and no public ingress.
- Lifecycle ledger idempotency rejects conflicting duplicate events.

## Acceptance Criteria

- No v1 `privacy-api`, `retention-api`, or `recovery-api` is required.
- Every service that stores non-public/recoverable data owns lifecycle procedures.
- Lifecycle ledger exists for services with deletion/redaction/retention behavior.
- Retention workers check legal hold and emit audit events.
- Asset deletion coordinates owner references, grants, namespace policy, and Blob retention.
- Restores are quarantined and reconciled before public traffic.
- Backup restore evidence includes deletion/redaction/legal-hold replay.
- Future privacy orchestrator triggers are explicit.
