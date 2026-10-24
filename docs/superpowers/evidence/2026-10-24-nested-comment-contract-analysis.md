# Nested recording comments: contract analysis

Date: 2026-10-24. Status: read-only design evidence; no product implementation.

The requested nested presentation can reuse the stored root-thread and reply-target relationships. It cannot be implemented correctly by grouping whichever replies happen to be loaded in the browser: whole-thread totals, branch totals and avatar previews require an explicit server contract. Direct-child pagination is a proposed transport mechanism; it is not the meaning of a YouTube reply label.

## Scope and immutable source evidence

| Repository | Inspected revision | Scope |
| --- | --- | --- |
| hhc-web | `6d37ad19e1fe85cbc21256d791f0134e91c759c8` | Current flat comment caller and avatar preparation |
| hhc-web-api | `f67e12135e8b3eb430107f4a42dd9aaeb3cd1cf8` | Domain, HTTP, SQL, moderation, privacy cleanup and contracts |
| frontend-platform | `2e58d00122a753492481a0898b8bd8d769aafdb8` | Published-client source, OpenAPI copy and tests |
| hhc-planning | `73ee1af2a1ff828d72421a73626f45ff4ce04a6f` | Shared entry documents read through the authorized immutable fallback |

API and package `origin/main` refs were refreshed for this analysis. Existing checkouts, branches and unrelated changes were preserved. These source revisions do not establish deployed revisions or production data shape.

Only this human-readable evidence file is written. No application, database, Dapr, provider or production runtime is required for this analysis. No engineering issue, PR, package publication or deployment is created.

## Current semantics that must remain compatible

1. `parent_id` stores the root thread, never the immediate reply parent. Creation rejects a non-root `parentId`; a targeted reply still sends `parentId=root` and `replyToId=target`. The target must belong to the same recording and root thread and be non-deleted/non-hidden. See API `internal/postgres/recording_interaction.go:156-177`.
2. `reply_to_id` already exists as an optional UUID FK with `ON DELETE SET NULL` in migration 103. Migration 097 provides the root `parent_id` FK and the `(recording_id,parent_id,created_at,id)` paging index. No new parent column or data rewrite is required for adjacency.
3. Untargeted historical replies have `parent_id=root, reply_to_id=NULL`; their direct parent is the root. Targeting the root explicitly has the same position. A reply to another reply has that reply as its direct parent while retaining `parent_id=root`.
4. The stored direct edge is therefore `COALESCE(reply_to_id,parent_id)` for non-root rows. Both IDs refer to server-owned comment rows. The browser must not infer a missing edge from display names or a partially fetched page.
5. `replyTo` in the response contains only `id` and display name. Decoration omits the entire object when the target is hidden/deleted (`recording_comment_ranking.go:26-54`); it is a safe presentation hint, not a durable structural-parent contract.
6. The existing `replyCount` subquery counts all non-hidden, non-deleted rows whose stored `parent_id` equals the comment ID (`recording_interaction.go:110`). It is a whole-thread count on roots and zero on replies. Changing it to a direct-child count would silently change old-client behavior.
7. `GET .../comments?parentId=root` returns the flat whole-thread page, oldest/newest using `(created_at,id)` keyset order. Root Top uses a separate per-account, 15-minute ranked snapshot. Existing query validation rejects unknown or repeated query parameters.
8. Root hiding removes the whole thread from member reads/counts. Hiding a non-root reply currently removes that row and its reply-target identity, but does not hide other replies in the root. Soft deletion retains a scrubbed placeholder and does not delete other members' replies. These are existing business behaviors, not automatic subtree-moderation rules.
9. A visible reply beneath a deleted root remains replyable; targeting the deleted root itself is rejected. An acknowledged mutation replay is resolved before current-target validation, so retrying the original mutation remains valid after target deletion. Preserve that order.

