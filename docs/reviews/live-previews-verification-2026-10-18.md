# Live previews — pre-merge verification

This is local candidate evidence, not a production or Windows acceptance result.
All five PRs remain unmerged; no formal recording, key or deployment was modified.

## Candidate and checks

Shared UI commit: `eefdaa1879d6b43fd3c12a51bb873920cb28b369`.
Locally packed UI 1.0.76 SHA-256:
`e7e47e5c555332b63a74d0df4ff9eecc0594cbf784689ee32a86ea843576867e`.
It is unpublished. Website and Admin registry dependency pins are unchanged.

Website: 167 test files / 1,303 tests passed, lint (zero errors, one pre-existing
LegalRequiredNavigation warning), production build, static budgets and release
policy passed against that local candidate. Hover coverage includes dwell/device
gating, cross-card cancellation, private scope renewal/cleanup and zero telemetry.

Admin: all 128 files / 1,339 tests passed with four workers (131.05 seconds),
source lint and TypeScript/Vite build passed against the same candidate. Earlier
parallel campaign timeouts were rerun independently and in the complete bounded
suite, without changing assertions or timeouts.

Shared UI: 343 tests, lint/build/contracts and packed ESM/Vite/Next consumers passed.
CMS: PostgreSQL-backed race tests, cadence/custom/End/promotion race coverage and
vet passed. Asset covers actual FFmpeg sprite generation, live/VOD byte reuse,
missing segments, public-range/authorization projection and retention separately.
See each producer PR for its final commit and CI; do not infer all CI from these
local checks.

## Browser evidence

A local browser used the actual Website thumbnail component and shared HLS player
with synthetic S10 HLS media and mocked authorization endpoints. This verifies
browser decode and interaction; it does not exercise production authorization.

- First VOD hover decoded 854×480, muted, playing, MediaError=null.
- Switching cards left one active video and released the prior private scope.
- Live hover decoded 854×480 at 210.320885 seconds against verified edge 300.3
  seconds, using the same approximately 90-second verified reserve as the player.
- Three preview grants were released after leaving; heartbeat count stayed zero.
- Live and VOD timeline previews displayed 160×90 crops from a 960×90 sprite.
- Without page reload, live→VOD returned identical image bytes. SHA-256:
  `1e65a23bb434bcb4f768a97e9d3ac9602512f566e80a2b7516b5f5a363df45f5`.
  Actual backend byte reuse is independently tested; this browser fixture alone
  does not prove server reuse.

Local screenshots are retained outside Git in the workspace artifacts directory:
`live-stability-20261018/live-preview-timeline.png` and
`live-stability-20261018/vod-preview-timeline.png`.
The finite synthetic live playlist is not continuous-stream stability evidence.

## Release dependency and remaining acceptance

Asset's additive private refresh operation must precede CMS use. Publish shared UI
through the normal merged release before updating Website/Admin registry pins and
rerunning their clean CI. Consumer clean CI cannot pass the new player export with
its old published dependency. Local candidate checks do not replace that gate.
Do not publish an unmerged package or bypass CI to conceal the dependency.

After an authorized release, use a short targeted Windows/browser run for five-minute
Auto refresh (custom remains fixed), live timeline previews, identical selected
cover and reusable previews after VOD, desktop hover/no telemetry, and stable
live controls. Existing long-field acceptance need not be repeated. Real iPhone,
production grants, continuous OBS load/cost and this feature's production behavior
remain unverified. Historical latency and weak-network failures remain unchanged.

Clean Website CI 39099524281: 162 files / 1,221 tests passed; five suites could
not import the old registry UI package because it lacks `./player`. This confirms
the dependency gate above; it is not a passing CI result.

## Authorized registry integration (supersedes the earlier dependency gate)

On 2026-10-18, the user approved ordered merge/release. Shared UI PR135 was
merged as `044232cf4e68840b00a69dcaaa029188e562fabd`; tag `v1.0.76` and release
39108832127 succeeded. Website now pins the actual registry package, integrity
`sha512-fb5wA59dpUbx8KQdpkA4T2ijbGYyClViGdfrDnozjRgyXs23vNZskOZmh3ctMM0X5Bz2U0wI1o9PW4DzY9CMXQ==`.
The complete 1,303-test suite, lint, Next production build, static budgets and
release-policy checks passed with that installed registry package. New clean PR
CI and production smoke remain mandatory; this section alone is not deployment
acceptance. The separate performance advisor findings remain analysis only.
