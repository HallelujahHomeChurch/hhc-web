# HHC Public Web

Next.js public website for `www.alive.org.tw`.

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
NEXT_PUBLIC_ACCOUNT_SITE_URL=http://account.hhc.test:5173
NEXT_PUBLIC_ACCOUNT_AUTHORIZE_BASE_URL=http://account.hhc.test:5173/api/account/v1
```

`HHC_WEB_API_BASE_URL` is server-only. `ACCOUNT_API_PROXY_TARGET` is only for
local same-origin Account API proxying; production routing belongs to
`api-gateway`.

## Verification

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
quality and playback speed. Fullscreen contains the entire player and its
pseudonymous watermark; the watermark discourages sharing, not screen capture.

Timeline previews lazily request `previews/index.vtt` and bounded 160×90 sprites
inside the same authenticated playback session. Asset API generates them from
validated HLS, including existing ready packages. A missing preview does not
block playback. Release that producer before this UI; do not proxy private
sprites through Next Image or expose public object URLs.

Only the Taipei upload date appears below titles. The selected recording is
excluded from the remaining list, which is paginated in groups of twelve.
Banner font regeneration includes the member-video strings in all five locales.

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
