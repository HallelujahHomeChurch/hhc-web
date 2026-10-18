# Member Video Watch Experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans for inline execution, or superpowers:subagent-driven-development if the user selects delegated execution. Steps use checkbox syntax for tracking. User approved inline execution in this chat followed by independent final review.

**Goal:** Deliver one correctly ordered video library and accessible desktop/mobile watch, sharing and threaded-comment experiences.

**Architecture:** Extend the existing Website API, shared typed client and protected Gateway policy additively. Keep flat reply threads and existing watch URLs; reuse current player lifecycle and member authorization. Build small watch-page components around existing primitives rather than replacing the player or introducing a new service.

**Tech Stack:** Go, PostgreSQL, TypeScript, Next.js/React, CSS modules, existing HHC UI, Vitest/Testing Library, existing repository CI and container smoke checks.

**Spec:** `docs/superpowers/specs/2026-10-17-member-video-watch-experience-design.md` (user approved on 2026-10-17).

## Global Constraints

- Preserve member entitlement, legal acceptance, media grants, moderation, mutation idempotency, and privacy controls.
- Use the existing HHC design system and five locales.
- No channel, subscription, post, download, embed, notification, or public-access feature is added.
- No production data or infrastructure changes are authorized by this specification.
- Library order: live by actual start descending; announced scheduled by scheduled time ascending; published playable recordings by upload descending; deterministic recording-ID ties.
- With no live or scheduled items, render only recordings: no empty category headings or gaps.
- Top comments: visible like count descending, createdAt descending, ID tie-breaker; default Top; keep old newest/oldest clients working.
- Replies retain root parentId, one visual indentation level and explicit reply target.
- Do not log tokens, share media grants, or install a new dependency where existing primitives suffice.
- Production mutation/release approval is separate from plan approval. PR CI may never be bypassed.

## Review Focus

1. Scheduled pages containing only hidden/expired entries must not end the list or let recordings jump ahead (Task 2).
2. A comment's reaction score changes between pages: one traversal must not duplicate or omit otherwise-visible comments (Task 1).
3. A reply target is deleted/hidden after composer opens: fail safely without leaking its old identity and preserve the draft (Tasks 1, 6).
4. An iOS keyboard, rotated viewport or long localized author name must not hide submit/close controls or introduce horizontal scrolling (Task 7).
5. Polling or identity changes during an uncertain mutation must neither replay under another account nor discard the current account's draft (Tasks 5–7).

## Source findings and file map

Planning inspected fetched hhc-web `e3dd55a`, hhc-web-api `f5f5999`, and locally available frontend-platform/api-gateway origin/main. Refresh all remotes and record exact SHAs at execution; local checkouts contain unrelated changes and must not be reset or fast-forwarded while dirty.

- Web: `src/features/member-videos/MemberVideoZone.tsx`, `UpcomingBroadcasts.tsx`, `BroadcastWaitingPanel.tsx`, `LiveRecordingPlayer.tsx`, `VideoInteractions.tsx`, associated CSS/tests, `share.ts`, `api.ts`, `src/app/[locale]/member-videos/page.tsx`.
- API: `internal/recordings/{interaction,broadcast}.go`, `internal/postgres/{recording_interaction,recording_broadcast,recording_comment_moderation,bulletin_watermark}.go`, `internal/httpapi/{recording_interaction,recording_broadcast}.go`, `openapi.yaml`, additive SQL migrations and contract tests.
- Client: `packages/hhc-web-client/{openapi/hhc-web-api.yaml,src/client.ts,src/generated.ts,src/index.ts,src/recording-interactions.test.ts,src/broadcast-client.test.ts}`. Use the repository generator; do not hand-edit generated output.
- Gateway: `conf.d/api/www/42-recordings.conf`, `internal/verifier/handler.go`, `docs/{openapi.yaml,openapi_test.go,recording_interactions_test.go}` and runtime routing checks.
- New focused Web units: `VideoShareDialog.tsx`, `VideoInformation.tsx`, `VideoComments.tsx`, `VideoComments.module.css`, `video-library.ts`, and colocated tests. Keep orchestration in VideoInteractions; avoid extracting generic frameworks.

