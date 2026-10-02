# Donation Admin Sandbox First Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement task-by-task when implementation is authorized. Steps use checkbox syntax. Read every affected repository's AGENTS.md and README first.

**Goal:** Validate authenticated online giving through Admin and the bank Sandbox on the existing HHC deployment, then reuse the same flow for Website production giving.

**Architecture:** Independent `donation-api` owns orders, provider integration, recurring plans, verified payment outcomes, reconciliation and audit. Admin exercises the Sandbox; Website later exposes production giving. Backend route policy selects the bank environment; client input cannot select credentials or provider hosts.

**Tech Stack:** Go, PostgreSQL, OpenAPI, TypeScript/React, existing frontend-platform AuthN runtime/UI/client conventions, Nginx gateway, Dapr and Azure Container Apps. Resolve exact supported runtime versions from each repository at execution.

**Spec:** [Future domain extension strategy, Phase 14](../specs/2026-07-08-hhc-web-future-domain-extension-strategy.md#phase-14-donations), refined by the approved product decisions below and session `01a02372-2d23-7191-91fc-9f76dab78e4a`.

**Status:** Implementation authorized 2026-09-30. As of 2026-10-02, the 1A backend, encrypted capabilities and reconciliation were merged through donation-api PR #1 (`b96ff29`); its disabled artifact release is tracked in the execution evidence. Shared Admin UI remains a draft. Merge is not deployment or delivery acceptance. No bank transaction, cloud change or production activation is authorized by this status.

**Execution:** [Local offline evidence and remaining work](2026-09-30-donation-execution-evidence.md). Task 0 live gates and Task 1/2 runtime/release items remain open; a passing foundation suite is not delivery 1A acceptance.

## Global constraints and approved product rules

- All giving requires HHC login; bind orders to the trusted authenticated `user_id`. Reuse canonical AuthN/AuthZ transport and Account RBAC catalog.
- Use `OrderCreate` and top-level redirect to bank-hosted checkout. HHC forms/API requests never collect full PAN, expiry or CVV. Provider query responses can include card fragments, expiry and tokens: decode only required fields and never expose or persist these extras in product DTOs, logs, traces or storage. Do not use `OrderBack`, `CardBindCreate`, a card wallet or reusable charge tokens.
- Delivery 1A supports credit-card single payment; delivery 1B adds bank-managed recurring giving after provider behavior validation. Virtual accounts/refunds and mobile payment are separate future scope despite Sandbox enablement.
- Recurring frequency is daily, weekly, monthly or yearly, mapped to `D/W/M/Y`, with `DeductFreq=1`.
- Offer a specified inclusive end date. Last scheduled debit is the last cycle date on or before it; calculate total installments including the initial debit, subject to provider verification. Accept only 2–999 installments; recommend single giving if only one debit fits.
- First debit is anchored to successful hosted authorization, not an arbitrary future start date. Use `Asia/Taipei` for product calendar dates, subject to confirmation of the bank's calendar. Preview is a separate read-only operation before creating checkout. Store the accepted preview/version with the order. The specification has no recurring start/end-date field: do not claim a strict end-date guarantee from installment conversion alone. For 1B, verify that setting `CardParam.ExpMinutes` (1–30) prevents authorization after the deadline; choose a lifetime that ends before the next local date, and reject new recurring checkout when less than one safe minute remains. Expiry must be enforced by the bank, not only by hiding the HHC button. If in-progress authorization can cross the deadline, keep the affected end-date mode disabled until the bank supplies a workable rule; never silently accept a different schedule or attempt a post-charge repair.
- Changes to amount/frequency/end date terminate the old plan and require a new authorization. Cancellation uses `OrderMaintain Command=E`; confirm termination before claiming it completed. A debit already processing may still complete and must remain in the ledger.
- The proposed ongoing mode is blocked until a truthful UX for the 999-installment ceiling is accepted. Daily is about 2.7 years, weekly about 19 years; do not describe either as literally unlimited. No silent new master order or automatic renewal without donor authorization.
- Key Vault owns separate Sandbox/production secrets. Persist the minimum whitelisted response fields; drop unnecessary card fragments/tokens and redact telemetry. Do not store entire decrypted provider messages by default.
- Shared deployment does not mean shared financial effects: Sandbox never enters production history, receipts, accounting exports, production notification queues or financial totals.
- Each implementation repository uses its own isolated worktree from fresh `origin/main`, focused PR, required CI and immutable release; consume producer contracts only after their release.
- Receipt generation, accounting-system integration and tax submission remain Open Gates. Payment confirmation is not a formal donation receipt. Define an accepted financial handoff before public production giving, even if the initial handoff is reviewed export.

## Member-private-details integration — coordinated delivery, not merged ownership

Canonical workspace documents (outside this child repository): `docs/superpowers/specs/2026-09-26-account-nickname-and-private-member-details-design.md` §9.1 and `docs/superpowers/plans/2026-09-27-account-nickname-and-private-member-details.md` §17 / Task C / Gate GC. Keep the purpose-contract and acceptance checklist there rather than inventing a second generic personal-data API here.

- Delivery 1A/1B does not collect donor legal name, address or identity document and does not depend on the nickname migration or private-member-data release. Giving requires login, not active church membership or a populated private profile. Admin Sandbox uses synthetic receipt fixtures only and never reads real member details.
- Account owns the private profile; Operations owns its eligibility; donation-api owns financial facts. Link by trusted Account ID only. No cross-database reads, shared Account KEK, raw profile in JWT/general DTOs, or Admin test-permission bypass.
- Formal receipts may later consume only explicitly confirmed, purpose-limited fields/version through the accepted Account contract. Nickname/provider claims are not legal receipt names. Existing member fields include family/given name and identity document, but not address; identity-document necessity, postal address, non-member receipt entry and accounting/receipt ownership remain decisions, not automatic collection.
- If the accepted receipt workflow needs a copy, keep a minimum encrypted snapshot separate from queryable financial facts, with confirmation/source version and independent donation storage key/identity. Do not reuse bank HashID or Account KEK; later profile edits must not silently change confirmed/issued receipt data. Define correction, finance access, retention, DSR and backup recovery before enablement.
- Member-details already requires browser↔Account bidirectional application-message encryption; this remains mandatory and is not backend-unreadable E2EE. Any new sensitive receipt transport must satisfy the same declared content-privacy goal through a reviewed contract, including service/intermediary boundaries. Ordinary amount/outcome APIs do not automatically inherit a new encryption protocol.
- GC gates only the member-data receipt consumer, not payment-only delivery. Receipt/accounting/tax features remain disabled until their own owner and acceptance gates pass; no production personal-data collection or external tax transmission is authorized by this documentation update.

## Current bank evidence — reviewed 2026-10-02

- Bank reply dated 2026-10-01, subject `RE: API 金流系統正式環境`, explicitly confirms credit-card checkout enabled in both environments and `OrderCreate` returning the hosted payment link. The confirmed exact hosted origin is `https://funbiz.sinopac.com`; sharing this origin does not select an environment. Backend API endpoint, merchant configuration and persisted environment still select Sandbox versus production.
- The newly forwarded encrypted Sandbox attachment was checked in memory: merchant identifier, A1/A2/B1/B2 and X-Key are present; X-Key validity is marked 2027/12. The bank says last year's X-Key is likely expired; use the newly supplied material. No credential values or unlock instructions belong in this document. Operational Key Vault configuration remains pending.
- The new attachment explicitly says Sandbox does not require an IP submission. Remove Sandbox IP whitelisting as a prerequisite; still verify actual connectivity. Production whitelist changes require bank processing (the attachment says two weeks).
- Production credit-card entitlement is confirmed, but the bank's promise to send production credentials is not evidence they were received. Only the Sandbox credential attachment was found in the reviewed mailbox.
- V2.5 (revision 2026-07-23; announcement 2026-08-11; forwarded 2026-10-01) is the current supplied baseline. Comparison with V2.3 found unchanged 1A endpoints, signature/encryption, hosted checkout and callback/query contracts. The envelope `Version` remains `1.0.0`.
- V2.4/V2.5 refresh test-card instructions: general credit-card `PayType=C` expiry is 12/35; the other credit-card-value/binding fixture changes expiry and CVV. Use the correct bank-hosted test fixture; never put PAN/expiry/CVV in HHC forms, APIs or credential configuration.
- V2.5 allows multiple credit-card refunds, at most one per day except failed applications; E3610/E3611 encode deferred eligibility and E9918 now means refund-count limit reached. Refunds remain out of 1A scope. Later implementation must track each refund and remaining refundable amount, rather than a single refunded flag.

This closes the written-specification, hosted-entitlement, hosted-origin and credential-delivery questions for Sandbox. Task 0 below also records a successful local read-only bank query. Deployed connectivity, hosted-browser/callback acceptance and production readiness remain open. The 2026-09-30 evidence below is retained as historical context and is superseded where this section differs.

## Historical capability evidence — mail reviewed 2026-09-30

Outlook search covered `from:patrickstar720@alive.org.tw`, `豐收款`, `Sandbox`, and `豐收款 正式`. The targeted bank keyword searches returned no further pages. This is mailbox evidence, not bank runtime verification; attachments were not decrypted during this review and credentials were not copied into this document.

| Capability | Sandbox evidence | Production evidence | Delivery scope |
| --- | --- | --- | --- |
| Virtual account | 2025-11-13 email explicitly says enabled | No per-method confirmation found | Deferred |
| Virtual account refund | Same email says enabled | No per-method confirmation found | Deferred |
| Credit-card single payment | Same email says enabled | No per-method confirmation found | Delivery 1A |
| Credit-card recurring | Same email says enabled | No per-method confirmation found | Delivery 1B; schedule behavior must be tested |
| Credit-card binding | Same email says enabled | No per-method confirmation found | Excluded |
| Mobile payment | Same email says enabled | No per-method confirmation found | Deferred |
| Daily/weekly/monthly/yearly | Historical V2.3 specification supports these fields | No explicit merchant-specific confirmation found | Gate 0 and Sandbox matrix |
| Merchant management portal | Sandbox URL supplied | 2026-01-26 bank mail states service successfully opened and supplies production portal | Supporting evidence only |
| API credentials | Test ShopNo/Hash/X-Key described as supplied in encrypted attachment | No production API credentials verified | Production blocked |

Source messages, for later retrieval by subject/date (do not copy secret-bearing bodies):

- 2025-11-13, forwarded by Patrick: `永豐銀行 – 豐收款API測試資料-XKey-【自建】`; lists the six methods above. The subject's 自建 label alone is not proof that hosted checkout is disabled or enabled: Gate 0 must confirm the hosted `OrderCreate` flow is allowed for this merchant.
- 2026-01-26 bank message, forwarded 2026-02-01: `豐收款商戶管理後台操作說明_社團法人中華民國哈利路亞社區關懷協會`; service opening, portal queries, refund/reconciliation guidance and Excel download. These instructions do not prove individual API feature entitlement.
- 2026-02-04: `【API開發規格書】`; attachment identified in historical analysis as FunBIZ V2.3. Re-obtain the current bank-approved version before coding the protocol.

Egress whitelist is user-confirmed historical context. Production requires current workload/IP acceptance; the 2026-10-01 Sandbox attachment above removes the Sandbox IP-submission prerequisite. Local read-only connectivity is now verified; deployed workload connectivity remains open.

### Specification evidence re-read 2026-09-30

The locally retained mail attachment is `website/tmp/pdfs/funbiz-api-v2.3.pdf`, 95 pages; its cover says V2.3 and revision history dates V2.3 to 2026-01-29. This is the supplied contract baseline, not proof that no newer version exists or that a merchant method is currently enabled.

| Confirmed interface | PDF pages | Implementation consequence |
| --- | --- | --- |
| `OrderCreate` returns `CardParam.CardPayURL` for credit cards | 37–43 | Hosted card entry exists in the specification; merchant entitlement/runtime remains to be tested |
| Card checkout lifetime `ExpMinutes=1–30`, default 10 | 38 | Use bank expiry in recurring calendar validation; do not assume expiry interrupts already-started authorization |
| `REGULAR`, total installments 2–999, D/W/M/Y, frequency 1–99 | 39 | Website chooses frequency 1; no arbitrary future start date or EndDate field in this interface |
| ReturnURL is form POST; BackendURL is JSON POST with ShopNo/PayToken | 34, 66 | Separate content-type handlers; these notifications do not carry a documented signature field |
| Backend receipt response is `{"Status":"S"}`; retry interval 10 minutes, limited retries | 35, 66 | Acknowledge after durable enqueue; HHC recovery cannot depend indefinitely on bank retry |
| `OrderPayQuery` inner `TSResultContent.Status` is payment outcome; outer Status is API execution | 56–58 | Verify bank response and expected merchant/order/amount/type; do not credit on notification or outer success |
| `OrderQuery` accepts OrderNo and returns original payment URL/status; maximum 300 results | 50–53 | Resolve ambiguous create using the original identifier; use exact-order queries or bounded windows |
| `OrderMaintain Command=E` terminates recurring, `R` requests refund | 47–49 | Cancel plan and refund payment are separate operations |
| `RegularQuery` has plan 00 completed / 01 active / 03 terminated and installment 00 success / 03 failure | 67–69 | Keep plan and installment states separate; the sample labels the master payment as installment 1 |
| `BillQuery` covers previous 1–30 days and only captured card transactions | 60 | Retrieve daily with persisted progress, bounded catch-up and alert on approaching retention limit |
| Query results may contain card fragments, `CCExpDate`, `CCToken`, BindToken | 53, 57–58, 68 | Ignore excluded fields in decoding; no raw response logging |

Remaining after the 2026-10-02 update: month-end/leap handling, bank timezone, exact expiry enforcement, retry/failed-installment counting, cancellation cutoff and order visibility after ambiguous create. Hosted entitlement and current test instructions are now supplied. Use V2.5 test fixtures, not the expired V2.3 examples.

## Routes, environment isolation and reusable interfaces

Proposed contract freeze in Task 1:

| Entry | Route family | Backend selection | Authority |
| --- | --- | --- | --- |
| Admin Sandbox | `/api/admin/donations/sandbox/*` on Admin host | Always Sandbox | Dedicated cataloged test permission |
| Website giving | `/api/donations/*` on Website host | Always production, disabled initially | Login plus own-order ownership |
| Bank callback | `/api/donations/provider-webhooks/funbiz/{sandbox,production}` | Fixed route and matching stored order | Provider protocol verification and result re-query; no user JWT |
| Bank browser return | `/api/donations/provider-return/funbiz/{sandbox,production}` | Fixed route | Bounded form POST; outcome re-query, then 303 to fixed console destination |

- Gateway checks host/path/method, strips spoofed identity headers and forwards trusted identity. `donation-api` independently enforces permission and ownership. Reject environment-selection fields rather than ignoring an attempted override.
- Order `environment` is immutable; use it for query, cancel, callback and reconciliation. Unique keys include `(environment, provider_order_no)` and environment-scoped idempotency keys. Different prefixes aid diagnosis but are not authorization.
- Callback route environment must match the local order and expected merchant/amount/currency. Unknown/mismatched results must not credit a donor or switch provider configuration.
- Backend application operations are shared: create checkout, get own order/plan, request cancel, verify outcome, reconcile. Transport handlers select a fixed environment; no second implementation for Admin.
- Released OpenAPI feeds a shared typed client. A shared donation form takes a fixed transport supplied by the console, not bank URLs, secrets or a user-editable environment selector. Server computes installment count; frontend only renders its preview.
- Initially only Sandbox secrets exist and `production_enabled=false`. Missing production configuration fails closed. No fallback to Sandbox on production errors.
- Bank callback/return ingress uses `www.alive.org.tw` with explicit POST routes for each environment, even during Admin-only delivery. No user JWT/CSRF is required on bank ingress; accept only bounded documented payloads, enforce expected ShopNo, deduplicate tokens and rate-limit before bank calls. Treat notification tokens as untrusted hints, not signed proof. Verify authenticity through the bank's authenticated query response and local order matching; if the current bank contract adds a signature, verify it as documented.
- Browser return need not have the donor session. Persist a short-lived opaque return reference, then 303 to a fixed Admin Sandbox or Website result URL without PayToken/card data. Require login plus order ownership before returning any financial detail. Invalid returns go to a generic result page, never a client-provided redirect. The original tab can also recover by querying its authenticated order history; do not depend on return delivery for financial truth.
- User mutation routes follow the existing bearer/session and CSRF policy, independently of bank ingress. Bank return must not grant a login session or confer ownership.

## File ownership map

Paths below are proposed new files; execution must inventory current checkout conventions before freezing the detailed code task list. Do not create repositories as part of documentation work.

| Owner / proposed files | Responsibility |
| --- | --- |
| `donation-api/docs/openapi.yaml` | Canonical donation contract and errors |
| `donation-api/internal/donation/{schedule,service}.go` and tests | Product schedule and ledger transitions |
| `donation-api/internal/funbiz/client.go` and tests | One bank integration, fixed environment configs |
| `donation-api/internal/httpapi/handlers.go` and tests; repository migration directory | Authenticated transport, callback handling, immutable environment and database constraints |
| `frontend-platform/packages/donation-client/` | Generated types and shared authenticated transport |
| `frontend-platform/packages/donation-ui/src/donation-form.tsx` and tests | Shared domain presentation consuming donation-client types and existing generic UI primitives; no bank protocol or scheduling authority |
| `admin-fe/src/pages/DonationSandboxPage.tsx` and tests | Sandbox create, result, recurring query/cancel and safe diagnostics |
| `hhc-web/src/app/[locale]/donations/page.tsx` and tests | Later authenticated production giving entry |
| `api-gateway/conf.d/api/` and `api-gateway/docs/openapi.yaml` | Current host-specific routing and contract aggregation |
| `account-api` catalog; `azure-infra` current workload definitions | Test permission and reviewed deployment/secret references |

## Review focus

1. Unauthorized caller or forged environment: deny without creating a bank order (Tasks 1–2).
2. Duplicate notification, timeout or delayed callback: one financial transition and no duplicate checkout charge (Task 2).
3. Midnight checkout, month-end/leap date or failed debit: no inaccurate installment/end-date promise (Task 3B).
4. Cross-environment callback/export: no Sandbox balance or production side effect (Tasks 2–3).
5. Cancel races with debit: show pending termination until verified; retain every real payment result (Task 3B).

## Task 0 — Provider and repository baseline gate

- [ ] Read current local instructions/contracts across affected repositories; identify existing AuthN client, permission catalog, audit outbox and deployment patterns. Freeze exact migration/files/test commands in the execution checklist before code.
- [x] Obtain current bank specification (V2.5) and written hosted-checkout merchant entitlement; confirm exact hosted origin and new credential attachment completeness.
- [x] Verify new test credentials through a bounded, read-only Sandbox Nonce + exact random-order query. On 2026-10-02 the local operator probe verified the bank response and returned S0001 with exit 0; no order was created. Credentials passed through an in-memory stdin stream; no raw responses were saved.
- [ ] Configure runtime Sandbox Key Vault references through reviewed deployment changes; the successful local probe does not configure or accept Azure runtime access.
- [x] Confirm Sandbox has no IP-submission requirement and current V2.5 general-card test instructions are available.
- [ ] Verify deployed connectivity, callback prerequisites and actual delivery during the authorized single-payment smoke.
- [ ] Build a provider behavior checklist from V2.5; collect available bank clarifications. Actual recurring behavior tests run in Task 3B after single-payment tooling exists, avoiding a circular prerequisite.
- [ ] Unresolved recurring schedule cases block delivery 1B only. Task 0 requires enough evidence to build single hosted payment, not acceptance of every recurring frequency. No bank production calls at this gate.

## Task 1 — Freeze contract, authorization and isolation

- [ ] Freeze delivery 1A OpenAPI for single checkout/query and bank return/callback; reserve recurring routes as unavailable until 1B. For 1B, define a read-only schedule preview and require the accepted preview version when creating checkout; cancel returns pending/confirmed termination. Specify integer minor units, TWD, ownership, limits and conflict errors.
- [ ] Catalog a dedicated Sandbox test action through Account; do not grant it implicitly to all Admin users. Reuse canonical audit query permissions for audit access; financial management permission decisions are a separate production gate.
- [ ] Define migrations for orders, plans, installments, verified outcomes and durable callback/reconciliation work. Constrain immutable environment and uniqueness; retain provider identity plus actor/time/status transitions.
- [ ] Write contract tests for login, ownership, test permission, unknown inputs, disabled production and environment override; run the repository-prescribed checks and prove fail-closed behavior.
- [ ] Review and release producer contract before generated frontend consumers.

## Task 2 — Delivery 1A single-payment backend and durable result processing

Runtime packaging decision (2026-10-02): use one image with `serve` (API plus
background loop), `api`, `worker`, `job`, `migrate` and `check` commands. Default
to disabled payments and no background work. Splitting API and workers/jobs is
allowed when needed, not a requirement to provision another service now.
Migration execution remains a separately authorized operation, never automatic
startup DDL. Local implementation/evidence does not authorize route enablement.

Local completion slice (2026-10-02, donation `a662b0b`): capability encryption/
retention, live-lease atomic callback completion, original-order outcome recovery
and daily BillQuery checkpoints are implemented and locally tested. A job now
handles callback/reconciliation plus audit work in 60 seconds total. Bank-query
review warnings are sanitized. The follow-up audit slice implements atomic
financial outbox delivery and audited, versioned owner-only Sandbox requery for
exhausted provider-unavailable work within 30 days. Other review causes, bill
work and general finance/operator authority remain closed. Shared client and
Admin controls exist locally; central audit deployment, real package publication,
secret wiring and alert routing remain open. See the execution evidence for exact limits and bank
assumptions. These local results do not check off Task 2 runtime acceptance.

- [ ] Persist a stable provider OrderNo and request fingerprint before `OrderCreate`; scope idempotency by environment/actor/key, reject changed-payload reuse and serialize concurrent creation for the same intent. Allowlist bank destinations.
- [ ] On transport timeout mark creation `create_unknown`, not failed. Query `OrderQuery` using the original OrderNo to recover status/URL; no new OrderNo and no blind automatic create retry. A not-found response alone is insufficient unless the bank guarantees visibility timing. Keep unresolved intents blocked for operator reconciliation; record provider duplicate-order semantics before permitting any same-ID retry.
- [ ] Persist minimal ShopNo/PayToken callback work before acknowledging. Query `OrderPayQuery` through the authenticated protocol, check its inner result plus APType/merchant/order/amount/currency or local TWD context/type. Apply one outcome per environment/provider transaction; queue errors for retry. Never require an undocumented notification signature.
- [ ] Implement fixed bank return handlers and 303 destinations, safe result lookup and `OrderQuery` recovery when no PayToken arrives. Use `BillQuery` as capture/reconciliation evidence with daily checkpoints and alerts; payment authorization, capture and settlement are separate facts, not one overwritten status.
- [ ] Test duplicate/reordered events, return without cookies, non-owner lookup, forged/mismatched token, callback loss, original-order recovery, simultaneous checkout, wrong idempotency payload and provider failures. Assert no excluded card fields or raw provider bodies reach DTOs/telemetry/storage.
- [ ] Configure only Sandbox secret references and disabled production; release via CI/CD after reviewed infrastructure preview and separate deployment authorization.

## Task 3 — Delivery 1A shared frontend and Admin single-payment acceptance

Local draft (2026-10-02): isolated frontend-platform and admin-fe branches now
contain a generated Sandbox client, shared form and default-disabled Admin page.
Local tarballs are verification-only, not a deployable dependency declaration;
the producer release and consumer registry pins are still required. The browser
may retain actor-keyed retry key/amount/time for 15 minutes, never bank URL or
PayToken. Expired/unrelated recovery metadata becomes a blocked sentinel rather
than silently permitting a new payment. Bank return/login and live payment
acceptance remain separate from mocked component/browser checks.

- [ ] Generate shared client from released OpenAPI and reuse existing authenticated transport; publish through frontend-platform's normal release workflow.
- [ ] Add donation-ui shared single-payment form using generic UI primitives; do not add donation domain dependencies to the generic ui package. Expose recurring choices only when 1B contract and evidence are ready.
- [ ] Add Admin Sandbox page/navigation with explicit test permission, persistent testing banner, authenticated ownership, query/recovery actions and sanitized diagnostics. ReturnURL renders pending until verified API state exists.
- [ ] Add component/contract tests for denied access, preview errors, pending result/cancel, environment immutability and unavailable bank; ensure Sandbox notifications are isolated or suppressed.
- [ ] Release gateway/backend before consumers. Run authorized single-payment Sandbox smoke: hosted checkout, browser return, verified query, expiry, duplicate/missed callbacks, unknown-create recovery and reconciliation. Use injected failures for cases the bank simulator cannot reproduce; label simulated versus bank-observed evidence.
- [ ] Record deployed revisions, correlations and reconciliation; declare delivery 1A independently accepted. No recurring or production-card acceptance is implied.

## Task 3B — Delivery 1B recurring behavior validation and implementation

- [ ] Using the accepted Admin tooling, run controlled recurring Sandbox probes and collect bank clarification for calendar/expiry rules, installment-1 counting, failure retries/counting and cancellation cutoff. Month/year edge cases cannot be proven by waiting a few daily cycles; use bank-supported fixtures/acceleration or written rules plus local contract tests. Keep unproven methods disabled.
- [ ] Add read-only server preview and schedule tests for inclusive end, initial installment, 2–999 limits, 29/30/31, leap years and Asia/Taipei checkout rollover. Enforce the bank-confirmed deadline behavior before accepting an end-date promise.
- [ ] Implement `RegularQuery` plus `OrderMaintain Command=E`. Store plan status separately: pending authorization, active, cancellation pending, completed, terminated; query failures do not turn an active plan into a failed one. Map bank 00/01/03 to completed/active/terminated; confirm cancellation by authoritative query/verified termination outcome.
- [ ] Store installment identity and payment attempts/outcomes separately. Bank installment 00/03 means success/failure, not plan completion/termination. Preserve verified successes; ambiguous or conflicting reports trigger reconciliation rather than regression. Do not invent merchant-side automatic charge retries; bank retry/count rules control the schedule.
- [ ] Record cancel request actor/time; serialize duplicate cancellation requests and query after timeout before resending. Late successful debit remains recorded after termination; cancellation never creates a refund. Handle refund lifecycle separately when authorized.
- [ ] Extend shared form/client and Admin with accepted frequencies, end-date preview, plan status/history and cancel. Test failure/success reorder, cancellation/debit race, changed preview and bank expiry rollover.
- [ ] Accept delivery 1B per enabled frequency with exact bank/local evidence. Ongoing mode stays disabled until its 999-limit product decision is approved; it is not required for delivery 1A completion.

## Task 4 — Production readiness gate

- [ ] Verify production ShopNo/Hash/Key, current endpoint, per-method activation, hosted checkout authorization, outbound IP and callback prerequisites. Do not reuse Sandbox credentials.
- [ ] Confirm actual PCI validation obligations and SAQ eligibility with the acquiring bank; obtain the bank/provider compliance evidence applicable to the hosted service. Do not assume SAQ A from the redirect alone. Confirm applicable ASV scan scope/cadence and record required passing evidence before cutover.
- [ ] Verify real data flow, browser network requests, API DTOs, database fields and telemetry redaction. Keep technical bank diagnostics in restricted Admin, not donor UI.
- [ ] Finance accepts giving categories/amount limits, refund operator/process, reconciliation ownership, payment confirmation wording and initial accounting handoff. Decide retention/DSR handling of financial records.
- [ ] Accounting API, formal receipts and tax filing stay separate integrations. No automatic official receipt/tax transmission until their owner, data requirements and interface are agreed.
- [ ] Before enabling member-data-assisted receipts, complete the canonical member plan Task C / GC: field/purpose/version confirmation, exact caller/subject binding, private transport, independent encrypted snapshot, non-member path and finance/DSR governance. Payment-only production does not require GC; it still requires the accepted initial financial handoff above.
- [ ] Accept the ongoing-mode finite ceiling UX and reauthorization behavior before enabling that mode. No production toggle until all relevant gates pass.

## Task 5 — Website production entry and cutover

- [ ] Add Website authenticated giving/history/cancel entry using the already released form/client and production route family; never move Admin bank-specific business logic into Website.
- [ ] Test own-record authorization, CSRF/idempotency, production-disabled errors and exclusion of Sandbox records from donor/finance views.
- [ ] Release production routes/backend configuration while giving remains disabled, then Website consumer through separate PR/CI/release chains. Keep Admin Sandbox available with its existing permission.
- [ ] After explicit production-test authority, enable only accepted methods and perform a controlled real payment, verified callback/query, settlement/reconciliation and agreed refund smoke. Record rollback path before enabling.
- [ ] On release/acceptance failure disable new production checkout; continue callback/reconciliation/cancellation processing for existing orders. Stopping checkout must not strand financial outcomes.

## Completion and document review

Delivery 1A completion means accepted Admin Sandbox single-payment flow (Tasks 0–3). Delivery 1B additionally requires Task 3B acceptance for each enabled recurring frequency. Neither means public giving or production PCI acceptance. Production requires Tasks 4–5 and finance handoff for the methods enabled. Receipt/tax integrations are not silently counted as complete.

Self-review 2026-09-30: six review findings addressed through separate 1A/1B deliveries, explicit unknown-create recovery, independent plan/installment facts, form POST browser return, bank-enforced calendar gate and domain-specific shared UI. V2.3 interfaces above are re-read evidence; current merchant activation and unspecified bank behaviors remain explicit gates. Exact execution paths and commands require the fresh repository baseline before coding.
