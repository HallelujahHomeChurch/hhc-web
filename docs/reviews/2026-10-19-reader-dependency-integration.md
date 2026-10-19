# Reader dependency integration checkpoint

2026-10-19 04:37 UTC. This is pre-merge preparation; integration is not complete. The user has not lifted the stop-before-merge instruction. No PR merge, tag, package publication, deployment, production data write or infrastructure configuration change occurred.

## Findings and corrections

The two independent read-only seats `dependency_producers` and `dependency_consumer` both returned CHANGES_REQUIRED for the outstanding publication/integration gates. SDK source 1.0.76 was behind current main; registry metadata confirms published client 1.0.76 and 1.0.77. A version number alone does not establish bookmark capability. Current main 11464e857daf02af9dd7118cc1314c08dceeaa22 has no bookmark source contracts.

In the existing isolated SDK feature worktree, origin/main11464e8 was merged into the feature branch (dd7d573); no main or PR merge. Root and all seven package manifests were then coordinated to planned 1.0.78 in commit `8c5fcdc9beb07fdac843ef1ec8d14fbf85e838f3`, pushed to PR138. This version is a source candidate, not a published package, and must be rechecked for availability immediately before any authorized tag operation.

Two independent correction reviewers `sdk_release_version_review` and `sdk_release_contract_review` both PASS: eight manifests agree; bookmark four-operation source/generated CAS/optional state capability and producer schema segments remain unchanged; immutable renderer source/assets/hashes/workflows have no diff against latest main. The release tag/main gate, three-shard receipt checks and publisher permissions remain intact. Reviewers did not run tests or modify anything.

Root fixed-source workspace build/test/lint, check:generated, seven package contracts, pack and real packed Vite/Next consumer builds PASS. Nine renderer CI/release gate tests also PASS. New hhc-web-client1.0.78 tarball SHA256: `5d57749142ff369b2b9adc3855c26055a6848ca52130f96cd039c5f0be44be3e`. This pack does not replace the published registry artifact.

