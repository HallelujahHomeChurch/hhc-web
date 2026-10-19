# HHC Public Web

Next.js public website for `www.alive.org.tw`.

## Private recording covers

Member recording cards, live thumbnails and playback posters use authenticated,
same-origin cover reads, independent of playback sessions. After current account,
entitlement and resource checks, private JPEGs reuse an account-bound memory and
IndexedDB cache keyed by recording/capture and cover revision. Returning to a page
reuses the image immediately; reopening the browser restores it from IndexedDB
without downloading unchanged bytes. HTTP responses remain no-store; covers never
pass through the public Next image optimizer or service-worker response caches.

Reusable entries are bounded to 64 images / 32 MiB and at most seven days, capped
by recording/capture expiry. Mounted viewers retain their URLs through eviction.
Logout, account change and authorization denial clear or invalidate the relevant
private scope, including cross-tab changes and late downloads. Storage failure
falls back to memory; unavailable images keep the placeholder and never block
playback. The cache does not provide offline access to recordings or their lists.

## License

The source and first-party content are publicly visible but remain all rights
reserved. See [LICENSE](LICENSE) and [ASSET_RIGHTS.md](ASSET_RIGHTS.md).

## Local development

```sh
NODE_AUTH_TOKEN="$(gh auth token)" corepack pnpm install
corepack pnpm dev
```

Environment:

```dotenv
HHC_WEB_API_BASE_URL=http://127.0.0.1:8081/api
ACCOUNT_API_PROXY_TARGET=http://127.0.0.1:8080
NEXT_PUBLIC_WEEKLY_READER_ENABLED=false
NEXT_PUBLIC_ACCOUNT_SITE_URL=http://account.hhc.test:5173
NEXT_PUBLIC_ACCOUNT_AUTHORIZE_BASE_URL=http://account.hhc.test:5173/api/account/v1
```

`HHC_WEB_API_BASE_URL` is server-only. `ACCOUNT_API_PROXY_TARGET` is only for
local same-origin Account API proxying; production routing belongs to
`api-gateway`.

Online bulletin reading is disabled by default. Set the build-time
`NEXT_PUBLIC_WEEKLY_READER_ENABLED=true` only after private-interaction/offline
acceptance and human approval of watermark readability. This gate does not grant
member access and does not disable the existing PDF download workflow.
Production builds use the repository variable `WEEKLY_READER_ENABLED` (default
`false`) to set that build argument. Changing a runtime Container App environment
variable cannot enable an already-built browser bundle; activation requires an
approved CI/CD release after those acceptance gates.

Explicit offline saves use account-bound IndexedDB with the server's seven-day
receipt, hash-verified resources and an atomic active-revision pointer. Native
Web Locks and logout epochs reject stale cross-tab writes. Clock rollback,
expiry and unmarked 404s lock retained data; only the owner's marked unavailable
response purges it. Logout/account change removes local copies. Cache Storage
contains only code-owned public assets and a generic, content-free reader shell;
member APIs and Authorization-bearing requests remain network-only. An offline
installed launch opens the saved-content list, never cached personalized HTML.
Unsupported browsers keep online reading; storage failure never deletes an
existing download to make room. Pinned renderer v1 and its immutable assets must
remain available across app upgrades for retained saves.

## Verification

Banner glyph regression tests use the same build-only FontTools/Brotli tools as
`scripts/subset-display-font.sh`: install `fonttools==4.60.2` and `Brotli==1.2.0`
in a Python virtual environment before running tests. After changing banner
translations, regenerate the checked-in subsets with that script.

```sh
corepack pnpm test:run
corepack pnpm lint
corepack pnpm build
docker build --secret id=npmrc,src="$HOME/.npmrc" -t hhc-web:local .
```

The runtime serves `GET /health` on port `10000`.

## Member video playback

The navigation entry requires both `NEXT_PUBLIC_MEMBER_VIDEO_NAV_ENABLED=true`
(release variable `MEMBER_VIDEO_NAV_ENABLED`) and the independent
`video.meeting-recordings.access` entitlement. Hiding navigation is not an
authorization boundary; list, grant, and media requests retain their checks.

The focused player supports Space/K, arrows (5 seconds), J/L (10 seconds), M,
and F. Desktop surface double-click toggles fullscreen without issuing playback
commands; surface single-click waits 500ms for click arbitration, while keyboard
and toolbar actions remain immediate. Form controls keep native keyboard behavior.
The settings menu has playback-speed and quality submenus, selected checkmarks,
keyboard navigation and a back action, contained within the fullscreen player.
In the HLS.js player, Auto starts with the lowest available rendition (480p when
present), then keeps adapting to measured bandwidth and buffering. Restored manual
quality is preserved. Native HLS chooses its own starting rendition.
Auto shows the rendered resolution only when HLS or native video reports it. Explicit quality changes rebuild the MSE buffers
and restore position, pause state, and speed; commands made during that brief
reload take precedence. This prevents cached lower-quality frames and stale
end-of-stream work from shortening the replay timeline. Fullscreen contains
the entire player and its pseudonymous watermark; the watermark discourages sharing, not screen capture.

