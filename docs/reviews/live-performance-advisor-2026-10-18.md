# Windows formal-live performance follow-up — read-only review

One Codex advisor completed the requested read-only review. No optimization was
implemented from this report; no production recording or configuration was changed.
This is independent of the live-cover / preview implementation in the same task.

Protected recording: `2796ca13-51b1-4817-ac49-795848d68437`.
Capture: `dce3101b54b15a24624316eeb7e3e5b4`.
Windows candidate: `32d5d66ccdd24520c8a9aa5eae092a9e7f60dbcc`, OBS 32.2.2.

## Evidence and limits

All event times supplied by Windows are 2026-10-18 Asia/Taipei UTC+8.
At 12:04:43.275, producer/confirmed/verified were 442/440/436: two segments
before common confirmation and four between confirmation and common verification.
This is one sample, not a measured growing-delay trend or viewer latency.

Seal 12:06:55.335311 → attempt start 12:07:28.476523: **33.141212 s**.
Attempt start → ready 12:30:33.658388: **23 min 5.181865 s**.
Seal → ready: **23 min 38.323077 s**.
Ready → first observed published 12:33:15.723: **2 min 42.064612 s**.
Last observed draft was 12:33:04.204. The exact publish audit event is not available.
Selected cover ready at 12:32:08 does not establish that promotion and every
publication authorization/prerequisite were satisfied then.

The advisor confirmed Asset revision 0000103 and CMS revision 0000226 exist.
The current worker configuration was 4 CPU / 8 GiB, parallelism 1, but the
historical image used for this capture's attempt was NOT established. Current
configuration is not evidence of the actual execution image.

## Findings and proposed next steps (not approved code changes)

1. Correlate the capture/sequence live stage logs (validation, stable publication,
   playlist and pointer) with Windows declare/sign/PUT/confirm spans. Neither
   Windows nor insufficient CPU is yet a proven sole bottleneck.
2. Final validation still performs package copy/hash/probe/decode with two fragment
   workers. Assess reuse only against immutable bytes/hash, init, validation version
   and final inventory; preserve complete cross-segment/rendition timing, public
   boundary and short-tail checks. Summed worker stage durations overlap and cannot
   be treated as sequential wall-clock stages. Do not raise concurrency yet.
3. Publication scheduler already runs every 30 seconds, while prerequisite failure
   can back off 1/2/4… minutes. Read AutoAttempts, AutoNextAttemptAt, cover promotion
   and publication audit before deciding whether a readiness-triggered retry is
   justified. Observed ready-to-published duration alone does not prove this cause.

## Overlap with implementation already underway

Do not duplicate five-minute automatic covers, shared live→VOD sprite images or
the existing 50-second worker standby. New preview work uses existing processing
slots, at most six segments / 20 seconds per live batch, and yields to runnable
media validation. Measure brief slot occupation and image storage/request cost
before increasing capacity. Thumbnail reuse is not media-validation reuse.

## Minimal remaining evidence

Mac: historical execution image/attempt, wall-clock stage start/end, sequence
waterline publication times, publication audit and prerequisite/backoff state.
Windows: per-file declare/sign/PUT/confirm spans, retries, and five-second
producer/confirmed/verified sampling. Correlate one targeted isolated short run;
do not repeat passed long-field tests or mutate the protected formal recording.
Historical latency and weak-network/seek failures remain unchanged.
