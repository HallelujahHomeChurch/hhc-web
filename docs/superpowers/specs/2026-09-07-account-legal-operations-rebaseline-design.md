# Account Legal Operations Rebaseline Design

**Status:** Approved design direction, pending written-spec review

**Date:** 2026-09-07

## Purpose

Rebaseline the five Account legal-operations phases for the current HHC website so production readiness does not depend on building speculative privacy, incident, retention, or vendor platforms.

The control objectives remain: give clear notice, fulfill data-subject requests, know and safely retire Account-attributable data, respond to incidents, and supervise external processors. The implementation stops at the smallest operationally reliable mechanism for the current traffic, data volume, team size, and product surface.

This is an engineering design, not a legal opinion. External review owns final public copy, legal bases, retention periods and exceptions, notification obligations, and processor contract terms.

## Current Baseline

The following capabilities are already merged and released:

- versioned Terms and Privacy Notice acceptance across password, OAuth, MFA, and resumed authorization flows;
- Account DSR orchestration plus owner contracts in Account, Asset, Engagement, and Notification;
- Account, Asset, Engagement, and Notification data-governance inventories with CI verification and immutable publication;
- MFA, RBAC, session and device lifecycle, encrypted notification targets and payloads, malware scanning, release rollback, and platform incident-command foundations.

Production intentionally keeps `POLICY_ACCEPTANCE_ENFORCED=false`. DSR remains unavailable to ordinary users. Asset retention remains a Manual job with apply disabled. Governance entries without an approved legal decision retain `legal_basis.status: pending_legal` and `retention.status: pending_legal`.

The public Privacy Notice already describes the organization, categories, purposes, retention, regions, recipients, processors, security, data-subject rights, and `support@alive.org.tw`. The registration UI currently renders its combined Terms and Privacy acknowledgement only while policy enforcement is enabled. Collection notice must no longer depend on that enforcement flag.

## Decision

Use a launch-first, platform-later model with three independent tracks:

1. **Engineering baseline:** small code or documentation changes may pass CI, merge, and release without waiting for external review when they do not activate policy or destructive behavior.
2. **External review:** legal and policy owners review public wording, retention decisions, incident-notification rules, and processor terms independently.
3. **Activation:** policy enforcement, public DSR, and destructive retention each require their own reviewed production change. One blocked activation must not block unrelated website delivery.

Do not create a privacy service, retention service, incident service, vendor service, new database, central case-management platform, or new Admin UI for this scope.

## Revised Five-Phase Scope

### Phase 1: Policy Acceptance

Keep the released versioned acceptance mechanism. Make the collection notice visible at password registration and OAuth onboarding independently of `POLICY_ACCEPTANCE_ENFORCED`.

- Privacy Notice presentation is informational and always visible when Account data is collected.
- Terms acceptance and persisted policy evidence remain controlled by the server capability and enforcement flag.
- The UI must not report policy acceptance or send a policy acceptance payload while enforcement is false.
- Newsletter consent remains a separate optional control.
- Final wording, translations, age or guardian requirements, version identifiers, and enforcement timing remain external-review inputs.

Phase 1 development completion does not authorize `POLICY_ACCEPTANCE_ENFORCED=true`.

### Phase 2: Data-Subject Requests

Keep the released DSR API, Gateway routes, Account UI, and service-owner contracts disabled for ordinary users until an operator drill succeeds.

The launch baseline is an operator runbook, not a public self-service portal. It must define:

- intake through `support@alive.org.tw`;
- request identity and Account subject;
- identity or representative verification;
- request type: access or copy, correction, restriction, or deletion;
- decision due date and documented extension;
- refusal or retention-exception reason;
- execution evidence and response completion;
- escalation when an owner service cannot export, restrict, correct, or erase safely.

One synthetic Account request must exercise intake through completion without using production personal data. Public DSR activation remains a separate gate after an operating owner accepts the workload.

