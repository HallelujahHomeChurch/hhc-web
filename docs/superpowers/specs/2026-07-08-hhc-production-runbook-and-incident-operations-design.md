# HHC Production Runbook And Incident Operations Design

## Purpose

This spec turns the platform SLO and observability rules into production operating behavior. It defines how the HHC web platform detects, classifies, mitigates, recovers from, and learns from incidents across `api-gateway`, `account-api`, `hhc-web`, `hhc-web-api`, `asset-api`, `notification-api`, `audit-log`, and `hhc-line-function-bot`.

The goal is not to create a large operations product. The goal is to make production support repeatable enough that the team can operate a small microservice platform without depending on tribal knowledge.

## Related Specs

- `docs/superpowers/specs/2026-07-08-hhc-platform-slo-observability-and-runbook-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-cloud-runtime-operations-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-cloud-infrastructure-iac-and-resource-governance-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-deployment-compatibility-migration-and-release-governance-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-data-lifecycle-deletion-retention-and-restore-orchestration-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-api-gateway-authentication-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-internal-service-identity-and-private-route-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-service-catalog-and-ownership-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-production-go-live-edge-routing-and-cutover-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-platform-backup-restore-and-disaster-recovery-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-background-jobs-scheduled-tasks-and-worker-orchestration-design.md`

## External Alignment

- Azure Well-Architected Framework incident management: `https://learn.microsoft.com/en-us/azure/well-architected/operational-excellence/incident-response`
- Azure Well-Architected Framework reliability monitoring: `https://learn.microsoft.com/en-us/azure/well-architected/reliability/monitoring`
- Azure Well-Architected Framework standard operations: `https://learn.microsoft.com/en-us/azure/well-architected/operational-excellence/formalize-operations-tasks`
- Azure Well-Architected Framework disaster recovery: `https://learn.microsoft.com/en-us/azure/well-architected/reliability/disaster-recovery`

## Core Decision

Use repository-owned runbooks and lightweight incident command rules in v1. Do not create an `incident-api`, `runbook-api`, or operations database for the first release.

This keeps the system practical:

- alerts point to service runbooks in `docs/runbooks/`
- rollout evidence links the exact runbook used for a release
- incident notes can live in the team's issue tracker or document system
- operational automation can be added later only when a repeated manual action is proven

Runbook ownership belongs to the service owner. Incident command belongs to the active operator for the incident, not to an application service.

## Production Operating Model

Production operations are split into three layers.

| Layer | Responsibility | v1 Implementation |
| --- | --- | --- |
| Platform operations | gateway routes, ingress, identity, IaC, environment health, shared observability | `api-gateway`, cloud runtime, IaC, Azure Monitor/App Insights dashboards |
| Service operations | service-specific health, dependencies, rollback, data recovery, degraded modes | one runbook per deployable service |
| Incident command | severity, owner, timeline, communication, mitigation choice, post-incident follow-up | `docs/runbooks/platform-incident-command.md` plus issue/doc notes |

The platform should remain small enough that a single operator can triage the first 15 minutes of most incidents using the incident command runbook, dashboards, and service runbooks.

## Severity Model

Use the same severity levels as the SLO spec, with explicit response behavior.

| Severity | User Impact | Response Rule | Required Follow-Up |
| --- | --- | --- | --- |
| SEV1 | Broad public outage, unsafe auth behavior, data exposure, or admin security risk | Immediate incident command; stabilize before feature work | Post-incident note, owner, prevention item |
| SEV2 | Major user workflow blocked, publish unavailable, public asset downloads broken, LINE bulletin download broken | Incident owner assigned; mitigation or rollback decision required | Short post-incident note |
| SEV3 | Degraded behavior with workaround, delayed notification, non-critical bot command failure | Track as operational issue; page only if trend worsens | Fix or accept with owner |
| SEV4 | Documentation gap, noisy alert, dashboard issue, low-risk defect | Normal backlog | Update runbook or alert rule |

SEV1 and SEV2 incidents must be declared with:

- start time and detected source
- incident commander
- technical lead
- affected services
- current user-visible impact
- mitigation path: rollback, kill switch, scale, dependency recovery, or degraded mode

## Incident Lifecycle

Use this lifecycle for SEV1 and SEV2.

