# Five-locale release evidence

This index records the release evidence and compatibility floors required before each program wave can advance.

| Wave | Repository | PR | CI | Artifact | Deployed revision | Smoke evidence | Rollback floor |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | hhc-web-api | [#24](https://github.com/HallelujahHomeChurch/hhc-web-api/pull/24) | [release run 31421732294](https://github.com/HallelujahHomeChurch/hhc-web-api/actions/runs/31421732294); merged `56f12f08551607fdb849ab3279eb14e403218a11` | `alive.azurecr.io/alive/hhc-web-api@sha256:0a9040cb3fba97468cfeb38cff92fa9ca199f896b86a4620a5a6f9152958842b` | `hhc-web-api--0000027` | CI internal/public/auth smoke passed; operator external curl on 2026-08-11 Asia/Taipei: `https://www.alive.org.tw/api/home?locale=zh-Hant` returned `status=200` | Not activated until the first persisted `ja` or `ko` row. Current operational rollback target: `hhc-web-api--0000026` / `alive.azurecr.io/alive/hhc-web-api@sha256:0c643f4207d9ba01d41a0b77cfb152b1bcb7228fe742985f8120a5383b81c05f`. Once activated, the floor must be a five-locale-compatible image and revision, not a commit alone. |
| 1 | frontend-platform | Pending | Pending | Pending | Pending | Pending | Pending |
