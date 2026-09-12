# Account Legal Operations Launch Design

**Status:** Approved for implementation and production activation

**Original date:** 2026-09-07
**Rebased:** 2026-09-12

## Purpose

Complete the five Account legal-operations phases without building speculative privacy, retention, incident, or vendor platforms. The launch must provide visible notice, versioned acceptance, data-subject request handling, factual data inventories, bounded retention, personal-data incident handling, and a processor register.

This is an engineering baseline, not a legal opinion. The current Traditional Chinese Terms and Privacy Notice are the governing launch draft. A lawyer may later revise wording, legal bases, retention periods, notification obligations, and processor terms without blocking the existing code or service boundaries.

## Current Baseline

The following capabilities are merged and released:

- versioned Terms and Privacy Notice acceptance across password, OAuth, MFA, and resumed authorization flows;
- self-service and Admin DSR UI, Account orchestration, and owner contracts in Account, Asset, Engagement, Notification, and Website watermark data;
- service-owned data-governance inventories with CI verification and immutable publication;
- Account security controls, private asset lifecycle, encrypted notification data, release rollback, and platform incident-command foundations.

Production currently reports:

- `POLICY_ACCEPTANCE_ENFORCED=false`;
- Terms version `terms-2026-08-04`, while the current public Terms were published 2026-09-07;
- Privacy Notice version `privacy-2026-09-11`, matching the current public publication;
- `dsr.enabled=false`;
- Asset retention as a Manual job with apply disabled.

The public Traditional Chinese Privacy Notice already states the collector, purposes, data categories, use period, regions, recipients, methods, data-subject rights, non-provision impact, security handling, third-party login, notification preferences, and `support@alive.org.tw`. The Account collection screen must link to it even before acceptance enforcement is enabled.

## Decision

Ship four small owner-local deliverables:

1. **Account notice:** show an informational Privacy Notice link wherever password registration or OAuth onboarding collects Account data. This notice never fabricates acceptance evidence.
2. **Operational baseline:** add a DSR runbook, personal-data incident checklist and tabletop record, processor register, and a versioned legal-review packet.
3. **Account activation:** align the Terms version to `terms-2026-09-07`, keep Privacy at `privacy-2026-09-11`, provision the DSR subject-reference key, then enable policy enforcement and DSR through the normal Account API release.
4. **Retention activation:** keep the Asset retention job Manual, run a production dry-run, enable apply through the normal Asset release, and perform one bounded manual execution only against the existing `line.group.media-sync` predicate. Do not enable a recurring schedule.

Do not create a privacy service, retention service, incident service, vendor service, new database, central case-management platform, or new Admin UI.

## Revised Five Phases

### Phase 1: Notice And Policy Acceptance

- Privacy Notice presentation is informational and always visible at password registration and OAuth onboarding.
- Terms acceptance and persisted evidence remain controlled by the server capability.
- No policy payload is sent while enforcement is false.
- Newsletter consent remains separate and optional.
- Enable enforcement only after the Account FE release is live and both public legal URLs return the configured versions.
- A later legal-copy change receives a new version identifier and another acceptance decision; it does not require an auth redesign.

### Phase 2: Data-Subject Requests

Use the released DSR system rather than creating another portal or API. The operating contract covers:

- authenticated self-service requests and `support@alive.org.tw` assisted intake;
- access/export, correction, restriction, and erasure;
- identity or representative verification;
- decision date, extension, refusal, or retention-exception evidence;
- owner execution evidence and retryable partial failure;
- Admin approval, retry, and manual-resolution paths.

Production activation requires capability readback plus a non-destructive authenticated smoke. A destructive erasure drill must use a dedicated synthetic account, never an existing member account.

### Phase 3A: Data Governance

The existing owner manifests remain authoritative. `pending_legal` remains a valid factual state and is not rewritten as legal approval. New Account-attributable datasets update their owner manifest in the same feature PR. Donation and other future sensitive domains require their own launch review.

### Phase 3B: Retention Execution

The initial production retention capability remains owner-local:

```text
dry-run report -> bounded approval -> manual apply -> result evidence
```