Current scheduled discovery pages the admin UUID-ordered collection and filters afterward. It has no search input. This must change at the owning backend before frontend ordering can be trusted. Current Gateway policy explicitly handles comment/report routes; a reaction route requires its own exact policy.

## Task 1: Comment contract, storage, ranking and privacy

**Files:** API interaction domain/repository/HTTP files above; `internal/postgres/recording_interaction_test.go`, `internal/recordings/interaction_test.go`, `recording_interactions_contract_test.go`; new `internal/postgres/recording_comment_ranking.go` and test; next available additive migration named `*_recording_comment_experience.sql`; `internal/postgres/bulletin_watermark.go`; `docs/video-interactions-and-metrics.md` and privacy documentation.

**Interfaces:**
- InteractionSummary adds `commentCount: int64`.
- Comment adds `likes: int64`, `reaction: "like" | "dislike" | null`, optional `replyTo: {id, displayName}`. Do not expose account IDs.
- CommentInput adds optional `replyToId`; parentId remains the root comment. Existing inputs remain valid.
- `PUT /api/member/recordings/{id}/comments/{commentId}/reaction`, body `{reaction: "like" | "dislike" | null}`, returns `{likes, reaction}`.
- `order=top` is additive to existing newest/oldest; top uses an opaque bounded cursor; existing UUID cursors remain supported for old orders. Invalid/foreign cursors return 400. Expired top traversal returns 409 with code `recording_comment_cursor_expired`.

- [ ] Write failing tests `TestCommentVisibleCount`, `TestReplyTargetSameThread`, `TestCommentReactionDesiredState`, `TestTopCommentSnapshotPagination`, `TestCommentReactionPrivacy`. Assert count includes visible non-deleted roots/replies; hidden-root descendants are excluded; repeated like remains one vote; dislike replaces like; null removes it; deleted/hidden/cross-recording targets fail; changed scores cannot reorder an existing traversal; foreign account/recording cursor fails; expiry is explicit.
- [ ] Run `go test ./internal/recordings ./internal/postgres ./internal/httpapi -run 'Comment|Interaction' -count=1` against disposable local PostgreSQL; confirm the new assertions fail, not merely a database connection error.
- [ ] Add reaction storage keyed by comment/account with constrained reaction values and account lookup index. Add nullable same-thread reply target with server validation. Allocate migration number only after refreshing main; no historical migration edits.
- [ ] Implement desired-state updates under existing entitlement, publication, comments-enabled and subject-write checks. Return current counts; concurrent updates cannot produce duplicate votes. Preserve old create payload hashing for omitted new fields so retried pre-upgrade mutations still match.
- [ ] Implement a bounded-lifetime ranking snapshot: server-generated random UUID, account/recording-bound metadata, 15-minute expiry, and ordered comment IDs/ordinals captured in one transaction. Store no body/name or cached visibility. Page by ordinal, recheck current visibility and continue scanning hidden holes until the page is full or exhausted. New comments appear on explicit refresh. Keep at most one active top snapshot per account/recording by reusing it during its lifetime; explicit refresh replaces it. Add optional `refresh=true` only for initial top requests and reject it with a cursor or other orders. Cursor identifies snapshot and next ordinal; all components are validated against stored ownership.
- [ ] Purge expired snapshots through the existing reconciliation lifecycle, with bounded batches and an expiry index; replacement and erasure also remove owned snapshots. Cap initial top page size at existing maximum 50 and preserve existing default 20. Do not silently truncate comment population to an arbitrary rank limit. Test cleanup and concurrent refresh/expiry.
- [ ] Resolve reply-target display names at read time using existing batched identity lookup, only for visible/non-deleted targets. Do not cache deleted identities in child rows. Normalize replyCount and commentCount visibility rules together; update moderation scanners for new projected fields without breaking Admin.
- [ ] Extend the owning subject export, erase and private-count coverage for reactions and snapshots. Trace existing export assembly from watermark handlers before patching; reuse existing versioned coverage mechanism if adding a dataset requires it. Test export completeness, erase retry, subject restriction, and removal of reply-target identity after erasure. Keep new write features unavailable until privacy coverage is verified; no separate policy publication in this task.
- [ ] Update API OpenAPI and contract fixtures, rerun focused tests then `go test -race ./... -count=1 -p=1` and `go vet ./...` with the CI's disposable PostgreSQL environment. Commit only this task's files on the API task branch.

