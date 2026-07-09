# HHC Platform Data Classification, Privacy, And Retention Design

This spec defines platform-wide data classification, privacy handling, retention, deletion, redaction, and backup rules for HHC web services.

It complements:

- `docs/superpowers/specs/2026-07-08-hhc-web-security-rbac-threat-model.md`
- `docs/superpowers/specs/2026-07-08-hhc-account-token-contract-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-asset-lifecycle-and-access-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-audit-log-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-notification-api-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-line-bot-platform-integration.md`
- `docs/superpowers/specs/2026-07-08-hhc-web-future-domain-extension-strategy.md`
- `docs/superpowers/specs/2026-07-08-hhc-data-lifecycle-deletion-retention-and-restore-orchestration-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-event-contract-schema-and-replay-governance-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-public-web-third-party-analytics-and-consent-governance-design.md`

## Scope

This is an engineering policy, not legal advice. Final public privacy policy text, consent wording, statutory retention periods, and legal hold rules must be approved by the church's policy/legal owner before production use.

This spec covers:

- public website/CMS content
- admin accounts and access tokens
- asset metadata and files
- audit events
- notifications and provider metadata
- LINE bot weekly bulletin download and future LINE group file storage
- public third-party links, embeds, analytics, consent choices, and provider metadata
- future contact, member, group, pastoral, event, donation, newsletter, and desktop-folder domains

## Core Decision

Use a common data classification model across all services, but keep ownership and deletion responsibilities inside the service that owns the domain data.

Do not create a generic "privacy service" in v1. A central privacy service would add workflow complexity before there are enough personal-data domains. Instead:

- each service owns data classification for its schema
- each service exposes operational deletion/redaction procedures when it stores personal or sensitive data
- each service that stores non-public or recoverable records keeps lifecycle ledger evidence and restore reconciliation procedures
- `audit-log` stores minimal, allowlisted evidence and avoids raw personal content
- `asset-api` owns bytes and grants, while owner services decide whether an asset should exist, be public, be retained, or be deleted
- future sensitive domains must define privacy/retention rules before production routing

## Data Classes

| Class | Description | Examples | Default Access |
| --- | --- | --- | --- |
| `public` | Intended for public website or public asset access | published pages, news, locations, videos, public weekly PDFs | anonymous public read |
| `internal` | Operational data not intended for public display | draft CMS state, publish status, projection metadata, worker state | scoped admin/service |
| `personal` | Identifies or can contact a person | email, phone, name, account id, LINE user id, registration data | owning domain and scoped admin |
| `sensitive` | Higher-risk personal or ministry data | pastoral notes, prayer details, counseling content, member household details, role-sensitive admin actions | restricted scopes and explicit audit |
| `financial` | Donation/payment/receipt data | provider transaction id, receipt metadata, reconciliation state | finance scopes and provider policy |
| `secret` | Credential or token material | access token, refresh token, password hash, API key, provider secret, Blob SAS URL | never returned or logged |
| `regulated_artifact` | Evidence that must be retained or controlled | audit events, legal hold exports, security incident records | append/query policy, retention controls |

Classification is not only about table names. A public content table can temporarily contain `internal` draft data. A notification table can contain `personal` recipient metadata. A file namespace can contain `public`, `personal`, or `sensitive` bytes depending on the owner domain.

## Service Ownership Matrix

| Data | Owner Service | Storage | Notes |
| --- | --- | --- | --- |
| Published website content | `hhc-web-api` | `hhc_web` schema and public projections | Public after publish only |
| Draft CMS content | `hhc-web-api` | `hhc_web` schema | Internal/admin only |
| Admin account identity and tokens | `account-api` | `account` schema, token store, key material | Refresh token revocation stays here |
| Access JWT claims | `account-api` issues, `api-gateway` validates | client/gateway memory | Keep claims minimal |
| Asset bytes and metadata | `asset-api` | `asset` schema and Blob | Business meaning stays with owner service |
| Audit evidence | `audit-log` | `audit` schema | Append-only, metadata allowlisted |
| Notification templates and delivery state | `notification-api` | `notification` schema | Does not own subscriber consent or member data |
| LINE group file relationship | `hhc-line-function-bot` | bot schema plus `assetId` | Bot owns LINE source context |
| Contact/inquiry submissions | future `engagement-api` or simple `hhc-web-api` module | owning schema | Requires consent and retention before launch |
| Member/group/pastoral data | future domain services | owning schemas | Must not live in CMS or notification tables |
| Donation records | future `donation-api` | owning schema | Never store raw card data |

