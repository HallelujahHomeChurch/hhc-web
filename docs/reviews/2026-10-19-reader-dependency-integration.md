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
