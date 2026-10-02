# Donation Sandbox implementation evidence

Date: 2026-09-30. Approved plan: `2026-09-30-donation-admin-sandbox-first.md`.
Initial foundation date above; subsequent evidence is recorded by date below.
Neither the local foundation nor a read-only bank query is delivery 1A acceptance.

## Continuation — private main-only publisher alignment (2026-10-02)

- User chose to keep donation-api private and align with existing private
  release practices without upgrading the GitHub plan. This supersedes the
  earlier required-environment-reviewer gate: PR review is an operational
  process, not GitHub-enforced two-person deployment approval.
- Donation PR #2 (`d99beb4`) removes the environment-subject dependency, uses
  exact repository/main job and pre-login guards, and keeps artifact provenance,
  scanning and both default-off flags. Publisher `AZURE_CLIENT_ID` and disabled
  deployment `AZURE_DEPLOY_CLIENT_ID` are distinct configuration slots; publisher
  access must not include deployment/DB/Key Vault permissions.
- Behavioral guard regression was observed failing before implementation, then
  passing main and refusing feature/tag/wrong-repository/missing-client cases.
  Full serial disposable PostgreSQL race suite, vet/build, actionlint and
  release-policy/rollback checks passed. The task-owned database was removed.
  Independent focused review found no Critical/Important findings. Remote CI
  `36981484556` passed on `d99beb4`; PR #2 squash-merged as `8aedb53`.
  Main release `36981732941` completed successfully: verification and artifact
  passed; publish/deploy were skipped with their gates unconfigured. No ACR
  publication, runtime deployment or bank acceptance is claimed.
- Exact expected Azure federation subject is now
  `repo:HallelujahHomeChurch@244118972/donation-api@1398406700:ref:refs/heads/main`.
  No cloud federation, identity, role or GitHub publication variable was changed.
  Live registry mode is `LegacyRegistryPermissions`; `AcrPush` would allow writes
  across the existing registry, not just donation images. Asked for explicit
  approval of that scope before creating a dedicated publisher. Do not silently
  change the shared registry permission mode or reuse the broad deploy identity.
- Review boundaries: live OIDC login/ACR publication remain unverified until
  approved identity setup and CI publication; deployed bank behavior and runtime
  configuration remain outside this workflow-only change. Delivery 1A stays OPEN.

## Continuation — approved release settings and Gateway merge (2026-10-02)

- User approved the proposed release-settings closeout. Fresh read-back still
  showed Gateway `0000186` active, Running, Healthy, 100% traffic and the exact
  immutable image recorded below. Updated and read back both approved GitHub
  rollback variables (`0000185` → `0000186` and corresponding digest). Audit
  production/test prerequisite revisions still match their configured values.
- Gateway PR #146 had successful CI on `701bcd0`, unchanged base `67d6e16`
  and the previously completed independent release review. Marked it ready and
  squash-merged through GitHub as `2f27d64025fb3b2dfef75f3291b6eeb7155bca58`.
  The existing production release now owns deployment; no ad-hoc deployment,
  donation routing enablement or bank call is authorized by this merge.
- Release `36979340311` verification/deployment jobs passed. Live revision
  `api-gateway--0000187` is active, Running, Healthy and receives 100% traffic.
  Its image matches the release tag's registry digest:
  `alive.azurecr.io/alive/api-gateway@sha256:136791d0e8c7b228884af63d7d332c093f95685eaa566da0b605a11d38d53a52`.
  Fresh public smoke: `/health` and `/ready` returned 200; all seven exact
  donation routes returned expected 503 using empty synthetic requests.
  Donation routing flag remains absent/default-off. No bank request occurred.
  OpenAPI publication also passed; the entire release completed successfully.
  Existing task worktrees remain for the still-open donation delivery gates.
- Confirmed organization plan is GitHub Free and donation-api remains private.
  GitHub's current [deployment protection documentation](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments#required-reviewers)
  states required reviewers are public-repository-only on Free/Pro/Team.
  The approved protected-environment design therefore cannot be configured as
  written on the current plan. No donation OIDC federation, role assignment,
  publication flag, billing or repository visibility change was made.
