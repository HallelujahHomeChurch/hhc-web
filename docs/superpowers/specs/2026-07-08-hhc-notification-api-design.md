# HHC Notification API Design

This spec defines `notification-api` as the internal notification capability for account, CMS, asset, event, engagement, donation, LINE/admin alert, and future ministry workflows.

## Purpose

Church platform domains need email and future notifications, but each domain should not integrate directly with provider APIs. `notification-api` centralizes message templates, rendering, provider adapters, retry, delivery state, suppression, provider webhooks, and notification audit events.

`notification-api` is not a newsletter subscription service, event reminder scheduler, member CRM, or workflow engine. It sends approved messages requested by owning domains.

Notification audit event shape, metadata limits, and retention are defined by `docs/superpowers/specs/2026-07-08-hhc-audit-log-design.md`.

Internal `/priv/notifications/*` service identity, caller app-id allowlists, template namespace restrictions, and confused-deputy controls are defined in `docs/superpowers/specs/2026-07-08-hhc-internal-service-identity-and-private-route-design.md`.

Template/action authorization, caller permission checks, sensitive recipient field policy, and authorization drift checks are defined in `docs/superpowers/specs/2026-07-08-hhc-authorization-policy-and-permission-governance-design.md`.

Notification recipient privacy, template-variable classification, provider metadata handling, and suppression-list access rules are defined in `docs/superpowers/specs/2026-07-08-hhc-platform-data-classification-privacy-retention-design.md`.

Notification provider adapter config, template registry config, fake-provider production guards, and send kill-switch rules are defined in `docs/superpowers/specs/2026-07-08-hhc-platform-configuration-feature-flag-and-release-control-design.md`.

Notification send quotas, recipient/template/provider throttles, suppression behavior, and provider reputation protection are defined in `docs/superpowers/specs/2026-07-08-hhc-platform-abuse-prevention-rate-limit-and-quota-design.md`.

## Core Decision

Use `notification-api` as an internal command service:

```text
caller service -> /priv/notifications/send -> notification-api queue -> provider adapter
```

The v1 channel is email. Future channels can be added only when a real caller needs them.

## Ownership Boundary

`notification-api` owns:

- template catalog
- template versioning
- template rendering
- provider adapter configuration
- message queue and status lifecycle
- idempotency for send requests
- retry/backoff and dead-letter state
- provider delivery callback handling when enabled
- suppression and bounce records
- notification-level audit events
- metrics for queue/provider health

Calling domains own:

- recipient selection
- user/member/subscriber consent
- business timing
- business eligibility
- message purpose
- domain record and resource id
- sensitive domain data

Examples:

- `account-api` owns whether an account verification email should be sent.
- `hhc-web-api` owns whether a CMS publish summary should be sent.
- Future `engagement-api` owns newsletter subscriber consent.
- Future `event-api` owns registration confirmation/reminder timing.
- Future `donation-api` owns receipt eligibility and financial record.

`notification-api` must not become the system of record for subscribers, event attendees, members, donations, pastoral care, or inquiry status.

## Public Exposure Rule

Internal command routes are never public:

```text
/priv/notifications/send
/priv/notifications/{messageId}
/priv/notifications/templates/preview
```

Optional provider callbacks are the only exception:

```text
POST /api/notifications/provider-webhooks/{provider}
```

This route is not a browser API. It must be method-limited, body-limited, rate-limited, and signature-verified by `notification-api`. Do not enable it until the chosen provider requires delivery/bounce callbacks.

## Channels

### V1 Channel

- `email`

### Future Channels

- `line`: route through `hhc-line-function-bot` or a dedicated adapter after explicit design.
- `sms`: only after provider and consent rules are decided.
- `admin_alert`: internal operational alerts for admins.
- `web_push`: only after browser push consent and key management are designed.

Do not add a channel without:

- provider adapter
- template type support
- consent/eligibility owner
- rate/suppression policy
- delivery status model
- audit behavior

## Template Catalog

Templates are stable IDs with explicit channel, locale, version, and allowed caller policy.

Recommended template IDs:

| Template ID | Owner Domain | Channel | Purpose |
| --- | --- | --- | --- |
| `account.verify-email` | `account-api` | email | account email verification |
| `account.reset-password` | `account-api` | email | password reset |
| `admin.invite` | `account-api` or admin domain | email | invite admin user |
| `cms.publish-summary` | `hhc-web-api` | email | CMS publish notification |
| `contact.submission-received` | `hhc-web-api` or `engagement-api` | email | notify staff of inquiry |
| `event.registration-confirmed` | future `event-api` | email | attendee confirmation |
| `event.registration-reminder` | future `event-api` | email | event reminder |
| `donation.receipt` | future `donation-api` | email | donation receipt |

Template record:

```sql
notification_template(
  id text not null,
  channel text not null,
  locale text not null,
  version int not null,
  active boolean not null,
  subject_template text,
  text_body_template text not null,
  html_body_template text,
  allowed_callers text[] not null,
  required_payload_schema jsonb not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  primary key (id, channel, locale, version)
)
```

Rules:

- Templates are versioned.
- Changing message meaning creates a new version.
- Deactivate old versions only after callers migrate.
- Missing locale falls back to `zh-Hant` only when the template explicitly allows fallback.
- Provider-specific markup should stay in templates/adapters, not callers.
- Callers pass structured payload, not pre-rendered HTML.

## Rendering

Renderer requirements:

- Escape all variables by default.
- Allow only approved helper functions.
- Reject missing required payload fields.
- Reject payload fields not allowed by schema when strict mode is enabled.
- Produce text body for every email.
- Produce HTML body only for templates that need it.
- Never render arbitrary caller-provided HTML unless explicitly whitelisted and sanitized.

Template preview:

```text
POST /priv/notifications/templates/preview
```

Preview is internal-only and should require `notifications:send` or `cms.admin` equivalent in the calling admin flow.

## Message Model

```sql
notification_message(
  id uuid primary key,
  template_id text not null,
  template_version int not null,
  channel text not null,
  locale text not null,
  recipient text not null,
  recipient_hash text not null,
  payload_json jsonb not null,
  rendered_subject text,
  rendered_text_body text,
  rendered_html_body text,
  status text not null,
  idempotency_key text not null,
  requested_by_service text not null,
  requested_by_actor_type text,
  requested_by_actor_id text,
  resource_type text,
  resource_id text,
  attempts int not null default 0,
  max_attempts int not null default 8,
  next_attempt_at timestamptz not null,
  provider text,
  provider_message_id text,
  provider_status text,
  error_code text,
  error_message text,
  requested_at timestamptz not null,
  queued_at timestamptz not null,
  sent_at timestamptz,
  delivered_at timestamptz,
  failed_at timestamptz,
  suppressed_at timestamptz,
  dead_lettered_at timestamptz,
  unique(requested_by_service, idempotency_key)
)
```

Do not log full recipient lists or message body content in normal logs. Use `recipient_hash` for correlation.

## Status State Machine

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

Allowed transitions:

```text
queued -> rendering
rendering -> ready_to_send
rendering -> failed
ready_to_send -> sending
sending -> sent
sending -> failed
sending -> suppressed
sent -> delivered
sent -> failed
failed -> ready_to_send
failed -> dead_lettered
queued -> cancelled
ready_to_send -> cancelled
```

Terminal statuses:

- `delivered`
- `suppressed`
- `dead_lettered`
- `cancelled`

`sent` can be terminal when the provider does not support delivery callbacks.

