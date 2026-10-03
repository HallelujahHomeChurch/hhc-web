# Donation Sandbox implementation evidence

Date: 2026-09-30. Approved plan: `2026-09-30-donation-admin-sandbox-first.md`.
Initial foundation date above; subsequent evidence is recorded by date below.
Neither the local foundation nor a read-only bank query is delivery 1A acceptance.

## Continuation — verified hosted origin and protected Sandbox CD (2026-10-03)

- Human approved the authenticated bank response's exact HTTPS origin
  `https://sandbox.sinopac.com` for Sandbox only, with no former-origin fallback.
  Runtime create/original-order recovery and Admin share this fixed origin using
  the existing generic shared validator; no shared package release is needed.
  Both regressions were observed RED then GREEN, including HTTP, userinfo,
  suffix-host, alternate-port, fragment and former-origin rejection.
- Human separately approved an independent enabled-Sandbox CI/CD gate. Reuse
  the existing image/traffic rollout; preserve secrets/env/identity/probes and
  reject incompatible schema without migration. Publisher remains ACR-only.
  Disabled-only entry still rejects enabled runtimes. Guard/rollback tests pass;
  full disposable PostgreSQL/race, vet/build/format/OpenAPI, Docker build and
  disabled-image smoke pass. Remote review/CI/release are not yet accepted.
- Terraform full-root preview adds exactly three resources: independent
  `donation-api-deployer`, immutable repository-ID/main-only federated trust,
  and Container Apps Contributor on `donation-api` alone. No updates/deletes,
  RG/Gateway/ACR/Key Vault/database grants. Fourteen mock contracts, format and
  validate pass. Separate approval for merged-main regeneration/apply was asked;
  no infrastructure mutation has occurred in this slice.
- Admin default parallel runs failed existing 5-second timeouts outside Donation.
  Isolated App tests passed 99/99; the full unchanged suite with reduced file
  concurrency passed 821/821 (81 files), retaining default test timeouts. Lint
  and enabled Sandbox build pass. Required remote CI still must pass unchanged.
- The earlier TWD1 unknown intent is retained; its ten-minute hosted URL window
  has elapsed. Do not re-create it or blindly clear pending state. Before a fresh
  controlled intent, verify original bank expiration/nonpayment. Browser
  acceptance remains test-card input only; no card or payment submission.
- Independent whole-change review accepts Donation `96e41b7`, Admin `78447f7`
  and Infra `2fef850` with no unresolved Critical/Important/Minor findings.
  Two rollout defects were reproduced RED then fixed: permit a subsequent
  guarded release after traffic rollback without trusting ACA latest fields;
  deactivate the old revision only after final verification to stop its workers.
  The actual live preflight prefix passes read-only, with no update or payload
  logging. Dormant disabled-mode gateway-exec permissions are not granted by the
  new Donation-only deployer; that gate remains off, not live accepted.
- Required remote CI passes on all exact final heads: Donation `37107016336`,
  Admin `37106794240` (unchanged default full suite), Infra `37106793654`.
  Infra CI full-root preview independently confirms three creates and all
  unrelated workload/database previews report no changes. Donation PR5 merged
  `6751292`; Infra PR115 merged `b366a02`. Main release `37107219204` is
  publishing the verified immutable image only: both runtime deploy gates remain
  absent/off. Admin PR172 remains open and green until compatible backend release.
  Azure deployer apply/role activation and hosted-page acceptance remain pending.

## Continuation — DB credential unblocked and restricted roles configured (2026-10-03)

- User updated the existing protected `.env.json`; fresh TLS `HHCAdmin`
  authentication succeeded against the verified private PostgreSQL address.
  No administrator reset or unrelated role/database permission change occurred.
- Account PR147 merged `89aed0c`; release `37096825480` succeeded. Live
  `account-api--0000148` is Healthy/Provisioned/Running at immutable digest
  `sha256:827649d6a75deb1f919a542f1bfd6f94e136829e805a67d6014a222b3bd718fb`;
  public OIDC discovery returns 200. Dedicated Sandbox permission is available,
  with no implicit user/staff grant. Admin browser session is authenticated but
  its page still explicitly says Sandbox is not enabled.
