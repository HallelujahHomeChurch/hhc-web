# HHC Platform Backup, Restore, And Disaster Recovery Design

## Purpose

This spec defines how the HHC web platform protects, restores, verifies, and promotes production data after accidental deletion, bad releases, provider failure, cloud resource failure, or regional disaster.

It covers:

- PostgreSQL backup and point-in-time restore.
- Blob asset data protection.
- Redis recovery expectations.
- Outbox, event, audit, and notification side-effect recovery.
- Restore quarantine.
- RPO/RTO targets.
- Disaster recovery drills.
- Evidence required before public traffic is attached to a restored environment.

This spec is intentionally operational. It does not create a runtime `backup-api`, `restore-api`, `dr-api`, or `recovery-api`.

## Related Specs

- `docs/superpowers/specs/2026-07-08-hhc-cloud-infrastructure-iac-and-resource-governance-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-cloud-runtime-operations-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-data-lifecycle-deletion-retention-and-restore-orchestration-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-platform-eventing-outbox-reliability.md`
- `docs/superpowers/specs/2026-07-08-hhc-audit-log-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-asset-lifecycle-and-access-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-publication-workflow-consistency-and-reconciliation-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-production-runbook-and-incident-operations-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-production-go-live-edge-routing-and-cutover-design.md`
- `docs/superpowers/plans/2026-07-08-hhc-web-rollout-verification-matrix.md`

## External Alignment

- Azure Database for PostgreSQL Flexible Server backup and restore: `https://learn.microsoft.com/en-us/azure/postgresql/backup-restore/concepts-backup-restore`
- Azure Database for PostgreSQL geo-disaster recovery: `https://learn.microsoft.com/en-us/azure/postgresql/backup-restore/concepts-geo-disaster-recovery`
- Azure Database for PostgreSQL business continuity: `https://learn.microsoft.com/en-us/azure/postgresql/backup-restore/concepts-business-continuity`
- Azure Storage Blob data protection: `https://learn.microsoft.com/en-us/azure/storage/blobs/data-protection-overview`
- Azure Well-Architected guidance for Blob Storage: `https://learn.microsoft.com/en-us/azure/well-architected/service-guides/azure-blob-storage`
- Azure Managed Redis reliability: `https://learn.microsoft.com/en-us/azure/reliability/reliability-managed-redis`
- Azure Managed Redis security and backup guidance: `https://learn.microsoft.com/en-us/azure/redis/secure-azure-managed-redis`

## Core Decision

Treat backup and DR as a platform operating capability, not a product service.

V1 uses:

- managed PostgreSQL backup and point-in-time restore
- service-owned schemas and lifecycle ledgers
- Blob soft delete, container soft delete, immutable object-key discipline, and optional versioning/PITR by storage class
- Redis rebuild from PostgreSQL and events, not Redis restore
- service outboxes for side effects
- audit exports for accountability evidence
- runbooks and release gates for restore drills

Do not create a v1 `backup-api`, `restore-api`, `dr-api`, `recovery-api`, or portal-operated recovery control plane.

Reasons:

- Recovery authority is dangerous and cross-cutting.
- Recovery is infrequent but high-risk; it needs operator approval, evidence, and runbook steps.
- A generic recovery service would need privileged access to every data store before operational demand justifies it.
- Domain services must still reconcile their own deletion, redaction, asset grants, public projections, and provider side effects.

## Recovery Principles

Use these rules for every restore path:

1. Restore into quarantine first.
2. Disable public ingress, provider sends, provider callbacks, LINE webhooks, scheduled workers, and retention workers until reconciliation is complete.
3. Treat PostgreSQL as the source of truth for domain state.
4. Treat Redis as rebuildable.
5. Treat Blob storage as bytes plus metadata owned by `asset-api`, not as authorization state.
6. Treat audit logs as accountability evidence, not as a domain recovery database.
7. Reapply lifecycle events newer than the restore point before traffic.
8. Rebuild public projections, search, sitemap, and asset grants from reconciled state.
9. Verify negative cases, not only happy-path smoke.
10. Promote only after evidence is attached to the incident or release record.