Services must not query another service's PostgreSQL schema to answer privacy or deletion requests. Use service APIs, migration jobs, or administrative procedures.

## Minimization Rules

Collect the smallest data needed for the workflow.

Rules:

- Access tokens must not contain email, phone, display name, or profile fields unless a route truly needs them.
- Logs must use stable internal ids or hashes, not raw emails, phones, LINE ids, provider recipient ids, or IP addresses where avoidable.
- Notification requests should use template variables only, not raw message bodies for long-term storage.
- Audit metadata must be allowlisted per action and must not include raw request bodies, full message bodies, pastoral text, provider secrets, or payment data.
- Event and outbox payloads must carry explicit classification/visibility metadata and must not include raw personal/sensitive/secret data unless the receiving service has a documented need and retention policy.
- Asset metadata should not store sensitive original filenames when a generated title or object key is enough.
- LINE bot should not store arbitrary user message text unless a specific feature requires it and retention is defined.
- Future contact/member/pastoral/donation services must define field-level classification before schema migration.

## Tokens And Secrets

`secret` data is never part of normal domain records, logs, audit metadata, public APIs, or notification payload history.

Never store or log:

- access tokens
- refresh tokens in plaintext
- ID tokens
- passwords
- one-time codes
- API keys
- provider secrets
- Blob SAS URLs
- upload URLs
- private signing keys

Rules:

- Refresh tokens are opaque, hashed at rest, and revocable by `account-api`.
- Access JWTs are short-lived and validated locally by `api-gateway`.
- Gateway trusted headers carry minimal identity context, not raw tokens.
- Signing keys and provider secrets live in Key Vault/ACA secrets.
- Secret rotation must not require code changes.

## Encryption

Baseline:

- TLS for all external traffic.
- Dapr/mTLS or equivalent internal service transport where available.
- PostgreSQL encryption at rest through managed database defaults.
- Blob encryption at rest through storage platform defaults.
- Key Vault/ACA secrets for runtime secrets.

Additional encryption or field-level controls are required before storing:

- pastoral notes
- member household details
- financial receipt/reconciliation details
- highly sensitive legal or incident records

Do not add application-level encryption to v1 CMS/public content unless a real sensitive-data domain requires it. Premature encryption can complicate search, audit, support, and migration without protecting meaningful sensitive data.

## Retention Defaults

Retention should be defined by data class and owner domain.

| Data Class | Default Retention | Notes |
| --- | --- | --- |
| `public` content | retain while published plus version history policy | Church may want long-term historical content |
| `internal` CMS drafts | retain until archived/deleted plus recovery window | Clean up abandoned drafts periodically |
| `personal` contact/inquiry | 12-24 months unless ministry policy requires longer | Needs explicit domain policy before launch |
| `personal` account security metadata | 12-24 months for routine metadata; longer for security events | Avoid excessive device/user-agent storage |
| `sensitive` pastoral/member care | domain-defined, shortest practical retention | Must be approved before implementation |
| `financial` donation records | policy/legal-defined | Provider records may have separate retention |
| `notification_operational` | 730 days default for delivery status | Do not store full message body |
| `audit admin_standard/security` | 2555 days default | Keep metadata minimal so audit can outlive account deletion |
| `high_volume_operational` | 180 days default | Read/download telemetry if enabled |
| `line.group.file` | group policy-defined, default disabled for broad launch | Quotas and deletion policy required |

The default values are engineering starting points. Production retention must be reviewed against church policy and applicable law.

## Deletion And Redaction

Deletion is domain-owned.

Patterns:

| Pattern | Use For | Behavior |
| --- | --- | --- |
| Soft delete | CMS content, assets, account-owned recoverable data | Hide immediately, retain for recovery window |
| Hard delete | expired assets, expired operational rows | Remove after retention policy and audit event |
| Anonymization | records needed for aggregate history but no longer need identity | Replace personal identifiers with non-reversible values |
| Redaction | audit or incident evidence that must remain but must remove approved sensitive fields | Append a redaction event and alter only approved fields |
| Legal hold | records that must not be deleted during investigation/policy hold | Pause retention worker for scoped records |

Rules:

- Public reads must hide soft-deleted records immediately.
- Asset hard delete requires both owner-domain decision and `asset-api` retention policy.
- Audit events are not arbitrarily deleted through application routes.
- Normal user data deletion should not require deleting audit evidence if audit metadata avoided raw personal data.
- If an audit record contains approved redaction fields, redaction must append an `audit.redaction.apply` event.
- Backups are not edited for routine deletion requests; restored backups must replay deletion/redaction state before becoming production.
- Lifecycle orchestration, legal hold, retention worker, restore quarantine, and post-restore reconciliation details are specified in `docs/superpowers/specs/2026-07-08-hhc-data-lifecycle-deletion-retention-and-restore-orchestration-design.md`.

## Privacy Request Workflow

Before member/contact/donation domains launch, add an operator workflow for privacy requests.

V1 readiness:

1. Identify requester and scope outside the public API surface.
2. Query owner services for records by stable account id, email hash, or domain-specific lookup.
3. Classify records as delete, anonymize, retain, or legal-hold.
4. Execute service-owned deletion/redaction procedures.
5. Record operator action in `audit-log`.
6. Verify public/protected routes no longer expose deleted data.

Do not let one service directly delete another service's rows.

## Logging And Analytics

Structured logs are operational evidence, not a data warehouse.

Rules:

- Use request id and correlation id for tracing.
- Use route pattern, status, latency, service, environment, and outcome.
- Hash or omit IP address unless security investigation requires raw value.
- Hash or omit user agent when long-term storage is unnecessary.
- Do not log raw request/response bodies by default.
- Do not log notification message body, contact message text, pastoral text, payment data, tokens, or Blob URLs.
- Debug logging that could include personal data must be disabled in production.

If future analytics are needed, create an analytics design with explicit data minimization and retention rules. Do not repurpose audit logs as analytics.

## Notification Privacy

`notification-api` sends approved messages. It does not own consent, membership, event eligibility, donation eligibility, or subscriber lifecycle.

Rules:

- Caller service owns consent and recipient eligibility.
- `notification-api` stores recipient routing metadata only as needed for delivery status and troubleshooting.
- Template variables should be minimized and classified.
- Provider message ids and status codes can be stored.
- Full rendered bodies should not be stored by default.
- Suppression lists are operational/personal data and require scoped admin access.
- Provider callbacks must not be logged with raw body unless in a protected, short-retention diagnostic store.

## Asset Privacy

`asset-api` owns storage and access mechanics, not business meaning.

Rules:

- Every asset has `ownerService`, `namespace`, `visibility`, grants, scan status, and retention policy.
- Public download requires public visibility/grant, clean scan, and ready/not-required processing.
- Private/restricted files must never leak through public asset URLs.
- Original filenames are user-controlled and must be sanitized in UI and logs.
- Sensitive namespaces require restricted visibility by default.
- Future desktop-folder objects require quota, sync conflict, retention, and delete semantics before launch.
- LINE group file storage requires per-group quota and deletion policy before broad launch.

## Audit Privacy

`audit-log` should preserve accountability without becoming a shadow copy of personal or sensitive data.

Rules:

- Store actor ids, resource ids, action, outcome, timestamp, request id, and metadata classification.
- Use hashed source IP/user-agent/external ids by default.
- Metadata is allowlisted per action.
- Sensitive audit reads require `audit:sensitive_read` and are themselves audited.
- Future member, pastoral, donation, and group audit categories require stricter metadata policies before append access is granted.

## LINE Bot Privacy

Weekly bulletin download in v1 uses public website APIs and does not need to store LINE user identity.

Future LINE group file storage rules:

- Store LINE source ids only when required for group file access.
- Prefer hashed or provider-scoped ids where possible.
- Do not store arbitrary chat history.
- Do not store sensitive message text unless a feature explicitly requires it.
- Link LINE users to account/member identity only through explicit linking flow.
- Group files use `line.group.file` namespace and restricted grants.
- Provide group-level deletion/retention policy before production launch.