- Reviewed one-time SQL verified exact empty DB, owner and absent roles before
  a transaction created `donation_sandbox_runtime` / `donation_sandbox_migrate`.
  Both have no superuser, role/database creation, replication, inheritance or
  RLS-bypass privileges. Migration owns only `donation_sandbox`; runtime has
  CONNECT initially, followed by reviewed schema grants below. PUBLIC privileges were revoked
  only in this new donation DB, not unrelated platform databases.
- Independent random passwords used client-side `psql \\password` with SCRAM;
  values stayed in memory and Key Vault. New DSN versions verified enabled:
  `donation-sandbox-runtime-database-url` / `205bca02fd684bd99dcca23d7d30c732`,
  `donation-sandbox-migration-database-url` / `c7e7053a712549c99694f0408431b743`.
  Run tag `donation-db-20261003T043657Z-c7c977c6aef2c175`.
  Exact-role login probes passed. SQL was tested first against disposable PG17;
  synthetic bootstrap/password/ambiguous-write/enable/read/login failures passed.
  Review found unconditional NOLOGIN rollback could affect concurrent existing
  roles; positive post-commit marker regression failed then passed after fix.
  No secret payload was printed, written to a file, or included in Terraform.
- Infra PR112 configures disabled runtime references, separate manual migration
  job using the existing released digest, exact secret-name RBAC, diagnostics,
  static worker/reconciliation failure alert to the existing operations receiver,
  and only central production Audit's Donation token (test Audit unchanged).
  Merged `77a1e0a`; final required CI `37098193695` succeeded. Fresh full-root
  preview: 17 creates, 2 updates, zero destroys, applied in scoped stages below.
  Twelve Terraform mock contracts and local exact CI plan checks passed.
  Review found guard-only gaps for vault-wide reads and unrelated Audit updates;
  negative tests reproduced both, then passed after exact grant/inventory and
  production-token-only delta checks. Converged/no-op negative-test fixture was
  corrected to retain coherent update actions; pre-apply and converged fixtures pass.
- Applied merged-main saved plans: RBAC only 13 creates; migration job and its
  diagnostics 2 creates; disabled runtime/Audit token/diagnostics/alert 2 creates,
  2 updates, zero deletes. Runtime and migration exact secret-name assignments
  verified, with no vault-wide grant or runtime migration DSN. Manual execution
  `donation-api-migrate-wbh7mvs` succeeded on the same released immutable image;
  all eight migration history records are present. Reviewed grants and live
  runtime login/TLS checks pass: no DB/schema CREATE, DB TEMP, history writes,
  financial fact UPDATE/DELETE, or order DELETE. No live synthetic fact/reset test.
- Full-root disabled convergence: `No changes`. Live private Donation revision
  `donation-api--0000001` has exact nine references and the unchanged image,
  Dapr health 200, disabled readiness 503; public exact Admin checkout 503.
  Central Audit `audit-log--0000002` is healthy at its unchanged digest. Its
  direct Dapr readiness smoke subsequently returned 200 after Azure exec
  throttling recovered; alert
  configuration is not proof of notification delivery or financial Audit dispatch.
- Subsequent activation slice `a515666` changes only Donation's Sandbox flag and
  readiness plus Gateway's existing `DONATION_SANDBOX_ROUTES_ENABLED` gate.
  Full-root saved review plan: zero creates, two updates, zero deletes; contract
  RED then GREEN, 13 mock tests pass. Both actual scoped workflow guard checks
  and unsafe-plan mutation tests pass. Gateway Terraform preview is never
  applied because its existing local Bible secret must be preserved by the
  same-image healthy-revision CLI copy; Admin stays disabled until service,
  Gateway smoke and full-root no-change convergence pass. Review identified a
  legacy Audit-bootstrap guard allowing an accompanying Audit env value delta;
  synthetic regression failed, then passed after full non-Donation env equality
  for the activation shape. Final head `4390cc2`, CI `37099792171` succeeded;
  PR113 merged `4b7d36d`. Fresh merged-main full-root plan remains exactly two
  updates. A transient backend connection reset left this task's exact state
  lease held after planning; no apply had occurred. Native lease release uses
  only the recorded matching lease ID, never break-lease or `-lock=false`.