SDK exact-head CI [39200281237](https://github.com/HallelujahHomeChurch/frontend-platform/actions/runs/39200281237) completed SUCCESS for8c5fcdc: prepare, legacy/v7-v8/v9-v10 renderer groups and verify all successful; the saved dependency-sdk-ci.json records the result. Do not reuse old-head green CI39151361617 as proof for8c5fcdc. API PR265 remains b6143e8, OPEN with successful CI. No new consumer registry CI exists.

## Remaining order and exact consumer changes

1. New SDK exact-head CI is successful. Confirm current main/version availability and fresh production release prerequisites immediately before an authorized merge/release.
2. With explicit authorization to cross the stop-before-merge boundary, merge API PR265; let the repository release workflow run migration104 before runtime rollout. Verify immutable deployed revision, health/readiness and scoped routes. Preserve the prior healthy runtime for rollback; additive schema is not rolled back.
3. Merge the reviewed SDK PR138, then tag the verified main commit with its actual coordinated version. SDK merge alone does not publish: only the matching v* tag drives the verified release workflow. Validate all package publication/renderer jobs and retrieve actual registry version, gitHead when available, dist.integrity and package tarball. Compare gitHead to the actual tag/main release commit, which may differ from the feature head after squash merge. The local candidate SHA is historical provenance and is not automatically the registry tarball integrity. Never reuse an already published version/tag.
4. Only after that artifact exists, update bookmark consumer `package.json`, `pnpm-lock.yaml` and exact-version assertion `src/i18n/locales.test.ts:41`. Install from the registry, use a clean frozen install with no ignored SDK candidate symlink, verify resolved version/integrity and bookmark exports/operation contracts, then run full required web checks and exact-head PR CI. The exact published version is authoritative; planned 1.0.78 is not an authorized consumer pin today.
5. Web stack: PR234 → PR236 → PR237 → bookmark consumer; PR235 is parallel roadmap documentation. Retarget/recheck affected PRs against their final base and require green CI; never bypass required checks. Physical iOS/Android IME/Files, installed PWA, screen reader, real cross-device account flow and real v1–v10/PDF acceptance remain separate gates.

The consumer source636c9e4 remains unchanged and its formal manifest/lock still pin registry client1.0.75. Only the ignored node_modules candidate was updated from1.0.76 to the exact packed1.0.78 SHA above. A new fixed-source full run passed 179 files /1423 tests +8 Node checks, type/lint/build/perf/release policy; logs are in reader-value-features-20261019/dependency-*.log. Earlier screenshot evidence remains tied to its original1.0.76 pack. No unpublished1.0.78 or local tgz/file/link pin was written to consumer manifests or lockfiles.

## Read-only production observation

Azure control plane reports hhc-web-api latestReadyRevision `hhc-web-api--0000235`, Single/Running/100% latest traffic; PostgreSQL17 is Ready, Standard_B1ms with max_connections50 / reserved5 / superuser_reserved10. This does not establish a fresh runtime connection budget or end-to-end readiness. No database SQL, secret retrieval, mutation, replica change or Operations release was performed. A fresh release-time capacity/overlap and migration budget is still required; do not copy the older Operations investigation's suggestions into this release as validated capacity.

## Final pre-merge result

The coordinated1.0.78 candidate is absent from all seven registries and v1.0.78 tag at the availability snapshot; recheck at release time. SDK local validation plus exact-head CI and both correction reviewers PASS. Consumer source remains636c9e4 with local-only1.0.78 full validation PASS. The consumer formal manifest/lock/assertion are still unchanged1.0.75, so formal registry integration is pending API/SDK main merge and successful package publication. All feature worktrees are retained. No production mutation or PR merge was performed.

## Authorized producer release / 1.1.0 progression

User now authorized continuing producer merge/release, with SDK advancing to 1.1.0; website PRs still stop before merge. Supersedes the earlier authorization/version statements for future work without rewriting historical evidence. Root and all seven SDK manifests are 1.1.0 at58649f2. No 1.0.78 tag/package was published. Registry1.1.0 absent in all seven packages and v1.1.0 absent at preflight; must recheck before tag.

Two independent read-only Codex seats minor_version_review and producer_release_preflight_review PASS: compatible additive bookmark capability, coordinated versions, merged-main tag gate, seven-package publication and additive migration104/rollback sequencing. API pool10/5 and min1/max3 unchanged; one healthy live replica235 observed. Fresh PG one-minute total connections26–30 and failed-connections0 observed; these include system roles and do not prove general-slot headroom or rollout overlap safety. No capacity/config changes authorized or performed. Existing release smoke and rollback remain mandatory.

SDK1.1.0 full local workspace build/test/lint/generated/package contracts, seven packs, real Vite/Next packed consumers and nine renderer release-gate tests PASS; candidate client tgz SHA2560f93a3a7001ba5595a12bc27989401fcdef2edc882adf31f4bd98369127ad3a8. Exact new-head CI pending. Prior1.0.78 CI/pack remains historical. API265 authorized squash merge requested through normal PR path; runtime release/health still must be verified before declaring producer ready.

## API producer released; maintenance boundary

PR265 squash-merged to main28a6d9d22f23e2126679f719dccd07da86caf50f at05:44:40Z. Production release39206125567 SUCCESS including migration104, runtime/worker/extractor deployment and smoke. Revision236 Healthy/Running/active/100% traffic, digest sha256:b6a3aeaef1294b2c1252a74a49a8e29e72e5a9337d6a7549822881fac97c8b8f matches ACR main28a6d9d. Original rollout artifact records90 successful ready/CMS/OIDC HTTP200 samples, transport0, API+daprd ready/started/restarts0; passed05:58:27Z. Rollback was available but skipped because forward release succeeded; not a rollback exercise.

Two independent post-release read-only seats api_release_artifact_check and api_release_health_check PASS. PG rollout metrics failed_connections0; total active_connections observed peak34, not a general-slot or worst-case-capacity guarantee. SDK reader contract semantic equality against actual merged API confirmed for2 paths and38 reader schemas, canonical SHA2567663a48b6c989fa2882d615432c0368ced54d254af6774fe436a60c9d8316beb. Entire YAML files differ in pre-existing non-reader layout/descriptions; equality claim is scoped to reader contracts.

User announced maintenance14:00–16:00 Asia/Taipei on2026-10-19. Original rollout samples were13:56–13:58, before maintenance. At14:01–14:03 ready/OIDC remain200 JSON; home/site-layout503 JSON withRetry-After300. This is an observed maintenance response, not evidence of a new code regression. A post16:00 public contract smoke remains required; do not bypass maintenance or declare end-to-end public acceptance during it. API producer release gate is complete, separate from this remaining public acceptance check.

## SDK1.1.0 merge/tag

SDK feature58649f2103193835d2d0afdda6e3c15a2481f59c exact-head CI39206125737 completed SUCCESS for all5jobs. Two independent pre-tag seats sdk_110_tag_gate and sdk_110_contract_gate PASS. The contract seat clarified that merge-triggered main CI is not an explicit hard gate before pushing a tag: release independently performs complete prepare/renderer/verify gates. Both main CI and tag release are tracked; neither can be reported passed while pending.

PR138 squash-merged at06:15:33Z to343aa8366cc65734f827f9f690002cd246c5afa0. Root fetched main, verified merged tree exactly equals reviewed feature tree and all8manifests1.1.0. Immediately before tagging, all7registry version full-page queries returned no1.1.0 and remotev1.1.0 absent. Annotatedv1.1.0 was pushed pointing to actual main343aa83, never feature58649f2. Tag release39208976862 and main CI39208883111 are now in progress. Package publication not yet established; consumer formal1.0.75 pins remain unchanged.

## SDK actual registry verification

Tag release39208976862 and main CI39208883111 both completed SUCCESS at actual main343aa8366cc65734f827f9f690002cd246c5afa0. Seven registry package metadata queries confirm1.1.0 with SHA512integrity/tarball/shasum; gitHead is absent on all7, so no registry gitHead is claimed. Provenance is actual merged-main/tag → same-run verified artifacts → publisher → registry.

Client actual registry tgz SHA256161bcc496180dced823b25089d9a5869734eb581124360b760e54153128926d2, SRI matches registry. It contains ReaderBookmark and create/rename/delete/reanchor mutation declarations. Root independently compared all11package file contents against the locally verified1.1.0pack: identical file lists and bytes. Archive byteSHA differs from local0f93a3a7; never replace registry integrity with the local archive hash. Post-publication two-seat review in progress; formal consumer pins remain1.0.75 until it completes.

SDK post-publication independent seats sdk_110_publication_check and sdk_110_registry_contract_check both PASS. Publisher shasum matches registry metadata for all7; client archive SRI/SHA1 and every packaged file independently checked. No missing gitHead is invented. API → actual SDK1.1.0 publication gate complete; website code remains unmerged.

Formal consumer integration now updates only client package pin, resolved lock and exact-version locale assertion to1.1.0. Entire previous node_modules, including ignored1.0.78 candidate, moved outside worktree before registry resolution/frozen install; no shared SDK package was edited. Full validation and consumer PR CI are pending, so this is not yet an accepted registry consumer build.

## Consumer registry local verification

Fresh frozen install resolved node_modules/.pnpm registry client1.1.0, not a candidate/file/link reference. Lock tarball URL and SHA512integrity exactly match actual registry metadata. Diff relative to previously reviewed consumer product636c9e4 outside docs is limited to package.json, pnpm-lock.yaml and src/i18n/locales.test.ts: only client1.0.75→1.1.0 and exact-version assertion/resolution. Other frontend pins and product source are unchanged.

Fixed-source full179testfiles/1423tests plus8Nodechecks PASS; TypeScript noEmit, lint, production build, static budgets and release policy PASS. Lint retains one existing LegalRequiredNavigation warning; pnpm local commands without auth emit the existing unset NODE_AUTH_TOKEN placeholder warning, while authenticated registry install/metadata/SRI checks succeeded. CSS195547bytes. No new visual changes; earlier screenshots remain tied to their original candidate evidence.

Consumer draft PR/exact-head CI and final two-seat integration review are next. Their final status will be recorded in the PR description/checks rather than adding a documentation-only commit after CI and changing the reviewed head. This paragraph is a historical pre-CI checkpoint, not a claim that CI or final reviewers already passed. Website PRs remain unmerged; maintenance-end public smoke and physical device/real-account acceptance remain separate.
