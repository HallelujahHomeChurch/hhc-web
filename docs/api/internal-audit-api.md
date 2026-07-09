# HHC Internal Audit API Contract

Detailed design lives in `docs/superpowers/specs/2026-07-08-hhc-audit-log-design.md`.

Audit append retries, producer outbox behavior, and event idempotency follow `docs/superpowers/specs/2026-07-08-hhc-platform-eventing-outbox-reliability.md`.

Shared envelope, error, cursor pagination, idempotency, internal API, and header rules live in `docs/superpowers/specs/2026-07-08-hhc-platform-api-standards-design.md`.

Internal service identity, caller app-id allowlists, append/query permission separation, and denied-call behavior live in `docs/superpowers/specs/2026-07-08-hhc-internal-service-identity-and-private-route-design.md`.

Audit append/query authorization, sensitive metadata field policy, route/action metadata, and authorization drift checks live in `docs/superpowers/specs/2026-07-08-hhc-authorization-policy-and-permission-governance-design.md`.

Audit privacy, metadata classification, redaction, retention, and backup restore rules live in `docs/superpowers/specs/2026-07-08-hhc-platform-data-classification-privacy-retention-design.md`.

Cross-service lifecycle ledger, legal hold, retention worker, privacy request, and restore reconciliation rules live in `docs/superpowers/specs/2026-07-08-hhc-data-lifecycle-deletion-retention-and-restore-orchestration-design.md`.

## Base

`audit-log` is internal-only. It is not exposed through public gateway routes.

Internal routes:

```text
/priv/audit/*
```

## Auth

Calls require service identity through Dapr service invocation, mTLS, and app-id allowlists.

Append callers:

- `hhc-web-api`
- `asset-api`
- `notification-api`
- `account-api`
- `api-gateway` for approved security events only

Query callers:

- `hhc-web-api` for admin console screens
- `account-api` for account security screens if needed
- dedicated incident tooling service identities

Query callers must pass verified user context with `audit:read`. Sensitive metadata requires `audit:sensitive_read`.

## Headers

Required internal headers:

```text
X-Request-Id: req_123
X-Correlation-Id: corr_123
X-Internal-Caller-App-Id: hhc-web-api
```

`X-Internal-Caller-App-Id` is set by the internal service invocation layer, not by public clients.

## Append Event

```text
POST /priv/audit/events
```

Request:

```json
{
  "eventId": "hhc-web-api:cms.bulletin.publish:bulletin_issue:bulletin_2026_07_12:1783824000000:a1b2",
  "schemaVersion": 1,
  "occurredAt": "2026-07-12T00:00:00Z",
  "requestId": "req_123",
  "correlationId": "corr_123",
  "traceId": "trace_123",
  "sourceService": "hhc-web-api",
  "sourceEnvironment": "prod",
  "actorType": "user",
  "actorId": "user_123",
  "action": "cms.bulletin.publish",
  "category": "cms.bulletin",
  "resourceOwnerService": "hhc-web-api",
  "resourceType": "bulletin_issue",
  "resourceId": "bulletin_2026_07_12",
  "outcome": "success",
  "severity": "info",
  "metadataClassification": "internal",
  "retentionClass": "admin_standard",
  "metadata": {
    "locale": "zh-Hant",
    "issueDate": "2026-07-12",
    "assetId": "asset_123"
  }
}
```

Response:

```json
{
  "data": {
    "eventId": "hhc-web-api:cms.bulletin.publish:bulletin_issue:bulletin_2026_07_12:1783824000000:a1b2",
    "status": "accepted"
  },
  "meta": {
    "requestId": "req_123"
  },
  "error": null
}
```

Duplicate response for identical canonical payload:

```json
{
  "data": {
    "eventId": "hhc-web-api:cms.bulletin.publish:bulletin_issue:bulletin_2026_07_12:1783824000000:a1b2",
    "status": "duplicate"
  },
  "meta": {
    "requestId": "req_123"
  },
  "error": null
}
```

Conflicting duplicate:

```json
{
  "data": null,
  "meta": {
    "requestId": "req_123"
  },
  "error": {
    "code": "event_id_conflict",
    "message": "eventId already exists with a different canonical payload"
  }
}
```

HTTP status: `409`.

## Append Batch

```text
POST /priv/audit/events/batch
```

Request:

```json
{
  "items": [
    {
      "eventId": "evt_1",
      "schemaVersion": 1,
      "occurredAt": "2026-07-12T00:00:00Z",
      "requestId": "req_123",
      "sourceService": "asset-api",
      "sourceEnvironment": "prod",
      "actorType": "service",
      "actorId": "asset-api",
      "action": "asset.grant.create",
      "category": "asset",
      "resourceOwnerService": "hhc-web-api",
      "resourceType": "bulletin_issue",
      "resourceId": "bulletin_2026_07_12",
      "outcome": "success",
      "severity": "info",
      "metadataClassification": "internal",
      "retentionClass": "admin_standard",
      "metadata": {
        "assetId": "asset_123",
        "visibility": "public"
      }
    }
  ]
}
```

Response:

```json
{
  "data": {
    "items": [
      {
        "eventId": "evt_1",
        "status": "accepted"
      }
    ]
  },
  "meta": {
    "requestId": "req_123"
  },
  "error": null
}
```

Batch append is partial by item. Valid items are accepted even if another item is rejected.

## Query Events

```text
GET /priv/audit/events?resourceType=bulletin_issue&resourceId=bulletin_2026_07_12&from=2026-07-01T00:00:00Z&to=2026-07-31T23:59:59Z
```

Supported filters:

- `eventId`
- `requestId`
- `correlationId`
- `sourceService`
- `actorType`
- `actorId`
- `action`
- `category`
- `resourceType`
- `resourceId`
- `outcome`
- `severity`
- `from`
- `to`
- `pageSize`
- `cursor`

Response:

```json
{
  "data": {
    "items": [
      {
        "eventId": "hhc-web-api:cms.bulletin.publish:bulletin_issue:bulletin_2026_07_12:1783824000000:a1b2",
        "occurredAt": "2026-07-12T00:00:00Z",
        "receivedAt": "2026-07-12T00:00:03Z",
        "requestId": "req_123",
        "correlationId": "corr_123",
        "sourceService": "hhc-web-api",
        "actorType": "user",
        "actorId": "user_123",
        "action": "cms.bulletin.publish",
        "category": "cms.bulletin",
        "resourceType": "bulletin_issue",
        "resourceId": "bulletin_2026_07_12",
        "outcome": "success",
        "severity": "info",
        "metadataClassification": "internal",
        "metadata": {
          "locale": "zh-Hant",
          "issueDate": "2026-07-12",
          "assetId": "asset_123"
        }
      }
    ],
    "nextCursor": null
  },
  "meta": {
    "requestId": "req_123"
  },
  "error": null
}
```

Query is internal/admin-only and is exposed to the admin console through `hhc-web-api`, not by directly exposing `audit-log`.

## Get Event

```text
GET /priv/audit/events/{eventId}
```

Returns one event if the caller is authorized to read its category and metadata classification.

## Error Codes

| HTTP | Code | Meaning |
| --- | --- | --- |
| 400 | `validation_error` | Required field missing, invalid enum, invalid time range, or metadata policy violation |
| 401 | `internal_auth_required` | Missing internal service identity |
| 403 | `caller_not_allowed` | Caller service is not allowlisted for the route or action |
| 403 | `scope_required` | User context lacks `audit:read` or `audit:sensitive_read` |
| 404 | `event_not_found` | Event does not exist or caller cannot access it |
| 409 | `event_id_conflict` | Same `eventId` has a different canonical payload |
| 413 | `metadata_too_large` | Metadata exceeds configured size |
| 429 | `rate_limited` | Caller exceeded audit query or append limits |
| 500 | `audit_append_failed` | Internal append failure |

## Append-Only Rule

Audit events are immutable. Corrections must be appended as new events rather than editing old records.

## Required Event Categories

Required v1 categories and action policy are defined in `docs/superpowers/specs/2026-07-08-hhc-audit-log-design.md`.