- Ruling: stop donation publisher setup at the missing approval boundary;
  do not replace required reviewers with an unprotected environment. Cost:
  ACR publication and genuine bootstrap what-if remain blocked. A separately
  approved manual-dispatch design with a publish-only identity could avoid
  a plan upgrade, but is not equivalent to enforced two-person approval and
  requires an explicit design decision before implementation.

## Continuation — backend merge and publisher setup gate (2026-10-02)

- Donation PR #1 was squash-merged at `b96ff29bacac6a7759c45a37c30a8d942920ce0b`
  after exact-head CI, independent release review and a fresh complete serial
  PostgreSQL race suite, vet/build and disabled guard/rollback checks passed.
  The task-owned disposable database was removed. Main release `36977777924`
  completed successfully: verification, disabled image smoke, vulnerability
  scan and artifact upload passed; publish/deploy were intentionally skipped.
  Artifact `11214436746` is `donation-release-b96ff29bacac6a7759c45a37c30a8d942920ce0b`
  (14,761,872 bytes), uploaded archive SHA256
  `50c308bdff627971ea73ccfb7d4067564d4b89b1d1dfb308e9075fc1ba7f6223`.
  This archive checksum is NOT an ACR image manifest digest. No registry
  publication, Azure deployment or bank acceptance is claimed.
- Gateway PR #146 initially failed the WWW runtime fragment-order assertion:
  the new `65-donations.conf` was absent from its expected list. Reproduced
  locally, fixed narrowly in `701bcd0`, then runtime routing and Go tests/vet
  passed. Fresh CI `36977457644` passed on that exact head. No Gateway
  merge/deployment yet.
- Read-only GitHub inspection found no donation repository variables, secrets
  or environments. The current shared Azure publisher has no donation federation.
  Main artifact creation needs none of these, but ACR publication is blocked.
  No identity/trust/role/environment/variable configuration was changed.
- GitHub reports immutable OIDC subjects for this repository. The expected
  environment subject is
  `repo:HallelujahHomeChurch@244118972/donation-api@1398406700:environment:donation-sandbox`;
  do not copy a legacy plain repository/main subject. Before setup, review the
  selected publisher identity's grants and confirm environment protection is
  supported and configured. Existing shared identity access is not authorization
  to extend that identity's trust to a new repository.
- Proposed next setup only: protected `donation-sandbox` environment, exact
  environment-subject federation, publisher ACR permissions, and non-secret
  `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID` configuration.
  Enable only `DONATION_IMAGE_PUBLISH_ENABLED` after approval; keep
  `DONATION_DISABLED_DEPLOY_ENABLED` absent/false. Obtain and verify the real
  registry digest before Azure what-if; resource apply remains a separate gate.
- The private repository's branch-protection API returned 403 (plan limitation).
  Required CI was still checked explicitly before merge; no billing/visibility
  change was attempted. Do not assume protected-environment reviewer support
  from the workflow YAML or silently replace the human approval requirement.
- Delivery 1A remains OPEN. Admin still needs actual package publication/pins;
  runtime DB/keys/audit/permissions, authorized deployment and bank-hosted
  end-to-end acceptance remain outstanding.
- Gateway release preflight found a separate configuration drift: live ready
  revision is `api-gateway--0000186`, but repository variable
  `AUDIT_GATEWAY_ROLLBACK_REVISION` still names `api-gateway--0000185`.
  The existing release workflow requires an exact latest/ready match and would
  stop before deploying. Keep PR #146 unmerged until the current healthy
  100%-traffic revision and its immutable image are verified and the matching
  rollback variable pair is reviewed/refreshed. No release guard was weakened.
