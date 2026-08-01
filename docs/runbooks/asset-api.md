# asset-api Runbook

## Service Purpose

`asset-api` owns asset metadata, Blob object references, upload sessions, scan/quarantine state, derivative generation, public/private access grants, and public download URL mediation. Consumers such as weekly bulletins, news images, LINE group files, and future desktop cloud-folder features use `asset-api` instead of direct Blob access.

In the office Compose stack, signed local upload targets use
`https://www-test.alive.org.tw/api/assets/uploads`; container-only hostnames are
never returned to browsers. `account-api` and `hhc-web-api` call private asset
routes directly with the development caller-header fallback enabled.

## Owner And Escalation

- Primary owner: asset/storage domain engineering
- Escalate to platform owner for Blob, network, or identity failures
- Escalate to `hhc-web-api` owner for CMS asset ownership/grant issues
- Escalate to security owner for public/private grant leakage or malware scan incidents

## Dependencies

- PostgreSQL asset schema
- Blob Storage
- Azure Storage Queue scan dispatch and the embedded scanner during cutover
- Derivative generation worker for images
- `audit-log` for protected grant changes
- Consumer services that own asset references

## Scan Dispatch

- Upload completion and one `asset.scan.requested.v1` outbox row commit in the
  same PostgreSQL transaction.
- The Asset runtime sends pending outbox rows to the `asset-scan` Azure Storage
  Queue with managed identity. Messages contain only version, event ID, asset
  ID, and immutable Blob ETag.
- Delivery is at-least-once. A send accepted by Azure can be repeated when the
  process exits before recording `delivered_at`; scan workers must deduplicate
  by event ID.
- During queue rollout `ASSET_SCAN_DISPATCH_ENABLED=false` and the embedded
  scanner remains active. Enable dispatch only after the queue-triggered ACA
  Job exists; disable the embedded scanner only after clean, infected, retry,
  and poison acceptance checks pass.
- `asset-scan` is an event-triggered ACA Job. Its managed identity has Queue
  Processor, poison Queue Contributor, Blob Reader, Key Vault secret, and ACR
  pull access only. The scan image includes ClamAV but no HTTP runtime.
- PostgreSQL records a durable poison event before the worker forwards its
  idempotent poison envelope. A Job crash therefore cannot lose failed work.
- `asset-clamav-signature-refresh` writes immutable generations to the private
  `asset-signatures` Blob container and atomically switches `current.json`.
  Scan and refresh Jobs use separate reader/writer managed identities; no
  Azure Files storage key is shared with LINE.
- Deploy first with `activate_queue_scanning=false`; after clean/EICAR fixtures
  pass, rerun with the flag true. Only then remove office/Tailscale/NSG access.
- LINE attachment Jobs call private Asset ingress with a dedicated managed
  identity and the `Asset.Invoke` app role. LINE owns download and publication;
  Asset remains the sole owner of quarantine, signatures, scan state, grants,
  and clean download. Keep the old LINE scanner as rollback-only until the
  private workload path passes production smoke without the office route.

## Health And Ready Checks

- `GET /health`: process health
- `GET /ready`: PostgreSQL reachable and runtime dependencies initialized
- Upload session smoke in staging
- Public download smoke through asset route, not raw Blob
- Worker backlog checks for scan and derivative queues

## Dashboards And Logs

- upload session count and failures
- Blob operation latency and failures
- scan backlog age and result counts
- scan outbox oldest pending age, send attempts, and last error
- derivative backlog age and failures
- public URL grant validation failures
- download route p95 latency and 5xx
- storage growth by namespace

## Page-Worthy Alerts

- public asset download route unavailable for published content
- Blob operation failures blocking uploads or downloads
- scan backlog exceeds threshold
- infected or quarantined asset referenced by public content
- public/private grant mismatch detected
- raw Blob/SAS URL appears in public API response check

## Common Failure Modes

- Blob outage or identity permission regression
- upload completes but metadata write fails
- asset scan stuck in pending state
- derivative generation fails for public image
- consumer publishes content before grant is active
- bad grant exposes private file or hides public file

## Quick Triage

1. Identify namespace, asset id, owner service, and intended visibility.
2. Check metadata state before Blob state.
3. Confirm whether public URL was requested through `asset-api`.
4. Check scan/quarantine state and derivative state.
5. Check consumer service reference and grant reason.
6. Preserve asset id, owner reference, request id, and correlation id.

## Mitigation Actions

- Revoke public grant for unsafe or wrong asset.
- Quarantine infected or suspicious asset.
- Return unavailable state to consumers rather than raw Blob URL.
- Re-run scan or derivative worker if input object is intact.
- Reconcile grants from consumer source-of-truth if metadata drift is detected.

## Rollback Path

- Roll back app revision for download/upload route regression.
- Keep uploaded Blob objects during rollback; do not delete objects as rollback.
- Re-run grant reconciliation after consumer publish rollback.
- Restore previous derivative only if it still belongs to the current asset version.

## Data Recovery Notes

Blob restore must be reconciled with asset metadata, grants, deleted state, legal holds, quarantine state, and owner references before public routes are enabled. PostgreSQL asset metadata is the source of public/private access decisions.

## Secrets And Key Rotation Notes

Blob credentials or managed identity assignments are platform-managed. Do not log SAS URLs, storage keys, scanner keys, or raw private object paths.

## Degraded Modes

- Public content can render with an unavailable asset placeholder.
- Uploads can be paused while downloads continue.
- Private/group file access fails closed when grant state is unclear.
- Derivative failure can fall back to original only if original is safe, public, and size policy allows it.

## Staging Drill

Run asset emergency takedown and Blob restore reconciliation drills. Evidence must include asset id, grant state before/after, public download result, audit entry, and consumer projection result.

## Production Verification

- Public asset route returns expected file for a public grant.
- Private asset is not downloadable without an authorized path.
- Public API responses never contain Blob/SAS URLs.
- Quarantined asset is not publicly downloadable.
- Weekly bulletin PDF can be downloaded through the owning service contract.
