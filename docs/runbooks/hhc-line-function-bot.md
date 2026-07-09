# hhc-line-function-bot Runbook

## Service Purpose

`hhc-line-function-bot` handles LINE webhook commands and integrates with platform APIs for church workflows. For the weekly bulletin download feature, it should call the public contract exposed by `hhc-web-api` rather than reading Blob Storage or CMS tables directly.

## Owner And Escalation

- Primary owner: bot integration engineering
- Escalate to `hhc-web-api` owner for bulletin lookup failures
- Escalate to `asset-api` owner for public bulletin download URL failures
- Escalate to platform owner for webhook ingress, secrets, or deployment issues
- Escalate to LINE provider owner for Messaging API outage or quota issues

## Dependencies

- LINE Messaging API and webhook signature secret
- `api-gateway` route to bot webhook if gateway-fronted, or platform ingress if separately hosted
- `hhc-web-api` public bulletin lookup endpoint
- `asset-api` mediated public download URL through `hhc-web-api`
- Redis or local cache only for ephemeral bot state if enabled

## Health And Ready Checks

- `GET /healthz`: process health
- `GET /readyz`: LINE configuration valid, public API base route reachable, required secrets loaded
- Webhook signature verification smoke in staging
- Bulletin latest lookup smoke
- Bulletin selected issue lookup smoke

## Dashboards And Logs

- webhook request rate and status
- signature verification failures
- command parse failures
- public API dependency latency and errors
- reply/send failures
- LINE quota or provider errors
- command success rate for weekly bulletin download

## Page-Worthy Alerts

- webhook signature failures spike
- LINE reply failure spike
- latest bulletin command fails broadly
- selected bulletin command fails broadly
- public API dependency unavailable for bot commands
- provider quota exhausted for required bot replies

## Common Failure Modes

- LINE webhook secret mismatch
- command parser rejects valid user phrase
- public bulletin API unavailable
- latest bulletin exists but public asset grant is missing
- reply token expires due to slow processing
- provider quota or temporary outage blocks replies

## Quick Triage

1. Determine command: latest bulletin, selected bulletin, or unrelated command.
2. Check webhook signature validation before command logic.
3. Check public API dependency latency and status.
4. Check bulletin response shape and public asset URL state.
5. Check LINE reply/send error code and retry policy.
6. Preserve webhook event id, request id, correlation id, and command type without logging private message content beyond what policy allows.

## Mitigation Actions

- Reply with temporary unavailable message when public API is down.
- Keep using `hhc-web-api` public contract; do not bypass to Blob or database.
- Disable a failing command with clear fallback if it causes provider errors.
- Re-run selected bulletin lookup after asset grant repair.
- Reduce dependency timeout so reply token is not wasted on slow upstream calls.

## Rollback Path

- Roll back bot app revision for parser or reply regression.
- Roll back command config if command aliases changed.
- No database rollback should be needed for bot-only changes.
- Keep public API contract backward compatible during bot rollout.

## Data Recovery Notes

Bot state should be ephemeral unless a feature explicitly stores files or conversation state. LINE group file storage is a future `asset-api` namespace and must have quota, retention, and ownership rules before broad use.

## Secrets And Key Rotation Notes

LINE channel access tokens and webhook secrets must live in secret storage. Do not log tokens, raw authorization headers, or private group/user identifiers beyond approved hashed/reference form.

## Degraded Modes

- Bot can return temporary unavailable while website remains healthy.
- Bulletin command can offer website link if direct file reply fails.
- Non-critical commands can be disabled independently.
- Bot must not scrape public pages or raw Blob URLs as a fallback.

## Staging Drill

Run weekly bulletin command drill for latest and selected issue. Evidence must include command input, public API response, public asset URL state, LINE reply result, and failure-mode response when API returns unavailable.

## Production Verification

- Webhook signature verification accepts valid request and rejects invalid request.
- Latest bulletin command returns current public bulletin.
- Selected bulletin command returns requested public issue.
- Missing bulletin returns stable not-found response.
- Public API outage returns temporary unavailable response.