## Data Store Classification

| Store | Role | Backup Strategy | Restore Strategy | Source Of Truth |
| --- | --- | --- | --- | --- |
| PostgreSQL service schemas | durable domain state | managed PITR, production retention window, optional geo-redundant backup | restore to new server, run reconciliation, promote only after smoke | yes |
| PostgreSQL outbox tables | durable side-effect intent | included in PostgreSQL backups | inspect dedupe keys and replay policy before workers resume | yes for side-effect intent |
| PostgreSQL lifecycle ledgers | deletion/redaction/legal-hold evidence | included in PostgreSQL backups; export when needed | replay events newer than restore point before traffic | yes for lifecycle state |
| Redis | cache/projection acceleration only | no required v1 backup | flush and rebuild from PostgreSQL/projection jobs | no |
| Blob assets | file bytes and derivatives | soft delete, container soft delete, versioning/PITR where cost justified, immutable exports for audit artifacts | restore bytes, then require `asset-api` metadata/grant/scan reconciliation | bytes only |
| Audit log | append-only accountability | PostgreSQL backup plus optional partition export to immutable Blob | restore to quarantine, verify retention/legal-hold/redaction state | evidence, not domain source |
| Provider systems | external side effects | provider-native history when available | reconcile by idempotency keys and callbacks; do not blindly resend | no |

## PostgreSQL Backup Design

Production PostgreSQL must be created with an explicit backup decision in IaC.

Minimum production rules:

- Enable point-in-time restore.
- Set a retention window that covers the operational mistake window. Recommended v1 default: 14 days. Minimum: 7 days.
- Review whether to enable geo-redundant backup at server creation. This is a creation-time decision and must be recorded because it cannot be changed later without reprovisioning.
- Use resource locks or equivalent guardrails to reduce accidental server deletion risk.
- Keep staging restore capability close enough to production that quarterly restore drills are realistic.
- Monitor backup storage consumption and WAL growth.

Recommended v1 decision:

- Enable geo-redundant backup for production unless cost is explicitly rejected by the platform owner.
- Do not add cross-region read replicas in v1 unless the church chooses a sub-hour regional RTO target.
- Keep the first implementation PITR-based because the expected public website and CMS workload can tolerate several hours of recovery better than the team can tolerate replica promotion complexity.

Restore behavior:

1. Restore to a new PostgreSQL server. Never overwrite the active server in place.
2. Keep the restored server unreachable from public apps.
3. Point a recovery deployment or recovery job at the restored server.
4. Import lifecycle events, legal holds, and emergency takedowns newer than the restore point.
5. Reconcile schema migrations and application compatibility before workers run.
6. Promote by changing app configuration and routing only after recovery evidence is reviewed.

## Blob Asset Protection

`asset-api` owns the logical asset layer. Azure Blob Storage is a provider behind that service.

V1 asset protection rules:

- Store application asset objects with immutable object keys. Do not overwrite an existing object key with different bytes.
- Enable container soft delete for asset storage accounts.
- Enable blob soft delete for asset storage accounts.
- Enable blob versioning when write frequency and cost are acceptable. Immutable object keys reduce overwrite risk, but versioning still protects against accidental overwrite paths and operational mistakes.
- Consider Blob point-in-time restore for production public and restricted asset containers when cost and storage-account constraints are acceptable.
- Use immutable storage only for audit exports, legal hold exports, or explicitly approved archive containers. Do not apply broad immutability to normal CMS upload containers without a lifecycle-cost review.
- Keep derivative files rebuildable where possible. Source originals are more important than generated thumbnails or previews.

Restore behavior:

1. Restore or undelete Blob objects or containers according to the incident.
2. Mark restored assets unavailable until `asset-api` verifies metadata, checksum, MIME type, scan status, deleted state, grants, namespace policy, and owner references.
3. Rebuild derivatives only after the source object passes validation.
4. Recreate public/protected download URLs from `asset-api`; never expose raw Blob URLs, SAS URLs, or storage account paths.

## Redis Recovery

Redis is not a durable system of record in v1.

Rules:

- Do not store unrecoverable user data, role state, publication state, asset grants, notification intent, or audit evidence only in Redis.
- Redis persistence is not required for v1 public website recovery.
- If Redis data is corrupted, flush the owning prefix and rebuild from PostgreSQL.
- If Redis is unavailable, public read routes should degrade to PostgreSQL reads or return cache-miss rebuild behavior within SLO limits.
- If a future feature needs durable queue semantics, use PostgreSQL outbox, a managed queue, or a service-owned database table. Do not promote Redis to a hidden source of truth.

Redis backup/export is optional only for future use cases where the data is expensive to rebuild but still non-authoritative.

## Outbox And Event Recovery

Outbox tables are part of service-owned PostgreSQL state. Restore can bring back old unsent or already-sent side effects.

Rules:

- Every outbox message has a stable idempotency key.
- Workers must be disabled during restore reconciliation.
- Before workers resume, each service classifies outbox rows as `safe_to_send`, `already_delivered`, `cancelled_by_lifecycle`, `requires_operator_review`, or `dead_letter`.
- Notification sends must not resume until provider dedupe behavior, suppression state, and recipient policy are checked.
- Audit append outbox messages may replay if idempotency prevents duplicate audit rows.
- Projection rebuild events can be regenerated instead of replayed if rebuilding from PostgreSQL is safer.

Never blindly resume side-effect workers after pointing an app at a restored database.

## Public Website Recovery

For website-facing content, recovery is complete only when public surfaces match reconciled state.

Required rebuild sequence:

1. Verify current schema version and app compatibility.
2. Apply lifecycle reconciliation.
3. Rebuild `hhc-web-api` public projections.
4. Flush Redis public prefixes.
5. Rebuild public search documents if enabled.
6. Rebuild sitemap and robots metadata.
7. Revalidate asset grants for published content.
8. Smoke public routes, admin routes, preview routes, and denied routes.
9. Run leakage checks for draft, archived, deleted, private, restricted, infected, and scan-failed data.
10. Run LINE weekly bulletin lookup for latest and selected issue if the incident can affect bulletin routes.

## Account And Gateway Recovery

Auth recovery must prioritize fail-closed behavior.

Rules:

- `api-gateway` continues to validate access JWTs locally from cached/current JWKS. It must not call `account-api` per request during recovery.
- `account-api` owns refresh token families and revocation state.
- A restored account database must reconcile token family revocations, disabled accounts, admin role changes, signing key state, and emergency denylist state before refresh/token endpoints are enabled.
- If account state is uncertain, protected admin routes remain unavailable instead of weakening gateway policy.
- Signing-key rotation, refresh-token revocation, and gateway JWKS cache behavior must be part of the DR drill program.

## Notification And External Provider Recovery

Provider side effects need stricter review than normal domain rows.

Rules:

- Disable notification sends by kill switch in restore environments.
- Disable or isolate provider callbacks until the restored environment is approved.
- Do not resend emails, messages, or provider calls only because an outbox row exists.
- Use idempotency keys and provider message ids to detect already-delivered notifications.
- Suppression and consent state must be reconciled before sends resume.
- Template versions used by restored messages must be available or the message must be reviewed.

## RPO And RTO Targets

Initial engineering targets:

| Surface | RPO Target | RTO Target | Recovery Method |
| --- | --- | --- | --- |
| Gateway route policy | last approved release artifact | 30 minutes | rollback route policy/config |
| Account token/JWKS state | 15 minutes | 2 hours | PostgreSQL PITR plus signing-key/revocation reconciliation |
| CMS source data | 15 minutes | 4 hours | PostgreSQL PITR plus lifecycle reconciliation |
| Public projections/search/sitemap | rebuildable | 2 hours after DB restore | rebuild from reconciled PostgreSQL |
| Asset metadata | 15 minutes | 4 hours | PostgreSQL PITR plus asset reconciliation |
| Blob source objects | storage policy-defined | 8 hours | Blob soft delete/version/PITR restore plus scan/grant checks |
| Redis | rebuildable | 1 hour | flush/rebuild prefixes |
| Audit append path | 15 minutes | 8 hours | PostgreSQL PITR plus idempotent audit replay/export verification |
| Notification intent | 1 hour | 24 hours | PostgreSQL PITR plus provider dedupe review |
| LINE weekly bulletin command | depends on public API | 4 hours | public API recovery plus LINE smoke |

These are engineering targets, not legal guarantees. Production launch must record the accepted targets and the cost tradeoff behind them.

## Disaster Classes

| Disaster | Primary Response | Avoid |
| --- | --- | --- |
| Bad application release | rollback revision or feature flag | database restore unless data was corrupted |
| Bad migration | stop writers, assess forward fix vs restore, use migration compatibility rules | ad hoc table edits without backup point |
| Accidental content delete | CMS revision restore or soft-delete restore | full database restore for one content item |
| Asset accidental delete | Blob undelete/version restore plus `asset-api` reconciliation | raw Blob public exposure |
| Redis corruption | flush prefix and rebuild | treating Redis export as source of truth |
| Account revocation corruption | fail protected routes closed, restore account state, reconcile revocations | weakening JWT validation |
| Notification duplicate risk | pause sends, review outbox and provider ids | blind replay |
| Region failure | geo-restore PostgreSQL or restore from backup, redeploy app stack, attach domains after smoke | partial manual failover with unknown data age |

## Restore Quarantine Environment

Every restore starts in a quarantine posture.

Required controls:

- no public DNS target
- no public gateway route
- admin access only for recovery operators
- provider sends disabled
- provider callbacks disabled or pointed to staging-only endpoint
- LINE webhooks disabled
- scheduled jobs disabled
- retention workers disabled
- read-only mode by default until reconciliation jobs are ready
- secrets are recovery-scoped, not copied from production by hand
- logs and evidence are tagged with restore incident id

Promotion requires an explicit operator decision. A restored environment must never become public because it reused production hostnames, production DNS, or broad wildcard routing.

## Restore Runbook Sequence

Use this sequence for full-environment recovery:

1. Declare incident and choose restore point.
2. Freeze production-impacting changes.
3. Record current release manifest, config fingerprint, route policy, DB server, Redis instance, storage account, and active workers.
4. Restore PostgreSQL to a new server.
5. Restore or validate Blob data needed for the selected point.
6. Deploy recovery app revisions with public ingress disabled.
7. Run schema compatibility check.
8. Disable workers by default.
9. Import lifecycle and legal-hold state newer than restore point.
10. Reconcile deleted, redacted, anonymized, and held records.
11. Reconcile account revocations and signing-key state.
12. Reconcile asset grants, scan state, owner references, and derivatives.
13. Classify outbox rows and external provider side effects.
14. Rebuild public projections, Redis prefixes, search, sitemap, and route metadata.
15. Run positive smoke checks.
16. Run negative leakage checks.
17. Run service-specific runbook checks.
18. Decide whether to promote, abandon restore, or continue degraded.
19. Attach public routing only after approval.
20. Monitor elevated metrics until the incident is closed.

## Drill Program

Run these before production launch and then at least quarterly for high-risk paths:

| Drill | Scope | Evidence |
| --- | --- | --- |
| PostgreSQL PITR quarantine | restore to new server, no public traffic, lifecycle replay | restore point, RPO, RTO, restored server id, reconciliation report |
| Redis flush/rebuild | public projection cache loss | flushed prefixes, rebuild job id, route smoke |
| Asset restore reconciliation | Blob soft delete/version restore | asset id, object version, grant state, scan state, public URL result |
| Outbox replay control | notification/audit/projection side effects | outbox counts, dedupe keys, replay/cancel decisions |
| Account recovery | JWKS, refresh revocation, admin role state | key ids, revoke evidence, protected route result |
| Public leakage check | draft/deleted/private content after restore | route list, expected denied resources, actual response codes |
| Region restore tabletop | production regional outage path | chosen restore method, DNS plan, data age estimate, owner approval |

Drills should run in staging or a recovery environment. Do not run destructive restore drills against the active production server.

## IaC And Release Gates

IaC must declare:

- PostgreSQL backup retention.
- PostgreSQL backup redundancy decision.
- storage account soft delete settings.
- storage account versioning/PITR decision.
- immutable containers for audit exports if enabled.
- Redis persistence/export decision if enabled.
- resource locks where used.
- alerting for backup failures, storage protection drift, and restore drill age.

Production release gates must reject:

- disabling PostgreSQL backups or reducing backup retention without explicit approval
- changing geo-redundant backup posture without replacement plan
- disabling Blob soft delete or container soft delete without explicit approval
- adding durable state to Redis without a source-of-truth design
- enabling provider sends in a restore environment
- attaching public DNS to a restore environment before reconciliation evidence exists

## Evidence Packet

Every production restore or DR drill must produce an evidence packet with:

- incident or drill id
- restore owner
- selected restore point and reason
- data stores restored or intentionally rebuilt
- measured RPO and RTO
- release manifest and config fingerprint
- schema compatibility result
- lifecycle/legal-hold reconciliation result
- account revocation/JWKS reconciliation result when relevant
- asset grant/Blob reconciliation result when relevant
- outbox/provider side-effect classification when relevant
- Redis/projection/search/sitemap rebuild result
- positive smoke result
- negative leakage result
- final promote/abandon/degraded decision
- follow-up items

Evidence must not contain secrets, tokens, cookies, raw personal data, SAS URLs, or provider API keys.

## Future Escalation Criteria

Consider adding stronger DR automation only when one of these becomes true:

- restore drills are too slow because manual evidence collection dominates
- multiple services have frequent recovery cases
- the platform has sensitive member, pastoral-care, donation, or event registration data
- RTO target drops below what manual PITR and runbook steps can meet
- the team needs cross-region active/passive or active/active operations

Even then, automation should orchestrate service-owned recovery APIs and IaC tasks. It should not directly mutate every service database.

## Tests And Verification

Required verification:

- PostgreSQL PITR drill restores to a new server.
- Restored environment has no public gateway route before approval.
- Redis can be flushed and rebuilt from PostgreSQL.
- Asset restore does not create a public download until `asset-api` reconciliation passes.
- Deleted/redacted/legal-hold lifecycle events newer than restore point are replayed before traffic.
- Notification sends remain disabled until outbox/provider reconciliation passes.
- Public APIs do not return draft, archived, deleted, private, restricted, infected, scan-failed, or stale projection data after restore.
- LINE bulletin lookup works after public API and asset URL recovery.
- IaC checks fail if required backup/data-protection settings are removed.

## Acceptance Criteria

- Backup and DR are defined as platform operations, not a new v1 service.
- PostgreSQL PITR, retention, geo-redundancy decision, and restore-to-new-server behavior are explicit.
- Blob soft delete, container soft delete, versioning/PITR decision, and asset reconciliation are explicit.
- Redis remains rebuildable and non-authoritative.
- Outbox and provider side-effect recovery require idempotency and operator review.
- Restore quarantine prevents public traffic, provider sends, callbacks, LINE webhooks, and workers from running before reconciliation.
- RPO/RTO targets are documented and measurable.
- DR drills and evidence packets are required before production launch and during steady-state operations.
