# HHC Public Web

Next.js public website for `www.alive.org.tw`.

## Private recording covers

Member recording cards and the playback poster use authenticated, same-origin
cover reads, independent of playback sessions. Images remain temporary object
URLs scoped to the mounted account/recording and are revoked on changes,
unmount or expiry. Covers never pass through the public Next image optimizer.
Missing or unavailable covers retain the video placeholder without blocking
playback; only mounted cards and the selected recording are requested. This is
an in-memory component cache, not a persistent browser image cache.

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
and F. Form controls keep native keyboard behavior. The settings menu contains
quality and playback speed. Explicit quality changes rebuild the MSE buffers
and restore position, pause state, and speed; commands made during that brief
reload take precedence. This prevents cached lower-quality frames and stale
end-of-stream work from shortening the replay timeline. Fullscreen contains
the entire player and its pseudonymous watermark; the watermark discourages sharing, not screen capture.

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

Live playback retains the available DVR timeline and replaces the numeric time
display with a live indicator/button. It is red at the current verified live edge
and gray during paused or earlier playback; pressing it resumes at the latest
available position. Stopped events keep their distinct status and disable return.

Search implementation and producer-first release gates follow the
[companion search plan](https://github.com/HallelujahHomeChurch/hhc-web/pull/167).
Banner font regeneration includes the member-video strings in all five locales.

## Header search and mobile navigation

The mobile bar has two content slots and an account slot on the right. The first
slot prefers authorized literature ministry over news; the second prefers enabled,
authorized recordings over About. Hidden projected items are omitted. The brand
always returns to the site home, including from video pages. Public news/About
remain available on the home page and in the footer. Desktop navigation retains
its existing destinations; simplified legal pages retain header account access.

Search is visible to every visitor and enabled only on member-video library,
result and watch routes. Other pages show a disabled trigger until their search
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

Website client and bulletin UI use exact published frontend-platform v1.0.48
packages; browser preferences retain v1.0.47. All use the registry lockfile.
