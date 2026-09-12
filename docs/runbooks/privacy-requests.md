# Privacy Request Runbook

## Scope And Owner

Use this runbook for access/export, correction, processing restriction, and erasure requests covering data reliably attributed to an HHC Account. `account-api` owns request state and delegates to Account, Asset, Engagement, Notification, and the Website manual owner. The platform operations owner coordinates exceptions and responses.

The target decision periods are 15 days for access/copy requests and 30 days for correction, restriction, or erasure requests. A justified extension may add at most the same period; record the reason and notify the requester in writing. These engineering targets follow the current Personal Data Protection Act Articles 3, 11, and 13 and require counsel confirmation.

## Intake And Identity

1. Prefer the authenticated Account **Data and privacy requests** page. Record only request id, type, submission time, and status in operational notes.
2. For email or support intake, direct the requester to sign in and submit the request. If that is impossible, open a restricted incident record and verify control of the account email plus a second existing account factor; never request a password or identity-document copy in ordinary support channels.
3. Treat recent authentication, exact-email erasure confirmation, and Account ownership checks as the identity gate. Escalate conflicting identities, compromised accounts, minors, deceased persons, or authorized representatives to the policy owner before disclosure or deletion.
4. Do not copy export contents or personal data into tickets, chat, logs, or this runbook.

## Operator Checklist

| Field | Record |
| --- | --- |
| Request id and type | Opaque id plus `access_export`, `correction`, `restrict_processing`, or `erasure` |
| Received / due time | Timestamp, statutory target, extension target if used |
| Identity gate | Method, completion time, verifier; no credentials |
| Owner progress | Account, Asset, Engagement, Notification, Website manual status |
| Holds or exceptions | Legal hold, security need, record duty, ownership conflict, or `none` |
| Decision | Complete, partial, refused, or identity unresolved; include reason |
| Response | Channel, sent time, export expiry when relevant |
| Closeout | Final request status, failed owner retries, audit/correlation ids |

## Execution

1. Confirm the request has the expected owner executions and no owner is silently missing.
2. For export, let the service build the package and give the authenticated requester only the short-lived Account download. Do not forward the archive.
3. For correction, route source-record changes to the owning service; do not patch derived copies without correcting the source.
4. For restriction, confirm affected owners stop the requested processing while preserving only data needed for the restriction, security, legal hold, or dispute.
5. For erasure, require the Account confirmation step, then verify each owner reports success, not-applicable, or a documented manual action. Deletion is not complete while an owner is failed or running.
6. If an owner fails, retain the request, retry idempotently, and escalate before the due time. Do not mark the request complete to clear a queue.

## Refusal, Extension, And Closeout

- The policy owner must approve a refusal, partial response, or extension and provide a specific written reason. Engineering does not invent a legal exception.
- Record the original due time even when extended. Notify the requester before it expires.
- Close only after the requester response is sent and all owners are reconciled. Preserve audit metadata, not exported personal data.
- Escalate suspected unauthorized disclosure to the personal-data incident checklist in `platform-incident-command.md` immediately.

