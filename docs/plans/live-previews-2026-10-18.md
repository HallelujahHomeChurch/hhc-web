# Live covers and previews — pre-merge implementation

Approved scope: five-minute automatic cover refresh; desktop thumbnail hover playback;
live timeline thumbnails with VOD-equivalent sampling and reuse after publication.
All branches remain unmerged. No release, production recording mutation or OBS wire change.

## Ownership and contracts

- Asset owns immutable generated images, bounded verified-media work, public range
  enforcement, preview indices, grants and cleanup. Add a private refresh-auto
  operation; preserve existing /auto semantics and use idempotent five-minute buckets.
- CMS schedules eligible automatic refresh, retains the previous ready cover during
  pending/failure, fences custom/End changes, and promotes the selected image to VOD.
- Shared UI reads the existing scoped previews/index.vtt format for live and VOD.
  Fetch only on timeline interaction, with bounded refresh and stale identity guards.
- Website hover uses the shared muted 480p player with the existing safe live target,
  private per-preview authorization and watermark. No heartbeat, metrics or saved
  watch progress. Desktop fine-pointer only, 500 ms dwell, one active card; leave,
  background, offscreen or auth unmount releases the player and its scope.

## Reuse and boundaries

Use existing VOD thumbnail dimensions and approximately five-second cues. Generate
incrementally from verified media; expose only public [start,endExclusive). VOD
reuses image bytes, rebases index timestamps and fills missing previews. Never
regenerate the entire event merely because it transitioned to VOD. Missing previews
fall back to the time label; failed cover refresh retains the last ready image.
Keep referenced images until the corresponding VOD retention/access lifecycle ends.

## Verification

- Asset: live and VOD range/auth checks, exact sprite byte reuse, gap filling,
  concurrency/idempotency, retention and ffmpeg output.
- CMS: five-minute cadence, pending/failure, custom races, End freeze, reference
  swap and VOD promotion against disposable PostgreSQL.
- Shared UI: dynamic index, scope changes, DVR range, absent previews, VOD switch,
  headless muted 480p player and existing stability regression suite.
- Website: dwell/device gating, single active card, cancellation/late grants,
  private scope cleanup, no telemetry, and actual browser decode/hover/navigation.
- Run repository-required tests/build/lint/contract checks and PR CI. Consumer CI
  must distinguish published package availability from locally packed candidate
  verification; do not publish an unmerged package or bypass required checks.

The separately requested performance consultant is read-only. Compare its findings
with image work before proposing additional optimization; no speculative worker
expansion, new service or reduced media validation.