- Read-only revision verification confirms `0000186` is active, Running,
  Healthy and receives 100% traffic. Public `/health` and `/ready` both returned
  200. Proposed GitHub variable diff (not applied):
  `AUDIT_GATEWAY_ROLLBACK_REVISION`: `api-gateway--0000185` → `api-gateway--0000186`;
  `AUDIT_GATEWAY_ROLLBACK_IMAGE_DIGEST`:
  `alive.azurecr.io/alive/api-gateway@sha256:c7e39400390bd59968c5209c312949989c64d428b06e69c91e607543c559dd29`
  → `alive.azurecr.io/alive/api-gateway@sha256:779aada5b6a2eba695eb4b05374458545589a827d83dd4aa7fe819937364647b`.
  Refresh live evidence again immediately before any approved variable update;
  another feature release may advance the rollback baseline. The live donation
  routing flag is absent, so the new routes must remain default-disabled.

## Continuation — disabled release and Gateway preview (2026-10-02)

- Donation PR #1 head `f688bf6` adds main-only immutable artifacts and separately
  gated image publication/disabled-only runtime update. The existing combined
  `serve` command is reused; no extra worker is provisioned. CI `36975065811`
  passed on that head. Serial disposable PostgreSQL race/vet/build, actionlint,
  Bicep compile, disabled image smoke, guard/rollback fixtures and image scan pass.
- `donation-api/docs/disabled-release-preview.md` owns the exact first-slice
  resource preview: private ACA app, user-assigned identity and registry-scoped
  AcrPull, with no database/Key Vault/secret/job creation and payments fixed off.
  Protected GitHub environment/OIDC and actual release gates remain unconfigured.
  A genuine Azure what-if requires an approved released digest; compilation is
  not what-if evidence. No cloud apply, migration or bank transaction occurred.
- Gateway branch `feat/donation-sandbox-routing` starts at current `67d6e16`.
  Seven exact host/method routes use fixed `donation-api`, explicit human test
  permission, stripped credentials/query strings, 4 KiB bodies and bounded rate
  limits. Routing defaults off. Site maintenance blocks checkout but preserves
  bank callback/return processing for existing orders. Synthetic container tests
  cover disabled/enabled/maintenance modes, spoofed headers and wrong host/scope.
- Gateway scanning found four fix-available HIGH PCRE2 findings in the existing
  base package. Its pin is updated from installed 10.47-r0 to repository-available
  10.49-r0; no scanner policy or required check is bypassed.
- Earlier frontend conflicts were resolved preserving both service-account and
  donation features: shared PR #88 `e793ae5` has passing CI and 221 local tests;
  Admin PR #170 `38d88e0` has 812 local tests/lint/build passing with uncommitted
  tarball overrides. Its remote CI `36973508379` fails resolving unpublished
  `donation-client`, so it remains a non-deployable draft, not a green consumer.
- Still required for real Sandbox: reviewed ordered merges/releases, actual
  shared-package publication/Admin registry pins, Account permission rollout,
  separate DB/grants/migration/Key Vault/audit/alert acceptance and authorized
  hosted-checkout/callback/reconciliation smoke. Delivery 1A remains OPEN.

## Continuation — central audit and safe owned requery (2026-10-02)

- Central `audit-log` worktree starts from freshly fetched `24adb8a`; donation
  reuses `07335cc`, frontend producer `b2c4cfe`, Admin source `5b6e232`. Only local
  feature branches are changed. Existing Admin tarball overrides are preserved.
- Closed financial audit catalog accepts exact donation service actor for facts,
  Account user actor for retries, and Sandbox-only minimal metadata. The optional
  central caller token keeps existing producers unaffected; without configuration
  donation is denied. Enabled donation runtime requires its independent token.
- An additive migration atomically enqueues new financial facts and backfills
  existing ones. Immutable payload/event ID/time survive retries. Live leases,
  fixed Dapr destination, refused redirects and three-second HTTP timeout protect
  dispatch. Transient failures retry with capped backoff; other failures retain
  review work. No raw bank response, amount, provider identifier, URL or donor PII
  enters central audit.
