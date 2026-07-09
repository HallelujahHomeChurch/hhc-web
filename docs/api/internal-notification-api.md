# HHC Internal Notification API Contract

Detailed template, provider, suppression, webhook, status lifecycle, and ownership rules are defined in `docs/superpowers/specs/2026-07-08-hhc-notification-api-design.md`.

Delivery reliability, idempotency, retry, and dead-letter behavior follows `docs/superpowers/specs/2026-07-08-hhc-platform-eventing-outbox-reliability.md`.

Shared envelope, error, idempotency, internal API, and header rules live in `docs/superpowers/specs/2026-07-08-hhc-platform-api-standards-design.md`.

Internal service identity, caller app-id allowlists, template namespace restrictions, and confused-deputy controls live in `docs/superpowers/specs/2026-07-08-hhc-internal-service-identity-and-private-route-design.md`.

Template/action authorization, caller permission checks, sensitive recipient field policy, and authorization drift checks live in `docs/superpowers/specs/2026-07-08-hhc-authorization-policy-and-permission-governance-design.md`.

Notification recipient privacy, template-variable classification, provider metadata, and suppression-list access rules live in `docs/superpowers/specs/2026-07-08-hhc-platform-data-classification-privacy-retention-design.md`.

## Base

`notification-api` send, status, and preview commands are internal-only. They are not exposed through public browser routes.

Internal routes:

```text
/priv/notifications/*
```

Optional provider delivery callbacks are the only public-ingress exception and must be signature-verified:

```text
POST /api/notifications/provider-webhooks/{provider}
```

## Auth

Calls require internal service identity through Dapr service invocation, mTLS, and app-id allowlists. Browser users never call `notification-api` directly.

## Send Message

```text
POST /priv/notifications/send
```

Request:

```json
{
  "templateId": "cms.publish-summary",
  "channel": "email",
  "recipient": "admin@example.com",
  "locale": "zh-Hant",
  "payload": {
    "title": "2026-07-12 週報",
    "publishedBy": "user_123"
  },
  "idempotencyKey": "cms.publish-summary:bulletin_2026_07_12"
}
```

Response:

```json
{
  "data": {
    "messageId": "msg_123",
    "status": "queued"
  },
  "meta": {
    "requestId": "req_123"
  },
  "error": null
}
```

## Message Status

```text
GET /priv/notifications/{messageId}
```

Statuses:

- `queued`
- `rendering`
- `ready_to_send`
- `sending`
- `sent`
- `delivered`
- `failed`
- `suppressed`
- `dead_lettered`
- `cancelled`

## Template Preview

```text
POST /priv/notifications/templates/preview
```

Used by trusted admin/backend flows to preview template rendering. It is still internal-only.

## Retry

Provider failures should retry with exponential backoff. Permanent failures should mark the message `failed` and emit an audit event.

## Ownership

`notification-api` sends approved messages. It does not own subscriber consent, event attendee eligibility, account verification tokens, donation receipt eligibility, or member/pastoral data.

## Audit

Emit audit events for:

- Message requested.
- Provider accepted.
- Delivery confirmed.
- Permanent failure.
- Suppression/bounce.
