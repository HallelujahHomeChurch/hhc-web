# api-gateway Runbook

## Service Purpose

`api-gateway` is the first and only external backend entry point for platform traffic. It routes `www.alive.org.tw` UI and API paths, validates JWT access tokens locally, strips untrusted client headers, injects trusted identity headers, blocks external `/priv/*` access, and forwards internal calls to service-specific APIs.

## Owner And Escalation

- Primary owner: platform engineering
- Escalate to account owner for JWKS or signing-key incidents
- Escalate to service owner for route-specific upstream failures
- Escalate to security owner for invalid-token acceptance, private route exposure, or trusted-header spoofing

## Dependencies

- Account JWKS endpoint and cached JWKS document
- Gateway route policy
- Internal Dapr/service discovery
- TLS certificates and public DNS
- Upstream services: `hhc-web`, `hhc-web-api`, `asset-api`, `account-api`

## Health And Ready Checks

- `GET /healthz`: gateway process is running
- `GET /readyz`: route policy loaded, service discovery available, JWKS cache state valid or within approved stale window
- Protected route smoke: valid token succeeds, missing token fails, invalid signature fails
- Private route smoke: external `/priv/*` returns blocked response

## Dashboards And Logs

- request rate, 4xx, 5xx, p95 latency by host and route class
- JWT validation failure count by reason
- JWKS refresh age and refresh failures
- upstream latency and error rate by service
- trusted header stripping/injection counters
- log lookup by request id and correlation id

## Page-Worthy Alerts

- gateway 5xx spike on public or admin routes
- gateway accepting invalid token in synthetic test
- JWKS refresh failure beyond max stale window
- protected route missing trusted identity headers after verification
- external `/priv/*` or `/api/priv/*` route reachable
- upstream failures affecting Tier 0 or Tier 1 route classes

## Common Failure Modes

- bad route policy sends a path to the wrong service
- JWKS cache stale after account signing-key rotation
- gateway route blocks valid public path
- trusted headers are not stripped before forwarding
- `www.alive.org.tw` host routing breaks UI or same-origin API calls
- Dapr/service discovery cannot reach upstream services

## Quick Triage

1. Confirm host, route, status code, and request id.
2. Check whether the failure is public route, protected admin route, account route, or private-route probing.
3. Compare active route policy version with the release manifest.
4. Check JWT validation metrics before blaming upstream services.
5. Check upstream health only after gateway policy and auth behavior are confirmed.
6. Preserve correlation id and route decision logs.

## Mitigation Actions

- Roll back the gateway route policy if routing changed.
- Roll back the gateway app revision if verifier or header behavior changed.
- Fail closed for protected routes if JWKS state is unsafe.
- Keep public read routes available only if route policy is correct and no private data can leak.
- Block affected path class at gateway if upstream behavior is unsafe.

## Rollback Path

- Restore previous ACA revision for gateway code regression.
- Restore previous route policy version for route regression.
- Restore previous config fingerprint if route or JWKS settings changed.
- Keep `account-api` signing-key compatibility window intact during rollback.

## Data Recovery Notes

`api-gateway` should be stateless. Recovery focuses on route policy, config, JWKS cache, and logs. Do not store user data in gateway state.

## Secrets And Key Rotation Notes

- Gateway reads public JWKS data and should not store account private signing keys.
- Gateway must never log access tokens, refresh tokens, authorization headers, cookies, or trusted identity header values containing sensitive claims.
- Signing-key rotation is owned by `account-api`; gateway validates current and previous keys during the rotation window.

## Degraded Modes

- Public reads may continue if upstream public services are healthy.
- Protected routes fail closed when token validation is unsafe.
- Gateway must not call `account-api` per request to compensate for local JWT verifier problems.

## Staging Drill

Run a staging route-policy rollback drill and a JWKS rotation drill. Evidence must include route policy id, key ids, valid-token result, invalid-token result, external private-route block result, and rollback result.

## Production Verification

- Public home route returns successfully.
- Same-origin public API route returns successfully.
- Protected admin route requires valid JWT.
- Invalid token is rejected.
- External `/priv/*` is blocked.
- Upstream response includes request id and correlation id.
