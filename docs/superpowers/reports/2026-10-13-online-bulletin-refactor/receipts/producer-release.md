# Platform 1.0.63 published artifact receipt

- Platform PR #121 merged to `f442be782223c61300dbbf60fe21e5d2e0ddd188`; tag `v1.0.63` targets that commit.
- Version-head required CI: https://github.com/HallelujahHomeChurch/frontend-platform/actions/runs/38381727064 — success on `cb8fc14d8c940674b9642943ad260f8c4c93bad9`; merged tree identical.
- Tag release: https://github.com/HallelujahHomeChurch/frontend-platform/actions/runs/38387987250 — success on merged commit, completed 2026-10-13 11:45:49 UTC.
- All seven 1.0.63 packages independently read from GitHub npm registry; downloaded tarball SHA-512 and SHA-1 match registry declarations. JSON companion contains every integrity and tarball identity.
- Immutable renderer image manifest independently fetched from GHCR; byte SHA-256 equals registry digest header and release push log.
- No deployment, production data/infrastructure/feature gate changes or physical/live acceptance are asserted. Task 7b may now use the actual published package, with its separate review and CI gates.

Image: `ghcr.io/hallelujahhomechurch/hhc-bulletin-renderer@sha256:a7bda5840b5145ddc866b0f38a2121e6af4a4df36f36c6a430cbbe5576f96c17`

Tag: `50cb71b21129cb5296f8fa849da743d3553048d9ebacee27d013ad1552d087a1-f442be782223c61300dbbf60fe21e5d2e0ddd188`

Release container matrix (zero failures):

| Renderer | Passed | Existing version-conditional skips |
| --- | ---: | ---: |
| V1 | 34 | 3 |
| V3 | 35 | 2 |
| V4 | 36 | 1 |
| V5 | 37 | 0 |
| V6 | 48 | 0 |
| V7 | 51 | 0 |
| V8 | 44 | 0 |
| V9 | 42 | 0 |
| V10 | 41 | 0 |

Conditional cases concern hanging whitespace/dense lyrics/dense cover and execute in applicable later versions; no environment skips substituted for execution. Release checks also passed dependency and image vulnerability scans, build, complete unit suites, lint, package contracts, tag/main ancestry and packaging.
