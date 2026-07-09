# HHC Platform Abuse Prevention, Rate Limit, And Quota Design

This spec defines how HHC platform services should prevent abuse, control request rates, enforce quotas, and protect provider reputation without creating a premature centralized abuse service.

## Purpose

The HHC platform has several public or semi-public surfaces:

- public website APIs
- future public search
- public asset downloads
- admin APIs
- asset upload sessions
- LINE webhooks
- notification provider callbacks
- future contact forms, registrations, newsletter signup, and donations

Abuse controls need to protect availability and cost without blocking normal church usage, such as a weekly bulletin link being shared in LINE and downloaded by many people at once.

## Core Decision

Use layered abuse controls:

1. `api-gateway` owns coarse public protection: method limits, body limits, route-level rate limits, blocked paths, CORS, and request normalization.
2. Backend services own domain-specific quotas: upload sessions, asset namespace limits, notification sends, audit queries, LINE function limits, future contact submissions, event registrations, and donation attempts.
3. Redis stores short-lived counters and sliding-window state where fast decisions are needed.
4. Service PostgreSQL stores durable quota policy, abuse events, suppression records, or operator decisions when those decisions must survive cache loss.
5. External WAF/bot protection is optional and added when traffic, public forms, or attack patterns justify it.

Do not create a standalone `abuse-api` in v1. Centralizing all abuse logic too early would create another dependency for every request and would hide domain-specific decisions from the services that understand the risk.

Public/admin search abuse rules, query validation, query logging privacy, and `429` behavior should follow `docs/superpowers/specs/2026-07-08-hhc-public-and-admin-search-design.md` when search is enabled.

## Non-Goals

- This is not authentication or authorization.
- This is not a replacement for asset grants, JWT validation, LINE signature validation, provider webhook signatures, or admin RBAC.
- This is not a fraud/risk-scoring platform.
- This does not require collecting invasive user fingerprints.
- This does not introduce CAPTCHA on normal public content reads in v1.

## Layered Responsibility

| Layer | Owns | Does Not Own |
| --- | --- | --- |
| Gateway | request size, method allowlist, route rate classes, public path blocking, IP-based coarse limits | domain quota semantics, provider reputation policy |
| `hhc-web-api` | public API read shaping, admin mutation throttles, future public form limits | asset byte limits, notification provider limits |
| `asset-api` | upload-session limits, namespace quotas, download abuse controls, storage cost controls | CMS publish authorization |
| `notification-api` | send quotas, recipient/template/provider suppression, provider backoff | deciding whether a domain event should notify |
| `hhc-line-function-bot` | LINE event dedupe, source/profile function limits, LINE group file quotas | website content publishing |
| `account-api` | login/token brute-force controls, account lockout, refresh-token abuse | non-account API traffic |
| `audit-log` | append/query throttles and export limits | blocking normal domain writes unless audit intent cannot be stored |

## Rate Limit Classes

Recommended initial classes:

| Class | Routes | Primary Key | Behavior |
| --- | --- | --- | --- |
| `public_read` | `/api/home`, `/api/site-layout`, `/api/news`, `/api/bulletins/*`, `/api/videos`, `/api/locations`, `/api/history`, `/api/legal/*`, `/api/sitemap-data` | IP plus route group | Generous, cache-friendly |
| `public_search` | `/api/search` when enabled | IP plus normalized query hash and route group | Moderate, validates query shape and protects DB/index cost |
| `public_asset_download` | `/api/assets/public/*` | IP plus asset id; optional country/ASN metric only | Protect egress and hot files without breaking weekly sharing |
| `admin_read` | `/api/admin/*` GET | user id plus IP | Moderate, protects DB/admin tooling |
| `admin_write` | `/api/admin/*` POST/PUT/PATCH/DELETE | user id plus route group | Strict, protects accidental retries and scripted abuse |
| `admin_upload_session` | `/api/assets/admin/upload-sessions` | user id plus namespace | Strict, metadata-only |
| `asset_upload_bytes` | direct upload target | upload session and namespace | Enforced by target TTL, size, MIME, checksum, and namespace |
| `line_webhook` | `/api/line/webhook/*` | source IP/provider path plus LINE event id dedupe in bot | POST-only, body-limited, signature-validated downstream |
| `provider_callback` | `/api/notifications/provider-webhooks/*` | provider plus signature-valid callback id | POST-only, signature required |
| `internal_command` | `/priv/*` | caller app id plus route | Domain-specific, idempotency required |
| `future_public_form` | contact/signup/registration/donation start | IP, subject hash, form id, and domain key | Strict with progressive friction |

