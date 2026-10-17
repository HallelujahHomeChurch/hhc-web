# Small-group member read access implementation plan

> Execute inline using superpowers:executing-plans. Two consultant seats (Codex + Gemini) review this plan and the final changes before sequential CI, merge and release.

**Goal:** Rename the WWW directory to 小家 and allow active direct small-group members to view their own group without management controls.
**Architecture:** Keep existing API response shapes and responsibility authorization. Add a narrow direct-membership read predicate used only by unit folder and roster reads; existing actions remain responsibility-derived.
**Tech Stack:** Go/PostgreSQL Operations API; TypeScript/React/Next.js WWW.
**Spec:** User requirements in this task, plus decisions below. Baselines: Operations 72201e6, WWW 50daad8.

## Requirements and decisions
- Nav and hero: 小家. Roots heading: 我的小家. Remove instruction paragraph. Localize all five existing locales consistently; list action becomes 查看/View.
- Ordinary readers must have active church membership, unremoved direct affiliation to the exact active small_group, matching active church ancestry, and no completed account cleanup. No ancestor/subtree membership inheritance and no new role. Existing DSR policy remains unchanged (current policy deliberately permits community participation).
- List combines existing collapsed management roots and directly joined small groups, deduplicated without hiding joined units under read-only ancestors. A managed ancestor may cover a joined group; retain existing management-root collapsing where covered.
- Preserve existing columns, including peer Email, per user requirement that the difference is ability to manage. Do not add personal profile or entitlement data. Preserve current roster self-exclusion for both modes to avoid unrelated behavior change.
- Non-managing folder responses have empty breadcrumb/children, omit parentId and redact entitlement policy values (required arrays remain [], required inheritance flag false). Existing manager responses remain unchanged.
- Folder action flags remain computed by existing scoped responsibility logic. Only directory and roster reads gain membership access; member detail, candidate searches, responsibilities, notification audiences and writes keep existing checks.
- Use per-unit actions to hide toolbar, settings, member name links, and full action column in read-only mode. Do not mount management dialogs without their corresponding capability. Name/search/pagination/responsible filter remain.
- Navigation presentation may use existing snapshot memberships of kind small_group, but all data APIs revalidate. No new API/schema fields or frontend-platform release, no new gateway routes.
- No production membership mutation during smoke. User authorized merge/release after clean reviews and green CI.

## Review focus
1. A manager in A who belongs to B must only read B, with no detail or write access.
2. URL guessing of parent/sibling/foreign church and membership revocation must fail closed.
3. Parent IDs, breadcrumb, children and management policy fields must not leak in read-only responses.
4. Existing management root collapse, self exclusion and privileges must stay unchanged.
5. Cached navigation, account switching, request failures and late responses must not grant data access.

## Task 1 — Operations read authorization
Files: internal/membership/service.go, internal/postgres/management_repository.go, relevant service/HTTP/PostgreSQL tests, README.md, openapi.yaml.
- [ ] Add red tests for direct-member roots/folder/roster; no actions or parent metadata; scoped denial and unchanged manager behavior.
- [ ] Add HasSmallGroupMembership(ctx, actorID, unitID) (bool,error) to ManagementRepository; implement a shared SQL eligible-member query used by this check and roots union. Validate active church ancestry and cleanup fence.
- [ ] Folder and roster first retain responsibility read check, then consult the narrow predicate if false; errors fail closed. Never change AuthorizeResponsibility or ManagementRead semantics.
- [ ] Union eligible small-group IDs with existing responsibility IDs for roots, preserving management ancestor collapse. Strip reader-only metadata before response; keep existing self exclusion.
- [ ] Integration tests: direct B reader; parent/sibling denial; membership removed, church ended, archived group and cleanup denied; dual role A/B; pagination/search/responsible filter; member detail and mutations denied. Existing management tests remain green.
- [ ] Document newly readable GET routes while writes remain responsibility-only. Run go test -race ./... -count=1 -p=1, go vet ./..., migration scripts and OpenAPI lint. PostgreSQL integration must run locally or in required CI (not be reported passed if skipped).

## Task 2 — WWW entry, copy and read-only rendering
Files: src/components/layout/AccountControl.tsx and tests; src/features/organizations/{OrganizationRootsPage,OrganizationUnitPage,messages} and tests; src/i18n/locales/*.json.
- [ ] Add red tests for snapshot direct member entry, no member entry without church membership, exact copy, roots View label, read-only DOM and unchanged manager DOM.
- [ ] Entry uses church membership AND (responsibilities nonempty OR memberships.some(orgUnit.kind === small_group)). Preserve existing subject-bound navigation caching and permission-unavailable behavior.
- [ ] Apply copy; remove paragraph DOM; use existing per-unit actions for manager controls/member links/action column/dialog mounting. Derive member-management availability from manageMembers/manageEntitlements without widening either.
- [ ] Run focused React tests, complete pnpm test:run, lint, build, perf:static, release-policy script. Required CI runs container build and vulnerability scans.

## Task 3 — independent reviews and delivery
- [ ] Two seats Codex/Gemini independently review plan before implementation; resolve substantive findings and record dispositions.
- [ ] Implement inline, then two seats Codex/Gemini review actual final diff. No unresolved important/critical issues; add regression checks for fixes.
- [ ] Open one PR per repo, attach both. Require successful complete CI for exact reviewed commits.
- [ ] Merge Operations first; wait for release and immutable revision/readiness verification. Only then merge WWW; wait for release and public health/route verification.
- [ ] Browser smoke where authenticated session available: nav/title/roots/read-only and manager UI, desktop/mobile. Do not fabricate real-member acceptance if session absent.
- [ ] Remove only task-created clean worktrees after successful release/smoke; primary checkouts remain untouched while dirty.

## Consultant dispositions
Initial Codex: narrow reads only, maintain per-unit scope, filter structural metadata. Accepted. Self-inclusion suggestion not adopted: preserve current self-exclusion as the smallest change.
Initial Gemini (gemini-4-argon-high, SUCCESS): per-unit action guards, IDOR/ancestor isolation, Email concern. Accepted boundary checks; Email remains per existing columns and user instruction; no extra profile fields exposed.

Plan review Codex: retain required policy fields as []/false in roots and folder; add mismatched-church/archived-ancestor negative cases; guard candidate effects and dialog mounting on fresh capabilities. All accepted.

Plan review Gemini: SUCCESS / clean; retain manager precedence on overlapping roots and verify existing snapshot membership filtering. Required-policy-shape correction from Codex is applied.
Execution note: Japanese retains existing 小グループ wording without 管理 to preserve current reviewed banner font subset.

## Execution evidence
- Operations full `go test -race ./... -count=1 -p=1` passed with dedicated PostgreSQL (not skipped); `go vet`, migration policy and OpenAPI lint passed (15 existing lint warnings).
- WWW: 161 files / 1,334 tests pass; lint has zero errors and one pre-existing warning; production build, perf:static and release policy passed.
- Codex implementation review: no Important/Critical findings. Requested extra ordinary-reader pagination/responsible-filter assertions; added to integration test.
- Gemini implementation review pending explicit private-code data-scope consent; no private diff sent.
- No new dependencies, migrations, gateway routes or client contracts. No production member/data mutation.