## Send Command

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
    "title": "2026-07-12 weekly bulletin",
    "publishedBy": "user_123"
  },
  "resourceType": "bulletin_issue",
  "resourceId": "bulletin_2026_07_12",
  "idempotencyKey": "cms.publish-summary:bulletin_2026_07_12:v7"
}
```

Rules:

- Caller app id must be allowed for the template.
- Recipient must pass channel validation.
- Payload must pass template schema validation.
- Idempotency key is required.
- Duplicate idempotency key returns existing `messageId` and status.
- `notification-api` queues the message; it does not block on provider delivery.

## Provider Adapters

Provider adapter interface:

```text
Send(message) -> provider_message_id, provider_status
ParseWebhook(request) -> provider_message_id, event_type, event_time, reason
ClassifyError(error) -> transient | permanent | suppressed
```

Possible providers:

- Azure Communication Services Email
- SendGrid
- SMTP provider as a fallback only if operationally acceptable

Provider selection should be config-driven:

```text
NOTIFICATION_PROVIDER=email-acs
EMAIL_FROM_ADDRESS=no-reply@alive.org.tw
EMAIL_FROM_NAME=HHC
PROVIDER_WEBHOOK_SECRET=...
```

Do not let callers choose arbitrary provider. Callers choose channel and template; notification service chooses provider.

## Suppression And Bounce Handling

Suppression record:

```sql
notification_suppression(
  id uuid primary key,
  channel text not null,
  recipient_hash text not null,
  reason text not null,
  source text not null,
  provider text,
  provider_event_id text,
  created_at timestamptz not null,
  expires_at timestamptz
)
```

Suppression reasons:

- `bounce`
- `complaint`
- `manual`
- `provider_block`
- `domain_policy`

Rules:

- Check suppression before sending.
- `suppressed` is terminal for the message.
- Suppression does not equal newsletter unsubscribe.
- Subscription consent/unsubscribe belongs to `engagement-api` or owning domain.
- Admin override requires audit and should be rare.

## Provider Webhooks

Enable only when needed for delivery/bounce status.

Route:

```text
POST /api/notifications/provider-webhooks/{provider}
```

Gateway rules:

- POST only.
- Body size limit.
- Rate limit.
- No browser JWT.
- Route only to `notification-api`.

`notification-api` rules:

- Verify provider signature.
- Deduplicate provider event id.
- Match provider message id to message.
- Update message status.
- Create suppression records for bounce/complaint.
- Emit audit events for permanent failure or suppression.

Provider webhook table:

```sql
notification_provider_event(
  id uuid primary key,
  provider text not null,
  provider_event_id text not null,
  provider_message_id text,
  event_type text not null,
  payload_json jsonb not null,
  received_at timestamptz not null,
  processed_at timestamptz,
  unique(provider, provider_event_id)
)
```

## Retry And Dead Letter

Follow `docs/superpowers/specs/2026-07-08-hhc-platform-eventing-outbox-reliability.md`.

Retry transient:

- provider timeout
- provider `429`
- provider `5xx`
- temporary DNS/network failure

Do not retry permanent:

- invalid recipient format
- unknown template
- payload schema mismatch
- caller not allowed for template
- provider permanent rejection

Dead-letter when:

- max attempts reached
- permanent provider failure needs operator review
- template render error cannot be fixed by retry

Dead-letter rows must be visible in metrics and operational query.

## Rate Limits

Rate limit dimensions:

- caller service
- template id
- recipient hash
- provider
- channel

Examples:

- `account.reset-password`: low per recipient and per IP/account upstream.
- `cms.publish-summary`: low volume.
- `event.registration-reminder`: batch window limits.
- `donation.receipt`: high reliability, low duplicate tolerance.

Rate limiting inside `notification-api` protects providers. Upstream domains still own anti-abuse controls for public forms or account flows.

## Audit Events

Emit audit events through `audit-log` for:

- `notification.message.requested`
- `notification.message.rendered`
- `notification.message.sent`
- `notification.message.delivered`
- `notification.message.failed`
- `notification.message.suppressed`
- `notification.provider.webhook.received`
- `notification.template.previewed`

Audit metadata should include:

- `messageId`
- `templateId`
- `templateVersion`
- `channel`
- `recipientHash`
- `requestedByService`
- `resourceType`
- `resourceId`
- `provider`
- `providerMessageId`
- sanitized failure reason

Do not audit full message body or raw recipient address unless a future legal requirement explicitly requires it.

## Security

- Internal send/preview/status routes require service identity.
- Template preview requires admin-equivalent scope through the calling service.
- Provider webhook route requires provider signature.
- Secrets stay in platform secrets.
- Do not log provider API keys, webhook secrets, raw message bodies, or full recipient lists.
- Reject templates that render unsafe HTML.
- Use least-privilege provider credentials.
- Separate production and test sender domains/config.

## Observability

Metrics:

- `notification.message.queued`
- `notification.message.render_failed`
- `notification.message.sent`
- `notification.message.delivered`
- `notification.message.failed`
- `notification.message.suppressed`
- `notification.message.dead_lettered`
- `notification.provider.latency_ms`
- `notification.provider.error_rate`
- `notification.queue.oldest_age_seconds`
- `notification.template.previewed`

Alerts:

- provider error rate spikes
- queue oldest age exceeds threshold
- dead-letter count increases
- suppression spike for one template/provider
- webhook signature failures spike

## Data Retention

Recommended defaults:

- Message metadata: 18-24 months.
- Rendered body: short retention or disabled unless needed for support.
- Provider events: 12 months.
- Suppression records: retain while applicable.
- Audit events: follow audit-log retention.

If rendered body is stored, treat it as sensitive and restrict admin access.

## Integration Examples

### Account Verification

1. `account-api` creates verification token.
2. `account-api` calls `notification-api /priv/notifications/send`.
3. Template `account.verify-email` renders verification link.
4. Provider sends email.
5. Delivery/bounce status updates message.

`notification-api` does not own the verification token.

### CMS Publish Summary

1. `hhc-web-api` publishes content.
2. Outbox event requests `cms.publish-summary`.
3. `notification-api` queues and sends email to configured admin recipient.
4. Audit records request and delivery/failure.

`notification-api` does not decide which content should notify admins.

### Future Event Reminder

1. `event-api` selects registrants eligible for reminder.
2. `event-api` calls notification for each recipient with idempotency key.
3. `notification-api` handles rendering, provider send, retry, suppression.

`event-api` owns schedule, attendees, and consent.

## Acceptance Criteria

- Browser users cannot call send/preview/status routes directly.
- Internal callers must be app-id allowlisted.
- Callers cannot use arbitrary templates.
- Duplicate send command returns existing message.
- Provider transient failures retry.
- Permanent failures do not retry forever.
- Suppression is enforced before provider send.
- Subscription consent remains outside `notification-api`.
- Provider webhook, if enabled, is signature-verified and idempotent.
- Audit events are emitted for request, final result, and suppression.