Use separate counters per route class. Do not put all routes into one global bucket; a weekly bulletin download spike should not block admin login or contact form submission.

## Rate Limit Key Design

Use the narrowest key that protects the resource without over-collecting data.

Allowed dimensions:

- normalized client IP from gateway
- trusted user id from gateway headers
- trusted service app id for internal routes
- route group
- HTTP method
- asset namespace
- asset id
- template id
- recipient hash
- LINE source hash
- LINE event/message id
- provider name

Avoid raw PII in rate-limit keys. Hash email, phone, LINE group ids, or recipient ids with an environment-specific secret salt before storing them.

## Gateway Enforcement

Gateway should enforce:

- blocked `/priv/*` and `/api/priv/*`
- method allowlists
- request body size limits
- route class mapping
- IP-based coarse rate limits
- admin host API blocking
- CORS policy
- no credentialed wildcard CORS
- timeout budgets
- request id injection
- stripping spoofable identity headers

Gateway should not parse business payloads or decide business quotas.

## Service Enforcement

Services should enforce limits where domain context matters:

- `hhc-web-api` checks admin write frequency, publish/unpublish retry behavior, public search query shape/rate when search is enabled, public form limits when forms are added, and public API cache behavior.
- `asset-api` checks namespace size, upload sessions per user/service, downloads per asset/namespace when needed, and storage quota.
- `notification-api` checks template/provider/recipient suppression and send rate.
- `hhc-line-function-bot` checks per-profile function calls, source/group quotas, event dedupe, file save limits, and reply flood behavior.
- `audit-log` checks query/export rate and append abuse from broken producers.

Service-level rate limiting should return the platform standard `429 rate_limited` envelope and `Retry-After` when retry is safe.

## Redis Usage

Redis is appropriate for:

- fixed-window or sliding-window counters
- token buckets
- short-lived dedupe keys
- temporary block decisions
- retry-after state
- per-route hot asset counters

Redis is not enough for:

- durable suppression lists
- legal/audit evidence
- long-term quota accounting
- operator decisions
- storage quota history
- provider reputation state

If Redis is unavailable, public reads should degrade conservatively but not fail open for dangerous writes. Protected writes, upload sessions, notification sends, and public forms should either use a local DB-backed fallback or fail closed with a clear retryable error.

## Suggested Initial Limits

Exact numbers should be tuned in staging and production metrics, but initial design should start with these relative limits:

| Surface | Initial Policy |
| --- | --- |
| Public API reads | high per IP, rely on cache and CDN/gateway where possible |
| Public search | moderate per IP/query hash, short query length, capped page size, no wildcard-only queries |
| Weekly bulletin API | high read limit, short response body, cacheable |
| Public weekly PDF download | higher burst window after weekly publication, egress metrics watched |
| Admin writes | low per user, idempotency required |
| Admin upload sessions | low per user and namespace |
| Upload session completion | one completion per session, idempotent on matching checksum |
| Notification sends | low per recipient/template, provider backoff honored |
| LINE weekly download command | moderate per LINE source/profile |
| LINE group file save | quota per group/profile before broad launch |
| Audit query/export | strict per user and per service |

Avoid hard-coding numeric limits in business logic. Put them in typed config with safe production validation.

## Asset Download Abuse

Public assets should remain stable gateway URLs, but downloads can be expensive.

Controls:

- stream downloads instead of buffering full files in app memory
- support range requests only when implemented safely
- use cache headers for public clean assets
- use per-namespace and per-asset counters for hot files
- keep weekly bulletin PDFs public and cacheable once published
- use shorter TTL or authenticated checks for revocation-sensitive assets
- expose egress, status, and throttle metrics

Emergency response:

- disable public downloads with `ASSET_PUBLIC_DOWNLOADS_DISABLED` only for serious leakage/malware incidents
- prefer blocking one namespace or asset id over disabling all assets
- keep admin diagnostics available to identify hot assets

## Asset Upload Abuse

Controls:

- upload sessions require admin JWT or allowed internal caller
- session TTL is short
- upload target is scoped to one object key
- namespace max size and MIME allowlist are enforced
- completion checks size, checksum, content type, and object existence
- scan status must be clean before public grant
- incomplete uploads are cleaned after expiry
- per-user/per-service upload-session limits apply

The app should never accept arbitrary large upload bytes through the main API process unless the namespace explicitly requires service-side upload, such as LINE bot file ingestion.

## Notification Abuse

Notification abuse can damage provider reputation even if the platform remains available.

Controls:

- internal-only send API
- template allowlist
- recipient hash quota
- template quota
- caller service quota
- provider-level backoff
- suppression list
- idempotency key required
- no raw recipient list in logs or audit metadata

Future public forms must not call `notification-api` directly. They write domain state first, then the owning domain decides whether to request a notification.

## LINE Webhook Abuse

Gateway controls:

- POST only
- route-specific body limit
- coarse IP/path rate limit
- request id

Bot controls:

- LINE signature validation before business handling
- event/message id dedupe
- profile/function allowlist
- per-source function limit
- per-group file quota
- max file size before reading into memory
- dependency timeout for public API reads
- retry-friendly replies for upstream `429` and `503`

Do not make gateway JWT validation part of LINE webhook security. LINE webhooks are authenticated by LINE signature, not account JWT.

## Public Form Abuse

Future contact forms, event registrations, newsletter signup, and donation starts need stricter controls than public reads.

Recommended pattern:

1. Gateway applies method/body/rate class.
2. Domain service validates schema and consent.
3. Domain service applies subject/IP/form id rate limits.
4. Domain service stores accepted submission or registration.
5. Domain service emits notification/audit outbox events.
6. Suspicious or repeated submissions can be accepted into a review state instead of triggering notifications.

Add CAPTCHA/Turnstile or WAF-managed bot challenge only when public form abuse becomes real enough to justify the user friction.

## Account Abuse

`account-api` owns:

- login brute-force protection
- password reset request limits
- refresh-token replay detection
- suspicious session revocation
- role/scope change audit
- account lockout or step-up policy if needed

Gateway must not call `account-api` per request for abuse decisions. Gateway can use route-level limits and local JWT validation. Account-specific risk decisions stay in `account-api`.

## Internal Command Abuse

Internal routes are still rate-limited and quota-aware.

Reasons:

- a buggy worker can loop
- a compromised service identity can spam downstreams
- retry storms can amplify incidents

Controls:

- caller app id allowlist
- per-caller route limit
- idempotency keys for side effects
- worker backoff
- outbox dead-letter after retry policy
- metrics per caller app id

Do not use internal rate limits to hide missing idempotency. Side-effecting `/priv/*` routes require idempotency first.

## WAF And Bot Protection

V1 can run without WAF if gateway limits, service quotas, and caching are in place.

Add WAF or managed bot protection when:

- public forms receive repeated spam
- public asset downloads create material egress cost
- route probing becomes frequent
- suspicious traffic reaches backend despite gateway limits
- compliance or provider requirements demand it

If WAF is added:

- keep `api-gateway` as the application route/auth boundary
- document forwarded client IP handling
- test that WAF does not block LINE/provider callbacks
- keep route-specific application limits in services
- avoid using WAF rules as the only protection for domain actions

## Quota Policy

Quota is longer-lived than rate limiting.

Use quota for:

- LINE group file storage
- desktop cloud-folder objects
- upload bytes per namespace
- notification sends per template/provider window
- audit export size
- future event registrations
- future donation checkout attempts

Quota policy should define:

- owner service
- subject type
- window or storage period
- hard limit
- soft warning threshold
- reset behavior
- admin override behavior
- audit event for override

Redis can track fast window counters. PostgreSQL should store durable quota decisions and override records.

## Error Responses

Use standard platform error shape.

For retryable rate limit:

```text
HTTP 429
Retry-After: 60
X-HHC-Request-ID: ...
```

```json
{
  "error": {
    "code": "rate_limited",
    "message": "Too many requests. Try again later.",
    "requestId": "req_123"
  }
}
```

For quota exceeded:

```text
HTTP 403
```

```json
{
  "error": {
    "code": "quota_exceeded",
    "message": "The allowed quota for this action has been reached.",
    "requestId": "req_123"
  }
}
```

Use `429` for temporary window limits. Use `403 quota_exceeded` when the subject has hit a durable policy limit requiring time reset, admin action, or cleanup.

