# Member-video layout parity analysis

Date: 2026-10-24
Status: Historical design record. Implementation was subsequently authorized and is tracked in hhc-web#285, hhc-web-api#336 and frontend-platform#157. Near-identical YouTube visual parity, nested replies and anonymous intermediate-removal placeholders accepted. Live desktop reference analysis completed; existing moderation roles clarified below.

## Outcome and reference boundary

Improve the watch-page information and discussion layout. Desktop uses the six YouTube screenshots supplied by the user and direct observation of the matching YouTube watch page. Mobile explicitly uses the native YouTube app reference, rather than desktop web at a narrow viewport.

User clarification after the analysis: the comments, reactions, and video information should look almost identical to YouTube. This is the visual acceptance target. Match reference alignment, proportions, spacing, typography hierarchy, surfaces, icons, selected states, and responsive composition. Earlier HHC-brand color suggestions and approximate dimensions are superseded where they differ visibly from the references. Keep the change local to these watch-page surfaces.

The user's confirmed requirements are: correct avatar/name/body proportions and alignment; selected reaction color confined to the icon, without a selected background or recolored number; compact viewing statistics followed by relative time; a simple underline composer in the supplied desktop reference; smaller reply avatars; and replies initially collapsed with a way to open and hide them. The user subsequently accepted multi-level replies, per-level expansion/collapse, connectors and preview avatars. The earlier flat-only recommendation is superseded.

Facts, recommendations, and decisions are distinguished below. Unspecified YouTube capabilities are not requirements. This analysis does not add timed comments, translation, voice replies, emoji pickers, notifications, channels, or player features.

## Evidence inspected

Freshly fetched source baselines:

- [hhc-web 6d37ad19](https://github.com/HallelujahHomeChurch/hhc-web/tree/6d37ad19e1fe85cbc21256d791f0134e91c759c8).
- [hhc-web-api f67e1213](https://github.com/HallelujahHomeChurch/hhc-web-api/tree/f67e12135e8b3eb430107f4a42dd9aaeb3cd1cf8).
- [frontend-platform 2e58d001](https://github.com/HallelujahHomeChurch/frontend-platform/tree/2e58d00122a753492481a0898b8bd8d769aafdb8). Web pins Website client 1.1.0 and UI 1.1.2; registry contents were not separately reinstalled for this analysis.

The primary Web checkout is an older, dirty main checkout. Source inspection used `git show origin/main`; no pull or source edits were made. Its existing changes and worktrees were preserved. Fetching refreshed remote refs only.

User-provided screenshot inventory, 2026-10-24:

| Time | Directly observed reference |
| --- | --- |
| 2:54:14 PM | Root avatar at left; author/time, body, and reactions in the right column; curved thread connector and collapsed reply entry. |
| 2:54:20 PM | Smaller reply avatars; deeper visual reply relationship; hide-replies entry. |
| 2:54:41 PM | Reply editor with avatar, underline, cancel, and disabled reply action. |
| 2:54:57 PM | Desktop comment heading/sort and underline composer. |
| 2:55:25 PM | Selected filled thumb, no button background, neutral numeric styling. Compared with the earlier image, the count increases from 2 to 3. |
| 2:56:44 PM | Information card beginning with `觀看次數：1.8萬次 2天前`, followed by description. |

These are scaled/cropped images. Relative alignment and proportions are observable; exact CSS-pixel sizes are not established by the images.

[Official reference research](../evidence/2026-10-24-video-layout-youtube-reference-research.md) contains platform-specific Help links and directly inspected official artwork. Particularly relevant:

- [iOS Help](https://support.google.com/youtube/answer/6000964?co=GENIE.Platform%3DiOS&hl=en) and [Android Help](https://support.google.com/youtube/answer/6000964?co=GENIE.Platform%3DAndroid&hl=en) distinguish returning from replies with Back from closing comments with X.
- [TeamYouTube's announcement](https://support.google.com/youtube/thread/380540176?hl=en) describes structured reply threading. Its [mobile illustration](https://storage.googleapis.com/support-forums-api/attachment/thread-380540176-5606961893163681394.png) shows a bottom composer with an avatar and a filled rounded entry, unlike the desktop underline.

No installed native app was operated. The official illustration is from the 2025 announcement; it is a reference, not proof of the precise October 2026 app variant delivered to the user's account. Its keyboard, selected-reaction, reply-subview, and information-card states are not shown.

[Live desktop observation](../evidence/2026-10-24-youtube-desktop-observation.md) records the subsequently authorized visit to the exact matching video, rendered DOM measurements, reply/editor interactions and expanded information. [Nested contract analysis](../evidence/2026-10-24-nested-comment-contract-analysis.md) records the resulting server/client design boundary. Screenshot capture failed in the browser session; no new image artifact is claimed. The selected comment state already existed and was observed without changing reactions.

Existing October 17 release screenshots were inspected. They are synthetic local fixtures with a placeholder player, as stated in their verification document. They show the older layout problems but provide no native-app or physical-keyboard acceptance.

## Gap analysis

### Comment anatomy and visual hierarchy

`VideoComments.tsx:61` places avatar, author, time, and edited marker in one flex header. Body and actions are separate article children. Consequently, body and actions begin at the article's left edge instead of the author text column. Changing gaps alone does not fix this structure.

The complete row needs a stable avatar column and a content column containing identity, text, and actions. More-menu placement belongs at the row's trailing edge; it currently shares the lower action row. Long names must wrap within the content column without displacing the avatar or causing horizontal overflow. Timestamp and edited metadata remain secondary.

The desktop screenshot also places comment count and sorting in one header row. Currently the heading is outside `CommentList`, with sorting in a separate toolbar below it (`VideoComments.tsx:22–23,47`). Align these in one desktop header while retaining a reachable refresh action. For the app-style mobile surface, Top/Newest chips can represent the two existing order values; the reference image's Timed option must not be added without its missing product/data capability.

`VideoComments.module.css:28` sets both root and reply avatars to 36px. `CommentAvatar` can reuse the existing house Avatar with a local size/class adjustment. The house component accepts `className` and has a 40px medium size. A shared-package change is not required for these sizes.

Sizing after live desktop observation, with mobile values still subject to native-reference verification:

| Element | Desktop proposal | Mobile proposal |
| --- | --- | --- |
| Root avatar | 36px, measured | 32px, provisional |
| Reply avatar | 24px | 24px |
| Avatar/content gap | 16px, measured | 12px, provisional |
| Author | 12px, weight 500, line-height 18px | 13px, provisional |
| Comment body | 14px, weight 400, line-height 20px | 14px, provisional |
| Time and edited marker | Time 12px/18px, muted | 12px, muted, provisional |
| Reaction icon | 18px, measured | 18–20px, provisional |
| Editable text | 14px/20px in observed editor | Existing 16px pending device verification |

Measured desktop values replace the earlier estimated tokens. Tune the final result through reference comparisons to meet the near-identical visual target; measurements describe the inspected variant, not every YouTube experiment. Keep required accessible hit areas while matching visible controls. The skeleton must use the same avatar/content columns and root/reply sizes, avoiding a jump when content arrives.

### Reaction styling

`VideoInteractions.module.css:6–7` gives buttons a panel background and changes the entire selected button to primary background/foreground. `VideoComments.module.css:35` changes selected buttons to panel background and primary text. Both recolor the number along with the icon.

Keep existing desired-state requests, server-authoritative counts, retry behavior, disabled states, and `aria-pressed`. Change presentation using a reaction-specific selector: only the selected SVG receives the selected color/fill. Count color, weight, and size remain stable. The reference itself shows count changes, so stable numeric styling must not freeze the count's value.

Selected thumbs use the reference's filled treatment and theme-appropriate color; unselected thumbs use the reference's outline treatment. The earlier HHC-primary-color proposal is superseded by the user's near-identical visual target. The observed selected comment icon is neutral foreground while its number stays muted. Video Like has a gray pill even before selection; retain that base treatment without adding a selected background, and keep comment reaction backgrounds transparent. Preserve visible keyboard focus. Scope these changes to reaction buttons so Share, Copy, confirmation actions, and other users of `VideoInteractions.module.css` do not change unintentionally. Existing video-zero and comment-zero count visibility can remain unchanged.

### Composer

The existing composer already has a transparent textarea and bottom border, but uses two rows, a 64px minimum height, vertical resize, no viewer avatar, and an always-visible submit action. It therefore does not match the compact desktop reference.

Desktop proposal: viewer avatar at left, initially one-line underline field, automatic growth for multiline text, and right-aligned cancel/submit actions after engagement. Clicking Reply should focus the intended editor. Preserve the 2000-character limit, whitespace validation, uncertain-create mutation ID, error text, and typed content after failure. Enter remains a newline; submitting remains an explicit action. Cancel is the explicit discard action; closing a panel or navigating Back should not discard a draft.

Viewer identity already exists through `useAccountAuth().session.user`, including display name and `avatar_url`; AccountControl consumes these fields today. No new account lookup, avatar endpoint, or SDK field is necessary. Use the existing Avatar fallback without changing comment-image preparation policy.

Mobile is a real design decision: the inspected official app artwork uses an avatar and a bottom filled rounded entry. Automatically applying the desktop underline to mobile would contradict that reference. The recommended mobile shape is fixed header, one scrolling discussion region, and a persistent bottom composer. An expanded editor must stay above the software keyboard and safe area; this requires browser/device verification rather than a CSS-only claim.

### Mobile presentation and navigation

At <=767px, the same HTML dialog becomes a fixed 78dvh modal. The entire dialog scrolls; its header is sticky, while sorting, composer, and replies scroll with the list. Replies remain inline. The modal locks body scrolling and makes the background player controls inert; the player itself remains mounted.

The fixed height has no relationship to the actual player bounds. The inspected historical mobile fixture already overlaps the placeholder player's lower area. Small landscape or keyboard-open viewports need a different constraint than an unconditional 78dvh.

Recommended app-like flow:

1. Watch page exposes a compact comment count/preview.
2. Opening comments presents a bounded surface below the visible player in portrait, with a stable header, scrolling list, and reachable bottom composer.
3. Opening a thread presents the root and its replies in a subview of the same surface. Back returns to the root list at its prior position; X closes the surface.
4. Closing/reopening preserves drafts and discussion state for the same recording/account. Switching recording/account clears that scope through the existing keyed boundary.
5. The same player instance survives every transition. Whether it must remain operable while comments are open is explicitly part of decision D1, since the existing modal prevents that.

Do not put a visual drag handle on a surface that does not drag. The official image shows a handle, but supported snap heights, drag-to-resize, and drag-to-dismiss are not established by the inspected sources. They are optional interaction scope, not implied by drawing a rounded panel. Short landscape and keyboard-open states must prioritize reachable editing and navigation; a full player plus a full composer cannot always fit simultaneously.

### Reply visibility, navigation, and retained state

Initial reply state is already false (`VideoComments.tsx:57`). The visible control currently says only `N Replies`; it has `aria-expanded` but no changing arrow or hide label. After posting under a root, the existing code opens that thread.

Desktop proposal: collapsed `N 則回覆` plus down chevron, expanded `隱藏回覆` plus up chevron, with a separate row aligned to the content column. Root-to-thread connectors follow actual visual grouping. Mobile proposal: thread-count entry opens the replies subview with Back, rather than reproducing desktop inline expansion.

The reply list is conditionally unmounted on hide (`VideoComments.tsx:65`). That discards its loaded pages and any editor state held inside a reply. This is a source-confirmed lifecycle issue. Retain the active recording's thread state when hiding or navigating Back; it does not require persistent browser storage. A simple retained mounted list may be sufficient for desktop; mobile needs state ownership that survives switching between list and thread presentation. Do not add a general cache or a second API client.

The collapsed preview avatar is now accepted scope. Root comment payloads currently have a reply count but no representative reply avatar. Add bounded preview metadata through the compatible threaded response rather than eagerly downloading every reply or fabricating a preview. Preview enrichment must honor removed identities and the existing Account identity-resolution limit.

### Flat storage versus fully nested replies

The existing single-level storage does allow replying to a reply: `parentId` remains the root and `replyToId` identifies the target. Responses expose optional `replyTo: {id, displayName}`. The UI currently displays a separate target label and renders all replies in one chronological list.

That metadata is useful but does not establish complete independently pageable subtrees:

- `ListRecordingComments` accepts only a root as `parentId` (`internal/postgres/recording_interaction.go:194–208`).
- `replyCount` counts rows whose `parent_id` equals the comment ID (`:110`), so a reply has no count of its own targeted descendants.
- `replyTo` is deliberately omitted when the target is hidden/deleted (`recording_comment_ranking.go:26–53`).
- A target or descendants can be outside the currently loaded reply page. Grouping only loaded rows cannot provide authoritative per-branch totals or prove an apparently empty branch is empty.

Fully reproducing the accepted independently expandable reply-to-reply branches requires a compatible contract for counts, pagination, ordering, missing targets, and deletion/moderation. The existing stored root plus reply-target edge can remain; API and generated SDK changes are in scope. Gateway query policy must be verified, with a change only if required. Loading every reply to manufacture counts is not an acceptable shortcut. The live root label counts all three replies across two levels, so direct-child count must not be substituted for the visible total.

The user's latest acceptance supersedes the October 17 flat visual design. Preserve stored root semantics for old callers and add an opted-in threaded query/response. Each expanded node needs independent page/draft/visibility state; root totals, direct-child counts and non-root descendant totals are different quantities. See the contract note for compatible fields, cursor scope, a proposed additive index, and batched preview author resolution.

### Viewing statistics and dates

`VideoInformation.tsx:9–11` currently uses ordinary numbers and absolute upload/live/scheduled dates. It has no compact view count or video-age formatter. The private comment formatter only handles seconds through days; it is insufficient for months/years and is not a reusable cross-file API.

Recommended general-video collapsed form: `觀看次數：1.8萬次 2天前`.

- Below 10,000, show the localized integer; from 10,000 use at most one decimal and omit trailing `.0`. Use localized large units and localized non-Chinese output, rather than adding the Chinese unit to all five locales.
- Expanded information shows full count and an exact date. An exact date must remain accessible even when the description is empty; currently the expand control exists only for nonempty descriptions.
- Use the existing authoritative timestamp: uploadedAt for VOD; actual startedAt, with the existing fallback, for a completed stream. Relative display needs minute/hour/day/week/month/year boundaries and deterministic tests for now, future, invalid, and missing values.
- If a small local relative-time formatter is introduced, consider using it for comment ages too, which currently stop at days; preserve each comment's exact-date access. This consistency change is a proposal, not a new date source or backend requirement.
- Preserve live `N 人正在觀看` and scheduled exact date/time. Waiting/processing/cancelled states must not masquerade as past uploaded videos.
- Keep unavailable/pre-launch statistics distinct from a genuine zero and retain the existing disclosure.
- Retain safe links and escaped text. Match the compact card: live desktop used a 12px inner inset/radius, 14px/20px text, no extra description top gap, and an inline more-content affordance. The current separate button row and 1.6 line-height are visible parity gaps. Expanded text remains fully accessible; handle empty/short descriptions deliberately.

The first-party mobile material inspected did not show a video information card. Applying the requested compact metadata to mobile is an HHC consistency proposal, not a measured native-app claim.

## Change map and smallest complete delivery

| Area | Expected reach |
| --- | --- |
| Comment structure, thread presentation, composer state | `VideoComments.tsx`, `VideoComments.module.css`, `VideoComments.test.tsx` |
| Avatar dimensions | `CommentAvatar.tsx`; local CSS; existing account context/Avatar reuse |
| Loading geometry | `VideoLoading.tsx`, comment skeleton CSS, `VideoLoading.test.tsx` |
| Video reaction presentation | `VideoInteractions.tsx`, `VideoInteractions.module.css`, `VideoInteractions.test.tsx` |
| Count/date formatting and card expansion | `VideoInformation.tsx`, `VideoInformation.test.tsx`; a small colocated formatter only if needed |
| Labels and accessibility names | `video-labels.ts`, all five supported locales |
| Shared callers/watch surface to verify | `MemberVideoZone`, `LiveRecordingPlayer`, `BroadcastWaitingPanel`, watch CSS and existing component test mocks; keep neutral surface/type changes local to the watch page |
| CSS consumers to protect | `VideoShareDialog`, its Copy/platform actions and tests |
| Accepted producer/client scope | API/OpenAPI, additive direct-edge query index if validated, Website SDK, contract tests, batched preview enrichment; inspect Gateway query policy and change only if necessary |

Nested behavior and previews are now accepted, so delivery includes an API producer, generated/published Website SDK and Web consumer, each with its repository-required branch/PR/CI gates. Inspect Gateway query forwarding and validation before deciding whether it needs a change. Reuse the table and current creation payload; avoid a new microservice, tree store or global UI abstraction. Keep one focused PR per genuinely affected owner and release producers before consumers after applicable authorization.

Implementation must start in an isolated worktree from fresh origin/main, read the installed Next.js guidance, and preserve all unrelated changes. This analysis authorizes no implementation, PR publication, merge, release, production writes, or infrastructure changes.

## Required validation after implementation approval

Source/interaction tests:

- Reaction selection/unselection changes only the icon; counts still follow server responses; error/retry and uncertain desired state survive. Use browser-computed styles for colors, not class-name-only assertions.
- Initial collapse, clear expand/hide names, mobile Back/X, focus restoration, and posting-then-opening behavior.
- Draft and loaded-page preservation through hide/reopen, Back, close/reopen, sorting/refresh where applicable, and 767/768 resizing; no cross-account/recording state leakage.
- Composer multiline behavior, empty/whitespace/limit cases, cancellation, failed/uncertain create retry, deleted reply targets, and keyboard navigation.
- Compact numbers around unit/rounding boundaries, exact date access, relative time boundaries, missing/invalid data, all five locales, and live/scheduled/unavailable/zero distinctions.
- Existing moderation, reply targeting, avatar fallback, avatar preparation, pagination, safe-link rendering, and playback tests remain valid. Update DOM-specific selectors only to follow the new structure; preserve behavioral assertions.

In particular, `MemberVideoZone.test.tsx:443` currently asserts an absolute uploaded-date label. It must be updated to assert the chosen collapsed/expanded date behavior rather than weakening date coverage. Existing avatar tests query `article > header`/`article header img`; those selectors must follow the new avatar/body anatomy while retaining failure, privacy, and cache assertions.

Browser visual checks use local synthetic fixtures and the actual changed components: 320, 375/390, 768, 1024, 1440 CSS px; light/dark; long names, four-plus-line text, URLs, emoji, edited/deleted comments, open menu, loading/empty/disabled/error; 200% text zoom and keyboard focus. Assert no document/dialog horizontal overflow and compare the stable content-column alignment. No fabricated secondary preview implementation is needed.

Mobile acceptance additionally covers portrait/short landscape, native software keyboard, safe areas, panel/list scroll ownership, nested Back behavior if chosen, preserving draft/scroll, and unchanged player identity/playback. Real iOS Safari and Android Chrome checks remain separate from desktop Chromium emulation. If video controls must remain operable, validate focus and scroll restrictions after changing modal behavior.

Run repository-required `corepack pnpm test:run`, `lint`, `build`, `perf:static`, release-policy checks, Docker verification, and required CI for the eventual product change. This analysis itself does not need a product build/test run. Later merge/release/smoke requires the applicable explicit authorization; CI is not device or production acceptance.

## Product decision frontier

D1. **Mobile interaction baseline — accepted in principle.** Use the app-style bottom rounded composer, comments/replies subview with Back/X, and a player kept visible and operable in ordinary portrait reading. Desktop retains the underline composer and inline expand/hide. Include initial appearance and navigation; leave draggable resizing/dismissal out unless requested. Decide how to prioritize player versus editor in short/keyboard-open layouts during the next dependent round.

D2. **Reply-depth fidelity — accepted.** Include multi-level replies, per-level expansion/collapse, connectors and preview avatars. Preserve current stored root semantics and old clients. Provide authoritative unloaded counts and independently pageable direct children through an opt-in API/SDK contract. Root labels retain whole-thread totals. Non-root total-count semantics and cost must be explicit; do not invent totals from loaded pages. The observed small YouTube thread revealed deeper replies when the root opened, so independent default-collapse behavior is the user's requirement rather than a universal observation of YouTube.

D3. **Visual tokens and reactions — confirmed reference parity.** Use YouTube-like theme-appropriate colors, icon treatment, surfaces, and type hierarchy within the affected watch-page modules. Live desktop root/reply avatars measured 36/24px and author/body/time text 12/14/12px; the earlier 40px and 13px estimates are superseded. Numeric styling stays neutral and no selected reaction background is added; retain the video's existing base pill and transparent comment controls.

D4. **Metadata presentation — accepted.** Use compact localized counts and relative time when collapsed, full count/exact date when expanded, live/scheduled exceptions preserved. This includes a date-access affordance even without a description.

D5. **Composer and retained state — accepted.** Use focus-based desktop action visibility, explicit submit, multiline input, avatar reuse, explicit cancel to discard, and retained draft/loaded pages across non-destructive presentation changes. Clicking Reply focuses that target; posting reveals the thread. Physical keyboard behavior is validated later, not presumed.

D6. **Intermediate deletion/hiding — accepted.** Use an anonymous structural placeholder that preserves the descendants and their position. Omit original body, identity, avatar and reply-target presentation from member responses; exclude placeholders from visible comment/reply totals, while retaining an explicit traversable-children signal. Root hiding still suppresses the whole thread. This extends the existing deletion/flat moderation behavior to the new nested presentation without erasing other members' replies or relocating the conversation.

Existing moderation ownership was verified on 2026-10-24 against API `f67e1213` and freshly fetched Admin `6946e77112e59c457cfb3027822e37a11d681af3`. The Admin recording detail page already mounts `RecordingComments` inside its Comments disclosure (`RecordingDetailPage.tsx:340`). With `cms:recordings:write`, staff can hide/restore comments, resolve reports and enable/disable comments (`RecordingComments.tsx:8–16`; API `recording_interaction.go:251–252`). The moderation operation validator accepts only settings/hide/restore/resolve (`internal/recordings/interaction.go:168–178`). There is no staff delete-other-comment operation. Member deletion requires ownership (`internal/postgres/recording_interaction.go:249–264`).

Preserve that role split. Author deletion and staff hiding are separate triggers for the new member-facing placeholder. Hiding toggles the hidden flag and retains stored text for authorized moderation/restoration (`recording_comment_moderation.go:88–91`); omission from member responses must not be implemented as destructive content erasure. Staff restore must recover the prior presentation and branch position. Do not add a new administrator deletion capability or broaden scopes as part of the layout task. This verification establishes source/UI wiring, not current production deployment or live operation acceptance.

After confirmation, resolve implementation details against the owning repositories and finish any dependent behavior questions before product implementation. Browser reference inspection does not authorize a merge, release, production migration or real-member write. Mobile keyboard, short-viewport composition, light theme and actual pixel comparisons remain acceptance work, not claims completed by this analysis.