### Phase 3A: Data Governance

Treat the released owner inventories and immutable evidence pipeline as complete. Continue to use the service-owned manifests; do not create a duplicate central data catalog.

- Every Account-attributable field retains a classification or explicit exclusion reason.
- `pending_legal` is an intentional state, not a publication failure.
- Governance publication proves reviewed implementation evidence, not legal compliance.
- New Account-attributable datasets extend their owner manifest in the same feature PR.
- Donation and other future sensitive domains must pass a separate launch review before production routing.

### Phase 3B: Retention Execution

Replace full automation with the following owner-local flow:

```text
dry-run report -> data-owner approval -> manual apply -> immutable result evidence
```

Rules:

- A dataset with `retention.status: pending_legal` is never eligible for a new destructive policy.
- Existing tested retention behavior may continue unchanged.
- Each newly approved rule is delivered by the owning service in a focused PR and release.
- The dry run and apply use the same selection predicate; apply adds mutation but does not broaden eligibility.
- Execution is idempotent and records selected, skipped, failed, and completed counts without personal record values.
- A partial failure remains retryable and cannot mark unprocessed owners complete.
- Backup expiry and restore reconciliation remain documented operational constraints. Do not build a restore orchestrator until an actual restore or request volume demonstrates the need.
- Do not add a global scheduler. Manual triggering remains the default until repeated, measured operator toil justifies scheduling.

### Phase 4: Security And Incident Operations

Extend the existing `docs/runbooks/platform-incident-command.md`; do not build an incident platform.

Add a personal-data incident section covering:

- suspected exposure, unauthorized access, loss, alteration, or unsafe restore;
- immediate containment and evidence preservation;
- affected data-owner and processor identification;
- Account credential and session revocation decisions;
- notification-decision escalation to the policy or legal owner;
- affected-subject communication tracking without copying sensitive payloads into incident notes;
- retention of the decision, actions, and closeout evidence.

Run one tabletop exercise using synthetic facts. Automation is added only when the exercise exposes a specific repeatable failure that existing Azure, GitHub, monitoring, audit, or service controls cannot cover.

### Phase 5: Vendors And Data Flow

Maintain one version-controlled processor register; do not build a vendor system.

The register covers every processor or identity provider used in production, initially Azure, Google, Microsoft, LINE, email and Web Push providers, and any enabled error or performance telemetry provider. Each entry records:

- service and business purpose;
- data categories and HHC owner services;
- processing or storage regions when known;
- subprocessors or authoritative subprocessor-list location;
- deletion, export, and contract-termination handling;
- security-incident contact or notification channel;
- contract or DPA source;
- external-review state and last evidence date.

`pending_external_review` is valid for merging the factual register. It is not approval to send a new data category, enable a new provider, or accept unresolved production risk.

## Repository Ownership

Only two initial delivery batches are defined by this design. Implementation still requires the normal user approval and repository delivery gates.

### Batch A: Registration Notice

Repository: `account-fe`

- Modify the existing registration and OAuth onboarding presentation.
- Reuse the current legal links, locale handling, and capability response.
- Add focused tests proving the Privacy Notice is visible with enforcement off and no acceptance payload is emitted.
- Preserve existing enforced Terms acceptance behavior.

### Batch B: Legal Operations Baseline

Repository: `hhc-web`

- Add one privacy-request operator runbook under `docs/runbooks/`.
- Extend the existing platform incident-command runbook with the personal-data incident checklist and tabletop record format.
- Add one vendor and data-flow register under `docs/governance/`.
- Link these artifacts from the runbook index.

This documentation batch contains no runtime, dependency, API, schema, infrastructure, or production configuration change.

Retention changes are not part of either batch. They begin only after a specific owner manifest receives an externally approved rule.

## External Review Packages

External work is split into four packages and may proceed in parallel:

1. **Public policy:** governing `zh-Hant` Terms and Privacy Notice, reviewed translations, age and guardian treatment, material-change notification, and version activation.
2. **Retention:** purpose, legal basis, period, trigger, action, and statutory or operational exceptions for each `pending_legal` dataset.
3. **Incident:** notification threshold, recipients, deadlines, regulator routing, approved communication content, and evidence retention.
4. **Processors:** processor terms, DPA or equivalent, processing regions, cross-border constraints, subprocessor notice, breach notice, DSR assistance, and termination deletion or return.

External review may create narrowly scoped remediation work. It does not reopen completed platform architecture unless an approved requirement contradicts an existing technical assumption.

## Independent Activation Gates

### Policy Enforcement Gate

Requires approved governing copy and translations, approved age treatment, configured version identifiers, Account FE live verification, rollback configuration, and an explicit production change setting `POLICY_ACCEPTANCE_ENFORCED=true`.

### Public DSR Gate

Requires a completed synthetic operator drill, named primary and backup operators, verified support-mail delivery, request deadline tracking, successful owner responses, safe failure handling, and authenticated UI and API smoke tests.

### Retention Apply Gate

Applies per dataset and owner service. Requires an approved manifest rule, dry-run review, tested selection parity, idempotent mutation, rollback or recovery procedure where deletion is reversible, immutable result evidence, and explicit production authorization.

No global legal-operations switch exists.

## Failure Handling

- If the public policy cannot be loaded, collection screens fail closed only when policy enforcement is active. With enforcement off, the stable Privacy Notice link remains visible and registration behavior remains compatible.
- If a DSR owner is unavailable or returns inconsistent evidence, keep the request open, record the owner failure, and escalate; never report completion from partial owner success.
- If retention dry-run evidence is missing, stale, or broader than the approved predicate, do not apply.
- If retention apply partially fails, retry only failed idempotent owner actions and preserve the original execution identity.
- If processor facts are unknown, record `pending_external_review`; do not invent a region, contractual protection, or deletion guarantee.
- If an incident may involve personal data, preserve evidence and escalate the notification decision. Absence of a final legal decision must not delay containment.

## Verification

### Batch A

- focused component and page tests for password registration and OAuth onboarding with enforcement on and off;
- Account FE full test, lint, and build gates;
- PR CI, merge, release, and live locale smoke;
- production readback confirms no server enforcement configuration changed.

### Batch B

- Markdown links and repository path checks;
- register schema and required-entry assertions using existing repository tooling or a minimal checked-in script only if plain review cannot enforce structure;
- placeholder and secret scans;
- `git diff --check` and repository CI;
- no application release is required unless the repository workflow unavoidably performs one for documentation changes.

### Operational Drills

- one synthetic DSR lifecycle record;
- one synthetic personal-data incident tabletop record;
- one retention dry-run only after an approved owner rule exists.

Drills must not use real personal data, send external user notifications, delete production data, or enable a production feature.

## Explicit Non-Goals

- automatic cross-service retention scheduling;
- public DSR activation in the initial batches;
- central privacy, retention, incident, recovery, or vendor services;
- case-management databases or Admin consoles;
- processor contract negotiation or legal approval inside engineering;
- automatic regulator or affected-user notification;
- donation collection, payment processing, tax receipts, fundraising permits, accounting, or donor-data policy.

## Completion Criteria

The rebaseline is complete when:

- registration collection notice is visible independently of Terms enforcement;
- the DSR operator runbook can drive a synthetic request to a documented outcome;
- existing governance inventories remain authoritative and no speculative catalog is added;
- destructive retention remains owner-local, approval-gated, and disabled where decisions are pending;
- the existing incident runbook covers personal-data containment and notification escalation and has one synthetic exercise record;
- every production processor has a factual register entry, including explicit unknowns;
- policy enforcement, public DSR, and retention apply remain separate production gates;
- no new platform service, database, or Admin UI was introduced.