## Task 2: Ordered, searchable scheduled discovery

**Files:** API `internal/recordings/broadcast.go`, `internal/postgres/recording_broadcast.go`, `internal/httpapi/recording_broadcast.go`, corresponding tests and `openapi.yaml`.

**Interfaces:** Existing member broadcast list gains optional `q` (same single-value 100-character search validation as recording search); response remains `{items,nextCursor}`. Member-only repository selection is independent of the admin list; cursor is opaque and tied to the normalized query. Ordering uses scheduledAt ascending and recording ID ascending. Missing scheduledAt entries do not masquerade as scheduled broadcasts.

- [ ] Add `TestUpcomingMemberOrderingAndSearch`: three scheduled pages with UUID order opposite chronological order, hidden/revoked/expired items, duplicate schedule times and search matches only on later pages. Assert filtering happens before page limit and every visible match is traversable.
- [ ] Run `go test ./internal/recordings ./internal/postgres ./internal/httpapi -run 'Upcoming|Broadcast' -count=1` and observe the targeted failures.
- [ ] Add a member-specific query for announced waiting phases, current recording visibility, non-null scheduled time and full-dataset search. Preserve admin enumeration. Use a keyset of scheduled time/ID, reject query-mismatched cursors, and keep watch resolution as the authority before returning a card; scan past entries that change state during resolution.
- [ ] Test an item starting between list and watch resolution, cancellation during paging, empty filtered pages with remaining candidates, and an unavailable authorization dependency. Never convert a dependency failure into an empty-success list.
- [ ] Rerun targeted tests, update contract fixtures and commit on the API branch. Task 1 and Task 2 may share one focused API PR but both test gates are required.

## Task 3: Shared client and exact Gateway policy

**Files:** Client and Gateway paths in the file map; package version/lock files as required by release policy. Read their AGENTS.md and workflows in the isolated checkouts.

**Interfaces:** Client exposes `setRecordingCommentReaction(id, commentId, {reaction}, signal?)`; extends existing RecordingComment/InteractionSummary types, comment ordering/options (`top`, `refresh`), create input (`replyToId`) and member broadcast options (`q`). Preserve existing methods/signatures compatibly.

- [ ] Add client tests asserting exact reaction method/path/body, explicit null handling, URL encoding, opaque cursor forwarding, refresh constraints, reply target, count decoding and query forwarding. Add Gateway tests asserting WWW-only authenticated PUT reaction; reject anonymous, other hosts, HEAD/POST and malformed IDs, and strip forged identity headers.
- [ ] Run client `corepack pnpm test` and Gateway `go test ./...`; confirm the new contract/policy tests fail before implementation.
- [ ] Update source OpenAPI and regenerate client types using existing scripts. Add the exact Gateway location and verifier policy following report-route protections, rate limits, no-store, bounded body and allowed-method rules; do not broaden a wildcard path.
- [ ] Pass client `corepack pnpm test`, `lint`, `build`, `pack:packages`, `test:consumers`; pass Gateway Go tests and existing recording runtime script with its documented disposable image/issuer fixture. Run all required repository CI jobs through PRs.
- [ ] Commit client and Gateway separately. Publish only the approved shared-client release, then pin its exact version in Web; record the selected version in release evidence. No fabricated version number in this plan.

## Task 4: One library with correct category pagination

**Files:** Web `MemberVideoZone.tsx`, `UpcomingBroadcasts.tsx` and tests, `video-library.ts` and test, `api.ts`, `src/app/[locale]/member-videos/page.tsx`, `MemberVideoZone.module.css`.

**Interfaces:** `mergeVideoLibrary(live, scheduled, recordings)` returns ID-deduplicated display items with precedence live > scheduled > recording. Scheduled loading uses Task 2 query/options. The existing watch URL is unchanged.