- The Asset predicate is fixed to active `line.group.media-sync` collections owned by `hhc-line-function-bot`, expired by the collection's configured `retention_days`, and excludes `retention_exempt=true` items.
- Dry-run and apply use the same repository predicate.
- Apply is idempotent and records counts without personal record values.
- The first apply remains Manual; the 19:00 UTC recurring schedule stays disabled.
- Other datasets with `retention.status: pending_legal` receive no new destructive rule.
- Restore orchestration and a global scheduler remain out of scope.

### Phase 4: Personal-Data Incidents

Extend `docs/runbooks/platform-incident-command.md`; do not build an incident platform. The checklist covers suspected exposure, unauthorized access, loss, alteration, unsafe restore, containment, evidence preservation, affected owners and processors, credential/session action, notification escalation, subject communication tracking, and closeout evidence. Record one synthetic tabletop exercise without real personal data or external notification.

### Phase 5: Processors And Data Flow

Maintain one version-controlled factual register; do not build a vendor system. It covers Azure, Cloudflare Turnstile, Sentry, Google, Microsoft, LINE, Azure Communication Services email, and browser-selected Web Push services. Unknown contract, region, subprocessor, deletion, or incident terms are recorded as `pending_external_review`, never invented.

## Public Legal Draft V1

The launch draft is the content currently published at:

- `https://www.alive.org.tw/zh-Hant/privacy-policy`, published 2026-09-11;
- `https://www.alive.org.tw/zh-Hant/terms-of-use`, published 2026-09-07.

The engineering review checks that the Privacy Notice contains the six collection-notice categories reflected in Article 8 of Taiwan's Personal Data Protection Act and the rights reflected in Article 3. It also keeps purpose limitation, correction/deletion handling, incident notification, and non-marketing-without-choice language explicit. Legal counsel remains responsible for confirming the organization's formal identity, sector-specific rules, age treatment, cross-border terms, statutory retention, limitation clauses, and future donation requirements.

## Delivery And Activation Order

1. Merge and release the Account FE notice.
2. Merge the operational documentation package.
3. Create the Account DSR HMAC secret without disclosing it, merge Account API activation, wait for CI/CD, and verify the deployed revision and live capability response.
4. Run authenticated Policy and DSR live smoke tests. Do not erase a real account.
5. Merge the Asset manual-apply activation, wait for CI/CD, rerun dry-run, then execute one bounded manual apply and preserve counts.

Every repository keeps its own branch, PR, CI, merge, release, and live evidence. No unmerged commit is deployed.

## Failure Handling

- If legal pages are unavailable, enforced registration or onboarding fails closed.
- If the DSR key or any owner dependency is unavailable, Account API must not become ready or the request remains open; partial owner success never becomes completion.
- If retention dry-run changes scope, reports failures, or includes an unexpected namespace/owner, do not apply.
- If retention apply partially fails, retry the same idempotent operation and preserve the original evidence.
- If processor facts are unknown, keep `pending_external_review` and do not infer protections.
- If an incident may involve personal data, containment and evidence preservation proceed immediately while notification decisions escalate.

## Verification

- Account FE: focused red/green tests, full test, lint, build, PR CI, release, and live locale/link smoke.
- HHC Web docs: link check, placeholder/secret scan, `git diff --check`, and PR CI.
- Account API: configuration tests, `go test ./...`, `go vet ./...`, Bicep build/what-if, PR CI, release, ready revision, capability readback, and authenticated smoke.
- Asset: release-policy test, `go test ./...` with the required PostgreSQL gate, `go vet ./...`, Bicep build/what-if, PR CI, release, dry-run/apply executions, and result counts.

## Non-Goals

- automatic cross-service retention scheduling;
- central privacy, retention, incident, recovery, or vendor services;
- automatic regulator or affected-user notification;
- deletion of an existing member account for testing;
- donation collection, payment processing, tax receipts, fundraising permits, accounting, or donor-data policy.

## Completion Criteria

The launch is complete when:

- collection notice is visible independently of Terms enforcement;
- the current legal draft is versioned and linked from Account collection flows;
- policy enforcement and public DSR are enabled and verified live;
- DSR operator instructions and a synthetic incident tabletop are recorded;
- owner data-governance manifests remain authoritative;
- Asset retention manual apply is enabled, the bounded first run is evidenced, and recurring scheduling remains off;
- all current production processors have factual register entries;
- no new platform service, database, or Admin UI was introduced.
