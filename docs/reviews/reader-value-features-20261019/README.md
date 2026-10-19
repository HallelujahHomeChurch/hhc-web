# Reader value features: local candidate evidence

2026-10-19. Synthetic fixtures only; no production account or note access.
Product source `636c9e4`, export source `9009179`, Phase 2 immutable baseline `8974b886`.

## Checks

- Fixed-source `pnpm test:run --maxWorkers=1`: 179 files / 1423 tests, plus 8 Node checks PASS. TypeScript, production Next build, static budgets and release policy PASS; lint 0 errors / 1 existing LegalRequiredNavigation warning. CSS 195547 bytes.
- Consumer package.json / pnpm-lock.yaml remain client 1.0.75. Local ignored node_modules uses packed SDK candidate 1.0.76, SHA256 `dc4c6162fe5542a2dd9e9169802683530e89418ba6ef479dc3ce55cdbda5c221`. This is not registry validation and cannot be merged as a deployable consumer until the reviewed SDK is published and exactly pinned.
- Initial Next build could not follow the package symlink outside its root. Moving only the candidate extraction under ignored node_modules fixed resolution; no Next configuration, manifest or lock workaround was committed. Final build.log supersedes that failed attempt.
- Original T3 seats found stale cache ingress and hidden bookmark draft loss / focus loss. Cache seed, note ack and bookmark ack now merge per-ID versions including tombstones; finishNoteEditor preserves bookmark draft. Final focus fallback covers 99→100 with busy transition, and the final two seats independently verified it.

## Browser matrix

`screenshots.json` inventories unedited browser screenshots. Desktop 1440×900, tablet 768×1024, phone 390×844; light/dark normal reading and long bookmark names. Normal pairs compare against existing `../reader-experience-20261018/baseline-*-normal.jpg`; all six have zero pixels whose max-channel difference exceeds 30 (`metrics.json`). This narrow fixture result does not prove every real PDF/version is unchanged.

Short phone 390×568: bookmark forms and prepared export dialogs for en/ja/ko/zh-Hans/zh-Hant in both themes. Dialog/form content scrolls vertically; some actions are below the initial viewport. Additional empty, draft, conflict, offline read-only, old producer and dirty-close states are saved. Bookmark create succeeded on a single Save; deletion used the house AlertDialog and returned to the empty list. Local fixture CAS is synthetic and does not replace API PostgreSQL integration coverage or real cross-device acceptance.

Native browser View Actual Size → five Zoom In operations yielded AX `Zoom: 200%`. At a normal native viewport, export was reopened and prepared; Tab reached Download, which is fully visible with its focus ring in `export-browser-200-download-focus.jpg`; `browser-200-focus.txt` records the matching Zoom and focused element. Return produced the handed status in `export-browser-200-handed.jpg`. Browser Zoom was restored to 100%. Earlier `export-browser-200-top/bottom.jpg` are incomplete narrow-emulation attempts, not the acceptance proof. `bookmarks-wide-form-not-zoom.jpg` is an ordinary wide form and not a zoom test.

The browser download event API timed out, but the actual scoped Downloads file was independently found with matching time 12:12:02 +08:00 and copied as `synthetic-notes-download.md` (1057 bytes; SHA in metrics.json). It contains the fixture's own note and controlled edition/source metadata; no bulletin quote or CMS title. This confirms desktop file creation, not physical iOS/Android Files acceptance.

## Review and delivery boundary

T3 data reviewer PASS after version/tombstone ingress correction. T3 UI original draft-loss finding PASS; its final full-capacity focus edge was fixed with a regression, then independently confirmed by both final reviewers. T4 `p3_t4_delivery` PASS, and `p3_t4_visual` PASS after its one narrow 200% evidence follow-up. Neither reviewer ran tests or mutated files.

API PR265 b6143e8 / CI39151345044, SDK PR138 0e6d29c / CI39151361617, export Web PR237 9009179 / CI39196694373 all read back SUCCESS, draft OPEN, mergedAt null, autoMerge null. Consumer source branch is reviewable but has no registry CI; no premature dependency pin and no deliberately failing consumer PR.

Remaining gates: producer release → published SDK → exact registry consumer pin and CI; physical iOS/Android IME and Files, safe areas/rotation, installed PWA, screen reader, real account cross-device flow, and real v1–v10/PDF acceptance. No merge/tag/publish/deploy or production writes performed.

## Reproduce local UI

The standalone `preview.mjs` was used against this exact worktree with its installed packed candidate: `node docs/reviews/reader-value-features-20261019/preview.mjs "$PWD"`. It binds loopback port 7152 and creates a temporary Vite fixture. Query parameters support `theme`, `locale`, `bookmarks=empty|long|conflict|invalid|legacy`, and `scenario=bookmark-offline`. This is local review tooling, not application code. Its only account identity is disposable `local-fixture-account`; it never calls production services. It does not simulate the production API security or persistence contract.

## Dependency preparation follow-up

See [integration checkpoint](../2026-10-19-reader-dependency-integration.md). SDK feature source now8c5fcdc includes latest main11464e8 and plans coordinated1.0.78; its new exact-head CI39200281237 completed SUCCESS (prepare, all three renderer groups and verify). Only the ignored local candidate was replaced with packed1.0.78 (SHA5d57749142ff369b2b9adc3855c26055a6848ca52130f96cd039c5f0be44be3e), and the unchanged consumer source passed a new full179-file/1423-test+8-node run, type/lint/build/perf/policy. Formal registry manifest/lock remain1.0.75; no package publication or registry consumer CI. Original screenshots/metrics above retain their original1.0.76 source provenance.