- Donation-only merged-main saved plan applied exactly one update, no creates
  or deletes. Live `donation-api--0000002` is Healthy/Provisioned/Running, 100%
  traffic at the unchanged digest, with Sandbox=true and DB readiness `/readyz`.
  Private Dapr readiness returns 200. The two task-created disabled, zero-traffic
  predecessors were deactivated, not deleted; rollback remains recoverable and
  only the active revision consumes the min-replica allocation. Gateway's native
  same-image revision copy created `api-gateway--donation-sbx-20261003054327`:
  Healthy/Provisioned/Running, latest=ready, 100% traffic, unchanged digest and
  exact three-secret inventory. No Gateway Terraform apply was performed.
  Full-root enabled convergence reports `No changes`. Public checks: forged/
  unauthenticated Admin checkout 401 JSON, malformed callback 400 JSON, invalid
  form return 303 to the fixed result URL without a reference, production 404.
- Full Gateway runtime smoke exposed an existing compatibility defect: its
  DSR capability assertion required `{"enabled":boolean}` with no extra fields,
  but the current released Account API correctly also returns
  `encrypted_delivery`. The exact live smoke exits 1 at that assertion, not a
  Donation route. Admin remains disabled; no financial acceptance is claimed.
  Focused Gateway fix keeps the boolean validation while allowing the additional
  object field; the expanded actual-shape response fixture reproduces RED and
  passes GREEN after the fix. The release-policy literal assertion was
  synchronized without removal/bypass. Final head `99e0fb8` passed local exact
  policy/rollback/Go tests and rebuilt-image routing/maintenance/inactive smoke.
  Independent review found no Critical/Important and passed nine regex cases.
  CI `37101586475` succeeded; Gateway PR147 merged `c7f64e7`, normal main release
  `37101885436` pending. Release and full live smoke exit 0 remain required
  before the Admin build flag is enabled.
  Existing release prerequisite variables were refreshed to the verified current
  Gateway rollback revision/digest and central production Audit revision/digest;
  token reference names and test Audit revision/digest are unchanged. No guard
  was disabled. Test Audit remains private/healthy at `audit-log-test--0000001`.
  Automatic release `37101885436` had already captured the old repository
  prerequisite values and failed before image build/deployment. Logs confirmed
  the stale snapshot; current verified metadata is correct. A fresh standard
  workflow dispatch on the same merged main commit is used, not a bypass or
  local deployment. The prior healthy runtime remains unchanged.
- Fresh Gateway main release `37102089466` succeeded, including image/security,
  routing, deployed-route and OpenAPI publication gates. Live `api-gateway--0000188`
  is Healthy/Running, 100% traffic at immutable digest
  `sha256:274faf91328a17ccebeaa7398f2a8e39ce9600c7bdc7b99fe7ff3a96fd768a29`;
  Sandbox gate=true and the exact three-secret inventory are preserved. Full
  live runtime smoke prints `GATEWAY_SMOKE_OK` with explicit exit 0.
  A concurrent Account crypto rollout caused the first subsequent full-root
  comparison to show one Account update only; infra PR114 already records that
  configuration. The isolated infra acceptance branch fast-forwards to current
  main `2dc68bd` and regenerates convergence, without applying or reverting
  unrelated Account settings. The fresh full-root plan completed successfully
  with `No changes`.
- Only Admin's `DONATION_SANDBOX_ENABLED=true` repository build flag was set.
  Normal main release `37103108743` succeeded on unchanged merged commit
  `47e6c227af235e4337701e814986e06fc351edda`: 81 files / 815 tests pass,
  dependency scan, lint/build/policy, deployment and static-origin checks pass.
  Authenticated live Admin shows the Sandbox banner, amount form and navigation.
- One authorized TWD 1.00 checkout created order
  `74af94b2-73ec-4f98-8cb1-a939c30e0df5`. The UI safely retains `create_unknown`
  rather than presenting an unverified hosted link. No second order/create retry,
  card typing, payment submission or financial fact occurred.
  A bounded read-only query of this exact original bank OrderNo passed envelope
  authentication/decryption and returned S0000 / one matching merchant, order,
  amount and card type. It has a 14-character transaction ID and a 116-character
  hosted URL. Only safe metadata was printed; no raw response/URL/token was saved.
  The actual hosted origin is `https://sandbox.sinopac.com`, not the previously
  mail-confirmed `https://funbiz.sinopac.com`. Backend/shared Admin allowlists reject
  it; the agent requested confirmation before changing the bank-origin contract.
