# SDD ledger — plan: docs/superpowers/plans/2026-10-17-organizations-on-www.md

Execution: inline, as authorized by the user's explicit request to implement the agreed proposal. Written spec records the agreed in-chat design; no additional permission gate.

Pre-flight: Tasks 1→2 share useOrganizationsAccess/context and unchanged manager-client signatures. Task 2→3 shares localized route shapes. Tasks 1→4 share existing exact management/notification endpoints. All signatures align; no conflicts.

Starting bases: Account f0e1b74 (prior #118); WWW bf14c55 (latest origin/main 74c9877 plus prior #221); Gateway b6d3475. Primary checkouts and prior worktrees preserved. Native task-level worktree creation cannot select a repository in this non-Git workspace root (failure established earlier); manual Git worktrees used per repo.

Task 1: in progress — baseline focused suites started. No business API changes.

Tasks 1–2: feature/runtime and shell committed together because the authorized provider, route shell and header search form one coherent integration. Existing management/client tests migrated; access/nav/font failures observed before fixes. Final WWW suite 1302/1302, lint (one pre-existing warning), build, static budgets and release-policy passed. Explicit retry revalidates both Account session and Operations qualification; focus retains existing Account runtime behavior. Owner-keyed gate and scoped search discard previous private state.
Task 3: Account 64f1bd6 (+whitespace cleanup) removes UI/clients/catalog and retains safe redirects/resources/member eligibility. Full suite 552/552, lint/build/release policy passed. Legacy member-link integration verifies no profile/management mount and no query/hash transfer.
Task 4: policy tests exposed obsolete WWW blanket-denial and fragment-order assertions. Updated those assertions to the approved exact WWW allowlist; Admin denial remains. New JWT matrix passed (anonymous 401, service 403, human requests forwarded, lifecycle/private/admin denied). Go tests/vet and OpenAPI validation passed. Remaining existing runtime matrix is running.
Task 2: complete (commits 0a749ef..ec0281c, tests: python3 /Users/rayselfs/Projects/hhc/website/.task-evidence/organizations-on-www-20261017/run-pnpm.py exec vitest run src/components/layout/SiteHeader.test.tsx src/components/display-font.test.tsx src/features/organizations/OrganizationsShell.test.tsx src/features/organizations/OrganizationsSearch.test.tsx --maxWorkers=2 →    Duration  33.41s (transform 4.13s, setup 1.55s, import 19.21s, tests 18.89s, environment 15.29s))
Task 1: complete (commits 0a749ef..ec0281c, tests: python3 /Users/rayselfs/Projects/hhc/website/.task-evidence/organizations-on-www-20261017/run-pnpm.py exec vitest run src/features/organizations src/components/layout/AccountControl.test.tsx --maxWorkers=2 →    Duration  61.35s (transform 5.38s, setup 3.00s, import 47.42s, tests 33.88s, environment 28.53s))

Task 4: existing WWW, managed-lifecycle retirement and entitlement-batch Docker runtime matrices all passed. Account CI passed on 937d529. Gateway/WWW CI pending.
Final review: fresh gpt-6-astra reviewer completed one read-only whole-change review. Two Important findings (focus draft loss; 768px brand/navigation collision), plus duplicate unit h1. Regraded duplicate primary headings as accessibility Important: every screen-reader user gets an incorrect duplicate document landmark; covered by a single-heading regression. All four failing cases (three focus outcomes plus heading count) observed before fixes (review-red.log); 57/57 focused tests now pass. Tablet browser assertion failed before compact tablet header changes (tablet-red.log); browser verification pending new build.
Final: Ruling: existing #118/#221 product choices are not redesigned — their moved integrations remain covered; cost if wrong: later polish follow-up.
Final: Ruling: unchanged Operations/Engagement authorization and real delivery remain producer-owned — synthetic transport/matrix checks only, no live writes; cost if wrong: authenticated rollout smoke may expose upstream behavior.
Final: Ruling: production readiness remains unclaimed — no merge/release authorized; cost if wrong: release acceptance is still outstanding.
Final: Ruling: test-host capability matrix relies on shared WWW/test server/issuer/Dapr mapping plus existing environment-isolation checks — new human/service management matrix uses WWW; cost if wrong: test-host-only routing issue could await CI/release verification.
Task 3: complete in Account 64f1bd6..937d529; full 552 tests, lint/build/release-policy passed. Task 4: complete in Gateway 6382292; Go/vet/OpenAPI/static policy/new JWT and existing WWW/lifecycle/entitlement runtime passed. No business API changes.

## Final fix verification and limits

- Focus draft regression: all three same-owner outcomes preserve input while loading; allowed keeps it, revoked/failed unmount it. Duplicate primary-heading regression also passed. Focused fix suite 57/57.
- Tablet fit: initial Chinese overlap reproduced; translated English subsequently exposed right-side crowding. Final 768px assertions passed all five locales. Normal desktop/mobile roots also inspected at 1440/1024/390/320 with zero document overflow.
- Browser mocked APIs: root banner/list, member header search and applied query, unit toolbar below breadcrumb, terminal-unit kind column omitted, member deep link, notification draft after focus, mobile document bottom/footer reachable. Ordinary member redirects home with zero management requests and no management nav.
- Private route HTTP headers verified: Cache-Control private,no-store and X-Robots-Tag noindex,nofollow. No private SSR fetch or live mutation.
- Local post-review full suite had one timeout in unchanged WeeklyReader mobile-progress test (1305/1306 pass under concurrent builds); isolated WeeklyReader rerun passed 112/112. Latest 80e2a14 CI full-test step passed. This is recorded as an observed intermittent test, not a proven product regression or a bypass.
- origin/main advanced during verification to #222 (private-cover persistence). Merged that existing main change into this feature branch without conflict; its logout/owner cache cleanup is preserved. Integration tests and final CI follow this synchronization.
- No deferred review minors: duplicate-heading finding was treated as accessibility Important and fixed.
- PRs: Account #119 (depends #118), WWW #223 (depends #221), Gateway #175. No merge/release; rollout order remains Gateway → WWW → Account when separately authorized.
- Physical iPhone/Safari, real notification delivery and authenticated production smoke remain unperformed. New JWT management fixture targets production WWW; test-host isolation uses existing shared server/mapping/CI checks.

### Continuous-owner qualification boundary

The draft-preservation fix is limited to a continuous authorized owner. Additional regression checks reproduced stale qualification after anonymous → same owner, other owner → original owner, and permission unavailable → recovered. The session subscriber now clears that projection at each boundary; same-owner ordinary focus keeps the draft. Three RED cases observed; final access/header/moved-feature/private-cover integration suite passed 168/168. Final CI must run on this change; prior successful checks do not replace it.
