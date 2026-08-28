# Weekly Bulletin Online Reader — Private Interactions and Offline Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let signed-in readers select one or more sentences, apply red/yellow/blue fluorescent highlights, copy, write private notes, resume reading, and safely use those features offline.

**Architecture:** `hhc-web-api` owns reader-private state keyed by the trusted Account user ID. The gateway authenticates normal member routes without a CMS scope. The reader keeps a small IndexedDB replica and idempotent pending-mutation queue, synchronizing when online. `account-api` remains identity authority and calls one idempotent internal erasure endpoint before final account deletion.

**Tech Stack:** Go 1.25, PostgreSQL, Nginx gateway policy, OpenAPI, TypeScript, React 19, IndexedDB, native Service Worker, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-21-weekly-bulletin-online-reader-design.md`

## Global Constraints

- Highlight, note, and progress data are private to the authenticated account and never visible to Admin Console.
- Toolbar order is exactly `[ yellow red blue ] Clear Copy Note`; the three colors are one unseparated group at the far left.
- Click unselected sentence to select; click it again to unselect; selection may be multi-sentence and non-contiguous.
- Applying a color atomically sets that color on every selected sentence and replaces prior colors. Clear atomically removes only highlights; notes remain.
- Color, Clear, and Copy retain selection. Successful Note creation clears selection; cancel retains it.
- Mixed selected highlight colors show no active swatch. Copy is public and works signed out.
- Login restores the exact selection and intended action, then asks for confirmation before any write.
- Highlights use last successful write wins. Notes use `baseVersion` conflicts with cloud/local/manual resolution. Mutations are idempotent.
- Logout clears private cache and pending private mutations; public offline bulletin content may remain.
- Private browser API calls use short-lived Account Bearer tokens held only in memory; gateway/session-cookie authentication is not added.
- V1 supports replay of private offline mutations for 90 days. Older pending notes/actions remain locally visible as `Action required` and are never silently dropped or assigned a fresh idempotency key.
- No CRDT, WebSocket, background-sync dependency, rich-text notes, shared notes, or Admin access.

---

### Task 1: Add private reader storage and sentence-anchor rules

**Repository:** `hhc-web-api`

**Files:**
- Create: `internal/migrations/sql/027_bulletin_reader_private_data.sql`
- Create: `internal/bulletinreader/types.go`
- Create: `internal/bulletinreader/service.go`
- Create: `internal/bulletinreader/service_test.go`
- Create: `internal/bulletinreader/repository.go`
- Modify: `internal/postgres/repository.go`
- Modify: `internal/postgres/repository_integration_test.go`

**Interfaces:**
- `Highlight`: one row per `(user_id, issue_id, content_locale, sentence_id)` with `yellow | red | blue`, update version, and timestamp.
- `Note`: private plain text plus ordered sentence anchors, quote snapshot, version, inactive-anchor metadata, and timestamps.
- `Progress`: last page/component/sentence plus viewport mode and timestamp per user/edition.
- `ReaderMigrationState`: one row per user/edition with the last transactionally applied published revision and any unresolved migration conflicts.
- Sentence migrations consume a server-composed mapping built from complete published→published checkpoints in CMS migration `026`; draft saves create no client checkpoint, and published revisions cannot contain unresolved `requires_review` mappings.

- [ ] Write failing tests for multi-sentence atomic highlight replacement/clear, notes unaffected by clear, multiple notes per sentence, note version conflicts, progress upsert, and ownership isolation.
- [ ] Write migration tests for user/edition indexes, color constraint, note length, unique idempotency key per user, processed-mutation `expires_at`/pruning index, erasure audit/result uniqueness, cascading edition deletion, and no foreign key to the separate Account database.
- [ ] Add typed services that take `userID` as an explicit trusted argument and never accept it from JSON.
- [ ] Store quote snapshots only for private anchored content; when a sentence is removed, retain the snapshot and mark the anchor inactive.
- [ ] Automatically migrate `unchanged` and `moved` anchors. On split, duplicate the anchor across mapped sentences; on merge, automatically merge compatible same-color highlights and return a user-resolution conflict only when source colors differ.
- [ ] Implement one idempotent transaction that advances a user's Highlight/Note/Progress rows and `ReaderMigrationState` through the composed published mapping; repeated calls cannot duplicate split anchors, merge notes twice, or regress the applied revision.
- [ ] Run focused service/repository/migration tests and commit.

```bash
git add internal/migrations internal/bulletinreader internal/postgres
git commit -m "feat: store private bulletin reader activity"
```

### Task 2: Add authenticated reader and idempotent mutation APIs

**Repository:** `hhc-web-api`

**Files:**
- Create: `internal/httpapi/bulletin_reader_handlers.go`
- Create: `internal/httpapi/bulletin_reader_handlers_test.go`
- Modify: `internal/httpapi/handler.go`
- Modify: `internal/httpapi/auth.go`
- Modify: `openapi.yaml`

**Interfaces:**
- Authenticated browser routes live under `/api/bulletin-reader/issues/{issueNumber}/{contentLocale}`.
- `GET /state` first idempotently migrates that user's cloud Highlight/Note/Progress rows from `ReaderMigrationState.applied_revision` to the current published revision, then returns the migrated state, applied/current revision, and pending sentence-migration conflicts.
- `GET /state?fromRevision={revision}` additionally composes retained published checkpoints server-side and returns one bounded direct mapping from that published revision to current plus its conflicts. `mapping_history_unavailable` means the source revision/checkpoint is genuinely missing or corrupt, not that an arbitrary transition-count limit was reached.
- `POST /mutations` accepts a bounded ordered batch of `{ mutationId, createdAt, documentRevision, kind, baseVersion?, payload }` and returns one deterministic result per mutation. `createdAt` is immutable client metadata for local 90-day UX, not a trusted server clock.
- The closed mutation union includes `resolveHighlightMigrationConflict { conflictId, chosenColor, currentRevision }`. It uses a new mutation ID to transactionally set the merged target highlight, mark that conflict resolved, and advance `ReaderMigrationState` when no blocking conflicts remain.
- `DELETE /priv/bulletin-reader/users/{userID}` is internal, idempotent, and accepts only the `account-api` Dapr caller.
- The erasure route requires `Idempotency-Key: account-delete:{userID}`; it records only operation state, deleted-record counts, result, and timestamps.
- Every authenticated/authorized valid erasure request returns `204` for first deletion, zero matching rows, and repeated completed operation. `404` is never an idempotent-success signal; it means route/deployment drift or a malformed path.

- [ ] Write failing tests proving trusted user ID comes only from gateway headers, no CMS scope is required, cross-user IDs are ignored/rejected, duplicate terminal mutation IDs replay results, a failed atomic highlight group changes nothing, `GET /state` repeatedly migrates cloud split/merge/remove/progress without duplication, highlight-conflict resolution is idempotent/owned/current-revision-only and advances state exactly once, and `fromRevision` returns the exact composed mapping/conflicts or genuine `mapping_history_unavailable`; include 33+ draft saves and 40 published checkpoints to prove no client transition ceiling.
- [ ] Add a member-auth mux wrapped by the existing gateway trust check but no scope check; keep it separate from public and Admin muxes.
- [ ] Validate document revision and sentence anchors on every mutation; return structured `revision_changed`, `note_conflict`, and `highlight_merge_conflict` results without partial writes.
- [ ] Treat `revision_changed` as non-terminal and do not consume/store that mutation ID; store and replay only successful or terminal business-conflict results, bound each ID to a request fingerprint, and reject same-ID/different-payload reuse.
- [ ] Limit batch size, note length, anchor count, and request body; use one DB transaction per atomic action group.
- [ ] Retain processed mutation IDs/results for 91 days; index `expires_at`, prune in bounded batches, and prove terminal replay works before expiry. The server does not guess the age of an unseen ID; the client uses immutable local `createdAt` to mark operations older than 90 days `Action required` and never silently drops or renumbers them.
- [ ] Implement internal erasure caller validation with Dapr API token + exact `account-api` app ID and delete all reader-private rows in one idempotent transaction.
- [ ] Insert/replay an erasure operation as `started`, then transactionally delete private rows and mark it `succeeded` with non-sensitive counts. On failure, best-effort mark it `failed` outside the rolled-back deletion transaction and emit an incomplete-erasure metric/alert; retain no private content.
- [ ] Set `Cache-Control: private, no-store` on every authenticated reader success and error response.
- [ ] Add bounded OpenAPI request/result unions including `resolveHighlightMigrationConflict`, and explicit `401`, `409`, and `422` responses.
- [ ] Run `go test ./... -race -count=1 -p=1`, `go vet ./...`, migration checks, and commit.

```bash
git add internal openapi.yaml
git commit -m "feat: expose private bulletin reader state"
```

### Task 3: Publish the private reader client contract

**Repository:** `frontend-platform`

**Files:**
- Modify: `packages/hhc-web-client/openapi/hhc-web-api.yaml`
- Regenerate: `packages/hhc-web-client/src/generated.ts`
- Modify: `packages/hhc-web-client/src/client.ts`
- Modify: `packages/hhc-web-client/src/client.test.ts`
- Modify: root `package.json`, all four `packages/*/package.json` manifests, and `pnpm-lock.yaml`

- [ ] Copy the Task 2 contract and regenerate.
- [ ] Add convenience calls only for `getReaderState({ fromRevision? })` and `applyReaderMutations`; the latter carries the generated highlight-conflict-resolution union. Do not add a second migration endpoint.
- [ ] Test Bearer forwarding, idempotent batch payloads, conflict decoding/resolution, and unauthenticated errors; session cookies alone are not an authenticated API credential.
- [ ] Run generated checks, full tests, lint, build, package packing, and consumer tests.
- [ ] Increment the current root patch version once, set it in the root and all four package manifests, run `pnpm install --lockfile-only` and `pnpm check:packages`, then PR, pass CI, merge, tag, publish all packages, and record the exact version for the website.

### Task 4: Authorize the Website token caller in the Account contract

**Repository:** `account-api`

**Files:**
- Modify: `docs/openapi.yaml`
- Modify: access-token handler/policy tests covering allowed client IDs

- [ ] Add a failing contract/handler test proving runtime `X-HHC-Client-ID: www-web` may POST the existing `/v1/session/access-token` endpoint after a valid Account session, while unknown clients and all other methods remain denied.
- [ ] Update the authoritative Account OpenAPI `x-hhc-callers` service name from only `account-fe, admin-fe` to include `hhc-web`; document `www-web` separately as the gateway-injected runtime client binding. Reuse the existing token/session implementation and do not create another token endpoint.
- [ ] Run the repository's OpenAPI/contract, auth, Go, and full verification; release this backward-compatible owner contract before the gateway exposes the www route.

```bash
git add docs/openapi.yaml internal
git commit -m "feat: authorize website access-token caller"
```

### Task 5: Permit normal-account reader routes at the gateway

**Repository:** `api-gateway`

**Files:**
- Modify: `conf.d/default.conf`
- Modify: `docs/openapi.yaml`
- Modify: `docs/openapi_test.go`
- Modify: `scripts/test-auth-method-matrix.sh`
- Modify: `scripts/test-www-routing.sh`

- [ ] Add failing cases for anonymous/session-cookie-only denial on reader routes, valid Account Bearer JWT, spoofed `X-HHC-*` stripping, allowed state GET and mutation POST, crossed `POST /state` and `GET /mutations`, invalid locale/issue, and all other methods denied.
- [ ] Add an exact POST-only www-host route for `/api/account/v1/session/access-token` to the existing account upstream, with the existing account/session-cookie policy and rate limit plus `X-HHC-Client-ID: www-web`; deny GET/HEAD and broader `/api/account/*`, and cover it in both routing/auth matrices.
- [ ] Add two exact protected locations: `/api/bulletin-reader/issues/{number}/{zh-Hant|zh-Hans|en}/state` permits only GET/HEAD, and `/mutations` permits only POST.
- [ ] Set required roles/scopes empty and include the existing protected identity configuration so every valid account can use the feature.
- [ ] Keep Admin/public routes unchanged and keep `/priv/*` unavailable on all public hosts.
- [ ] Update the gateway canonical OpenAPI and contract tests with the www access-token binding plus exact reader state/mutation operations; remove the stale statement that www has no access-token route.
- [ ] Run gateway route/auth tests, Go tests/vet, Nginx validation, and commit.

```bash
git add conf.d/default.conf docs/openapi.yaml docs/openapi_test.go scripts
git commit -m "feat: protect bulletin reader activity routes"
```

### Task 6: Implement sentence selection, toolbar, copy, and login continuation

**Repository:** `hhc-web`

**Files:**
- Modify: `package.json`
- Modify: lockfile
- Modify: `src/components/layout/AccountControl.tsx`
- Modify: `src/components/layout/AccountControl.test.tsx`
- Create: `src/lib/authenticated-hhc-web-client.ts`
- Create: `src/lib/authenticated-hhc-web-client.test.ts`
- Create: `src/features/weekly-reader/selection.ts`
- Create: `src/features/weekly-reader/selection.test.ts`
- Create: `src/features/weekly-reader/copy.ts`
- Create: `src/features/weekly-reader/copy.test.ts`
- Create: `src/components/weekly-reader/SentenceLayer.tsx`
- Create: `src/components/weekly-reader/SelectionToolbar.tsx`
- Create: `src/components/weekly-reader/SelectionToolbar.test.tsx`
- Modify: `src/components/weekly-reader/WeeklyReader.tsx`
- Modify: `src/components/weekly-reader/reader.css`
- Modify: locale message files for five reader-control locales

- [ ] Update to the exact client package from Task 3.
- [ ] Write failing reducer tests for toggle select/unselect, non-contiguous ordered selection, mixed colors, toolbar absent at zero selection, desktop/iPad page change clearing selection, mobile selection across components, action retention/clearing, and selection restoration after login.
- [ ] Keep selection state as an ordered set of stable sentence IDs; do not add a state library.
- [ ] Render the exact toolbar order and fluorescent color treatment, with accessible color names and pressed/mixed states.
- [ ] Implement Copy for signed-out and signed-in users in document order, insert blank lines between components, and append `— 第 {issueNumber} 期《{title}》` with no URL.
- [ ] Expose the existing Account login transaction through a focused hook; store issue, revision, viewport mode, page/section anchor, ordered selection, and intended action in session storage. On return, first restore position and selection for that exact issue/revision, then ask for confirmation.
- [ ] After login, show a confirmation for color/Clear/Note; never apply the stored write automatically.
- [ ] Build the authenticated Website client around existing `issueAccessToken()`: hold token only in memory, refresh 30 seconds before `expiresIn`, clear on account BroadcastChannel/logout/switch, and retry exactly once after a 401 by issuing a new token. Do not persist tokens or teach the gateway to accept session cookies.
- [ ] Add keyboard selection/action support and announce selection/action results through the existing accessible status pattern.

### Task 7: Add highlight, note, and reading-progress UI

**Repository:** `hhc-web`

**Files:**
- Create: `src/features/weekly-reader/private-state.ts`
- Create: `src/features/weekly-reader/private-state.test.ts`
- Create: `src/components/weekly-reader/NoteEditor.tsx`
- Create: `src/components/weekly-reader/NotesPanel.tsx`
- Create: `src/components/weekly-reader/ReaderPrivateState.tsx`
- Modify: `src/components/weekly-reader/SentenceLayer.tsx`
- Modify: `src/components/weekly-reader/SelectionToolbar.tsx`
- Modify: `src/components/weekly-reader/WeeklyReader.tsx`

- [ ] Write failing tests for atomic mixed-selection recolor, Clear preserving notes, note success/cancel selection behavior, multiple notes, inactive quote display, progress debounce, signed-out controls, token refresh, 401 single retry, and token clearing on logout/account switch.
- [ ] Fetch current-bulletin private state only after authentication; a failure must not block public reading/copy.
- [ ] Apply optimistic highlight/progress updates with rollback on a rejected mutation; notes wait for server acknowledgement before leaving edit mode.
- [ ] Render note editor/list in a right panel on desktop/iPad and an accessible bottom sheet on phones; show only the current bulletin's notes.
- [ ] Add inline note indicators and a current-bulletin `My Notes` list with create, edit, delete, and jump-to-source behavior; do not add a global notes center.
- [ ] Use plain text controls, explicit save/cancel, character count, and cloud/local/manual UI for a note version conflict.
- [ ] Save progress on settled page/component changes and page visibility change, not on every scroll/pan frame.
- [ ] Feed signed-in cloud progress into the existing `ResumeReadingPrompt` and offer the same explicit `Continue | Start over`; Start over writes the reset through the normal idempotent progress mutation path.

### Task 8: Add the private offline replica and synchronization

**Repository:** `hhc-web`

**Files:**
- Modify: `src/features/weekly-reader/offline-store.ts`
- Modify: `src/features/weekly-reader/offline-store.test.ts`
- Create: `src/features/weekly-reader/sync.ts`
- Create: `src/features/weekly-reader/sync.test.ts`
- Create: `src/components/weekly-reader/SyncStatus.tsx`
- Modify: `src/components/weekly-reader/ReaderPrivateState.tsx`
- Modify: `src/components/layout/AccountControl.tsx`
- Modify: `src/components/layout/AccountControl.test.tsx`
- Modify: `public/sw.js`

- [ ] Add separate IndexedDB stores for private state and pending mutations, keyed by account ID + edition; never put bearer tokens or session secrets in IndexedDB/Cache Storage.
- [ ] Write failing tests for offline mutation enqueue, idempotent replay order, highlight last-successful-write-wins, concurrent note conflict, delete-vs-edit preserving both sides, interrupted sync resume, expired authentication pausing sync, account switch, logout clearing, public-cache preservation, no private Cache Storage responses, and a two-tab logout-vs-sync race.
- [ ] Queue one compact mutation per final user action. Coalesce only unsent progress; retain each multi-sentence highlight action as one atomic anchor set, optionally replacing it only when a later unsent action has the exact same anchor set. Never coalesce individual highlight anchors or note operations.
- [ ] Sync on app start, regained connectivity, and visible foreground. Reuse the existing account-state BroadcastChannel plus account-scoped `navigator.locks`; do not depend on Service Worker Background Sync or only an in-page mutex.
- [ ] On published revision change, wrap the public-plan update state machine: call `GET /state?fromRevision={oldRevision}`, use its composed direct mapping to rebase pending mutation anchors/versions to current, require resolution for conflicts, replay those same mutation IDs against current, then atomically switch the validated document and migrated private state. Retain the old document on any mapping, conflict, replay, validation, or download failure; never first submit stale-revision mutations and hope the server guesses.
- [ ] Require user resolution for differing-color merged highlights and note conflicts; automatically migrate unambiguous unchanged/moved/split/removed and compatible same-color merged anchors.
- [ ] Render each differing-color merge conflict with the source colors and red/yellow/blue choice; submit `resolveHighlightMigrationConflict` with a new mutation ID, retain the old revision until its acknowledgement, and make offline replay/retry safe.
- [ ] On logout/account change, broadcast an incremented logout epoch, abort all tabs, then under the account lock transactionally remove that account's private state and pending writes; stale epochs cannot write back. Leave explicit public offline documents intact.
- [ ] Keep the Service Worker network-only for Authorization-bearing requests and exact `/api/bulletin-reader/*` paths; assert Cache Storage remains free of private responses before and after logout.
- [ ] Surface the approved statuses `Synced | Waiting for connection | Syncing | Action required` plus a Retry action where applicable, without blocking reading.
- [ ] On authentication expiry, keep cached public content readable, retain pending private mutations, pause synchronization, and resume only after reauthentication; do not retry through note conflicts.
- [ ] Before sync, mark locally created mutations older than 90 days `Action required`; keep their original IDs/content for user review/export and never send, drop, or renumber them automatically.

### Task 9: Integrate final account erasure

**Repository:** `account-api`

**Files:**
- Create: `internal/hhcwebclient/client.go`
- Create: `internal/hhcwebclient/client_test.go`
- Modify: `internal/config/config.go`
- Modify: `internal/config/config_test.go`
- Modify: `internal/services/user_service.go`
- Modify: `internal/services/user_service_test.go`
- Modify: `cmd/main.go`

**Interfaces:**
- Add `HHC_WEB_API_URL` with the same `http://localhost:3500` Dapr sidecar default as `ENGAGEMENT_API_URL`.
- `EraseBulletinReader(ctx, userID)` invokes `DELETE /v1.0/invoke/hhc-web-api/method/priv/bulletin-reader/users/{userID}` as `account-api`.

- [ ] Write client tests for exact Dapr path, caller identity, stable erasure idempotency key, timeout, repeated/zero-row `204` success, bounded error bodies, and every `404` (missing endpoint, rollback, route typo) returning cleanup failure.
- [ ] Extend the deletion-order test to require `sessions -> newsletter -> push -> avatar -> bulletin-reader -> delete`, keeping every remote erasure before the guarded Account DB deletion.
- [ ] Add one setter/callback to `UserService`; do not create a generic cleanup registry.
- [ ] Accept only the explicit `204` erasure success. Fail the hard deletion with the existing cleanup error on every other status—including `404`—so Account DB deletion does not proceed and an operator retry safely replays every idempotent cleanup.
- [ ] Wire the client/config, run `go test ./...` and the repository's full verification, and commit.

```bash
git add cmd internal
git commit -m "feat: erase bulletin reader data with account deletion"
```

### Task 10: End-to-end release and acceptance

- [ ] Release `hhc-web-api` private storage plus internal erasure endpoint first while public gateway routes are absent; release the Task 4 `account-api` token contract plus cleanup callback second and pass token/hard-delete/erasure smoke before publishing `frontend-platform`, `api-gateway`, and `hhc-web`. Each repository gets its own branch, PR, passing CI, merge, immutable release, and live smoke.
- [ ] Verify signed-out multi-select and Copy, then login continuation with confirmation for each write action.
- [ ] Verify mixed existing highlights recolor atomically, Clear removes all selected highlights without notes, and Note success/cancel selection behavior matches the spec.
- [ ] Verify private data isolation with two accounts and confirm Admin APIs/UI have no access path.
- [ ] Install the PWA, save 1731, go offline, search/copy/highlight/note/progress, restart, reconnect, and verify idempotent convergence.
- [ ] Publish a controlled sentence edit/split/merge/remove revision and verify automatic mappings plus both required conflict dialogs.
- [ ] In one combined update smoke, create pending highlight/note mutations offline on the old revision, publish split/merge/remove changes, reconnect, fetch/migrate cloud state, rebase/resolve/replay the same IDs, and verify document plus private-state pointers switch atomically; force download and replay failures and verify both remain on the old revision.
- [ ] Log out with pending mutations and verify private IndexedDB data/pending writes are gone while the public saved bulletin remains readable.
- [ ] Deactivate a test account through the grace period, hard-delete it, verify private rows are erased and the content-free erasure audit/result remains, prove retry safety by repeating the internal erasure, and verify incomplete erasure alerts on a controlled dependency failure.
- [ ] Roll back/disable or deliberately misspell the erasure route in a controlled smoke, assert `404` blocks Account DB deletion, restore the route, retry the same idempotency key, and require `204` before deletion proceeds.
- [ ] Record current/previous Chrome, Edge, Safari plus iOS/iPad Safari PWA and Android Chrome PWA evidence before declaring V1 complete.