- Live read-only EXPLAIN also identified SQLSTATE 42501 on the expiry cleanup's
  return-reference row lock. Existing SELECT/INSERT/DELETE is insufficient for
  FOR UPDATE SKIP LOCKED. Disposable PG17 reproduced the denial, then verified
  that UPDATE on only `return_refs.expires_at` enables row locking without full
  table UPDATE or hash/callback-ID updates. Guarded one-column grant applied in
  the authorized Sandbox DB; live EXPLAIN now passes, all previous denied DDL/
  history/fact mutation checks still pass. Background original-order reconciliation
  now exists as pending with zero failed attempts; zero financial outcomes.
  The task-owned disposable container was stopped/auto-removed; the throwaway
  query harness was removed, retaining no bank response.
- Next: obtain the Sandbox origin decision, align backend and shared Admin
  allowlists via reviewed PRs/normal releases, then resume hosted card-entry smoke.
  Hosted card input remains unaccepted. Production and full financial acceptance
  remain closed; an API-created Sandbox order is not a successful payment.

## Earlier continuation — authorized setup, then pending DB credential (2026-10-03)

- User authorized configuration until they can enter a test card on the
  bank-hosted page; no production enablement or card entry by the agent.
- Shared producer PR88 merged `401e8ef`; tag `v1.0.32`, release `37091417067`
  succeeded. Admin PR170 merged `47e6c2`, required CI `37091837400` and release
  `37092287385` succeeded. Real registry pins replace task-owned tarballs.
  Fresh default suite: 815 passed; lint/build/policy passed. Live Admin page and
  referenced immutable JS return 200. UI build flag stays false and checkout
  returns 503; this is not hosted-payment readiness.
- Infra PR111 merged `21b2276`. Reviewed saved plan applied exactly one empty
  `donation_sandbox` DB create, zero changes/deletes; full-root post-apply plan
  reported `No changes`. No schema, roles or DSNs applied.
- Outlook browser recovered the encrypted Sandbox PDF. Fields were decoded
  only in memory and configured as eight exact Key Vault secrets, independent
  from production/member data. Reviewed mutation first staged disabled versions,
  enabled only after all writes, verified values in memory and printed metadata
  only. Synthetic tests cover ambiguous write, enable, verification and interrupt
  rollback. Optimized Python is explicitly rejected; no plaintext file saved.
  Run tag: `donation-sandbox-20261003T032130Z-029ce92da6ea2f19`.

| Key Vault secret | Reviewed enabled version |
| --- | --- |
| donation-sandbox-shop-no | 63e0389710a74bc09c8694002ead6e0f |
| donation-sandbox-hash-a1 | 1fcc732366294f25b5e5bf7c2e9f03aa |
| donation-sandbox-hash-a2 | edfc346cabd1436ca039f356b14fc948 |
| donation-sandbox-hash-b1 | 9b9fa572f2c746df870db3af205eccb4 |
| donation-sandbox-hash-b2 | 54d8fa7a13a64a35b7bb272279ca8b31 |
| donation-sandbox-x-key | 672c9610c4ae41be9ec946a469d8583e |
| donation-sandbox-storage-keys | 2d9a2b7ccfd24b108c6044a0778fad5d |
| audit-log-production-token-donation-api | c58575d9e9a541a6be435c5aad8b78a2 |

No runtime has received these secrets yet. Donation remains private,
`DONATION_SANDBOX_ENABLED=false`, no secret references, ready revision
`donation-api--7oci5l2`. No bank order or card entry was attempted.

- Audit PR15 query actor review finding fixed `7ead270` with RED→GREEN tests;
  fresh full race/vet/policy and CI `37092575268` passed, merged `67d9552`.
  Release `37092758164` succeeded; verified live ready revision
  `audit-log--release-37092758164-1`, private runtime Running/Succeeded at digest
  `sha256:45a4b696ed5707e7eb5ca4aa1d3adc74de9ae8024af6ea7402dd6e9a281f4d44`.
  Donation token injection and deployed outbox acceptance still untested.