## Privacy

Abuse controls must not become a hidden tracking system.

Rules:

- store only what is needed to protect the service
- hash subject identifiers where possible
- avoid raw email, phone, LINE ids, and provider ids in Redis keys/logs
- expire short-lived counters quickly
- classify durable abuse events according to data privacy rules
- never log request bodies for public forms, provider callbacks, or LINE webhooks

## Observability

Metrics:

- gateway rate-limited requests by route class
- service rate-limited requests by route/action
- quota exceeded count by policy
- public search rejected/rate-limited count when search is enabled
- hot asset download count and egress estimate
- upload sessions rejected by namespace/user/service
- notification suppressed/rate-limited by template/provider
- LINE webhook signature failures and dedupe hits
- public form rejection/review count when forms are added
- Redis rate-limit dependency failures
- WAF/bot challenge counts if enabled

Logs should include request id, route class, decision, and safe subject hash. Do not log raw identifiers, tokens, or request bodies.

## Alerting

Alert on:

- sudden spike in `429` for public routes
- LINE webhook signature failures above baseline
- notification provider rate-limit response spike
- asset egress spike by namespace
- upload-session creation spike
- Redis unavailable for rate-limit decisions
- internal command rate-limit spike by caller app id
- WAF starts blocking provider callbacks or LINE webhooks

Not every `429` is an incident. Alert only when rate limits indicate user impact, attack, cost risk, or broken client behavior.

## Test Requirements

Required tests:

- gateway route class applies expected method/body/rate policy
- public `/priv/*` remains blocked
- public read rate limit returns `429 rate_limited`
- public search validates query shape and returns `429 rate_limited` under route-class abuse when search is enabled
- admin write rate limit keys by user id, not only IP
- asset upload-session limits by user/service/namespace
- notification send duplicate idempotency does not count as a new send
- LINE webhook rejects invalid signature before business handling
- LINE webhook dedupe prevents duplicate command execution
- Redis unavailable behavior is safe for writes
- quota exceeded maps to `403 quota_exceeded`
- error responses do not leak raw subject identifiers

Staging smoke should include at least one `429` path per major route class before production rollout.

## Local And CI

Local and CI should use:

- Redis container or in-memory fake with the same semantics for route unit tests
- deterministic fake clock for window tests
- fake LINE events for dedupe tests
- fake notification provider that returns transient and permanent rate-limit responses
- small test limits so behavior is easy to exercise

Do not run load tests against production without explicit approval.

## Runbooks

Runbooks should cover:

- public API abuse spike
- hot asset egress spike
- LINE webhook flood
- notification provider rate-limit or reputation issue
- public form spam
- Redis rate-limit dependency outage
- accidental admin write loop
- internal worker retry storm

Each runbook should include:

- how to identify affected route class
- which dashboard to inspect
- which kill switch or config limit can be adjusted
- whether to block by route, namespace, asset id, caller app id, or source hash
- rollback or cleanup procedure

## Service Extraction Trigger

Consider a dedicated abuse/risk service only when at least three are true:

- multiple services need shared long-lived subject reputation
- public forms or donations face persistent abuse
- WAF/bot provider integration needs centralized policy
- operator review queues become cross-domain
- rate-limit policy changes need audited runtime workflow
- duplicated quota code causes inconsistent behavior

Until then, shared libraries, gateway policy, Redis counters, and service-owned quota tables are enough.

## Acceptance Criteria

- No v1 standalone `abuse-api` is required.
- Gateway and services have separate, explicit abuse responsibilities.
- Route classes are defined for public reads, search, assets, admin, LINE, provider callbacks, internal commands, and future public forms.
- Redis is used only for short-lived counters and dedupe, not durable policy.
- Durable quota and suppression decisions live in the owning service.
- Weekly bulletin download spikes do not block unrelated APIs.
- Notification sends are protected by recipient/template/provider/caller limits.
- LINE webhooks use signature validation, dedupe, source/profile limits, and body limits.
- Public form abuse has a future-safe pattern before forms launch.
- Error responses use `429 rate_limited` or `403 quota_exceeded` consistently.
- Privacy rules prevent raw identifiers from leaking into logs, Redis keys, metrics, or audit metadata.
- Staging can prove representative rate-limit and quota paths before production promotion.
