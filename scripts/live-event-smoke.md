# Member live acceptance record

Use the approved test environment and a test member. Never paste access tokens,
exchange credentials, signed URLs, cookie values or user-identifying media into
this record. Local unit tests and a production build do not replace this check.

## Prerequisites and pins

Record approved CMS/Asset/Account/Gateway/media-Worker revisions, the exact
published frontend client version, Website revision, OBS/plugin version, Windows
GPU/driver version, and browser/device versions. Confirm the Windows C1 manifest
acknowledgement, F1 real output and F1-L discontinuity/tail fixtures. Record only
test origin names, not credentials. The plugin output remains independent of
YouTube and existing local recording.

Provider fixtures need a private test R2 bucket, the existing recording Job and
API database, and approved test secrets configured through normal environment
mechanisms. Do not launch load tests or change production settings from this runbook.

## Early 30-minute G2 run

Produce three closed renditions every 30 seconds. Record source timecode, upload
completion, immutable-copy completion, validation completion and playlist visibility
for each sequence. Record common waterline, backlog depth and billed Job work.
Test one five-minute upload interruption; after reconnect, backlog must drain within
ten minutes and its processing rate must exceed one three-rendition batch/30 seconds.
A progress heartbeat is not media advancement.

Report startup separately from steady-state latency. Measure visible source timecode
against viewer timecode: p50/p95/max, healthy-network p95 target at most 120 seconds.
Include upload, validation, publication and player contributions when the target is
missed. Do not hide latency failure behind a successful completed VOD.

## Full event and DVR

Run an actual 2.5-hour event twice: YouTube + original recording + HHC, and original
recording + HHC. Also use a generated long EVENT fixture for quick repeatable seek
checks; a generated fixture does not replace the real-duration run.

| Scenario | Required observation |
| --- | --- |
| First play | Starts at the safe playable live edge, not sequence zero or an incomplete segment |
| Minute 90 → minute 1 | Seek succeeds through the full EVENT history after prior buffer eviction |
| Pause 15 minutes | Resume stays at the paused location and original rate/quality |
| Sleep beyond grant, then server stop | Old scope reauthorizes; no fresh scope, stale token replay or initial-edge jump |
| Network interruption while following live | Shows interrupted/recovering; one safe-edge return only after catch-up |
| Network interruption during DVR | Stays at the chosen historical position and paused/playing intent |
| Native quality switch | Waits for valid seekable and preserves position, rate and intent |
| Normal server stop | Existing viewer stays mounted through ENDLIST and sees replay deadline; new viewers cannot join |
| Published VOD handoff | Only explicit selection changes source; matching capture preserves position/pause/rate/quality |
| Auto-publish disabled | Existing scope can finish its bounded replay; no draft VOD or new viewer access |
| Revoked membership / close / delete | No new grants; document the residual already-issued grant lifetime, at most five minutes |
| Expired replay/capture | Stops media requests; published VOD remains independently available if permitted |

On desktop HLS.js, sample buffered ranges once per minute and after long seeks;
record memory where supported. Back buffer target is 120 seconds with at most one
30-second boundary allowance, forward targets 60/120 seconds. Verify no buffer
increase proportional to event duration. On a physical iPhone Safari, separately
record native HLS stability and full-event seekability; do not promise the same
120-second browser-managed buffer limit. Check keyboard seek/play/volume/fullscreen,
focus visibility and touch seeking on their respective devices.

## Result record

For each row: timestamp, exact revision/device, expected observation, actual result,
and redacted evidence location. Mark pass/fail/not run separately. Record unfinished
F1/F1-L/G2/device/cost checks explicitly; no infrastructure activation follows from
this document alone. See Asset docs/obs/live-incremental-cost.md for the A/B meters
and cost assumptions.
