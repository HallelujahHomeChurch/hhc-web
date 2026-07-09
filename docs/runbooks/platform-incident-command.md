# Platform Incident Command Runbook

## Purpose

Use this runbook for SEV1 and SEV2 incidents across the HHC web platform. It coordinates severity, ownership, timeline, communication, mitigation choice, verification, and follow-up.

## Owner And Escalation

- Primary owner: platform operations owner
- Technical lead: owning service engineer for the first failing service boundary
- Escalation: security owner for auth/data exposure, data owner for restore/lifecycle incidents, provider owner for external notification or LINE issues

## Severity Assignment

| Severity | Use When |
| --- | --- |
| SEV1 | broad public outage, unsafe gateway/auth behavior, data exposure, production restore risk, admin security path unsafe |
| SEV2 | major workflow blocked, publish unavailable, public asset download broken, LINE weekly bulletin command unusable |
| SEV3 | degraded service with workaround |
| SEV4 | documentation, dashboard, noisy alert, or low-risk defect |

## First 15 Minutes

1. Record incident id, start time, detected source, and initial severity.
2. Assign incident commander and technical lead.
3. Identify affected route class: public read, protected admin write, asset download, provider callback, worker, or LINE webhook.
4. Check `api-gateway` status first because all external routes pass through it.
5. Open the owning service runbook after the failing boundary is identified.
6. Preserve release manifest id, config fingerprint, request ids, correlation ids, and gateway route policy version.
7. Choose one mitigation path: rollback, kill switch, route block, degraded mode, dependency recovery, scale, or restore.
8. Record the next update time.

## Evidence To Capture

- incident id
- severity
- start and end time
- affected services and route classes
- current public or admin impact
- latest release manifest id
- config fingerprint
- gateway route policy version
- request ids and correlation ids
- dashboard or log query links
- mitigation and verification results
- follow-up owner

Do not paste secrets, tokens, cookies, authorization headers, raw provider payloads with private data, or Blob SAS URLs into incident notes.

## Mitigation Rules

- Fail closed for auth, authorization, private data, and protected writes.
- Public pages can use stale public projections only when they cannot expose private, draft, deleted, or legally held data.
- Do not route around `api-gateway`.
- Do not expose raw Blob or SAS URLs.
- Do not silently drop notification or audit intent.
- Do not attach public traffic to a restored environment until lifecycle reconciliation and smoke checks pass.

## Closeout

Close SEV1 and SEV2 only after:

- user-facing workflow is verified
- rollback or fix is stable
- queued workers are recovering or intentionally paused
- no public/private data leakage is present
- incident note has impact window and mitigation summary
- follow-up item has an owner

## Post-Incident Review

Record:

- what failed
- how it was detected
- what contained the blast radius
- whether the runbook worked
- what should be automated, alerted, or documented
- one prevention item with owner and target release