Current model and HTTP evidence: `internal/recordings/interaction.go:18-61`, `internal/httpapi/recording_interaction.go:102-169`. Existing compatibility/privacy cases: `internal/postgres/recording_comment_experience_test.go:13-99` and `recording_interaction_test.go:160-219`.

## Recommended additive query contract

Use the existing member GET route with one explicit opt-in, provisionally named `view=threaded`. Naming is an implementation choice; the compatibility distinction is required.

| Request | Meaning |
| --- | --- |
| No `view` | Exact existing flat behavior and response shape |
| `view=threaded`, no `parentId` | Root page, with the existing Top/Newest behavior and new branch summaries |
| `view=threaded&parentId=<node>` | Direct children of that root or reply, independently paginated |

In threaded query mode, `parentId` identifies the expanded node. In the response, legacy `parentId` continues to identify the stored root. Document this distinction explicitly; do not reinterpret the stored field. Validate the expanded node, resolve its root, and prove both belong to the requested recording before querying children.

Return optional fields only for opted-in list responses:

- `threadParentId`: the structural direct parent for a non-root node. It is separate from `replyTo`, so anonymizing a deleted target does not destroy navigation. It is omitted on roots.
- `directChildCount`: the count of rows renderable immediately beneath this node, under the agreed placeholder/visibility policy. It must match the direct-child query, across all pages. This is paging/expandability metadata, not automatically the displayed reply total.
- `descendantReplyCount`: a possible separate count of actual visible non-deleted replies anywhere below a non-root node. Its use for a non-root label remains pending reference/semantic confirmation; do not substitute `directChildCount` or invent an exact total from a partial page. Root labels retain the existing whole-thread `replyCount`.
- `replyPreviewAuthors`: at most three distinct visible direct-child authors, in deterministic child order, each containing only `displayName` and optional current `avatarUrl`. Do not expose account IDs or email addresses. Empty/missing avatar uses the house fallback.

A structural placeholder counts as a renderable child if the agreed policy returns it. Keep the existing member-wide `commentCount` and root `replyCount` as counts of actual visible non-deleted comments. Display the root toggle from `replyCount`, never `directChildCount`. Branch expandability can use direct-child metadata independently of a displayed descendant total; a zero real-comment total must not hide traversable placeholders. If the final DTO does not include renderable direct-child counts, supply a separate `hasChildren` indicator.

Keep POST/PATCH/DELETE response shape and creation input unchanged. After a mutation, the new frontend refreshes the affected branch summaries/list; it already has a reconciliation path. Do not append new fields unconditionally to legacy responses: both OpenAPI copies currently use `additionalProperties:false` and some consumers may validate against them.

Update the API OpenAPI source, the package's copied OpenAPI, generated TypeScript and the existing client options together. New properties are optional at the shared-type level because flat callers and mutation responses omit them; the opted-in UI should require the threaded metadata at its boundary rather than inventing counts when absent.

There is no new endpoint or HTTP method in this proposal. Gateway query forwarding/validation should still be checked during implementation; a route-shaped argument alone is not proof of query compatibility.

## Pagination, order and depth

Use default 20 / maximum 50 for a direct-child page, matching existing limits. Each paginated branch retains its own items, next cursor, pending/error and expanded state. Expanding one branch does not exhaust or refetch its siblings. Hide/show retains already loaded state and drafts; only explicit refresh or recording/account change resets the corresponding traversal.

