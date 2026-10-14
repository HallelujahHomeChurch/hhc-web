# K3 player overlap and live positioning follow-up

Scope: Website player only. Source baseline `8c15a85e7a9326a807eea23c8e746ab6d1e2469f`
(Website207). The immutable commit in this document's final URL pins the complete
fix and report. Exact PR CI, merge/deployed commit, revision, image digest, flags
and confirmation time are supplied with the final Mac handoff after readback.
No recording mutations, key resets, uploads, publication requests or backend
migrations are part of this change.

## Fixed Windows evidence

https://github.com/HallelujahHomeChurch/hhc-obs-plugin/blob/262174c5b32419b44587aa3296188fbeae10dbed/docs/reviews/mac-k3-player-followup-2026-10-14.md

Companion reports at the same immutable commit:
`windows-k3-replay-2026-10-14.md`, `windows-k3-long-2026-10-14.md`,
`windows-k3-pacing-2026-10-14.md`.

Normal installed plugin `5af0fa4a82c473df7bac780fa97779f5ebd57f49`, ZIP SHA-256
`9102cd7541cc4991cbb4e637763bac1bb1438d9ed36abc31943dbac5e2c22dfa`.
This Website fix requires no plugin/CLI change.

Retain these records:

- Rapid replay: `45fd5c77-be41-4fe4-a2f2-03ad57b9fe9d` /
  `61da0f63c09600506282f2cd55bd50f7`. At 120 seconds, paused, 1.5x;
  480p -> 1080p -> Auto at 17:55:00.470–17:55:03.315 UTC+8, still 0x0 /
  readyState 0 / time 0 / rate 1 / empty buffer through 17:56:47.207.
  Stop/seal/ready passed; automatic publication deliberately off. Replay was
  advertised until 18:30. Do not manually publish or re-upload it to retest.
- Follower: `a57859d4-364e-4f24-9589-209294de5d18` /
  `77044fc2351d448bbf2622be9b9ded2c`. At 15:35:18.561–28.595 UTC+8,
  time 3753.759063, frames 98659, readyState 2, buffered end 3753.749999,
  verified end 3753.75; at 15:35:33.612 time 3727.565097, frames 98810,
  readyState 4, MediaError null. No user seek/pause/reload/return-to-live.
- Earlier fault-build comparison `94219ab8-014c-4a94-84c2-2713c13beb98` /
  `abdb493b142bb01499ca92036a4bc1ad` remains diagnostic evidence.

All observation times above: 2026-10-14 Asia/Taipei (UTC+8).

## 1. Overlapping quality reconstruction

Confirmed code defects and event regressions:

- Each choice called recoverMediaError (MSE detach/attach) again while the prior
  reconstruction remained in progress.
- loadedmetadata cleared the saved intent before a decoded/positioned frame.
  A subsequent reset could therefore become the next choice's time 0 / rate 1.
- While reconstructing, bookmark suppression also discarded explicit commands
  needed by the parent for a live-to-VOD handoff.

The player now allows one reconstruction at a time and retains only the latest
queued choice. It retains the original pixels and playback intent through
metadata, seeking and decode readiness, ignores aborted/superseded restoration
callbacks, then applies the latest queued choice. Bookmarks during reconstruction
use the saved intent, not transient native defaults; subsequent explicit seek,
pause/play and speed commands update that intent. Source replacement/unmount or
terminal errors discard pending work and release held pixels.

Error behavior stays bounded and honest: fatal network/authorization failures
remain immediate; observed reconstruction decode errors retain the previous
30-second grace. Slow buffering alone does not become a fabricated media error.
No new retry/watchdog or indefinite error suppression is introduced.

Evidence limits: the controlled Chromium baseline recovered on locally available
media, including rapid selections. Windows' exact 103.892-second no-data stall
was not independently reproduced locally. Regression tests reproduce the
premature-intent-release/reset and overlapping operations. These are confirmed
hazards; formal resolution of the retained Windows failure still requires a
fresh targeted ended-live reproduction, not an assertion based on hidden errors.

## 2. Live positioning ownership

Actual hls.js 1.7.3 StreamController.synchronizeToLiveEdge seeks backward when the
playhead lies just beyond playlist edge and readiness is below 4, even with
liveMaxLatencyDuration=Infinity. The deployed Asset producer writes integer TARGETDURATION 31 while media
segments are 30.03 seconds (`asset-api` 57322952, recording_live.go:122). With
that actual header and Windows' playhead/edge/readiness values, the real installed
library moves 3753.759063 -> 3722.75. The behavior also applies to paused/non-1x
viewers because that upstream predicate does not check those intents.

This is consistent with the reported tail overrun/stall and subsequent backward
sample. Historical playlist snapshots and the exact old seek call stack were not
retained in the fixed report; do not claim the exact old invocation time from
sparse samples or treat the 26.194-second observed difference as the seek size.

The configured public latency-controller extension retains the library's other
latency behavior but returns no internal live-sync seek target. The existing
player owns startup/resume and forward catch-up from the validated EVENT timeline.
Automatic catch-up requires followLive intent, unpaused playback and exactly 1x;
DVR, pause and non-1x remain unchanged. First-entry quality changes still position
at the intended live start; resumed bookmarks retain their own coordinates.
VOD engines retain their ordinary latency-controller configuration.

## Verification

Regression cases include:

- MSE/native rapid 480p -> 1080p -> Auto at 120 / paused / 1.5x, metadata-only
  readiness, late reset, last-choice coalescing and retained pixels.
- Actual pinned hls.js outside-window synchronization at the recorded numeric
  boundary, for follower, paused DVR and non-1x DVR.
- Non-1x protection even when rate changed outside the toolbar.
- Early quality selection before first metadata, pending scope replacement,
  and latest commanded bookmark before VOD handoff.
- Existing fatal errors, bounded decode recovery, EOS, single switches,
  frame holding, controls, scoped authorization and live recovery regressions.

Local focused player/lifecycle suite: 4 files, 118 tests passed. Full Website
suite: 143 Vitest files, 1206 tests passed, plus repository Node/asset checks.
The unchanged LegalRequiredNavigation lint warning and existing jsdom
"navigation to another Document" diagnostics are not new player failures.
Build/image checks and exact CI/release evidence accompany final delivery.

Real Chromium used the actual component and actual hls.js with local three-quality
29.97-fps / 900-frame / 30.03-second fMP4. Rapid selections during controlled
350ms latency restored 120 seconds, paused, 1.5x, readyState 4, four decoded
480p frames and MediaError null. Two distinct MSE attachments replaced the
three overlapping operations; a navy decoded canvas pixel remained while native
state temporarily became 0 / rate 1 / readyState 0. This is synthetic browser
proof, not normal-network throughput or OBS acceptance.

A synthetic EVENT timeline was held at 90.09 then advanced to 180.18. The
original 1x follower stalled at 90.063419 / frame 900; without reload or return
button it sought forward to 150.18, decoded 1920x1080, reached 150.200195 /
frame 907 / readyState 4, MediaError null. 200ms samples showed no backward
movement. This does not reproduce normal church/YouTube load or prove all stalls
eliminated. Native Safari has event-level regression coverage, not device evidence.
Temporary local diagnostic routes are removed before commit/build/release.

## Frozen contracts and already-passed work

K3 k3-2026-10-14.rc1, B1 b1-2026-10-10.rc1, C1 c1-2026-10-08.2,
inventory 1, 30000/1001 fps, 900 frames / 30.03 seconds, digest, idempotency,
[start,endExclusive), member authorization and complete media validation stay
unchanged. No producer/worker capacity, scheduling, key, permission or feature
flag changes are required. No new cloud service, event bus or transcoding.

Preserve Windows passes: fixed-key ingest; 16-minute process-scoped outage
resume; full three-rendition local media QA; normal 2.5-hour source; single-attempt
platform ready; natural publication; original URL VOD decode/seeks; thumbnail
hash inheritance; original first-field natural publication; removed stop-OBS
Console copy; new short End/Stop/seal/ready; EOS -> Home -> 1080p -> Auto; ordinary
switches retaining frame, position, pause and 1.5x. Do not rerun the complete
2.5-hour capture or upload unchanged old material for this local player patch.

Keep separate: actual church + YouTube load is untested; original pre-Start short
page continuity was not verified because the tool cleaned the page. Auto downshift
to 480p at 1.2Mbps/80ms passed, continuous weak-network play and 32.730-second
uncached seek did not. The 122.098-second pressure sample is not a strict 60–120
pass. Original 379/388-second lag evidence remains. Fixed 480p first frame is
not an acceptance condition. The earlier PostgreSQL 53300 observation is not
resolved or attributed to these player problems by this change.

## Minimal Windows retest

1. Confirm current meeting times, continuing authorization and idle single input
   before true OBS. Use the verified normal binary; separately identify any
   fault-injection build. Preserve one browser TaskSpace across the complete test.
2. Open the deployed new frontend before Start; afterward preserve original pages
   without reload/cleanup through live, End and replay. Prepare one new short
   event if replay is needed: the old short's replay window expired. Set automatic
   publication off at creation only if needed to retain replay. Do not change
   retained fields or reset the reusable key.
3. Observe the original normal-network 1x follower across multiple closed-fragment
   updates. If a recovery trigger is needed, use the existing isolated 60–90-second
   transport test, clearly recorded as fault injection; do not rerun the old
   five-minute pressure or 2.5-hour collection. Keep a separate paused/non-1x/DVR
   page and verify it is not moved. Sample playlist edge/sequence, verified waterline,
   positions, readiness and frames together without exposing media URLs/headers.
4. In ended-live replay, establish decoded 120 seconds / paused / 1.5x, then choose
   480p -> 1080p -> Auto within approximately the original 2–3-second window.
   Add a burst ending at manual 1080p. Assert final actual decode, desired quality,
   full duration and retained intent; temporary loading defaults are acceptable
   only while the original pixels/intent are preserved and playback recovers.
   Inspect for old callbacks/default-zero bookmarks, not just badge/error absence.
5. Exercise a seek/rate/play command while reconstruction is pending; it must
   survive completion and VOD handoff. An existing published long field can be
   used for the new rapid VOD case without new capture/upload or another full watch.
6. Report actual plugin commit, capture/recording IDs, timezone-qualified times,
   width/height, decoded frames, currentTime/duration, paused/rate, buffered/seekable,
   MediaError, held frame and recovery time. Use denser samples around transitions;
   retain failures instead of reload/manual recovery or longer acceptance windows.

Keep all diagnostic/designated original/formal church records. No deletion or
manual publication is requested. New short ingest still uses its ordinary full
validation and Stop/seal semantics. Never include credentials or signed URLs.
