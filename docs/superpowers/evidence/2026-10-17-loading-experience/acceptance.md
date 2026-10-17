# Loading experience implementation acceptance

Baseline: `009d37c8238fc50024982f9dc396812bd7fb4ef0`. Task branch: `feat/frontend-loading-experience`. No backend, dependency, production data or infrastructure changes.

## Local verification

- Frozen install: pnpm 10.12.1, unchanged lockfile, exit 0.
- Full suite: 170 files / 1,390 tests passed after independent review fixes (baseline 165 / 1,350).
- ESLint: exit 0; existing `LegalRequiredNavigation.tsx:17` no-location-assign warning only.
- Production build: exit 0, temporary preview routes removed before the final build.
- Static budgets: 4 fonts, hero 140,091 bytes, CSS 196,401 bytes; passed.
- Release policy shell checks and git diff whitespace checks: exit 0.
- Impeccable detector: one pass over changed TSX/CSS paths, exit 0, no output/findings emitted. This does not replace the visual inspection.
- InitialLoadingBoundary, AnalyticsBoundary, locale layout, package.json and lockfile: unchanged against baseline.

## Browser acceptance

Used a temporary production-build preview under localhost:4317 with real feature components, synthetic account/data, 1.8 s delayed read-only responses and 2 s dynamic Next routes. No production member writes. The preview subtree was deleted and the server stopped; it is absent from the final build.

- Inspected 320, 390, 768, 1024 and 1440 CSS px, light and dark. Document scroll widths were respectively 305, 375, 753, 1009 and 1425 px (15 px scrollbar), with no document horizontal overflow.
- Library shows 3 placeholders below 640 px, 6 otherwise; text lines measured 14 px despite the shared primitive's default 44 px minimum.
- Reduced-motion media query was active; skeleton computed animation-name was `none`.
- Long titles, 12 recording/weekly/member records, empty and rejected recording/weekly responses were exercised. Empty and error results replaced the pending skeletons; no endless skeleton remained after settlement.
- The directory fixture initially omitted schema-required updatedAt/action fields. Correcting only the local mock response yielded 12 real directory rows; the product validator remained unchanged.
- On 390 px the comments dialog retained an unsent draft through refresh, opening replies, closing and reopening. Two reply skeleton rows appeared inside the open thread; the screenshot shows the draft and reserved rows without horizontal overflow.
- Native Next slow-link and pagination pending attributes appeared, then cleared at completion. The slow link's bounds stayed identical while pending; old page content remained present. Rapid slow→fast navigation finished at fast, and Back/Forward restored destinations with zero pending markers. A warm destination rendered successfully; no JS minimum wait exists.
- Authorization/account handoff, out-of-order requests, weekly independent settlement, group filtering/page identity, permission-loss dialogs and stale live discovery were verified by deterministic regression tests rather than synthetic browser sign-in mutation.

### Measurement limits

Ego's animation timeline reported localTime=0 even 350 ms after pending began; a later sample saw a painted marker. Therefore this run verifies the CSS delay (150 ms), native pending lifecycle and fixed geometry, but does not claim a reliable browser paint-time measurement at exactly 150 ms or a precise cache-fast latency. Physical phones, manual screen reader announcement quality, route-level server failure recovery and production acceptance were not exercised. Native Link click behavior and the global first-load/analytics guards remain in their existing implementation.

## Visual evidence

- [Desktop initial skeleton](desktop-initial.png)
- [Mobile dark library skeleton](mobile-dark.png)
- [Mobile information and comments preview](mobile-comments.png)
- [Mobile open comments, preserved draft and loading replies](mobile-replies-loading.png)

## Final independent review and CI

One fresh read-only whole-branch reviewer found no Critical issues, two Important issues and no Minor issues. Both Important issues were reproduced by six failing regressions and fixed in one pass; the full suite then passed 1,390/1,390. Details and all rulings are in [independent-review.md](independent-review.md).

Final-source [local smoke](local-smoke.json): health/about/literature/videos returned 200; the removed preview returned 404. PR [#229](https://github.com/HallelujahHomeChurch/hhc-web/pull/229) must pass the current-head verify job, including dependency/image scans and container build. Its [live checks](https://github.com/HallelujahHomeChurch/hhc-web/pull/229/checks) are authoritative; no production release is claimed.
