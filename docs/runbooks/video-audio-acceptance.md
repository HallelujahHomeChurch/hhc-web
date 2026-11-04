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
browser/OS, normal playback, seeking and rate changes, lock/unlock times, headphone/phone interruption,
network changes and whether media progresses across the old grant expiry. Compare
buffered ranges and accepted generations before assigning an authorization cause
to a stall. A shortened expiry fixture verifies a path, not hour-long stability.
The previously declined 90-minute session must not be started automatically.

The normal video controls own the audible media. There are no audio mode,
preparation status or manual readiness controls. Derivative readiness is captured
when opening a playback session; later readiness does not replace running media,
especially in a hidden page. Ordinary authorization renewal continues unchanged.
Missing derivatives retain ordinary video playback; they do not prove lockscreen
support. Revocation, expiry and unmount stop both sound and video.

Acceptance must start using the normal Play button, then lock the phone without
another interaction. Verify sound continues, lockscreen pause/resume works, and
unlocking restores synchronized video. Previous manual-audio-mode checks are not
acceptance of this corrected user experience.

Foreground recovery must remain smooth for at least 20 seconds without reloading
the page. The initial iPhone Safari check confirmed uninterrupted lockscreen
sound but found persistent picture stutter after unlock, resolved only by reload.
Retest that failure specifically; sound alone does not pass acceptance.

A later iPhone report reproduced picture stutter immediately after a fresh reload,
before locking, with normal audio. Verify the initial 20 seconds first, then
lock/unlock; the foreground-only check does not cover this failure. On native-HLS
capable ManagedMediaSource browsers, companion video uses the existing native HLS
backend. Confirm the new diagnostic backend is native before comparing recovery.
