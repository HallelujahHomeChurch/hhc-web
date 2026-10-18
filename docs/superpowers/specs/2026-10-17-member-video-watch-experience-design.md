# Member video library and watch experience

Date: 2026-10-17
Status: Approved by the user on 2026-10-17. Library ordering, mobile YouTube-app alignment, and flat reply threads are confirmed.

## Outcome and scope

Make the member video library and watch page coherent on desktop and mobile. Preserve member entitlement, legal acceptance, media grants, moderation, mutation idempotency, and privacy controls. Use the existing HHC design system and five locales. YouTube is an interaction reference, not a promise of identical recommendation algorithms or every YouTube feature.

No channel, subscription, post, download, embed, notification, or public-access feature is added. No production data or infrastructure changes are authorized by this specification.

## Evidence

Read from hhc-web origin/main e3dd55a and hhc-web-api origin/main f5f5999:

- MemberVideoZone renders live items, UpcomingBroadcasts, then recordings. The separate upcoming view is selected by `?upcoming=1`.
- VideoInteractions invokes navigator.share, exposes the time checkbox outside sharing, lacks comment counts, and offers newest/oldest ordering.
- Reply buttons are restricted to root comments; the repository rejects reply parents that are themselves replies.
- InteractionSummary has video likes and commentsEnabled but no comment total. Comments lack reactions and reply-target metadata.
- Existing share URLs strip query/hash and optionally include bounded integer `t`; the watch player already accepts this parameter.
- BroadcastWaitingPanel preserves the shared recording URL before launch. LiveRecordingPlayer and VOD both use VideoInteractions.

References: https://support.google.com/youtube/answer/57741 ; https://support.google.com/youtube/answer/6000976 ; https://developers.google.com/youtube/v3/docs/comments/list . User-provided screenshots are visual references only.

## Unified library

One list, ordered by category:

1. Actually live broadcasts, newest actual start first.
2. Announced scheduled broadcasts, nearest scheduled start first.
3. Available published recordings, newest upload first.

Use recording ID as a deterministic tie-breaker. Direct-start broadcasts enter category 1 once live. Scheduled broadcasts move from category 2 to 1 once live. Ended broadcasts must not remain labelled live; after processing and publication they enter category 3. A processing watch URL remains usable with its existing status panel, without falsely advertising a playable recording. Cancelled, revoked, expired, failed, and unauthorized items follow existing visibility rules.

Remove the upcoming-only entry, its all-upcoming link, and its separate frontend mode. A legacy `?upcoming=1` URL resolves to the ordinary library, preserving valid locale and search input. Scheduled cards stay in the main list and open the normal watch URL. Preserve announced schedule and waiting-state functionality in the backend.

Sorting must hold across pagination, not merely within each loaded page. Exhaust scheduled pages before appending recordings, and keep category cursors independent if reusing existing endpoints. Deduplicate by recording ID and reconcile transitions without dropping already loaded recording pages. Search uses the same order over matching items; verify scheduled search capability before choosing the implementation. Do not fake global search by filtering one fetched page.

## Watch page and sharing

Layout: player, title, interaction row, information card, comments. Desktop retains recommendations alongside the player; mobile uses a single-column layout. Waiting/live/VOD reuse the same applicable information and sharing components.

Enabled interactive controls have cursor:pointer, visible keyboard focus and accessible names. Disabled controls retain disabled semantics.

Sharing opens a house dialog on both desktop and mobile, never the OS share sheet. Include LINE, WhatsApp, Facebook, X, email, a selectable canonical HHC watch URL, and Copy. Open platform destinations only after a click, safely encode title/URL, and avoid third-party tracking SDKs. Copy reports success or failure accessibly. Never share media grants, signed media URLs, tokens, or unrelated query parameters.

For playable VOD, provide an opt-in Start at checkbox and editable m:ss/h:mm:ss input, initialized from current playback position when the dialog opens. Normalize to integer seconds within the existing URL limit and known duration; reject invalid input with an inline message. All destinations and Copy use the same resulting URL. Live and waiting states omit the time control. Dialog supports Escape, focus containment/restoration, a visible close button, safe-area padding and narrow-screen scrolling.

The information card contains viewing statistics, the appropriate upload/live/scheduled date, and description. Collapsed state shows a brief description preview; expanded state shows full text and exact date. Keep unknown or unavailable statistics distinct from zero, and retain the existing not-started metrics disclosure. Render safe http/https links without raw HTML injection. Long text and URLs wrap. Opening the card does not navigate or restart playback.

## Comments on desktop and mobile

Desktop: count and sort header, composer, author identity/avatar fallback, relative timestamp with exact-date access, edited marker, text, reactions, Reply, and a collapsible reply thread. Long comments can expand/collapse. Edit/Delete/Report live in an accessible more menu with existing ownership and moderation rules.

