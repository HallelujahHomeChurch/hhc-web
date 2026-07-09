# notification-api Runbook

## Service Purpose

`notification-api` is an internal-only service for notification intent, provider adapters, templates, retry policy, suppression, provider callbacks, and delivery status. Other services call it through private routes when they need to send email, LINE/admin alerts, or future channels.

## Owner And Escalation

- Primary owner: platform/notification engineering
- Escalate to provider owner for email or messaging provider outage
- Escalate to security owner for callback signature failures or sensitive payload exposure
- Escalate to caller service owner for malformed notification requests

## Dependencies

- PostgreSQL notification schema and outbox
- Provider adapters and provider credentials
- Template registry
- Callback route validation
- `audit-log` for protected notification configuration changes when applicable

## Health And Ready Checks

- `GET /healthz`: process health
- `GET /readyz`: database reachable, provider adapter configured, callback verifier configured
- Worker backlog check
- Provider sandbox smoke in non-production

## Dashboards And Logs

- notification intent rate by channel/template
- retry backlog age
- permanent failure count
- provider latency and error rate
- callback signature failure count
- suppression count
- cost/quota usage by provider

## Page-Worthy Alerts

- retry backlog oldest age exceeds threshold
- permanent failure spike for critical template
- provider callback signature failures spike
- provider credentials invalid
- internal callers receive broad 5xx from notification intent endpoint

## Common Failure Modes

- provider outage or quota exhaustion
- template regression renders invalid message
- callback signature secret mismatch
- retry worker stuck
- caller sends invalid recipient/channel/template
- provider returns delayed status updates

## Quick Triage

1. Determine channel, template, caller service, and provider.
2. Check whether failures are intent creation, worker send, provider callback, or suppression.
3. Check provider status and quota.
4. Check retry backlog age and permanent failure reason.
5. Preserve notification id, caller id, request id, and correlation id without storing sensitive body content.

## Mitigation Actions

- Enable provider kill switch to pause sends while preserving intent.
- Queue and retry rather than dropping notification intent.
- Roll back template version if rendering regressed.
- Switch provider adapter only if preconfigured and tested.
- Reject malformed caller requests with stable error codes.

## Rollback Path

- Roll back app revision for provider adapter or callback regression.
- Roll back template version for content/rendering regression.
- Keep outbox rows and retry state during rollback.
- Reprocess queued notifications only after duplicate-send safeguards are confirmed.

## Data Recovery Notes

Notification intent and delivery state are operational records. Restore into quarantine first if database recovery is needed. Before replay, check dedupe keys, suppression state, and provider idempotency behavior.

## Secrets And Key Rotation Notes

Provider API keys and callback secrets live in Key Vault or provider-specific secret storage. Do not log provider keys, raw provider callbacks containing private data, or message bodies with sensitive content.

## Degraded Modes

- Caller services can record local outbox intent if notification API is temporarily unavailable and the caller contract defines it.
- Non-critical notifications can be delayed.
- Critical protected workflows must not pretend that notification was sent if only intent was queued.

## Staging Drill

Run provider-disable and retry-recovery drill. Evidence must include kill switch state, queued intent count, retry result, duplicate-send check, and callback signature validation result.

## Production Verification

- Internal notification intent endpoint accepts valid caller.
- Invalid caller or malformed template request is rejected.
- Provider kill switch queues without sending.
- Retry worker drains backlog after provider recovers.
- Callback signature verification rejects invalid callback.