## Future Sensitive Domains

Before launching any of these domains, create a service/domain privacy appendix:

- `engagement-api`: contact/inquiry text, consent, assignment, retention.
- `event-api`: attendee data, dietary/accessibility notes, capacity/waitlist, consent.
- `member-api`: profile, household, membership status, admin access.
- `group-api`: group roster, leaders, attendance, access delegation.
- `pastoral-care-api`: prayer/care/counseling content, very restricted access, short retention, elevated audit.
- `donation-api`: provider-hosted payment, receipts, reconciliation, finance scopes, no card storage.
- Search: keep public search in `hhc-web-api` first and index public projections only. A future `search-api` is public-only by default; protected/private indexes require the separate access design in `docs/superpowers/specs/2026-07-08-hhc-public-and-admin-search-design.md`.

None of these domains should store data in generic CMS, notification tables, audit metadata, or LINE bot memory unless the field-level classification explicitly allows it.

## Schema And API Requirements

Services storing non-public data should include:

- `created_at`
- `updated_at`
- `deleted_at` for soft-delete capable records
- `retention_class`
- `legal_hold_until` or equivalent only when the domain needs legal hold
- `data_classification` when records can vary by sensitivity
- `owner_service` and `namespace` for shared capabilities such as assets

Public APIs must not expose:

- draft content
- unpublished content
- private/restricted assets
- personal identifiers unrelated to the public page
- raw provider ids
- internal audit metadata
- retention/legal-hold fields

Admin APIs must return only fields needed by the screen and role.

Integration event schemas must define payload classification, visibility, and prohibited fields. Event examples must prove that public events do not contain draft/private content, Blob/SAS URLs, provider secrets, raw request bodies, or unnecessary personal identifiers.

## Backup And Restore

Backups preserve data for recovery, but they also preserve deleted personal data until backup expiry.

Rules:

- Production restore must replay deletion/redaction/legal-hold state before taking traffic.
- Restored environments must start quarantined with public ingress, provider sends, LINE webhooks, and retention workers disabled until lifecycle reconciliation completes.
- Restore drills should include at least one soft-deleted asset and one redacted/audit-sensitive event.
- Backup retention must be documented per environment.
- Non-production restores from production must be sanitized unless explicitly approved for incident response.
- Export files containing personal/sensitive data must have owner, expiration, storage location, and access list.

## Tests And Verification

Required tests:

- Public APIs exclude draft, private, restricted, deleted, infected, and scan-failed records.
- Access tokens do not include disallowed personal profile claims.
- Gateway and services do not log Authorization, cookies, tokens, upload URLs, or Blob SAS URLs.
- Audit metadata policy rejects raw request body, message body, token, provider secret, and pastoral text fields.
- Event schema/classification review rejects event payloads that leak draft/private content, Blob/SAS URLs, provider secrets, raw request bodies, or unnecessary personal identifiers.
- Notification send stores template metadata/status without full rendered body by default.
- Asset public URL denies private/restricted/soft-deleted/scan-failed assets.
- LINE weekly bulletin path does not require LINE user identity storage.
- Soft delete hides records immediately.
- Retention workers emit audit events.
- Backup restore procedure re-applies deletion/redaction state before promotion.
- Lifecycle ledger and restore reconciliation evidence are captured for production-routed services.

## Acceptance Criteria

- Every service-owned schema has field-level data classification for non-public data.
- Access JWTs and gateway trusted headers remain minimal.
- Audit metadata allowlists prevent sensitive-data leakage.
- Event schemas, examples, and release evidence include classification/visibility review for integration and outbox payloads.
- Asset namespaces define visibility, retention, size, and scan policy.
- Notification templates define caller ownership and template-variable classification.
- LINE group file storage is not broadly enabled until quota, retention, and deletion policy exist.
- Future member, pastoral, donation, event, and engagement domains cannot launch without privacy/retention appendix.
- Rollout evidence includes privacy checks for public leakage, logs, audit metadata, asset access, and backup restore behavior.
