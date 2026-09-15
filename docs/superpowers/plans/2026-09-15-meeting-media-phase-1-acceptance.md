# Meeting Media Phase 1 Pre-Launch Acceptance Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to execute this operational plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Formally accept the already released Meeting → LINE → Asset → Presenter media path with representative latency, security, schedule propagation, scale-to-zero, cost, and installed-device evidence.

**Architecture:** Reuse the deployed Meeting occurrence source, scheduled warmers, queue-scaled workers, clean-before-publish gate, Presenter download path, and `available-offline` receipt. This plan collects evidence and fixes only a separately proven bottleneck; it neither rebuilds Phase 1 nor owns Phase 2 Resource reservations.

**Tech Stack:** Azure Container Apps, Azure Queue Storage, Log Analytics, existing Go/TypeScript/Electron services and Presenter clients.

**Spec:** [2026-09-15-hhc-unified-authorization-membership-and-entitlement-design.md](../specs/2026-09-15-hhc-unified-authorization-membership-and-entitlement-design.md)

## Global Constraints

- Preserve clean scan, derivative readiness where required, authorization, ACL/grant, version/hash, cancellation, and revocation fences. Never prefetch pending bytes or bypass scanning.
- SLO is server `media_sync.webhook_received` to Asset receipt of authenticated Presenter `available-offline`, keyed by content version and opaque correlation IDs.
- Eligible sample: at most 25 MiB, media-enabled occurrence, authenticated online collection-connected Presenter using always-offline. Required p95 is at most 20,000 ms with no missing eligible receipt.
- Production Meeting creation/change, LINE test messages, EICAR control, fault injection, device release, and Azure mutation require their own explicit authorization.
- Do not call historical samples, a healthy revision, a scheduled warmer, or zero current replicas formal acceptance.

### Task 1: Freeze The Acceptance Baseline

**Files:**
- Create: `docs/operations/meeting-media-phase-1-acceptance-evidence.md`

- [ ] Record latest/ready revision and immutable image digest for `hhc-web-api`, `api-gateway`, `asset-api`, `asset-scan-worker`, `hhc-line-function-bot`, and `hhc-line-bot-attachment-app`.
- [ ] Record Presenter source commit, release tag, package checksum, installed version, platform, login state, collection, and always-offline policy for at least one real target device.
- [ ] Create or reuse one bounded internal one-time Meeting bound only to a test collection; read back occurrence identity, 5-minute lead, 10-minute tail, and both warmer results.
- [ ] Freeze one UTC observation window before the first sample. Record actual scanner/attachment capacity and prove both workers still scale to zero; do not tune capacity to make the baseline pass.

### Task 2: Collect And Calculate The Representative Sample

- [ ] Send 10 sequential single-file samples, 10 short-burst samples, and 10 mixed-format burst samples. Keep actual webhook order and do not replace a failed/late sample with another success.
- [ ] For all 30 messages record opaque correlation ID, Asset ID, collection item ID, content version, type, size bucket, app version, and webhook/upload/scan/publish/local-commit/server-receipt timestamps.
- [ ] Export every webhook in the fixed window and left join all later stages. Require webhook count 30 and report missing upload, scan dequeue, scan completion, publication, and receipt counts.
- [ ] Report coverage, p50, p95, p99, max, and type/size/sequential/burst splits. Pass only with attributable stages, zero missing eligible receipt, and overall p95 at most 20,000 ms.
- [ ] If the sample misses, identify the largest controllable stage and open one bounded corrective plan. Do not add replicas, concurrency, or a new transport without that evidence.

### Task 3: Verify Security, Schedule, And Cost

- [ ] Prove clean content publishes only after clean scan and receipt matches the same content version.
- [ ] With separately approved isolated EICAR control, prove infected status, zero download projection, zero collection publication, and zero Presenter receipt; then use the existing retention cleanup.
- [ ] Use isolated tests/canaries for scanner, Meeting API, and warm-queue failure. Prove fail closed and durable work is not lost; never disable a shared production dependency.
- [ ] Move the test occurrence by at least five minutes before start and prove Admin occurrence, private consumer, LINE reader, and Presenter discovery converge within 60 seconds with the same original occurrence identity. Cancel it and prove warmers/Presenter cadence return to idle without fabricated fallback.
- [ ] After final work, wait through Meeting end, tail, pulse TTL, and 120-second cooldown; prove both workers have zero replicas.
- [ ] Record scheduler executions, worker replica/vCPU/GiB hours, requests/queue work, and provider cost available for the fixed window. Separate fixed scheduler cost from Meeting-window worker cost and obtain user cost acceptance.

### Task 4: Record The Formal Decision

- [ ] Record source PR/CI, release digest/revision, device/version, sample coverage/SLO, security/failure, schedule propagation, scale-zero/cost, and every unresolved item in the evidence file.
- [ ] Mark Phase 1 accepted only when Tasks 1-3 all pass and the user accepts cost. If only macOS device evidence exists, record Windows unverified rather than generalizing it.
- [ ] Archive the test Meeting through the existing lifecycle while retaining stable identity, audit, opaque evidence IDs, and normal telemetry retention.
- [ ] Commit the redacted evidence through the normal documentation PR/CI flow. This result does not change Phase 2 implementation status.