The coordinator inspected the live [YouTube reference video](https://www.youtube.com/watch?v=TG8Iu6zUycs) on 2026-10-24: a collapsed root showed 3 replies; opening it displayed two first-level replies and one second-level reply, three replies in total. This observation confirms that the root label is a whole-thread total, not a direct-child count of two. It also shows multiple levels visible after that root expansion. It does not establish that every nested branch on YouTube always begins open or closed. The accepted HHC requirement is that each level can expand/collapse; initial expansion state must follow the concrete reference behavior.

Separate expansion state from network shape. A bounded initial subtree or batched descendant groups may be returned with a root expansion, then individual branches can continue paging. Direct-child queries remain useful but must not force an initially closed secondary level when the reference shows it. Any preloaded groups need explicit structural parents and branch completion/cursors; a payload containing some descendants is not proof that the whole subtree is loaded. Avoid unbounded recursive fetches or one automatic request for every node.

Keep root Top/Newest and the current Top snapshot rules. Direct-child pages use chronological `(created_at,id)` order, matching the existing reply experience. A bounded initially expanded subtree must preserve the agreed per-branch order. Do not add per-level popularity ranking or an unbounded full-tree download.

A UUID cursor can remain small and compatible with the existing chronological lookup approach. In threaded mode the cursor row must be scoped to the same recording, root and direct-parent relationship; reject a cursor from a sibling branch instead of accepting it as an empty page. If its boundary is physically missing or no longer valid, use the existing cursor-expired/refresh behavior for that branch. Never reuse a root Top snapshot cursor as a branch cursor. All requests still perform current entitlement/visibility checks; a cursor grants no authority.

Current writes have no logical reply-depth cap: every new row can target an existing visible row in the same root. Since edges are immutable and a new row targets an existing row, the API construction path cannot create a cycle. Keep this write behavior unless the user asks for a hard conversation-depth limit.

The stored root shortcut allows a direct-child request to use one indexed hop without recursive SQL or loading its ancestors. That shortcut does not compute a non-root descendant total. Bounded page/subtree loading is the resource bound; data depth, initially expanded levels, the number of opened UI branches and visual indentation are separate. Clamp visual indentation to the space demonstrated by the desktop/mobile references without silently flattening semantic parentage. A visited-ID guard should reject malformed/cyclic response traversal. If exact descendant counts or a moderation policy require recursive traversal, detect cycles and apply a measured work bound; do not silently report a truncated result as an exact total or introduce a new write rejection to solve a layout problem.

## Deleted or hidden intermediate targets: accepted product decision

The user has accepted nested replies, per-level expansion, connectors, preview avatars and anonymous structural placeholders when an intermediate node is deleted or hidden. Descendants remain in position. Placeholders do not contribute to visible comment/reply totals; a separate traversable-child indicator is required when visible counts alone cannot express expandable structure.

Role clarification, verified from the current API and Admin sources: staff moderation supports settings/hide/restore/resolve under `cms:recordings:write`, while member deletion is author-only. Admin `6946e77112e59c457cfb3027822e37a11d681af3` mounts its existing `RecordingComments` UI in the recording detail page; it has no delete-other-comment control. Keep that authorization split. Hiding preserves stored content for authorized moderation and restoration; redact the member projection without erasing the hidden body. No new administrator-delete operation is in scope.

For deletion, use the accepted anonymous structural placeholder retaining the existing replies in position. Scrub body, author identity, avatar and reply-target presentation exactly as today. A root placeholder remains traversable. A deleted target cannot receive a new reply, but its visible descendants remain replyable.

For moderation, preserve the current root rule: hiding a root hides the entire root thread. For a hidden non-root target, preserve the independent replies beneath an anonymous structural placeholder. Promotion to the root was not selected. Do not introduce subtree hiding.

The accepted placeholder policy keeps the stored edge/index simple and avoids relocating discussions. It reveals the existence of a removed node while omitting its original content and identity. Required invariants:

- No removed body, name, avatar or mention metadata may reappear through previews, counts, stale target objects or cached profile lookup.
- Counts, preview selection and list rows use exactly the same root/branch visibility predicate.
- Root hide must suppress the thread even if a caller directly requests a known descendant ID.
- Restore must recompute presentation without duplicating or dropping rows between branches.
- A soft delete/erasure must not cascade-delete another member's reply. Existing `parent_id` and `reply_to_id` FKs remain unchanged.

Root reply labels continue to exclude deleted/hidden comments and use the legacy whole-thread total, as both current HHC SQL and the observed YouTube root example support. Anonymous placeholders are excluded from visible totals by the accepted policy. Do not ask the user to choose either rule again. Non-root label scope remains to be matched to the reference; confirm only genuinely unresolved visible semantics. No question is needed about SQL field names or internal index names.

## Persistence and query plan

Keep the existing comment table, immutable migrations 097/103, root paging index and creation payload. Add one new additive migration for a direct-edge paging index, conceptually:

```sql
CREATE INDEX recording_comment_direct_children_idx
ON hhc_web.member_recording_comment
  (recording_id, (COALESCE(reply_to_id,parent_id)), created_at, id)
WHERE parent_id IS NOT NULL;
```

This is a proposed index shape, not executed SQL. Choose the migration number from the latest main at implementation time. Existing migration/release policy owns lock/build strategy; do not alter a published migration or run ad hoc production index creation.

Use that same direct-edge expression for the raw-child query. Resolve node/root through primary-key lookup, then query only the expanded edge. Batch direct-child summary/preview enrichment for the returned page with indexed lateral/aggregate queries. A bounded initial subtree can batch several edges; this query plan must follow the initial visible expansion confirmed by the reference. Do not issue one HTTP/database request per child, scan all comments into the browser, add a closure table, persist denormalized counts, or store profile copies in comments.

Current comment SQL has no recursive descendant-count query. The existing root total is cheap to express through `parent_id=root`, independent of nesting. Exact totals below a non-root node require following the stored direct edges, for example a recursive CTE seeded with the relevant returned node IDs. The proposed edge index helps each traversal step but does not make a transitive count a one-hop operation: work scales with the visited subtree, and batching overlapping ancestor seeds can revisit the same descendants. Bound seed/page size, measure broad and deep fixtures with EXPLAIN on a disposable database, and keep root totals on the existing root index. Do not add precomputed counters/paths before those measurements. If a work/depth guard fires, omit/mark the optional descendant total unavailable or return a typed error; never emit the capped count as exact. This recursive-count cost applies only if the confirmed non-root label or preview scope needs descendants, not to ordinary direct-child paging.

If the user chooses promotion of hidden targets, revise the effective-parent SQL and its plan before implementation. A bare COALESCE index does not by itself implement dynamic reparenting based on another row's current visibility.

Root totals, any confirmed descendant totals, direct-child counts and previews should be derived under consistent visibility and snapshot rules where practical. Include current recording/root visibility predicates in returning SQL, rather than relying only on a prior validation query. Test concurrent hide/create/restore with the existing publication, settings and subject fences.

### Identity lookup bound

`internal/accountclient/client.go:34-35` rejects batches above 100 IDs. Current maximum 50 comments plus 50 reply targets already reaches that bound. Three preview authors per returned node can raise the worst-case distinct profile set to 250.

Reuse `commentAuthorCache` but deduplicate and resolve at most 100 IDs per batch under a bounded shared lookup deadline. Do not increase Account's limit, issue one lookup per avatar or let an oversized batch silently turn the whole page into fallback identities. Preserve its 60-second presentation-only cache, cancellation/singleflight behavior, no email caching and failure fallback. A partial profile failure must not change content visibility or branch counts.

DSR cleanup currently scrubs comment author/body while retaining structural rows (`internal/postgres/bulletin_watermark.go:478-487`). Preview authors are derived only from still-visible, non-deleted child authors after that scrub. The proposal adds no persisted account dataset or profile cache in the browser; retain existing export/erasure and account-switch fences and test that previews cannot re-identify an erased node.

## Authorization and compatibility checklist

- Keep human member entitlement, legal acceptance, Gateway/Dapr caller and trusted-identity checks, feature gate and private/no-store responses.
- Use the existing interaction transaction and subject write fences; preserve closed-comment checks, target locks, mutation hash/idempotency and optimistic revisions.
- Reject foreign recording/root/parent/cursor IDs without leaking content or author metadata.
- Keep reaction/report/edit/delete ownership and moderation scope behavior. Adding a tree read does not grant authority to mutate a target.
- Legacy flat queries, root `replyCount`, chronological cursors, Top snapshot traversal and admin moderation payloads remain unchanged.
- Opt-in lists do not return strict-schema additions to old clients. Optional fields alone are not sufficient compatibility if the server emits them to every legacy request.
- Producer release precedes SDK publication and consumer rollout. Rollback of the frontend can use the legacy API view; rollback of the API must not remove stored relationships or a harmless additive index. A new frontend must not fall back to guessed nested counts on an older API.

## Implementation surface and acceptance

API: `internal/recordings/interaction.go`, HTTP query/DTO enrichment, `recording_interaction.go`, `recording_comment_ranking.go`, additive index migration, API OpenAPI and corresponding domain/HTTP/PostgreSQL/schema tests. Preserve the older repository interface by adding a focused threaded-read capability if needed, rather than breaking every existing repository test double.

Package: `packages/hhc-web-client/openapi/hhc-web-api.yaml`, `src/generated.ts`, `src/client.ts` and `src/recording-interactions.test.ts`. Bump/publish an exact compatible package only in an authorized implementation delivery. No shared UI package or Account API schema change is needed for the proposal.

Web: existing API adapter/client version, `VideoComments.tsx`, avatar/body CSS and skeleton, per-node state, preview-avatar preparation and tests. VOD/live/waiting already share `VideoInteractions`. Keep the player and one composer state mounted across responsive presentations; this contract does not require a second mobile draft tree.

Required focused cases after implementation:

1. Historical null target, explicit root target, reply-to-reply and at least three semantic levels; more than one page at two separate branches; equal timestamps; no sibling cursor reuse; root Top ranking remains stable.
2. A root with two first-level replies plus one second-level reply displays 3, while `directChildCount` remains 2; any confirmed non-root descendant total is tested separately. Counts/previews include relevant rows not yet fetched; initial root expansion reproduces the observed visible levels and each remains collapsible. Test deduplicated author previews, zero/avatar-missing cases, 50 parent rows with more than 100 distinct resolved identities and no account IDs/emails in member output.
3. Intermediate deletion/hide/restore, hidden root/direct descendant lookup, deleted root with visible descendant, erased author and physical cursor loss; no orphaning or removed identity leakage under the agreed policy.
4. Concurrent posting/close-comments/moderation, lost create response with the same mutation identity, target deletion between attempts, cross-recording and foreign-thread targets/cursors.
5. Existing flat clients and strict schemas, old/new SDK options, admin moderation, reactions/report permissions, privacy export/cleanup, account switch and request cancellation.
6. Web draft and pagination preservation across each collapse/reopen, mobile panel back/close, desktop/mobile resize and unrelated count polling; connector geometry, preview avatars, long text/five locales, 200% zoom and real-device keyboard gates.

Repository-required Go/policy/database/contract checks, SDK package/consumer checks, Web tests/lint/build/performance checks and final-head CI remain required in implementation. This note executes none of those checks and claims no migration rehearsal, production counts, query-plan timing, deployment or device acceptance.

## Questions versus engineering decisions

Intermediate deletion/hiding and placeholder exclusion from totals are accepted. Root label meaning is settled as the whole-thread total. Ask only about a genuinely unresolved non-root reply-label scope where reference evidence cannot settle it. Mobile thread-panel navigation, initial visible expansion and precise proportions are owned by the main UI reference analysis; do not assume every nested level initially closes just because direct-child pages are fetched separately.

Choose the remaining details from the repository: opt-in parameter/DTO names, direct-edge index, per-page limits matching the existing contract, oldest branch order, batch size 100, profile timeout/cache reuse, migration number, tests and producer-before-consumer sequencing. A new maximum write depth, popularity algorithm or subtree moderation action is not necessary for the accepted layout scope.