- [ ] Write `video-library.test.ts` fixtures: expected IDs `[liveNewest, liveOlder, scheduledSoon, scheduledLater, vodNewest, vodOlder]`; recordings-only equals the recording list; duplicate IDs appear once; failed/ended live entries do not get a live badge.
- [ ] Add component tests for two scheduled pages before recording append, scheduled-fetch failure with retry, search filtering from backend, polling transition and preservation of loaded VOD pages. Add route test that legacy upcoming query returns the normal library while preserving valid q and locale.
- [ ] Run `corepack pnpm exec vitest run src/features/member-videos/MemberVideoZone.test.tsx src/features/member-videos/video-library.test.ts` and confirm intended failures.
- [ ] Replace upcoming-only mode with scheduled cards in the existing grid. Remove all-upcoming navigation and obsolete prop/state/tests; preserve reusable cover and waiting UI. Fetch next scheduled page before exposing the next recording page. Do not show a false empty library while scheduled discovery is pending/failed.
- [ ] Use actual live start metadata, not an assumed capture creation time; if current producer omits it, add the optional actual-start field through Tasks 2–3 using the existing lifecycle timestamp. Reconcile active-category refreshes without restarting playback, repeating cards, or discarding loaded recordings. Reset traversal only for search/identity changes.
- [ ] Pass feature tests and commit. Retain existing load-more UX and recommendations layout.

## Task 5: Sharing and unified information card

**Files:** Web `VideoShareDialog.tsx` and test, `VideoInformation.tsx` and test, `share.ts` and test, `VideoInteractions.tsx`, `MemberVideoZone.tsx`, `LiveRecordingPlayer.tsx`, `BroadcastWaitingPanel.tsx`, feature CSS and locale resources.

**Interfaces:** `VideoShareDialog({open,onClose,title,watchUrl,currentTime?,durationSeconds?})`; `VideoInformation({description,date,dateKind,metrics,locale})`, dateKind is `uploaded|live|scheduled`. Reuse house dialog/menu primitives after inspecting their exported API; do not replace player refs or authorization.

- [ ] Test dialog open/close/focus, platform encoding, clipboard success/failure, absent navigator.share calls, and removal of unrelated parameters. Test m:ss and h:mm:ss input, zero, non-finite, negative, over-604800 seconds and known duration boundary; invalid input blocks copying/sharing rather than silently sharing another time.
- [ ] Test collapsed description preview, exact expanded date, safe http/https links, escaped HTML, unavailable/not-started/zero metrics, long URL wrapping and no player remount on expansion.
- [ ] Run focused Vitest files and observe intended failures.
- [ ] Implement opt-in time parsing and canonical URL construction using existing integer t contract. Snapshot current position when dialog opens; all platform buttons and Copy consume the same validated URL. Live/waiting omit time controls. Close/reset on account or recording change.
- [ ] Render title/actions/card/comments consistently for relevant watch states; remove duplicate dates and the external time checkbox. Add pointer only to enabled controls, accessible names and status feedback. Share canonical HHC URLs, never media URLs. Use localized UI strings in all five supported locales.
- [ ] Pass focused feature tests and commit.

## Task 6: Desktop comment experience and flat targeted replies

**Files:** Web `VideoComments.tsx`, `VideoComments.module.css`, tests; `VideoInteractions.tsx`, `api.ts`, locale resources.

**Interfaces:** VideoInteractions owns summary/metrics; VideoComments receives recording ID, authorization-scoped API, commentCount/commentsEnabled and a callback to refresh summary. Use Task 3 reaction/reply interfaces. Keep mutation and draft state above presentation-specific containers.

- [ ] Add tests for count including replies, Top/Newest selection, chronological replies, initial/loading/disabled/error states, and cursor-expiry UI offering explicit refresh without discarding a draft.
- [ ] Add tests for replying to a reply: POST has root parentId plus clicked replyToId; visual indentation stays one level. Test target disappearing while composing, own Edit/Delete versus Report, revision conflicts, repeated uncertain create retry using the same mutation ID, reaction desired-state retries and account switch cancellation.
- [ ] Run `corepack pnpm exec vitest run src/features/member-videos/VideoComments.test.tsx` and observe failures.
- [ ] Move existing comment implementation into the focused component while preserving error handling. Add relative times/exact-date access, avatar fallback, edited indicator, more-menu operations, long-comment expansion, reactions, reply-target label and reply fold controls. Do not invent public profile/avatar URLs or author IDs absent from the contract.
- [ ] Default root order Top; sort changes start a new traversal but preserve unsent text. Poll count independently, never reload the entire thread on every metrics poll. Mutations update their row and visible counts; explicit refresh requests `refresh=true` and replaces ranked pages.
- [ ] Test and commit; existing moderation, deletion, idempotency and comment-closure behavior must still pass.

