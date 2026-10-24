# Member watch follow-up: comments, theme and timeline previews

Scope: Website presentation changes, analysis and the separately reviewed shared-player continuation described below. No API, database,
Redis, production configuration or release-workflow changes. The reviewed
continuation uses the normal package/Website release sequence.
The separate pool/lock remediation remains outside this incremental PR.

Source baseline: Website `27e9b7e`, published UI `1.1.2` and Website client
`1.1.4`. Supporting source inspected: frontend-platform `81b5784`,
Website API `ed17473`, Asset API `27b47e4`. Planning entry documents were read
at `ea3f3afebf4433c074c0a4d2e392e380dc4b7f83`; MED-04 remains pending its
separately bounded device acceptance. Source inspection is not a production
revision attestation.

## Comment assessment

The current design is a reasonable bounded implementation, not a universal
"best practice" or proof of peak-load readiness:

- Direct-child pagination, collapsed branches and stable IDs avoid downloading
  and rendering the entire tree. The API supplies structure; the browser rejects
  legacy, cyclic or wrong-branch payloads rather than inventing a hierarchy.
- A cancellable per-discussion GET queue, obsolete-response guards and retained
  drafts/loaded branches avoid duplicate refresh work and losing input. This
  queue does not serialize different tabs, accounts or application replicas.
- Mutation retries retain their identity; uncertain sends cannot silently create
  another comment. Text remains plain React text. Server-side permissions,
  anonymous removed-node placeholders and staff moderation remain authoritative.
- Recursive metadata enrichment is bounded to 4,096 nodes with a 500ms SQL
  context. Oversized paths have explicit fallback/error behavior. That context
  does not bound the entire endpoint or its inherited lock acquisition.
- The author-profile service already has bounded memory caching and request
  deduplication. It does not hold the comment SQL transaction open for Account
  profile resolution. Existing PostgreSQL admission/fences are separate from
  this UI change; client serialization alone cannot prove absence of lock waits.

Two useful next improvements remain analysis only:

1. `VideoComments` awaits `prepareCommentAvatars` before showing a page. The
   existing image timeout is two seconds. A slow public avatar can therefore
   delay comment text; render text/initials first and progressively replace the
   fixed-size image if this becomes visible in real-user measurements.
2. Retaining every expanded/paged branch is convenient but can grow DOM and
   memory during a long session. Measure first; add bounded retention or
   virtualization only when realistic thread sizes justify the complexity.

Physical phone/keyboard, screen-reader, slow-network and large-thread acceptance
are still necessary. The source safeguards and passing tests do not replace them.

## Implemented presentation changes

Selected video/comment thumb icons use `--color-primary`; counts retain neutral
colors and reaction backgrounds retain their prior behavior. Composer resting
underlines use the website border token and focused underlines/focus indicators
use primary. Send/reply and edited-comment Save use the existing primary-solid,
foreground and solid-hover tokens. Disabled buttons stay neutral; destructive
moderation actions keep their existing presentation.

The initial follow-up unified foreground only. The continuation now reuses the
same `hhc-player-loading` class as the shared player: white48px icon,900ms linear
animation, identical drop shadow and SVG path, including reduced-motion rules.

The first VOD session placeholder inherited the watch page's dark text because it
had no foreground declaration. Once mounted, the shared player's separate loading
overlay explicitly used white. This explains the initial black-to-white change.
Both Website session placeholders now reuse that shared loading class. The live outer
placeholder already used white; its inner overlay is now explicit as well.

Desktop layout now uses a 1,000px two-column breakpoint, a 16px gap and a bounded
300–520px sidebar. Normal player width is bounded by viewport height, with a
640px minimum in that cap calculation for short desktop windows. Recommendation
thumbnails use 44% of their card width instead of the prior 60% wide-screen
rule. Comments align with the player column; theater mode spans the player across
both columns and keeps the discussion and related videos below it. Below768px,
a retained theater selection returns to16:9 so the sticky player cannot cover
the mobile comment entry.

