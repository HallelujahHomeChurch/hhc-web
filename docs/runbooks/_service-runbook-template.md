# Service Runbook Template

Use this structure for new service runbooks.

## Service Purpose

Describe the user-facing or internal responsibility of the service.

## Owner And Escalation

- Primary owner: service engineering owner
- Escalation: platform owner for runtime, data owner for schema/state, security owner for auth/data exposure

## Dependencies

- Runtime dependencies
- Data dependencies
- Internal service dependencies
- External provider dependencies

## Health And Ready Checks

- `GET /healthz`: process health
- `GET /readyz`: dependency readiness
- service-specific worker or provider checks

## Dashboards And Logs

- request rate, latency, and error panels
- dependency latency and error panels
- worker backlog panels if applicable
- log queries by request id and correlation id

## Page-Worthy Alerts

- user-visible outage
- unsafe security behavior
- durable backlog or data recovery failure
- dependency outage that blocks the service's SLO route class

## Common Failure Modes

- deployment regression
- dependency outage
- bad config or secret version
- schema or migration issue
- queue or worker backlog
- provider outage

## Quick Triage

1. Confirm affected route class or workflow.
2. Check gateway status and route policy.
3. Check service health and ready state.
4. Check the latest release manifest and config fingerprint.
5. Check dependency health and recent alerts.
6. Preserve request ids and correlation ids.

## Mitigation Actions

- rollback app revision
- enable kill switch
- fail closed for protected writes
- serve public degraded mode if safe
- queue and retry downstream work

## Rollback Path

- application revision rollback
- gateway route rollback if route policy changed
- config rollback if a config fingerprint changed
- database rollback or roll-forward notes when migrations are involved

## Data Recovery Notes

- stateful data sources
- cache rebuild path
- restore quarantine checks
- lifecycle, deletion, redaction, and legal-hold reconciliation if applicable

## Secrets And Key Rotation Notes

- secret names, not values
- key rotation behavior
- emergency rollback behavior

## Degraded Modes

Document what the service can safely do when each dependency is unavailable.

## Staging Drill

Describe the staged failure simulation and expected evidence.

## Production Verification

List smoke checks required after mitigation, rollback, or restore.
