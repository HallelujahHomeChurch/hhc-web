# HHC Runbooks

This directory contains the production runbooks for the HHC web platform. Each deployable service must have a runbook before it receives production traffic.

## Operating Rules

- Start with `platform-incident-command.md` for SEV1 and SEV2 incidents.
- Use the owning service runbook after the failing route class or dependency is identified.
- Keep request ids, correlation ids, release manifest ids, and config fingerprints in incident evidence.
- Never paste secrets, tokens, cookies, authorization headers, Blob SAS URLs, provider keys, or private member data into runbooks or incident notes.
- Prefer rollback, kill switch, degraded mode, or queue/retry behavior over manual production data edits.
- For restored environments, keep public ingress and provider callbacks disabled until lifecycle reconciliation and smoke checks pass.
- For backup, restore, and DR drills, use `docs/superpowers/specs/2026-07-08-hhc-platform-backup-restore-and-disaster-recovery-design.md` for restore quarantine, data-store recovery, RPO/RTO, side-effect review, and evidence packet requirements.
- For launch windows, use `docs/superpowers/specs/2026-07-08-hhc-production-go-live-edge-routing-and-cutover-design.md` for DNS, TLS, custom-domain, first-admin, cutover, rollback, and freeze-end evidence.
- For compromised artifact, suspicious dependency, image provenance, or release-evidence incidents, use `docs/superpowers/specs/2026-07-08-hhc-software-supply-chain-artifact-provenance-and-release-security-design.md`; preserve image digest, SBOM/provenance, scan result, ACR audit evidence, and release manifest before mitigation.
- For stuck workers, missed schedules, failed manual jobs, backfills, reconciliation, or worker release changes, use `docs/superpowers/specs/2026-07-08-hhc-background-jobs-scheduled-tasks-and-worker-orchestration-design.md`; preserve job run id, worker id, lease owner, checkpoint, schedule, image digest, and last safe state.

## Required Runbooks

Use `_service-runbook-template.md` when adding a new deployable service or service-owned worker runbook.

| Runbook | Service |
| --- | --- |
| `platform-incident-command.md` | cross-service incident command |
| `api-gateway.md` | `api-gateway` |
| `account-api.md` | `account-api` |
| `hhc-web.md` | `hhc-web` |
| `hhc-web-api.md` | `hhc-web-api` |
| `asset-api.md` | `asset-api` |
| `notification-api.md` | `notification-api` |
| `audit-log.md` | `audit-log` |
| `hhc-line-function-bot.md` | `hhc-line-function-bot` |

## Maintenance

Update the affected runbook when a release changes:

- route behavior
- auth or authorization behavior
- image, dependency, build pipeline, SBOM/provenance, scanner gate, or release manifest behavior
- data ownership or schema
- queue, worker, or retry behavior
- scheduled job, manual job, backfill, worker command, job ledger, schedule, lease, checkpoint, or dead-letter behavior
- rollback procedure
- restore procedure
- dashboard, metric, or alert names
- provider adapter behavior
- public/private asset behavior

Runbooks are part of production readiness. A release can deploy to staging without a completed runbook, but it cannot be promoted to production traffic without runbook evidence in the rollout record.
