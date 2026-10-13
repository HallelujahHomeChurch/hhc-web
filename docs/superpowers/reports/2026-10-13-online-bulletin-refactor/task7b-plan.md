# Task 7b standalone consumer plan

Fresh baseline: `b4cf65093fa3cc039e8595a1796b7b1973fe1721`; branch `refactor/online-bulletin-capabilities-20261013`. Existing Web #209 remains unmerged and its changes are not copied. Coordinator's independent preflight confirms independence: only overlapping file is offline-store, where this task changes staging capacity and #209 changes list projection.

## Scope and ownership

- `verifyReaderAccess`: call existing digest/template validator first; use released capabilities for snapshot presence and font-family selection. Keep exact URL/SHA/kind code-owned asset allowlists and every binding/page/proof check.
- `stageOfflineSave`: use font-family capability to choose 40 MiB for Hans v7-family, otherwise 32 MiB. Keep streaming bounds, hashing, account/epoch, receipt/clock, atomic commit and stored schema unchanged.
- `fitPaperLines`: read explicit nearest renderer marker and use composer-spacing capability. Missing marker retains legacy behavior. Explicit unknown version rejects `update_required`; known V1–V10 render exactly as before. Keep restore sequence/text/anchors/layout CSS intact.
- `PaperViewport` and `PageNavigator` already emit the marker. Existing CSS version selectors remain unchanged; test-fixture legacy lists remain independent expectations, not production policy sources.
- Exact UI package pin and registry lockfile only after coordinator verifies the actual producer publication. No predicted version/local tar dependency is committed. Other packages remain at their existing versions unless a concrete peer requirement demands a reviewed change.

## Verification gates

1. Extend API rejection matrix across all supported version/locale pairs; unknown version still fails before assets. Existing snapshot invalid-input and binding tests retained.
2. Extend offline limits across supported V1–V10 locale pairs; retain saved-copy expiry/revision and altered-asset/failed-stage tests.
3. Paper test table V1–V10: V8–10 composer spacing unchanged, V1–7 legacy fit/restore unchanged, absent marker legacy fallback, explicit unknown rejection.
4. Targeted three suites, full test/lint/build/static budgets/asset verification/release-policy and required CI. Root owns browser/profile rollback check after actual registry install. No skip/fixture simulation counts as full live or device acceptance.
5. Independent final actual-source/callers/tests review, disposition and rereview before focused PR. No merge, tag, package release or deployment of this Web change.

## Progress and review dispositions

- Preflight and actual six-file source review: C0/I0/M0. Reports copied into this owning task branch; no product correction requested.
- Final dependency pin/integrity/lockfile diff and finished receipts require advisor re-review after actual publication.
- Root's browser acceptance adds direct real DOM fit/restore coverage alongside the same-profile 20-fixture package upgrade/rollback exercise. Scratch harness/module simulation remains distinct from deployed Next/SW/member/backend/device acceptance.
- Baseline dependency installation (`pnpm install --frozen-lockfile`, pnpm 10.12.1) completed without changing package.json or pnpm-lock.yaml. Installed UI is still 1.0.61; candidate tests have not run against an unpublished or local package.