1. Detect: alert, support report, synthetic test, manual check, or deployment failure.
2. Declare: assign severity and incident commander.
3. Triage: identify the first failing user flow and the first failing service boundary.
4. Stabilize: stop the blast radius using rollback, route block, feature flag, kill switch, scale, or provider disable.
5. Communicate: record user impact, internal status, and expected next update time.
6. Mitigate: restore the user-facing workflow using the lowest-risk path.
7. Recover: return dependencies and workers to normal operation.
8. Verify: run route, auth, data, asset, and worker smoke checks.
9. Close: record impact window and final state.
10. Learn: create follow-up items for prevention, observability, runbook, or architecture changes.

## First 15 Minutes

The first 15 minutes should avoid deep debugging unless the blast radius is already contained.

Initial operator flow:

1. Open `docs/runbooks/platform-incident-command.md`.
2. Confirm whether the issue is auth/security, public read, admin write, asset download, worker, provider, or LINE bot.
3. Check the `api-gateway` dashboard first because all external traffic passes through it.
4. If gateway is healthy, move to the owning service runbook.
5. Preserve request ids, correlation ids, release manifest id, config fingerprint, and deployment revision.
6. Choose one mitigation path and avoid parallel conflicting changes.
7. Announce the next check-in time in the incident note.

## Mitigation Decision Rules

| Condition | Preferred Action | Avoid |
| --- | --- | --- |
| Bad app revision with no data migration | ACA rollback to previous revision | Hot patching production image by hand |
| Bad gateway route policy | Roll back route policy or block affected route | Routing around auth checks |
| JWT/JWKS validation failure | Fail closed for protected routes; use cached valid JWKS within max stale window | Calling `account-api` per request to compensate |
| Public projection stale or corrupt | Rebuild projection and flush Redis namespace | Editing Redis values manually |
| Asset public URL exposes wrong object | Revoke asset grant and return unavailable state | Exposing raw Blob/SAS URL |
| Notification provider outage | Queue and retry; enable provider kill switch if needed | Dropping notification intent |
| Audit append outage for protected write | Use local outbox if defined, otherwise fail closed | Completing protected write with no audit intent |
| Worker stuck or backlog growing | Pause risky worker if needed, inspect job/outbox ledger, scale or replay idempotently | Manually editing queue tables without runbook evidence |
| Scheduled/manual job missed or failed | Inspect job run ledger, checkpoint, lease owner, and missed-run policy; rerun through protected job path | Starting arbitrary ad hoc scripts against production |
| Restore from backup | Restore into quarantine and reconcile lifecycle state first | Re-attaching public routes before deletion/legal-hold checks |

## Runbook Standard

Every production deployable service must have a runbook under `docs/runbooks/{service-name}.md`.

Required sections:

- service purpose
- owner and escalation path
- dependencies
- health and ready checks
- dashboards and logs
- page-worthy alerts
- common failure modes
- quick triage
- mitigation actions
- rollback path
- data recovery notes
- secrets and key rotation notes
- degraded modes
- staging drill
- production verification

Runbooks must use service names and route classes from the service catalog. They must not document private credentials, production secrets, raw tokens, Blob SAS URLs, or provider API keys.

Go-live incidents and launch-window rollback follow `docs/superpowers/specs/2026-07-08-hhc-production-go-live-edge-routing-and-cutover-design.md`. That launch procedure records DNS/TLS state, traffic-switch decisions, first-admin checks, and post-launch freeze decisions; this incident spec remains the steady-state incident model after launch.

## Required V1 Runbooks

| Runbook | Primary Coverage |
| --- | --- |
| `docs/runbooks/platform-incident-command.md` | severity, owner, timeline, communication, evidence, closeout |
| `docs/runbooks/api-gateway.md` | route policy, JWT verification, trusted headers, public/private route boundary |
| `docs/runbooks/account-api.md` | login, refresh revocation, JWKS, signing key rotation, admin lifecycle |
| `docs/runbooks/hhc-web.md` | public/admin UI delivery, rendering, sitemap/metadata, frontend rollback |
| `docs/runbooks/hhc-web-api.md` | public projections, CMS reads/writes, Redis rebuild, publish consistency |
| `docs/runbooks/asset-api.md` | Blob access, asset grants, public URL generation, scan/quarantine, derivatives |
| `docs/runbooks/notification-api.md` | provider adapters, retry backlog, templates, callback signatures, suppression |
| `docs/runbooks/audit-log.md` | append path, producer backlog, query path, partition/export/retention |
| `docs/runbooks/hhc-line-function-bot.md` | webhook signature, bulletin lookup, reply failure, bot-to-public-api integration |