- Own-order Sandbox requery requires exact test scope, ownership, a monotonic
  expected version, exhausted provider-unavailable review and an unexpired query
  window. Reset and user audit commit together. Identity/refund/malformed-response
  reviews, bill jobs and general finance operations are not unlocked. No bank
  order is created by requery and no manual paid state exists.
- Canonical OpenAPI, generated shared client and Admin controls were updated.
  The Admin action explicitly distinguishes query queued from payment success.
  Client publication/real version pins remain required; local tarballs are not
  production dependencies.
- TDD observed missing-contract/API/client/UI failures, then passing targeted
  checks. Donation full serial PostgreSQL race/vet/build and OpenAPI pass (five
  pre-existing semantic warnings); image build passed. Central audit full tests,
  vet and disposable append-only migration/permission integration pass. Producer
  full 220 tests, lint/build/package contracts and packed Vite/Next consumers pass.
  Admin focused 10 tests/lint/build pass; all 78 files / 795 tests pass using
  `--maxWorkers=2 --testTimeout=15000` (68.14s).
  The pre-implementation default Admin run also hit an unrelated existing
  five-second `creates a one-time newsletter schedule` timeout; not relabeled green.
- Local image scan found no fix-available HIGH/CRITICAL vulnerabilities. Disabled
  image smoke returned health 200, readiness/checkout 503; embedded image migrate
  and check passed against a separate task-owned disposable database only.
- Fresh whole-branch review found two Important issues, no Critical: the wrong
  S0001 response shape in reconciliation, and checkout recovery/read bypassing
  closed review. Both were reproduced with failing regressions, then fixed in
  one pass: shared probe-compatible parser, original ten-minute recovery guard,
  review-safe owned/idempotent URL projection, and late-response suppression.
  Existing financial facts stay readable. Expiry and malformed/not-found negative
  cases are also covered. Final full serial race (`-count=1 -p=1`), vet/build and
  format/diff checks passed. Latest image rebuilt/scanned with no fix-available
  HIGH/CRITICAL findings; disabled smoke again returned 200/503/503.