For 768–999px, related videos follow the information and precede the full comment
region. The recommendation slot is between the existing mobile comment entry and
comment region in DOM order: mobile retains its entry above recommendations and
its fixed below-player discussion panel. CSS flattens only nonsemantic wrappers;
the labelled discussion region remains intact. CSS resizing does not remount the
player or discussion. Waiting/live/VOD paths share this slot; a recommendation
list remains available while interactions load or are unavailable.

Observed YouTube desktop behavior varies with viewport height and current UI
experiments. This is alignment to the observed structure and proportions, not a
promise of identical experiment-specific pixels.

## Why timeline previews feel slow

The published implementation already generates and serves sprites. It is not
seeking/decoding the full video on each pointer move:

```text
Asset processing -> 160x90 cells every ~5s -> 6-cell JPEG / ~30s + VTT
hover/scrub -> VTT (first use) -> 60ms target coalescing -> JPEG -> image decode
                                   mounted-player memory cache + next sprite
```

Relevant implementation:

- frontend-platform `packages/ui/src/player/{PlayerChrome,use-preview-index,
  preview-index,PreviewSprite,preview-cache}.{ts,tsx}`; the installed UI artifact
  was also inspected to confirm the behavior used by this Website.
- Asset API `internal/recordingvalidation/preview.go` and
  `workers/member-media/src/index.ts`.

`usePreviewIndex` starts only while hovering/scrubbing. VOD reuses its index;
live refreshes at most every five seconds while active. `PreviewSprite` delays
network-target changes by 60ms, including a request for an already-cached new
sheet. Moving within the displayed sheet changes its crop immediately; crossing
a sheet can temporarily remove the image until the target callback arrives.
There are two concurrent downloads, one forward-neighbor prefetch and a mounted
cache bounded to 16 sheets / 8 MiB of compressed bytes. Old in-flight downloads
are not reprioritized when the pointer jumps to an unrelated time. Downloaded
Blobs are cached, but there is no explicit decoded-image warmup.

A foreground, authenticated, read-only production sample on 2026-10-25 returned
VTT 200 in 584ms, then the selected JPEG in 374ms (neighbor 417ms). This is a
single trace, not a percentile or proof of the bottleneck for every viewer.
The sequential request dependency plus 60ms coalescing is confirmed in source.
Earlier background-tab animation-frame timings were discarded because browser
throttling made them unsuitable latency evidence.

On the official YouTube reference video, a storyboard JPEG was requested before
our first timeline hover. The tooltip reused that image as a larger tiled
background and changed its crop. This directly supports precomputed sheets and
warming before interaction; it does not reveal YouTube's private scheduling or
cache implementation. A cross-origin transferSize of zero is not cache-hit proof.

## Low-cost recommendation: frontend first

The following plan was reviewed before the user authorized the shared-player continuation. Implemented scope and remaining gates are recorded below:

1. After playback reaches a usable first frame, warm the VOD index once at low
   priority; avoid competing with playback startup or priming every library card.
   Honor data-saver intent. Keep live's existing refresh/range semantics.
2. Warm/decode the current or resumed sheet and one neighbor within the existing
   mounted-player budget. On timeline pointer intent, prioritize its target.
3. Return a cached sheet immediately; apply coalescing only to network misses.
   Prefer the newest target over obsolete queued/prefetch work. Keep request
   deduplication, scope fencing, aborts and URL revocation on disposal/denial.
4. Measure cold first-use, warm same-sheet, warm cross-sheet and random uncached
   jumps separately. Suggested warm target: no intentional debounce and image
   visible within 50ms p95 on the agreed device/network matrix; this is a future
   acceptance target, not a measured result from this PR.

This needs no new infrastructure and no new thumbnail generation job. It adds
bounded optional prefetch traffic, so it is not literally free. Random uncached
jumps will still require a network round trip. If instant arbitrary jumps across
long recordings are required, evaluate a coarse full-video overview sheet plus
fine sheets later; that changes producer/parser contracts and decoded-memory
budgets and belongs in a coordinated follow-up, not this styling PR.

Redis is not the first fix: pointer rendering happens in the browser and the
member-media Worker already checks authority before its internal edge byte-cache
lookup. Its successful internal cache entries use a one-day TTL; browser-facing
responses remain `private, no-store`. Presence of that code does not attest the
current production cache hit ratio. Keep private media out of public browser,
service-worker and image-optimizer caches. Do not weaken membership/range/revocation
checks to improve preview latency.