## Incident Evidence

Every SEV1 and SEV2 note should record:

- incident id
- severity
- start and end time
- detected by
- incident commander
- technical lead
- affected services and route classes
- user-visible impact
- release manifest id if a release is related
- config fingerprint if config is related
- request ids or correlation ids
- mitigation taken
- verification checks
- follow-up owner

For security, token, auth, or data incidents, preserve audit references and relevant request ids. Do not paste secrets, tokens, cookies, SAS URLs, or private member data into incident notes.

## Post-Incident Review

SEV1 and SEV2 reviews are short and blameless.

Required questions:

- What user-visible workflow failed?
- What signal detected it first?
- What signal should have detected it earlier?
- What stopped the blast radius?
- Was rollback, kill switch, degraded mode, or restore path clear?
- Did the runbook work as written?
- Which prevention item has one accountable owner?

Follow-up categories:

- product behavior
- service implementation
- gateway/auth policy
- observability or alert threshold
- runbook documentation
- IaC or release pipeline
- data recovery or lifecycle policy

## Drill Program

Run operational drills before production launch and then at least quarterly for the highest-risk areas.

| Drill | Purpose | Minimum Evidence |
| --- | --- | --- |
| Gateway route rollback | Prove bad public or admin route policy can be reverted | old/new route policy id, rollback command, smoke result |
| JWKS rotation and rollback | Prove gateway validates both current and previous signing keys during rotation | key ids, cache behavior, protected route result |
| PostgreSQL restore quarantine | Prove restore does not leak stale/deleted/private data | RPO/RTO, lifecycle replay, projection rebuild, leakage check |
| Full backup/DR evidence packet | Prove restore decisions are reviewable and repeatable | restore point, data stores, RPO/RTO, release/config fingerprint, reconciliation, smoke, negative leakage, promote/abandon decision |
| Redis public projection rebuild | Prove public pages recover after Redis flush | rebuild command, route smoke result, cache key sample |
| Asset emergency takedown | Prove public asset grants can be revoked quickly | affected asset id, public URL 404/410/403 result, audit entry |
| Notification provider disable | Prove sends can be paused without losing intent | kill switch state, queued outbox count, retry recovery |
| Audit append outage | Prove protected write behavior fails closed or records durable audit intent | simulated failure, write result, recovery result |
| LINE bulletin download | Prove bot can fetch latest and selected bulletin through public contract | command input, API response, reply result |

## Production Promotion Gate

A service cannot receive production traffic until:

- runbook exists in `docs/runbooks/`
- dashboard link or query name is recorded
- page-worthy alerts are mapped to runbook sections
- rollback path is tested in staging
- degraded mode is documented
- data recovery behavior is documented if the service is stateful
- production verification checks are included in rollout evidence

This gate applies to `hhc-web-api` even though it is mainly a public backend facade. It also applies to non-public services like `notification-api` and `audit-log` because callers rely on them during protected workflows.

## Future Automation Boundary

Automation should be added only after a manual action appears repeatedly in incidents or drills.

Good automation candidates:

- collecting correlated logs for an incident id
- comparing gateway route policy with OpenAPI metadata
- rebuilding public projections
- generating a read-only incident evidence bundle
- running staging smoke checks after rollback

Actions that should require human approval in v1:

- disabling auth checks
- deleting or redacting production data
- restoring production databases
- making public a restored environment
- rotating account signing keys
- changing public/private asset grants in bulk

## Acceptance Criteria

- `docs/runbooks/` contains a platform incident command runbook and one runbook per v1 deployable service.
- SLO, cloud runtime, service blueprint, roadmap, rollout matrix, and phase plan link to the production runbook design.
- Release readiness requires runbook evidence for production-routed services.
- SEV1 and SEV2 incidents have a required lifecycle, evidence set, and post-incident review.
- Restore, rollback, asset takedown, JWKS rotation, notification pause, audit outage, and LINE bulletin drills are explicitly covered.
- V1 avoids a standalone operations service while preserving a clear path to automate repeated operational actions later.