- Handoff heads: donation `334881a` pushed to existing PR #1;
  [CI 36952391265](https://github.com/HallelujahHomeChurch/donation-api/actions/runs/36952391265)
  passed on that exact head (tests/OpenAPI/image/scan). Central audit `f1f0704`,
  frontend producer `ee7ed06`, Admin `cbab000` are local commits only. Their
  publication/PR/CI/release remain outstanding. Admin manifest/lockfile retain
  verification-only tarball overrides, not committed deployment dependencies.
  No merge or deployment occurred. Task-owned smoke and PostgreSQL containers
  were stopped; worktrees and execution ledger remain for the release gates.
- Remaining gates: reviewed PR/CI and ordered service/package releases, gateway
  route/identity/ingress controls, Key Vault and least-privilege DB grants, runtime
  queues/alerts and audit-review recovery, bank-hosted Sandbox end-to-end evidence.
  Production, recurring/finance/receipts/tax reporting remain unavailable. No
  cloud changes, live migration, package publication or bank transaction occurred.

## Continuation — shared frontend and disabled Admin draft (2026-10-02)

- Fresh isolated frontend-platform (`ce4d063`, version 1.0.30) and admin-fe
  (`3069b17`) worktrees hold the reusable generated donation client/form and
  dedicated-permission Admin page. Existing authenticated token/refresh behavior,
  generic UI, locale and navigation conventions are reused. Only fixed same-origin
  Sandbox routes are called; the bank link requires the exact approved HTTPS
  origin. The feature is disabled by default.
- The result page preserves the opaque reference through login, displays pending
  until verified results, and bounds/cancels polling. Authorization, capture and
  settlement are separate. No card fields, charge tokens or official receipts.
- Reload-safe retries keep only actor-keyed key/amount/time for 15 minutes plus
  an opaque owned order ID. No bank URL/PayToken is persisted. Expired/malformed
  metadata becomes a data-free blocked sentinel; a mounted timer plus restore/
  submit validation enforces logical expiry (suspended browsers may defer work).
  Correlated POST success clears metadata. Unrelated GET/return recovery cannot
  prove the original idempotency mapping, so it minimizes metadata to a sentinel
  rather than silently permitting a new payment.
- Independent frontend review found this cleanup gap; regression tests observed
  RED, then the fix passed bounded re-review with no remaining blocking finding.
  Main executor freshly ran the full producer `corepack pnpm test`: 219 passed.
  Producer lint/build/package contracts/generated parity and packed Vite/Next
  consumer checks were also run by the implementer. Main executor inspected the
  desktop and 390px mobile screenshots; layout fits and the Sandbox notice is
  visible. This is mocked local UI evidence, not a real login/bank round trip.
- Admin dependency overrides are **uncommitted local tarball verification only**.
  The source branch is a draft, not independently deployable until released
  producer packages and their real registry pins/lockfile are integrated.
  No frontend push, PR, package publication, merge or release occurred.
- Final producer head is `b2c4cfe`; Admin source head is `5b6e232`.
  Admin's full refreshed-package rerun passed
  all 78 files / 794 tests using `--maxWorkers=2 --testTimeout=15000` (118.77s).
  The original default run had 12 failures: 11 five-second timeouts plus a DSR
  expected-call assertion. No test assertion/default/skip was changed; contention
  is an inference, not proven causation. Do not represent the original default
  run as green. A stale-tarball attempt was stopped; the final run used the
  frozen original registry pins and refreshed local Donation UI integrity.
  Admin lint/build passed. Main executor independently reran the page/runtime
  suites: 12 tests passed. Only Admin package.json/pnpm-lock.yaml local tarball
  overrides remain uncommitted; producer and backend worktrees are clean.

Current release gates, not additional completed work: central audit dispatch and
audited operator requeue; reviewed gateway/Key Vault/DB/alert/release wiring;
backend/Account producer rollout and actual shared-package publication before
consumer registry pins; authenticated bank-hosted Sandbox acceptance. Keep all
worktrees while these gates remain. The task-owned disposable PostgreSQL test
container and local mock browser/server were stopped; no operational data changed.

## Continuation — encrypted capabilities and durable reconciliation (2026-10-02)

- Donation commit `a662b0b` adds donation-only AES-256-GCM storage encryption,
  independent stable token-HMAC dedupe, keyring rotation, purpose/environment/
  record binding and fail-closed enabled configuration. Bank Hash/X-Key and
  Account keys are not reused. No real storage key or cloud configuration was
  created. Migration refuses legacy plaintext work instead of deleting data.
- Checkout URLs expire ten minutes after intent creation and are wiped after
  successful facts; callback tokens are wiped atomically on completion and
  outstanding/review tokens after seven days. Financial facts/dedupe identities
  survive cleanup. These Sandbox capability limits are not a production
  financial-retention policy. Key Vault/DB TLS/grants/backups remain runtime gates.
- Original-order OrderQuery recovers lost callback authorization/capture without
  requiring a checkout URL. Authenticated S0001 remains retryable. BillQuery
  stores independent daily checkpoints for the prior 1–30 days, revisits recent
  days and cannot skip a failed day through a maximum-date cursor. Queries never
  create orders; API success is not payment success, and no settlement timestamp
  is invented. Refund/unknown/mismatched bills require review without partial
  writes. Bank-query review warnings contain fixed reason/kind only.
- Callback facts and completion now commit atomically behind a live lease;
  expired workers cannot mark work done/review. Outcome and checkout updates
  serialize on the order row, preventing late recovery from resurrecting a
  completed payment URL. Changed TSNo is conservatively reviewed, not an assumed
  bank one-to-one guarantee; V2.5 does not define failed/retried attempt identity.
- Same-image `job` now handles one callback and one reconciliation item under a
  55-second total budget (25 seconds each plus bounded cleanup), avoiding queue
  starvation. Existing default-disabled serve/api/worker modes remain unchanged.
- RED→GREEN observed for encryption storage, live-lease completion, order
  visibility retry, changed transaction identity, late capability resurrection,
  aged work and review warnings. Full serial PostgreSQL/race suite, vet/build and
  diff checks passed; OpenAPI valid with the same five semantic warnings.
  Independent backend review findings were reproduced and fixed; bounded final
  re-review found no remaining issue in these fixes. Reviewer did not rerun DB
  suites or accept live bank/cloud/central audit behavior.
- Updated existing PR #1; [CI `36944929097`](https://github.com/HallelujahHomeChurch/donation-api/actions/runs/36944929097)
  passed on `a662b0b`, including race/vet/build/OpenAPI, image build and the
  configured Trivy scan. This is CI acceptance only, not runtime acceptance.
  Follow-up `07335cc` adds active bank-call cancellation and replacement-worker
  lease-recovery coverage, closing the earlier local test deferral. Full local
  race suite and [latest-head CI `36945358744`](https://github.com/HallelujahHomeChurch/donation-api/actions/runs/36945358744)
  also passed, including image build/scan. PR #1 remains unmerged.
  No merge, release, bank transaction, deployed route, cloud write or payment
  enablement occurred. Central audit dispatch, operator requeue authority,
  deployed alert routing, runtime configuration and live acceptance remain open.

Implementation rulings: retain old AES IDs through ciphertext/backup lifetime;
do not rotate dedupe key without reviewed reindex/replay handling. Use Taipei as
provisional bill timezone; bank availability/late-arrival/empty-list behavior is
still a runtime acceptance gate. Shared-merchant unrelated bills require an
agreed review ownership policy. Review does not authorize manual-paid edits.

## Continuation — workflow permission restored and foundation PR (2026-10-02)

- User completed GitHub reauthorization and confirmed the existing account now
  has `workflow` scope. Publication used that refreshed GitHub CLI credential
  with per-command Git helper overrides, not a different identity or a global
  credential configuration change. The CI workflow was preserved.
- Published `feat/donation-sandbox-single` and opened
  [donation-api PR #1](https://github.com/HallelujahHomeChurch/donation-api/pull/1)
  against the approved empty `main`. Current head `ad2f230` also reconciles the
  runtime README's historical publication blocker. No merge or deployment.
- CI run `36941920028` on the older head was automatically cancelled by the
  workflow concurrency policy when the documentation update arrived. Latest-head
  [run `36942001839`](https://github.com/HallelujahHomeChurch/donation-api/actions/runs/36942001839)
  passed on `ad2f230`: Verify (race tests, vet/build/format/OpenAPI), Docker image
  build and configured Trivy image scan all succeeded. This is fresh remote CI
  evidence for this head only. Old cancelled results do not establish test
  failure or success; PR success is not a merge/release/deployment acceptance.
- This publishes only the default-disabled backend foundation. Admin UI,
  encryption/retention, audit/reconciliation, runtime configuration, release and
  bank checkout/callback acceptance remain separate incomplete work.

## Continuation — approved empty baseline and publication gate (2026-10-02)

- User confirmed the scope is Admin Console using bank Sandbox and authorized
  continuation after the empty-main proposal. Verified existing bootstrap
  `bb1f82e84aa62d40557ef889568d4b1557d3b148` has an empty tree; pushed only that
  commit to `origin/main`, without rewriting history or putting feature code on
  main. Fresh remote inspection confirms that is the only remote branch.
- Feature push was rejected by GitHub: the OAuth credential lacks `workflow`
  scope for `.github/workflows/ci.yml`. Active GitHub CLI authorization likewise
  lists no workflow scope. No feature branch, PR, CI run, merge or deployment was
  created. Do not remove the workflow, switch identities or otherwise bypass the
  permission gate. Request authorized credential reauthorization before retry.
- Local worktrees and existing implementation remain preserved. This is a
  publication authorization blocker, not evidence that tests failed or that
  Sandbox UI/payment acceptance is complete.

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
