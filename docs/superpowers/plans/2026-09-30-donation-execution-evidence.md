# Donation Sandbox implementation evidence

Date: 2026-09-30. Approved plan: `2026-09-30-donation-admin-sandbox-first.md`.
Initial foundation date above; subsequent evidence is recorded by date below.
Neither the local foundation nor a read-only bank query is delivery 1A acceptance.

## Continuation — shared runtime image and background jobs (2026-10-02)

- Donation `32ff4d6` adds one nonroot image with `serve` (combined), `api`,
  `worker`, `job`, `migrate` and `check` commands. User explicitly accepted
  splitting a job from the same image if needed. No separate deployment or
  schedule has been created. Defaults start HTTP only with payments disabled.
- Explicit migrations embed the existing SQL, serialize using a transaction
  advisory lock and commit schema plus SHA-256 history together. Tests cover
  concurrent/idempotent runs, checksum mismatch, unknown versions, history gaps
  and rollback on an untracked schema. Runtime startup checks, never applies.
- Background processing reuses the leased single-item callback processor, with
  a 25-second job deadline, existing retry backoff and cancellation. Continuous
  polling is five seconds. Cleanup removes at most 1,000 expired Sandbox return
  references per run; it preserves active/production references and all provider
  work/financial facts. No background command calls OrderCreate.
- Local tests observed missing migration/worker/runtime functions before
  implementation, then passed. All seven package race suites passed serially on
  task-owned PostgreSQL 17; vet/build, Docker build and diff checks passed.
  Canonical OpenAPI includes private probes and validates with five documented
  warnings (local probe origins, no 4xx probe response and 303-only bank return).
- Local image smoke: nonroot user; disabled `/healthz`=200, `/readyz`=503 and
  checkout=503. Same image successfully ran `migrate` and `check` against only
  the disposable database. These are not Azure or live-bank acceptance checks.