## Task 7: Mobile sheet and browser acceptance

**Files:** Web comment/share/information CSS and components; colocated accessibility tests; `docs/release-evidence/member-video-watch-20261017/` for screenshots and a concise result matrix.

- [ ] Add tests for opening/closing the sheet, focus restoration, Escape, retaining draft/reply state across sheet and viewport changes, cancelling requests on account change, and no duplicate live form IDs.
- [ ] Implement one shared comment state with responsive desktop inline/mobile bottom-sheet presentation. Use existing project breakpoints/primitives. Bound height by dynamic viewport, respect safe-area insets, keep header/actions reachable, contain sheet scroll and wrap long content. Avoid two mounted composers or background focus access.
- [ ] Run feature tests, then inspect browser layouts at 320, 375, 390, 768, 1024 and 1440 CSS px and 200% text zoom. For each, assert document scrollWidth does not exceed clientWidth, and manually verify menu, dialog, nested replies, long author/URLs and disabled/error states.
- [ ] Verify keyboard-only and screen-reader labels/focus order; open and close the mobile keyboard, rotate and change viewport, submit a long reply and retry an error in local fixtures. Keep the player mounted and playing while opening comments/share/info.
- [ ] Capture genuine local screenshots and record real-device availability. Run physical iOS Safari and Android Chrome keyboard/safe-area checks when devices are available; otherwise explicitly leave these acceptance items unverified. Do not claim emulation is physical validation.
- [ ] Commit responsive fixes and evidence without personal member content.

## Task 8: Integrated verification, review and authorized delivery

**Files:** All changed repository workflows (read, do not bypass) and Web evidence directory.

- [ ] At execution start create or reuse suitable isolated worktrees from freshly fetched origin/main for each affected repository; read service AGENTS/README, relevant installed Next.js docs and UI skill instructions. Record clean baseline or explain baseline failures before proceeding. No changes to existing user worktrees.
- [ ] Run Web `corepack pnpm test:run`, `corepack pnpm lint`, `corepack pnpm build`, required Docker build using existing secret mechanism. Run the API full CI test/vet/migration/OpenAPI/image checks, shared-client consumer checks and Gateway runtime matrix. A skipped PostgreSQL suite is not a pass.
- [ ] Review end-to-end entitlement, comment privacy/moderation, lifecycle transitions, cursor bounds/cleanup and backward compatibility; fix findings and rerun only affected checks plus required CI.
- [ ] Open and attach one PR per affected repository. Record exact dependency versions, migration names and CI results. Keep current main checkouts untouched while dirty.
- [ ] Present concrete release preview for approval: API additive migrations/new contracts first; Gateway policy and published client next; Web consuming the exact client last. Existing clients keep working throughout. Shared-client publication must follow its tag workflow, not an assumed merge-only release.
- [ ] After explicit release approval, merge through passing CI and verify deployed revisions, health/readiness and relevant authenticated routes. Use synthetic/local comments for acceptance until a real test account and bounded production writes are explicitly authorized.
- [ ] Rollback frontend first if UX fails; preserve additive migrations and reaction data. Do not roll back the API beneath an active dependent frontend. Follow each repository's release rollback process, never ad hoc deployment.
- [ ] Remove only task-created clean worktrees after merge, successful release and smoke verification; delete branches only once their commits are included in origin/main. Otherwise preserve them and record follow-up work.

## Dependency and review handoff

Execution sequence: Task 1 → Task 2 → Task 3 → Task 4 → Task 5 → Task 6 → Task 7 → Task 8 release gates. Worktree/baseline step from Task 8 occurs before the first implementation task. Independent preparation is possible, but do not concurrently edit overlapping files across agents.

Recommended execution: inline in this chat, with whole-change independent review at the end if authorized. Four repositories share tightly coupled contract decisions; keeping the implementer continuous avoids mismatched interfaces. Delegated task-by-task execution is an alternative if the user prefers it.

Self-review: every spec section maps to Tasks 1–8; all five review-focus conditions have explicit tests; existing permissions/player/DSR are preserved; mobile physical acceptance and production writes are explicitly gated. Plan and inline execution were approved by the user. This document does not claim tests, migration rehearsal, release or live acceptance have run.