- Account dedicated permission rebased onto fresh `e246b84` as `4087235`;
  preserved latest native CLI test while resolving an adjacent additive-test
  conflict. Full uncached required disposable PostgreSQL/Redis race suite,
  vet/policy passed; fresh review has no blockers. PR147 pending CI/release.
- Blocker: controlled `PG_ADMIN_PASSWORD` and existing `postgres-pass` both
  fail `HHCAdmin` authentication at verified private IP and exact platform DB
  FQDN via bastion. No shared administrator reset or unrelated role workaround.
  Requested a fresh credential via existing secure source, never chat plaintext.
  Next: donation-only runtime/migration roles and DSNs, explicit same-image manual
  migration job, restricted grants, reviewed Terraform/runtime/Gateway rollout,
  then Admin build activation and authenticated bank-hosted checkout smoke.
  Delivery1A, recurring, production, PCI and financial acceptance remain open.

## Continuation — user-requested runtime sizing (2026-10-02)

- User requested the 0.25 CPU tier and max 8. Interpreted max as replica ceiling:
  0.25 vCPU / 0.5 GiB per replica, minReplicas=1, maxReplicas=8 per revision.
  This supersedes the earlier 0.5 CPU / 1 GiB fixed-one-replica preview.
  Private ingress, Dapr and payment-disabled configuration are unchanged.
- Donation commit `694a7ef` changes only bootstrap sizing and its documentation.
  Compiled-template checks and full serial disposable PostgreSQL race suite,
  vet/build, release-policy/rollback checks passed. Disposable database removed.
- Fresh Azure what-if against published digest `sha256:d5efddf9d80d9b89bd54f80460a49acb3baeff037cb28b40355d49ff985b4149`
  succeeded with exactly three Creates and no Modify/Delete. The actual preview
  reports cpu=0.25, memory=0.5Gi, min=1 and max=8. No runtime apply occurred.
  The max is not eight always-on replicas; multiple active revisions can each
  have replicas, so it is not an app-wide spending cap.

## Continuation — approved publisher identity setup (2026-10-02)

- User approved the explicitly disclosed registry-wide AcrPush scope. Fresh
  checks confirmed legacy ACR mode, unchanged immutable repository OIDC subject
  and main `8aedb53`; no pre-existing donation publisher identity was found.
- Created `donation-api-publisher` user-assigned identity in `alive`/eastasia,
  with one federation `github-donation-main`: GitHub Actions issuer, audience
  `api://AzureADTokenExchange`, exact immutable repo/main subject recorded below.
  Assigned only `AcrPush` at the `alive` registry resource. Read-back lists that
  single role, with no subscription/resource-group deployment or secret roles.
- Configured repository variables `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`,
  `AZURE_SUBSCRIPTION_ID` and `DONATION_IMAGE_PUBLISH_ENABLED=true`.
  `AZURE_DEPLOY_CLIENT_ID` and `DONATION_DISABLED_DEPLOY_ENABLED` remain absent.
  No credentials were created or stored in GitHub; authentication uses OIDC.
- Main release `36982356973` passed verification, artifact and publish jobs;
  deployment was skipped. Real OIDC login, push, pull and image-ID equality
  checks succeeded. Independent registry read-back confirmed the release tag
  for commit `8aedb5374e4b1ca88ff645f0c638c5100b5cda17` resolves to
  `alive.azurecr.io/alive/donation-api@sha256:d5efddf9d80d9b89bd54f80460a49acb3baeff037cb28b40355d49ff985b4149`.
  Final role/variable read-back still shows only AcrPush and the image-only
  configuration. Publication is not runtime readiness or bank acceptance.
- No payment/runtime app, database, bank key, secret, deployment permission,
  repository visibility or shared ACR permission-mode change was made.
- Azure incremental what-if with the actual published digest succeeded. After
  excluding Ignore/NoChange, exactly three Create entries remain: private
  `donation-api` ACA app, `donation-api-identity`, and its registry-scoped AcrPull
  assignment. No Modify/Delete entries. The app has fixed Sandbox=false,
  0.5 CPU/1 GiB, one always-on replica, private ingress and Dapr donation-api.
  The reference expressions for registry loginServer/new principal remain ARM
  expressions in what-if; this is not applied-resource or readiness evidence.
  No bootstrap apply was performed. Its ongoing replica cost and the three
  resource additions need approval before execution through the delivery path.

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
