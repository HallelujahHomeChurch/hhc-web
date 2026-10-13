# Task 7b final main integration

Merged actual latest origin/main `bd98ef18c786a3428366e686851c52916189dcf8` (#209) into the preserved Task 7b branch from `5c83167882449f350ede618920c2ae66db6817e8`. This regular merge is source commit `6a0f580d0776f30a4ee25f1d8d484ff46210f330`. No cherry-pick, rebase, force push or conflict resolution was needed. Git auto-merged offline-store.ts and its tests: main's lightweight summary projection and Task 7b's staging-capacity predicate occupy separate regions.

Against the new main, product/test/dependency diff remains the original nine files (31 insertions, 16 deletions): three capability callers, their tests and existing exact-pin assertion, package.json and lockfile. No frozen renderers, CSS, fonts, assets, historical digests, workflows, feature gates or other dependency versions changed. New main's controlled PassageText, caller-owned lifecycle, lightweight summaries and full availability/transient validation are retained. Earlier standalone Task 7b evidence remains historical; this integrated candidate needs its own complete gates.

## Integrated candidate local gates

Toolchain Node 24.21.0 / pnpm 10.12.1 / FontTools4.60.2 / Brotli1.2.0. All commands exited 0:

- `pnpm test:run --maxWorkers=2`: required Node budget/immutable tests, frozen asset base-ref verification and 143 files / 1191 Vitest tests passed.
- `pnpm lint`: zero errors; one pre-existing LegalRequiredNavigation.tsx:17 navigation warning.
- `pnpm build`: default production build passed without enabling a reader feature gate.
- `pnpm perf:static`: four local fonts, hero140091 bytes, CSS159000 bytes passed.
- `scripts/test-release-policy.sh`: passed.
- Authenticated registry `pnpm install --frozen-lockfile`: passed with no manifest/lock change; token remained environment-only.

Commands that did not need registry access emitted the existing missing NODE_AUTH_TOKEN interpolation warning; no credential was printed and no dependency fetch was needed. Browser agent archives this exact source into separate scratch checkouts; no source changes were made after source identity capture. Independent integration review, actual Next/SW/browser and fresh exact-head Node22/container/security CI remain separate gates, not implied by these local passes.

## Independent integrated browser acceptance

Final independent source/local validation and actual Next/SW evidence reviews both report Critical0 / Important0 / Minor0; no correction requested. Browser receipt `browser-next-sw/` verifies actual released209 baseline `bd98ef1` → integrated210 `6a0f580` →209 with physical frozen installs, default production builds, five phases and exact loaded chunk binding. Twenty synthetic retained documents, V1–V10, account/revision/expiry/mutation identities, native selection/highlight/clear/note, dirty return, all ten expired/locked routes and rollback restoration passed. Copy manifest verifies original file hashes and records only .log trailing-whitespace normalization; executable driver suffixes become .txt without byte changes.

The browser gate does not establish live authorization/backend replay/CAS, physical devices/PWA lifecycle or touch interaction. Local feature build values apply only to isolated scratch previews; no production variable changed. Exact-head Node22/container/security CI must still run after this evidence commit.
