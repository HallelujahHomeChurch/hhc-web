# VOD audio acceptance

Enable optional diagnostics in the browser console before opening the watch page:

```js
sessionStorage.setItem('hhc.playbackDiagnostics', '1')
```

The current mounted watch page exposes `window.hhcPlaybackDiagnostics.events`.
It retains at most 256 in-memory samples, with progress sampled every 30 seconds.
Events include media waiting/stalled/playing, buffered ranges, rate, visibility,
renew/exchange and the accepted grant generation/remaining lifetime. No request
URL, title, recording/user identity, credential, Cookie or access token is stored
or sent by this diagnostic. Disable with `sessionStorage.removeItem(...)` and
reload; the event buffer does not persist across page loads.

For each available physical device (iPhone Chrome, Safari, Android Chrome), record
browser/OS, mode switches, lock/unlock times, headphone/phone interruption,
network changes and whether media progresses across the old grant expiry. Compare
buffered ranges and accepted generations before assigning an authorization cause
to a stall. A shortened expiry fixture verifies a path, not hour-long stability.
The previously declined 90-minute session must not be started automatically.

Pending/processing audio is checked at most five times per playback scope, after
5, 15, 30, 60 and 120 seconds. Hidden pages suspend these readiness checks. The
existing serialized grant/Cookie renewal path remains the only authority path;
manual recheck remains available. Missing/failed derivatives are unavailable,
not an assertion that historical generation has been scheduled.

Current evidence is synthetic local producer output and automated session tests.
Physical lockscreen, real Account/CMS/Cookie/Worker integration and the prior
68.510-second progress discrepancy remain unaccepted until measured.