Live watch routes prepare playback automatically. Both live and VOD attempt audible
playback and retain a neutral Play fallback when browser autoplay is blocked;
they never silently mute. Media-error Retry retains the latest position, pause
intent, speed and quality, including commands during rendition reattachment.
Finished VOD exposes Replay without starting another recording or acquiring a
new session. Live end-of-stream retains DVR and the explicit recording handoff.

Timeline previews lazily request `previews/index.vtt` and bounded 160×90 sprites
inside the same authenticated playback session. Asset API generates them from
validated HLS, including existing ready packages. A missing preview does not
block playback. Release that producer before this UI; do not proxy private
sprites through Next Image or expose public object URLs.

The library uses three thumbnail/title/date cards per desktop row and loads
cursor batches of twelve on scroll, with an accessible manual load/retry button.
Live events appear first in the same grid with a top-right live badge. The watch
page places the player and description beside the newest ten other recordings;
recommendations move below the player on narrower screens. Only the Taipei upload
date appears below recording titles; live events show their start date.
Mobile browse uses a compact hero. In portrait, the same watch player stays visible
through descriptions and recommendations, using measured top chrome and its
existing hide/search state. Short available viewports and landscape use normal
flow. The touch timeline has a separate 44px hit row; cancelled or lost-capture
scrubs do not commit. Watch links omit the source search query; searching again uses the header search
field. Search depth and scroll position are not cached for returning to results.

Live playback retains the available DVR timeline and replaces the numeric time
display with a live indicator/button. It is red at the current verified live edge
and gray during paused or earlier playback; pressing it resumes at the latest
available position. Stopped events keep their distinct status and disable return.

