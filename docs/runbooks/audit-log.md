# audit-log Runbook

## Service Purpose

`audit-log` stores append-only audit records for protected administrative actions, security-relevant events, operational changes, and selected lifecycle events. It is not a content recovery database and must not be used as the source of truth for CMS rollback.

## Owner And Escalation

- Primary owner: platform/audit engineering
- Escalate to security owner for tamper, missing audit, or suspicious admin activity
- Escalate to data owner for partition/export/retention incidents
- Escalate to caller service owner when producer requests are malformed or missing required metadata

## Dependencies

- PostgreSQL audit schema or dedicated audit storage
- Caller service outboxes for durable audit intent when allowed
- Time synchronization and request/correlation id propagation
- Export target for closed partitions when enabled

## Health And Ready Checks

- `GET /healthz`: process health
- `GET /readyz`: append path available, query path available, storage writable
- Append smoke in staging
- Query smoke for authorized admin/security user in staging
- Partition/export worker status when enabled

## Dashboards And Logs

- append rate and failures by caller
- producer backlog age
- query rate and failures
- storage growth and partition age
- export job success/failure
- retention worker state
- authorization failures for audit query routes

## Page-Worthy Alerts

- audit append unavailable for protected writes
- producer backlog age exceeds threshold
- audit storage write failure
- partition/export failure blocks retention policy
- unexpected audit query access spike
- required metadata missing from producer events

## Common Failure Modes

- append endpoint unavailable
- caller cannot reach internal private route
- producer sends incomplete audit metadata
- partition growth or index bloat affects query performance
- export target unavailable
- retention worker risks deleting records still under legal hold

## Quick Triage

1. Determine whether the issue is append, query, producer backlog, partition/export, or retention.
2. Identify caller service and protected workflow.
3. Check whether caller has local outbox for audit intent.
4. Check storage health and migration version.
5. Preserve request id, correlation id, actor id hash/reference, and audit event id where safe.

## Mitigation Actions

- Fail closed protected writes if audit intent cannot be recorded and caller has no durable local outbox.
- Pause retention worker if legal-hold or export state is unclear.
- Reject malformed producer events with stable error codes.
- Scale query path separately only if append path remains protected.
- Keep append path priority higher than query path during incident.

## Rollback Path

- Roll back app revision for query or append regression.
- Prefer roll-forward for schema/index fixes after new audit rows are written.
- Keep producer outbox rows until append succeeds.
- Do not delete audit rows as part of rollback.

## Data Recovery Notes

Audit records are append-only operational evidence. Restore into quarantine and verify monotonic event ids, producer replay state, retention/legal-hold state, and export completeness before promotion.

## Secrets And Key Rotation Notes

Do not log full sensitive metadata. Store actor/resource references according to data classification rules. Audit query access must require protected admin/security authorization.

## Degraded Modes

- Query path can be degraded while append path remains available.
- Protected writes fail closed if no durable audit intent exists.
- Retention/export workers can pause without blocking append.

## Staging Drill

Run append outage and producer backlog replay drill. Evidence must include protected write behavior, local outbox state if used, replay count, append result, and audit query result.

## Production Verification

- Protected admin action creates audit intent or audit record.
- Missing required metadata is rejected.
- Audit query requires authorized role.
- Retention/export worker does not process legally held records.
- Producer backlog drains after audit service recovers.