- Initial image scan failed on x/text v0.29.0 (CVE-2026-56852). The official
  [Go advisory](https://pkg.go.dev/vuln/GO-2026-5970) identifies v0.39.0 as fixed;
  updated to that version plus required x/sync v0.21.0, then repeated the full
  suite/image build. Final Trivy scan passed with zero findings in the selected
  HIGH/CRITICAL, fix-available scope (`--ignore-unfixed`); this is not a claim of
  zero vulnerabilities at every severity. A repeated seven-package/race suite,
  vet/build/format/diff checks and rebuilt-image disabled/migration smoke passed.
- Fresh independent whole-branch review of `bb1f82e..32ff4d6` found no Critical or
  Important issue for the disabled local foundation. Reviewer independently ran
  non-DB race tests/vet/format checks. One deferred minor: add active in-flight
  bank-call cancellation/lease-recovery integration coverage before activation;
  current tests cover pre-cancelled worker and server shutdown without a service.
  Deployed identity, bank interoperability, storage/audit/reconciliation/UI,
  recurring/export and release readiness remain explicitly unaccepted. Required
  remote CI is not substituted by this review or the executor's local scan.
- CI configuration is written, not run on GitHub. Fresh remote inspection found
  no heads: the private repository has no main baseline. Requested explicit
  permission for an empty bootstrap main commit, with all code still going via
  feature PR/CI; no push/PR/release occurred in this slice.
- Remaining before activation: storage encryption/retention and DB controls,
  central audit/alerts, lost-callback and BillQuery reconciliation, Admin return
  UX/shared client, gateway policy and runtime secret wiring, actual CI/release
  and hosted-checkout/callback acceptance. Delivery 1A remains incomplete.

## Continuation — V2.5 and bank prerequisite closeout (2026-10-02)

- The approved private GitHub repository was created 2026-09-30 and attached as
  origin. Historical inaccessible-remote notes below no longer block local work;
  repository release/CI setup remains unfinished.
- Reviewed the bank's 2026-10-01 reply and new encrypted Sandbox attachment.
  Written entitlement confirms credit-card hosted checkout in both environments;
  exact payment-page origin is `https://funbiz.sinopac.com`. Sandbox requires no
  IP submission. Formal production credentials were promised but not found in
  the reviewed mailbox. No inference about recurring acceptance is made.
- Attachment fields were verified in memory: merchant, four hashes and X-Key
  present, X-Key validity marked 2027/12. No values or unlock instructions are
  included in repository evidence. Old X-Key should not be reused.
- V2.5 replaces V2.3 as the supplied baseline. Core 1A endpoints, signing/AES,
  creation/query/callback fields and envelope Version 1.0.0 are unchanged. Test
  fixtures and future refund rules changed; refunds remain disabled.
- Added `donation-api/cmd/sandbox-check`, reusing the existing Sandbox client:
  bounded credentials on stdin only, random exact-order query, no create path,
  validated response and sanitized status/code output. This is operator tooling,
  not a new HTTP API or a donor authentication bypass.
- Live local probe on 2026-10-02: fresh Nonce and authenticated OrderQuery for a
  random nonexistent order returned verified S0001, exit 0. This confirms new
  credential/protocol interoperability from the operator host. No order, charge,
  callback processing, database entry or Azure configuration was created.
- Added a local bank form-return handler: body bounded to 4096 bytes, exact gateway
  caller, no donor session required, only ShopNo/PayToken body values accepted.
  Callback work and a random 15-minute return reference are persisted atomically;
  reference storage is SHA-256 only. Redirect is fixed to Admin and never carries
  a bank token. A new authenticated lookup returns pending until callback work
  is verified, then only the order owner can resolve it. Invalid/expired/review
  references reveal no order; no bank call or financial credit occurs in return
  or reference lookup. Migration 000004 and canonical OpenAPI are included.
- RED: return integration failed with 404 before implementation. GREEN: real
  disposable PostgreSQL tests cover cookieless POST, replay, duplicate/extra form
  fields, ignored query tokens, oversized bodies, fixed redirects, login,
  pending state, cross-owner rejection and expiry. Full five-package race suite,
  vet, build and diff checks pass. OpenAPI validates with one expected warning:
  bank browser return intentionally emits 303, not a synthetic 2xx response.
- Fresh independent review of donation `91bb73c..29daf68` found no Critical or
  Important issue. It identified URL-query parsing influencing body-only return
  acceptance. A malformed-query regression failed first; parsing only the bounded
  body fixed it, followed by a green full PostgreSQL/race suite. Reviewer reran
  non-DB tests/vet; its unset-DSN full-suite attempt failed the database guards
  without mutation, so DB verification is executor-provided. Bank authenticity,
  deployed security/runtime/UI/release acceptance remain separate evidence gates.
- Remaining: runtime secret references, return UI/login handoff and expiry cleanup,
  runtime/workers/audit,
  durable reconciliation and storage controls, CI/release, shared client/Admin
  integration and actual hosted-payment/callback acceptance. Task 0 is partially
  closed, not all of Tasks 0–3; production and recurring gates stay open.

## Workspaces

- `website/.worktrees/donation-sandbox/donation-api`, branch `feat/donation-sandbox-single`.
- `website/.worktrees/donation-sandbox/account-api`, branch `feat/donation-sandbox-permission`, base `feed0f8` from fresh `origin/main`.
- `website/.worktrees/donation-sandbox/hhc-web`, branch `docs/donation-sandbox-execution`, base `b90cf42` from fresh `origin/main`.

The app's native worktree call returned `Not a git repository` for the umbrella
directory, so repository-specific manual worktrees were created. Existing
worktrees and unrelated primary-checkout changes were not repurposed.
`donation-api` did not exist and its proposed remote was not accessible. Only a
local repository was bootstrapped on `bootstrap`, with a separate feature
worktree; there is no fabricated remote or production `main` baseline.

## Implemented slice

- Account catalogs `donations:sandbox:test` and adds it to `admin-web` allowed
  scopes. No existing granular role or standard user gets the grant. Existing
  wildcard-superadmin semantics remain unchanged.
- FunBIZ V2.3 SHA-256 Sign and AES-CBC match published independent examples.
  Decode checks version, merchant, API service, padding and response signature
  with response Nonce. Fixtures are public specification examples, not secrets.
- Single checkout includes only required hosted ONE/AutoBilling/expiry fields,
  fixed Sandbox ingress URLs and integer TWD minor units. No binding/card entry.
- Verified-outcome parsing whitelists facts, checks local merchant/order/amount/
  type and inner payment Status, handles quoted Amount, and separates
  authorization from capture. Excluded card fields are dropped.
- Strict input rejects unknown fields including actor/environment/card overrides,
  invalid amounts, oversized bodies, multiple JSON documents and bad keys.
- PostgreSQL constrains immutable intent identity, environment/owner-scoped
  idempotency and lookup. Compare-and-swap records create uncertainty before a
  provider call; ambiguous creation cannot automatically acquire a second create
  right. Callback work persists and deduplicates independently of payment facts.
- Authorization, capture and settlement evidence have distinct append-only rows;
  contradictory duplicates are reconciliation conflicts, never overwrites.
- Stable provider transaction identity is bound to one intent by a separate
  primary key and composite foreign key; authorization/capture cannot attach the
  same bank transaction to different orders. Record writes are atomic.
- Proposed OpenAPI 1A contract is local, unpublished and not a runtime claim.

## Verification and remaining gates

Tests were written first, observed failing, then implemented and rerun.
Donation: `go test -race ./...`, `go vet ./...`, `go build ./...`, and Redocly
2.47.0 lint. Real disposable PostgreSQL tests cover concurrent same intent,
payload conflict, immutable fields, environment/ownership isolation, callback
dedupe and non-regressing financial facts. The test database name is guarded.

Account baseline without external fixtures passed. Enabling full PostgreSQL
fixtures first exposed missing Redis, connection saturation and a URI DSN that
an existing test appends keyword options to. Tests were rerun against only
task-owned disposable PostgreSQL/Redis, keyword DSN and adequate connection
capacity. Final results are recorded after the final run; neither initial
dependency failure is evidence against the scoped permission change.

Final Account suite: 1671 passing test entries, zero failing entries, 21 passing
packages; the separately invoked governance-export test also passed. Account
vet, migration/bootstrap/release/governance policy checks, `make build` and
local Docker image build passed. Donation's seven top-level tests plus subtests,
race/vet/build passed; OpenAPI lint passed with two warnings for the intentionally
303-only return endpoint (no fabricated 2xx/4xx behavior).

Fresh-context review of the offline slice found no Critical/Important defects.
A subsequent executor regression test exposed cross-order reuse of one provider
transaction across different fact kinds; the test failed first, then passed
after the transaction binding and atomic-write fix, followed by the full suite.

Deferred review minors: JSON decoder accepts case-insensitive `AMOUNT_MINOR`
despite exact OpenAPI naming; no demonstrated permission/amount bypass. Add a
complete independent bank response-decryption vector (currently the published
request cipher prefix and self-roundtrip are covered).

Missing live prerequisites: bank-approved current contract/hosted entitlement,
secure Sandbox credential configuration, valid current test cards and actual
workload egress acceptance. No live bank call was attempted; no secrets were
written into code/docs. No Azure, provider or financial configuration was changed.

Next after the continuation below: safe return refs, scheduled worker runtime,
central audit and reconciliation; migration/runtime/CI/release packaging. Then
release producer contract before frontend-platform donation client/UI and Admin
consumer. No package pin, public route or production toggle exists yet. Recurring
1B and production 4–5 remain explicit gates.

## Execution rulings

### Continuation — Sandbox HTTP boundary (2026-09-30)

- Added `donation-api/internal/funbiz/client.go` and synthetic transport tests.
  Supplied V2.3 §§4.1, 5.3–5.4, 5.7 were re-read: fixed Sandbox HTTPS
  Nonce/Order endpoints, X-KeyID on both calls, fresh per-call Nonce and response
  decryption using the response's Nonce. No merchant credential was configured.
- Constructor is Sandbox-only, TLS minimum 1.2 with normal certificate checks,
  redirects rejected, one 15-second context for both calls, bounded bodies and
  sanitized errors. Only 1A OrderCreate/OrderQuery/OrderPayQuery/BillQuery service
  names are allowed. No bank retries, card binding or production path.
- RED: new transport tests failed to compile before implementation. GREEN:
  successful authenticated envelope flow, tamper, redirect, transport error,
  oversize, trailing JSON, missing Nonce, cancellation/deadline, wrong merchant
  and unsupported operation. This uses synthetic bank transport, not live TLS
  or bank interoperability acceptance.
- Full `go test -race ./... -count=1` passed with a fresh task-owned PostgreSQL
  17 disposable database; `go vet ./...`, `go build ./...`, `git diff --check`
  passed. Test database removed by stopping its auto-remove container.
- Still missing: typed result validation/checkout URL allowlist, durable
  create/recovery orchestration, runtime auth/handlers/workers, live bank gates
  and release packaging. Client returns internal plaintext protocol data; no
  raw response may be forwarded into UI/storage/logging. No bank call, cloud
  change, deployed route, PR or release was performed in this continuation.

### Continuation — checkout, HTTP authorization and callback processing

- Local donation commit `6c017fe`: typed create/recovery whitelist matching
  merchant/original OrderNo/amount/card type/transaction and one configured exact
  HTTPS hosted origin; no bank origin inferred from historical examples.
- Additive `000002` persists checkout readiness and binds its provider
  transaction atomically. Creation commits its uncertainty barrier before bank
  I/O. Concurrent retries create once; timeout/empty query remains uncertain;
  owner-only recovery queries the original OrderNo and never re-creates.
- Admin create/query handlers require an exact nonempty Dapr gateway caller,
  trusted Account UUID/provider and dedicated test scope (or existing canonical
  wildcard). Duplicated identity/caller/scope headers fail closed. No cookie
  authentication or invented service-side CSRF token: gateway verifies explicit
  bearer credentials; mutation Origin/fetch-site checks add browser defense.
  No production routes or deployed gateway routing were added.
- Callback HTTP ingress accepts only bounded merchant/token JSON via the exact
  gateway caller, without donor cookies/JWT. Acknowledgement follows durable
  enqueue, not bank query or a financial result. Query responses must match the
  queried PayToken and local merchant/order/amount/type before recording facts.
- Additive `000003` supplies atomic SKIP LOCKED callback leases, crash recovery,
  stale-lease completion fencing, delayed bounded retries and manual-review
  state. The one-item processor is tested but has no scheduled server runtime.
  It is not yet an operational callback/reconciliation service.
- RED→GREEN tests cover matching/host attacks, single-flight barrier ordering,
  changed idempotent amount, timeout and original-order recovery, unauthorized
  callers/subjects/scopes/origins, cross-owner reads, minimal callback enqueue,
  lease recovery/stale completion and mismatched token/amount refusal.
- Latest full PostgreSQL/race suite, vet/build and diff checks pass; producer
  OpenAPI remains unpublished. Its lint retains two known warnings for the
  planned form-return 303-only route. Fresh independent whole-branch review of
  `bb1f82e..6c017fe` found no Critical/Important in this local scope; the two
  existing minor deferrals remain. Reviewer independently reran protocol/strict
  input checks and vet, not the destructive database suites. Review accepts the
  local foundation only, explicitly not Task 2/1A/release completion.
- Fresh `git ls-remote` against the proposed donation-api URL returned Repository
  not found; this does not distinguish absence from insufficient access. Asked
  for approved remote/creation authority and secure configuration location plus
  bank-approved Sandbox hosted origin. No credentials were retrieved, remote
  created, bank calls attempted, cloud writes, PRs or releases performed.
- Task 2 is NOT complete: bank return/ref flow, central audit, BillQuery/checkpoint
  reconciliation, token-at-rest protection/retention, server/migration/CI release
  packaging and live gates remain. Task 3 producer release blocks client/package
  publication and enabled Admin consumer. Tasks 3B–5 and member-data GC are open.

1. Local new-service bootstrap only, not remote creation or a claimed origin/main
   baseline. Cost if wrong: transplant commits onto the approved remote baseline.
2. Supplied V2.3 is the offline baseline, not bank runtime/current-version proof.
   Cost if wrong: adjust provider code before acceptance.
3. Only 1A orders/outcomes/callback tables now; no unused recurring tables.
   Cost if wrong: additive 1B migration.
4. Canonical X-HHC identity with exact Dapr gateway caller is the planned handler
   boundary, not legacy X-User-ID examples. Cost if wrong: correct the contract
   before exposing routes. The boundary is not yet implemented or accepted.
5. Reviewer-deferred runtime/AuthN/CSRF, HTTP adapter/secrets/TLS/redaction,
   create/recovery, callback worker/audit, return UX, reconciliation/export,
   recurring, live grants, DB grants/backup/DSR, remote/CI/release/finance/PCI are
   explicit unaccepted future gates. Cost if wrong: unsafe financial/security
   behavior; no routing or deployment before their verification.
