# account-api Runbook

## Service Purpose

`account-api` owns identity, login sessions, refresh token rotation and revocation, admin account lifecycle, role bundles, and JWKS publication. Access tokens are short-lived and validated locally by `api-gateway`; gateway does not call `account-api` for every request.

## Owner And Escalation

- Primary owner: account domain engineering
- Escalate to platform owner for gateway/JWKS validation issues
- Escalate to security owner for suspected token replay, compromised key, role escalation, or account takeover

## Dependencies

- PostgreSQL account schema
- Key Vault signing-key material
- Gateway JWKS cache and route policy
- Email or notification path for account lifecycle messages when enabled
- Audit-log for protected administrative changes

## Health And Ready Checks

- `GET /healthz`: service process is running
- `GET /readyz`: PostgreSQL reachable, signing key available, JWKS can be generated
- JWKS smoke: published key ids match active and previous rotation window
- Login smoke in staging: login, refresh, revoke, and protected route access through gateway

## Dashboards And Logs

- login success/failure rate
- refresh token rotation and revoke count
- refresh token reuse or replay detection
- JWKS request rate and key age
- admin role grant/revoke actions
- account API p95 latency and 5xx
- log lookup by account id, request id, and correlation id where safe

## Page-Worthy Alerts

- login outage
- refresh token reuse spike
- JWKS unavailable or stale during rotation window
- signing key unavailable
- unexpected role escalation path
- account admin lifecycle write fails broadly

## Common Failure Modes

- bad signing-key rotation removes a still-needed key
- refresh token revocation table unavailable
- login provider or password verifier regression
- role bundle migration breaks admin permissions
- JWKS response cached incorrectly by gateway or CDN path

## Quick Triage

1. Determine whether the issue affects login, refresh, JWKS, or admin lifecycle.
2. Check gateway JWT validation alerts to see whether tokens are failing after issuance.
3. Check latest signing-key rotation event and active key ids.
4. Check PostgreSQL availability and migration version.
5. For suspected replay or compromise, preserve audit references and request ids without exposing token values.

## Mitigation Actions

- Pause key rotation if gateway validation is unstable.
- Restore previous signing key as previous-valid key during compatibility window.
- Revoke affected refresh tokens if replay or compromise is suspected.
- Disable affected admin account or role grant path if privilege escalation is suspected.
- Keep access tokens naturally expiring; do not require gateway to call account per request.

## Rollback Path

- Roll back app revision if login/JWKS behavior regressed.
- Roll forward schema fixes for token tables when destructive rollback would lose revocation data.
- Keep previous signing key published until gateway cache has observed the current key.
- Roll back role bundle config only with audit entry and explicit owner approval.

## Data Recovery Notes

Account data is stateful and security-sensitive. Restore account schema only into quarantine first. Before promotion, verify disabled accounts, revoked refresh tokens, role grants, and signing-key references are current.

## Secrets And Key Rotation Notes

- Private signing keys live in Key Vault, never in repo, image, logs, or incident notes.
- JWKS contains public key material only.
- Emergency key rotation requires gateway validation test for current and previous keys.

## Degraded Modes

- Existing short-lived access tokens continue until expiration if gateway has valid JWKS.
- New login and refresh fail closed if account state or signing keys are unsafe.
- Admin role changes fail closed if audit or account write path is unavailable.

## Staging Drill

Run signing-key rotation and refresh-token revoke drill. Evidence must include key ids, gateway validation result, revoke result, and failed refresh attempt after revocation.

## Production Verification

- JWKS endpoint returns active public key set.
- Gateway accepts a freshly issued valid token.
- Gateway rejects an expired or invalid token.
- Refresh token can be revoked and cannot be reused.
- Admin role grant/revoke writes an audit intent.
