# Donation Sandbox implementation evidence

Date: 2026-09-30. Approved plan: `2026-09-30-donation-admin-sandbox-first.md`.
This is the first local offline slice, not delivery 1A acceptance.

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

Next: bank HTTP adapter, safe endpoint allowlists and query recovery; exact
gateway/AuthN/CSRF/ownership handlers; durable callback worker, safe return refs,
central audit and reconciliation; migration/runtime/CI/release packaging. Then
release producer contract before frontend-platform donation client/UI and Admin
consumer. No package pin, public route or production toggle exists yet. Recurring
1B and production 4–5 remain explicit gates.

## Execution rulings

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
