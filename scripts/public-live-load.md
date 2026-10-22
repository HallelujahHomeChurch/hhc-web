# Controlled member-live protocol load

This operational browser bundle is not imported by the product UI. Loading it
makes no request. Only `startPublicLiveLoad` starts traffic. It reuses the pinned
Account browser runtime and `createMemberVideoApi`: no copied credentials,
authentication bypass, anonymous playback or provider configuration changes.
Keep credentials, grant objects, media URLs and cookies out of saved evidence.

Before execution, the coordinator must have an explicitly authorized public test,
known healthy deployed revisions, actual Windows input release, normal notification
and publication consequences, and an exclusive ingest/test slot. Preserve original
media and queues. Never start OBS or publish a recording from this script.

```sh
node scripts/build-public-live-load.mjs /tmp/hhc-public-live-load-bundle
```

CI also uploads `controlled-live-load-<commit>` with only `public-live-load.js`
and `SHA256SUMS`, retained for two days. For device execution, download it from
the verified normal main release with `gh run download <run> --repo
HallelujahHomeChurch/hhc-web --name controlled-live-load-<commit> --dir <output>`.
Check the run's exact main commit, required verification result and file SHA-256
before injection. The device needs no package-registry credential or build tools;
the artifact contains code, never live credentials. PR artifacts are not main releases.

Inject the resulting JavaScript with the supported browser automation Page API in
an already signed-in `https://www.alive.org.tw` page. Then invoke it explicitly:

```js
window.hhcLoad = await HhcLiveLoad.startPublicLiveLoad({
  recordingId: '<actual authorized live recording UUID>',
  captureId: '<actual capture ID>',
  viewers: 8,
  minutes: 10,
});
window.hhcLoad.snapshot(); // aggregate counts/bytes only
window.hhcLoad.stop();     // operator stop; does not control OBS
await window.hhcLoad.done; // drains requests and clears only owned media cookies
```

Use the approved stages: one real browser baseline10min; then 8 protocol +2 real
for10min, 23+2 for10min, 47+3 for10min and 97+3 for30min. Drain one stage before
starting another. These are independently granted playback scopes for one test
member, not100 distinct members/devices/locations. Each protocol stage ramps over
30s; its full hold begins only after all sessions have read their first segment.
For an approved distributed stage, each shard may hold up to31min so staggered
starts can still provide a measured common30min overlap. The coordinator must
verify that overlap and the aggregate byte budget; individual shard passes alone
are insufficient.
Startup is bounded to ramp+15s. Completion uses the monotonic hold deadline and
fully downloaded media coverage, including when the abort timer callback runs late.
No completed count is possible without actual
media and EXTINF coverage of the complete all-active hold.

The deterministic index mix is20%480p/50%720p/30%1080p where the advertised ladder
supports it (small stages may differ by rounding); each viewer chooses the nearest
advertised height. Each scoped master/playlist is authenticated normally, full init
and segment bodies are drained, downloads are paced by EXTINF, and live grants
renew before their maximum5min TTL. No credential leaves browser memory. Only
canonical media origins and the granted session path are accepted. Unsupported
separate audio, encryption, byte ranges or partial-segment playlists fail closed;
this is a protocol load generator, not a decoder or general HLS implementation.
Join at the last three EVENT segments, then follow only entries after the last
fully downloaded URI. Earlier pre-join history is never replayed as new live media;
a missing cursor fails closed. The cursor uses constant state even on long timelines.

A HTTP failure, stale media coverage>10s, missed scope/TTL fence,10s request timeout,
failed cookie cleanup, unexpected ENDLIST,120GB aggregate or200,000 media requests stops
the stage. The overall deadline aborts in-flight workload; owned-cookie cleanup
has its own bounded request. Operator stop is drainage, not a completed hold.
The DOM real-player probes must separately measure decode, stalls/A-V sync, dropped
frames, seek/DVR and visible live latency; protocol success cannot replace these.

Read `snapshot()` once per minute and derive interval goodput from byte deltas;
`megabitsPerSecond` is the average including ramp/cleanup; terminal snapshots freeze
when cleanup finishes; hold duration stops at workload abort, excluding cleanup.
Later observations cannot inflate a failed hold. Record concurrent active
sessions, completed holds, grants (including initial grants), max full-body request duration and failure.
For generic session/generator failures, `failureDetail` records only the viewer index,
fixed phase and allow-listed category (timeout, network, generator lag, stalled/ended
media, invalid evidence or budget). It never includes raw error text or URLs;
`UNCLASSIFIED` remains unknown. Adding diagnostics does not relax acceptance limits.
A valid stage requires all requested holds completed, no failure, independent real
player acceptance and acceptable actual API/PG/job health. Compare Mac CPU/memory
and measured WAN headroom at each stage; a generator limit is not cloud tier proof.
Stop the generator first on a service/ingest regression. Do not force-kill media jobs
or OBS. Normal public End/Stop/seal and actual published stable-URL VOD acceptance
remain mandatory after the final stage. Actual usage/provider costs are separate.

Focused offline checks (no cloud traffic):

```sh
corepack pnpm exec vitest run scripts/public-live-load.test.ts scripts/public-live-load.runner.test.ts
```