Mobile: a compact comment count/preview opens a YouTube-app-like bottom sheet. The sheet has its own bounded scrolling area and reachable header/close/sort controls. Composer and actions stay usable with the software keyboard, dynamic viewport and safe-area insets. Closing restores focus and preserves playback and draft state. Avoid horizontal overflow, background scroll leakage, overlapping controls, or progressive reply indentation. Desktop uses inline comments rather than the mobile sheet.

Loading, empty, comments-disabled, permission-loss and retry states are explicit. Refreshing counts or changing unrelated playback state must not erase drafts or unexpectedly close replies. Mutation errors preserve input; uncertain creates reuse the original mutation ID.

Count represents all visible non-deleted comments including replies, excluding replies beneath hidden roots. Deleted root placeholders may remain to preserve visible replies but do not count as comments. Counts must use the same visibility rules as the returned lists and update after successful mutations.

## Replies and reactions

Maintain a root thread with one visual level of replies. Every non-deleted visible comment or reply can be replied to while comments are enabled. Add optional reply-target metadata while retaining root parentId semantics for backward compatibility. The server verifies that the target belongs to the same recording and root thread and is currently replyable. Show the reply target independently of editable message text; no mention-notification subsystem is added.

Deleting or hiding a target must not expose its removed text or identity through reply metadata. Root deletion retains current thread placeholders; root hiding hides its thread. Avoid recursively nested rendering and recursive database traversal.

Add per-account comment reactions: like or dislike, mutually exclusive and removable, with public like count and the current user's reaction. Do not expose a public dislike count. Changes are idempotent desired-state updates. Retain subject write fences and authorization, and include new personal reaction data in existing export/erasure handling.

Top-level sorting is Top/Newest; preserve oldest support for existing clients and chronological thread replies. Default Top uses visible like count descending, then createdAt descending and ID as tie-breakers. This is HHC's explicit deterministic ranking, not YouTube's proprietary ranking. Pagination must preserve a traversal boundary under changing scores, using a bounded ranking snapshot or equivalent stable cursor strategy; avoid sorting loaded rows in the browser. Reactions refresh displayed counts; explicit refresh obtains a new ranked traversal.

## Ownership and delivery

- hhc-web: library composition, route compatibility, watch information, sharing, comments and responsive interactions, five-locale copy and frontend tests.
- hhc-web-api: visible comment totals, reactions, reply targets, ranked pagination, additive migrations, authorization and privacy integration, API and database tests.
- frontend-platform: additive typed client contracts and contract tests; inspect its current source and release rules before implementation.
- api-gateway: inspect route/method policies for any new reaction endpoint. Change only if the endpoint is not already permitted by the existing protected policy.
- Admin and Account are compatibility/DSR consumers to inspect; do not change their behavior unless required by the new contract or privacy coverage.

Use isolated branches from latest origin/main for implementation. Preserve unrelated local changes. Publish compatible producers and shared clients before dependent frontend releases. Each affected repository needs its own PR and required CI. Deployment follows merged CI/CD only; production migrations, releases and any live writes require the applicable explicit authorization and reviewed preview. Keep worktrees until authorized release and smoke verification succeed.

## Acceptance

- Mixed live/scheduled/VOD fixtures, no-live and no-scheduled cases, more than one scheduled page, search, duplicate IDs and transitions maintain correct ordering without missing entries.
- Legacy upcoming links land in the unified library; scheduled watch URLs retain entitlement and open the waiting state, then transition at launch.
- Sharing never calls navigator.share; every platform and Copy uses the same safe URL. Time input handles zero, invalid, over-limit, duration boundaries and player round-trip.
- Information card dates, metrics and expansion behave consistently for VOD/live/waiting, including unavailable metrics and long descriptions.
- Counts, reactions, sorting across pages, reply-to-reply, cancelled replies, concurrent changes, deleted/hidden targets, comment closure and authorization failures are tested against the backend.
- Privacy export/erasure and moderation tests cover added reaction and target fields without identity leakage.
- Browser checks at 320, 375, 390, 768, 1024 and 1440 CSS px; long localized text, 200% text zoom, long URLs, expanded replies, dialogs, sheets and keyboard-only navigation must not overflow.
- Test real iOS Safari and Android Chrome keyboard/safe-area behavior when devices are available. Browser emulation alone must not be reported as physical-device acceptance.
- Run repository-required tests, lint/build, contract checks and relevant database integration tests. After authorized deployment verify revisions, health and protected routes; do not create real member comments without explicit test-account/write authorization.

## Review notes

User decisions are incorporated. No product code is changed by this document. Implementation planning must resolve the exact stable ranking cursor and existing scheduled-search support against owning source, without weakening global ordering or adding an unrelated subsystem. Written-spec approval was received on 2026-10-17; the implementation plan is the next review artifact.
