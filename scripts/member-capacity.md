# Stateful member capacity probe

This explicitly invoked browser bundle reuses the pinned Account runtime, member
clients, reader validation and the existing restricted HLS parser. Importing it
does not issue requests. It is not imported by the product UI.

Build with `node scripts/build-member-capacity.mjs /absolute/output/directory`.
Use only a verified bundle in an already authenticated production WWW page, with
an independently reviewed scope and continuously refreshed external safety gate.
The gate must match the scope hash, remain at most ten seconds old, and expire
within the authorized window. A human authorization alone is not a ready gate.

`startMemberCapacity(options)` returns `done`, `snapshot()`, `evidence()`,
`cleanupLedger()`, `updateGate(next)` and `stop()`. The coordinator owns the
exclusive generator lock, aggregate request/byte ledger across stages, actual
service/queue/database monitoring, Mac CPU/memory/WAN calibration, and stage
admission. Pass only the remaining aggregate budgets, never a reset budget.
Do not export cookies, tokens, raw errors, grants or signed media URLs.

The model uses one real login with independently scoped active flows. It does not
represent distinct members, independent login sessions, login bursts or their
cache/authorization/watermark costs. Each seeded deck has the fixed mix in
`member-capacity-model.ts`. A baseline executes each operation once; the mixed
hold starts after all flows have entered, with a bounded ramp deadline. Ramp and
hold samples remain separately identifiable. Every attempted operation and HTTP
request is retained, including failures and interrupted work. Record both the
all-phase and hold summaries; do not average stage percentiles.

Reader writes require explicitly designated writable fixtures and an exclusive
private-state slot. Created bookmark/note IDs are unique to the run. Cleanup
deletes only those items; an uncertain or failed cleanup remains visible in the
ledger. Original progress remains in memory and is restored only when the current
timestamp matches the last test write. This is not a server-side compare-and-swap;
do not use a document that the account may concurrently edit. Never publish the
private cleanup ledger or replace an unrelated progress update.

Media requires independently approved analytics side effects and VOD long enough
for the requested dwell. The runner drains complete muxed audio/video bodies and
paces segments by EXTINF. Unsupported HLS (including separate audio, encryption,
byte ranges and live playlists) fails closed, rather than omitting that traffic.
Confirm the actual fixture format first. A protocol probe does not decode video;
independent real-player startup, buffering, audio, seek and dropped-frame evidence
is required. Normal token refresh and playback-grant renewal remain active.

PDF timing includes preparation, polling and the complete file. A fast job-create
response is not a completed download. Same-account warm PDF reuse is not evidence
of different members' cold watermark capacity.

The browser stops on stale admission, timeout/budgets, 429 or an operation failure.
SLO/error summaries are checked independently of request status; low-sample
results never establish a final percentile. An operation failure is a safety stop,
not proof of a capacity ceiling. Terminal partial/cancelled samples remain in the
evidence. A final capacity pass additionally requires the external statistical,
resource, recovery and minimum-sample gates.

Focused offline checks:

```sh
corepack pnpm exec vitest run scripts/member-capacity-model.node.test.ts scripts/member-capacity.runner.test.ts
corepack pnpm exec tsc --noEmit
```

The runner fixture mocks upstream clients and uses synthetic complete response
bodies. It is not a production integration or a live-readiness claim. Repository
checks, PR CI, runtime admission and real acceptance are separate evidence.