## Primary references

- [Official YouTube reference video](https://www.youtube.com/watch?v=M7lc1UVf-VE),
  also used by [Google's IFrame API reference](https://developers.google.com/youtube/iframe_api_reference).
  Storyboard and desktop-layout statements above are bounded browser observations.
- [MDN: image decode()](https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement/decode)
  documents waiting for decoding before inserting an image.
- [MDN: fetchpriority](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/fetchpriority)
  documents priority hints; hints do not guarantee scheduling or zero latency.
- [Cloudflare Workers Cache API](https://developers.cloudflare.com/workers/runtime-apis/cache/)
  documents the per-data-center cache, distinct from browser caching and Redis.

## Authorized continuation: loading and preview cadence

The user clarified that density means how often the timeline image changes, not
spacing between recommendation cards. On the same browser, the official22-minute
reference and [Google I/O2025 keynote](https://www.youtube.com/watch?v=o8NiE3XMPrM)
(about115minutes) both exposed10,000ms storyboard intervals. This is an observed
reference, not a claim that every YouTube video uses that interval.

The companion [frontend-platform PR#160](https://github.com/HallelujahHomeChurch/frontend-platform/pull/160) prepares UI1.1.5 with10-second image selection
from the existing5-second cues. Pointer labels and seek times remain exact.
Binary cue lookup retains unavailable-gap and clipped-range checks; no regenerated
assets or server contract changes are needed. VOD warms its index and current/next
sheets after usable playback, skips optional warming/neighbors in data-saving
mode, decodes before caching and skips the60ms miss timer for cached sheets.
Missing optional warm metadata can retry on later pointer intent. Existing live
refresh, request concurrency, memory bounds, authorization-denial and disposal
fences remain covered; active uncached requests are still network-bound.

Actual-component synthetic browser checks showed matching initial/later loading
properties and VOD index/two sheets loaded before first hover. With150ms injected
network delay, cached image/time DOM updates across seven pointer positions took
about4–9ms;5/9s retained the0s image,10/15s retained10s, and30/35s retained30s.
The video currentTime remained0 throughout pointer movement. These are local
observations, not production percentiles or physical-device acceptance.

The user approved merge/release after review and CI. Producer PR160 merged at
`a41ee9b05529e6e4493d5376558a4a706b4df7ce`; immutable tag`v1.1.5` passed the
[normal package release](https://github.com/HallelujahHomeChurch/frontend-platform/actions/runs/40117215247), including all renderer checks and publication. This
Website now pins actual registry UI1.1.5 with its genuine integrity and a verified
frozen install. All other HHC package pins remain unchanged. Normal Website CI
must pass on that exact consumer head before merge; production deployment and
smoke receipts are recorded in the PR separately from package publication.

## Verification

See the linked PR for the final tested commit and ordinary CI result. The local
checks cover the published registry dependencies, behavior/state regressions,
production build and static budgets. Browser evidence uses actual components with
synthetic comments and local mutation stubs; the production trace only read media
and paused playback. No production likes, comments or moderation writes were made.

Local behavior checks passed: 187 files / 1,576 tests, 23 script checks and 12
immutable template assets. Lint had zero errors and three existing warnings;
production TypeScript/build and static budgets passed. A final CSS-only theater
spacing adjustment is additionally rebuilt before delivery.

The actual-component browser fixture passed widths 390, 768, 960, 999, 1,000,
1,024, 1,280, 1,440, 1,920 and 2,560px: no horizontal overflow; desktop comment
and player columns align; narrow desktop places recommendations before comments;
mobile retains its entry and panel geometry. One continuous resize sequence kept
the same video node, textarea node and draft throughout. Theater preserved that
video/draft and moved the sidebar below the full-width player. Light/dark primary
icons, neutral counts, transparent comment-reaction backgrounds and primary
submit/hover colors were read back from computed styles.

Screenshot capture timed out in Ego; DOM/geometry/style evidence is not full pixel,
physical-keyboard, screen-reader or long-playback acceptance. The thumbnail implementation is in the published companion UI1.1.5 artifact;
this Website PR consumes its actual registry version/integrity.