Search implementation and producer-first release gates follow the
[companion search plan](https://github.com/HallelujahHomeChurch/hhc-web/pull/167).
Banner font regeneration includes the member-video strings in all five locales.

## Header search and mobile navigation

The mobile bar has two content slots, an optional delegated small-group management slot,
and an account slot on the right. Management follows recordings and precedes My. The first
slot prefers authorized literature ministry over news; the second prefers enabled,
authorized recordings over About. Hidden projected items are omitted. The brand
returns to the video library from watch pages; on the library and other pages it
returns to the site home. Public news/About
remain available on the home page and in the footer. Desktop navigation retains
its existing destinations; simplified legal pages retain header account access.

Search is visible to every visitor and enabled on member-video library,
result and watch routes, and authorized small-group unit directories. Other pages show a disabled trigger until their search
behavior is implemented. Video submissions update the URL `q` and search literal
words across published titles and descriptions after membership, entitlement and
legal checks. Results use fresh cursor batches; watch recommendations stay
unfiltered and preserve the source query when returning to results.

The shared field keeps draft entry, clear, close, focus restoration and IME
handling. Mobile expansion covers the entire header row with an opaque surface;
desktop expansion replaces center navigation only when both cannot fit. Global
search and subtitle indexing are outside this change. UI and SDK 1.0.49 must be
published and pinned with a fresh registry lockfile before this draft can merge;
local preview dependencies are never committed.

## Office integration

The HTTPS-only Windows Docker Desktop stack is documented in
[the office Compose runbook](docs/runbooks/office-compose.md).

## Legal documents and optional analytics

The existing privacy and terms URLs prefer immutable common publications; an
unpublished snapshot (404) uses the existing public CMS projection during rollout.
Private supplements are fetched only in the browser after authentication and
fresh server-side membership qualification, with no-store responses. No private
copy is embedded in the frontend or server-rendered page.

`NEXT_PUBLIC_GA_MEASUREMENT_ID` stays unset until the reviewed disclosure is
published and automatic enhanced measurement is disabled in the GA stream.
Only production `www.alive.org.tw` is eligible. The shared analytics choice must
be explicitly granted; refusal does not affect required services. Public routes
use fixed categories, and sensitive routes or any query/fragment are excluded.
A document that started GA reloads before mounting an excluded destination.

## Church statement preferences

“Do not show again” hides only the current published version. Signed-in users
share the Website API preference across devices and Account; anonymous users
share version storage only within their browser. Auth bootstrap and preference
lookup finish before the automatic popup opens. Focus, visibility and visible
60-second polling refresh state. The existing popup publication window remains
enforced; the statement strip and article remain available.

Website client and bulletin UI use exact published frontend-platform v1.0.52
packages; browser preferences retain v1.0.47. All use the registry lockfile.

The bulletin reader accepts V8 alongside frozen V1–V7. V8 reuses V7's assets;
the Simplified font allowlist includes only their pinned Traditional body/bold fallback, retaining
account, edition, revision and offline-expiry checks. Deploy this consumer before
enabling V8 production; upgrading the renderer does not activate the reader.
V7/V8 Simplified offline saves have a 40 MiB streaming limit to accommodate 35.3 MB
of pinned fonts/assets; all other saves retain 32 MiB. Failed staging never
replaces an existing offline revision.

## Live thumbnails

Live cards, member search/recommendations and the live player poster share the
private cover cache described above. Recording, capture and immutable cover
revision identify each image; capture expiry remains 24 hours after creation.
A temporary refresh failure keeps the previous valid image. HHC branding covers
the no-image state. Live-following, DVR, ABR and playback grants are unchanged.

Consumer release requires the reviewed and published shared Website client plus
CMS/Gateway live-cover producers. Local packed verification is not production or
physical OBS acceptance.

## Delegated small-group management

Localized `/organizations`, unit and member routes reuse the Account session runtime,
Operations/notification contracts and management UI. Entry uses the site's banner;
inner pages retain compact controls and header member search. Active church members can
discover same-church groups and fellowships, keep managed roots, and submit requests
that remain pending until approval. Confirmation shows the current server-provided
church/family ancestors affected by the narrow affiliation rule.
Navigation display reuses the account-scoped presentation cache; directory mounting
requires fresh church membership, while unit/member access keeps its existing
server authority checks. The owner-only request result route remains available after
church membership ends, with live Account admission and no directory or roster access. Cached navigation hints never authorize access. Private reads are client-only and no-store,
and routes are noindex/nofollow and excluded from sitemap and analytics.

Gateway must release the exact WWW management/notification allowlist before WWW;
Account's compatible API routes remain during rollout. Release the Account management UI removal last. Business APIs and notification click destinations are unchanged.

### Shared live player (candidate)

This change consumes the reviewed `@hallelujahhomechurch/ui/player` and
`@hallelujahhomechurch/ui/player.css` from frontend-platform PR #135, planned
version 1.0.76. Its player regression suite moved with the implementation; this
application retains member grant, cookie renewal, watermark, telemetry, public
media-origin and live-to-VOD orchestration tests. Studio uses the same controls
with a separately scoped staff-preview grant.

The current application registry pin is deliberately unchanged until that shared
package is merged and published. Local integration uses its packed candidate;
that is not a production or registry-readiness claim. Before merging this
consumer, pin the actually published exact UI version, regenerate the registry
lockfile, update the exact-version assertion and rerun CI. Do not merge this
consumer while it still depends on an unpublished player subpath.

Live follows a point 90 seconds behind the verified playable end. The viewer
live indicator, seekbar endpoint and explicit return action share that target.
Fresh automatic playback waits for that reserve; explicit DVR, saved playback
state and ended short captures remain usable. The 2–3 minute end-to-end latency
goal still requires producer/verification and
real-device measurements; increasing holdback cannot cure sustained backlog.

## Global in-app inbox (candidate)

Authenticated pages share a foreground-only 60-second notification summary refresh.
The Bell previews five items; `/[locale]/notifications` supports unread filtering,
current-page cursor navigation and snapshot-bound read-all. Private titles, counts
and opaque tokens stay in memory, and the route is no-store/noindex and excluded
from offline caching and analytics. Notification links retain destination authority
checks; they never perform group approval.

This draft consumes immutable local Shared Inbox candidates for validation. The
product registry pins remain unchanged. Final shared packaging, approved publication,
exact registry repinning and CI revalidation are required before merge or release.
Current responsible people review pending requests and history in the existing unit
page. Review links recheck the current unit, request actions and version; approval
shows the current affected church/family ancestors. The root summary uses the
server-filtered actionable total across current scopes. Final cross-service
integration acceptance remains required.

### PR validation of unpublished Shared dependencies

PR CI checks out frontend-platform commit
`ccef0d8c74c604ad70d5f88b3135a88b5c084303` (coordinated `1.1.1`), builds all
seven archives and verifies their SHA-256 values in `scripts/shared-candidate.json`.
It exports committed WWW files into a disposable context, adds relative archive
overrides, regenerates its lockfile and uses that same context for host tests,
dependency scanning, Docker build and image scanning. Installed package bytes are
checked against those archives. The immutable weekly-asset check retains the
real consumer `origin/main` objects through the original checkout's Git directory.

This validates source compatibility only. Product dependency strings, registry
lockfile, Dockerfile and release workflow remain unchanged. Before WWW merge,
Shared requires separately approved merge/tag/publication, then WWW must pin the
actually published exact versions, regenerate its registry lockfile, remove the
temporary candidate CI path and rerun normal registry installation and image CI.
No candidate result establishes registry availability or production readiness.
