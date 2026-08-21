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
- Modify: `internal/onlinebulletins/types.go`

**Interfaces:**
- `Highlight`: one row per `(user_id, issue_id, content_locale, sentence_id)` with `yellow | red | blue`, update version, and timestamp.
- `Note`: private plain text plus ordered sentence anchors, quote snapshot, version, inactive-anchor metadata, and timestamps.
- `Progress`: last page/component/sentence plus viewport mode and timestamp per user/edition.
- Sentence mapping records immutable old revision/ID to new revision/ID(s) with `unchanged | split | merged | removed`.

- [ ] Write failing tests for multi-sentence atomic highlight replacement/clear, notes unaffected by clear, multiple notes per sentence, note version conflicts, progress upsert, and ownership isolation.
- [ ] Write migration tests for user/edition indexes, color constraint, note length, unique idempotency key per user, cascading edition deletion, and no foreign key to the separate Account database.
- [ ] Add typed services that take `userID` as an explicit trusted argument and never accept it from JSON.
- [ ] Store quote snapshots only for private anchored content; when a sentence is removed, retain the snapshot and mark the anchor inactive.
- [ ] On split, duplicate the anchor across mapped sentences; on merge, merge compatible highlights and return a user-resolution conflict when source colors differ.
- [ ] Run focused service/repository/migration tests and commit.

```bash
git add internal/migrations internal/bulletinreader internal/onlinebulletins internal/postgres
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
- `GET /state` returns highlights, notes, progress, current published revision, and pending sentence-migration conflicts.
- `POST /mutations` accepts a bounded ordered batch of `{ mutationId, kind, baseVersion?, payload }` and returns one deterministic result per mutation.
- `DELETE /priv/bulletin-reader/users/{userID}` is internal, idempotent, and accepts only the `account-api` Dapr caller.

- [ ] Write failing tests proving trusted user ID comes only from gateway headers, no CMS scope is required, cross-user IDs are ignored/rejected, duplicate mutation IDs replay results, and a failed atomic highlight group changes nothing.
- [ ] Add a member-auth mux wrapped by the existing gateway trust check but no scope check; keep it separate from public and Admin muxes.
- [ ] Validate document revision and sentence anchors on every mutation; return structured `revision_changed`, `note_conflict`, and `highlight_merge_conflict` results without partial writes.
- [ ] Limit batch size, note length, anchor count, and request body; use one DB transaction per atomic action group.
- [ ] Implement internal erasure caller validation with Dapr API token + exact `account-api` app ID and delete all reader-private rows in one idempotent transaction.
- [ ] Add bounded OpenAPI request/result unions and explicit `401`, `409`, and `422` responses.
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
- Modify: package version files changed by the patch-version command

- [ ] Copy the Task 2 contract and regenerate.
- [ ] Add convenience calls only for `getReaderState` and `applyReaderMutations`; reuse generated mutation unions and conflict results.
- [ ] Test bearer/session forwarding, idempotent batch payloads, conflict decoding, and unauthenticated errors.
- [ ] Run generated checks, full tests, lint, build, package packing, and consumer tests.
- [ ] Patch-version, PR, pass CI, merge, publish, and record the exact version for the website.

### Task 4: Permit normal-account reader routes at the gateway

**Repository:** `api-gateway`

**Files:**
- Modify: `conf.d/default.conf`
- Modify: `scripts/test-auth-method-matrix.sh`
- Modify: `scripts/test-www-routing.sh`

- [ ] Add failing cases for anonymous denial, valid Account JWT/session identity, spoofed `X-HHC-*` stripping, allowed state GET/mutation POST, invalid locale/issue, and all other methods denied.
- [ ] Add one exact protected location for `/api/bulletin-reader/issues/{number}/{zh-Hant|zh-Hans|en}/{state|mutations}`.
- [ ] Set required roles/scopes empty and include the existing protected identity configuration so every valid account can use the feature.
- [ ] Keep Admin/public routes unchanged and keep `/priv/*` unavailable on all public hosts.
- [ ] Run gateway route/auth tests, Go tests/vet, Nginx validation, and commit.

```bash
git add conf.d/default.conf scripts
git commit -m "feat: protect bulletin reader activity routes"
```

### Task 5: Implement sentence selection, toolbar, copy, and login continuation

**Repository:** `hhc-web`

**Files:**
- Modify: `package.json`
- Modify: lockfile
- Modify: `src/components/layout/AccountControl.tsx`
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
- [ ] Write failing reducer tests for toggle select/unselect, non-contiguous ordered selection, mixed colors, action retention/clearing, and selection restoration after login.
- [ ] Keep selection state as an ordered set of stable sentence IDs; do not add a state library.
- [ ] Render the exact toolbar order and fluorescent color treatment, with accessible color names and pressed/mixed states.
- [ ] Implement Copy for signed-out and signed-in users in document order, insert blank lines between components, and append `— 第 {issueNumber} 期《{title}》` with no URL.
- [ ] Expose the existing Account login transaction through a focused hook, store pending selection/action in session storage, and restore it only for the same issue/revision.
- [ ] After login, show a confirmation for color/Clear/Note; never apply the stored write automatically.
- [ ] Add keyboard selection/action support and announce selection/action results through the existing accessible status pattern.

### Task 6: Add highlight, note, and reading-progress UI

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

- [ ] Write failing tests for atomic mixed-selection recolor, Clear preserving notes, note success/cancel selection behavior, multiple notes, inactive quote display, progress debounce, and signed-out controls.
- [ ] Fetch current-bulletin private state only after authentication; a failure must not block public reading/copy.
- [ ] Apply optimistic highlight/progress updates with rollback on a rejected mutation; notes wait for server acknowledgement before leaving edit mode.
- [ ] Render note editor/list in a right panel on desktop/iPad and an accessible bottom sheet on phones; show only the current bulletin's notes.
- [ ] Use plain text controls, explicit save/cancel, character count, and cloud/local/manual UI for a note version conflict.
- [ ] Save progress on settled page/component changes and page visibility change, not on every scroll/pan frame.

### Task 7: Add the private offline replica and synchronization

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
- [ ] Write failing tests for offline mutation enqueue, idempotent replay order, highlight last-successful-write-wins, note conflict pause, interrupted sync resume, account switch, logout clearing, and public-cache preservation.
- [ ] Queue one compact mutation per final user action; coalesce unsent progress and highlight writes for the same anchor while preserving note operations.
- [ ] Sync on app start, regained connectivity, and visible foreground with a single in-page mutex; do not depend on Service Worker Background Sync.
- [ ] On published revision change, sync pending writes first, fetch mappings/conflicts, download and verify the new public document, then atomically switch; retain the old document on any failure.
- [ ] Require user resolution for conflicting merged highlight colors and note conflicts; automatically migrate unambiguous unchanged/split/removed anchors.
- [ ] On logout/account change, abort sync and transactionally remove that account's private state and pending writes while leaving explicit public offline documents intact.
- [ ] Surface Offline, Syncing, Synced, Conflict, and Retry states without blocking reading.

### Task 8: Integrate final account erasure

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

- [ ] Write client tests for exact Dapr path, caller identity, timeout, idempotent 404/204 handling, and bounded error bodies.
- [ ] Extend the deletion-order test to require `sessions -> newsletter -> push -> avatar -> bulletin-reader -> delete`, keeping every remote erasure before the guarded Account DB deletion.
- [ ] Add one setter/callback to `UserService`; do not create a generic cleanup registry.
- [ ] Fail the hard deletion with the existing cleanup error when remote erasure fails so an operator retry safely replays every idempotent cleanup.
- [ ] Wire the client/config, run `go test ./...` and the repository's full verification, and commit.

```bash
git add cmd internal
git commit -m "feat: erase bulletin reader data with account deletion"
```

### Task 9: End-to-end release and acceptance

- [ ] Release in order: `hhc-web-api`, `frontend-platform`, `api-gateway`, `hhc-web`, then `account-api`; each repository gets its own branch, PR, passing CI, merge, immutable release, and live smoke.
- [ ] Verify signed-out multi-select and Copy, then login continuation with confirmation for each write action.
- [ ] Verify mixed existing highlights recolor atomically, Clear removes all selected highlights without notes, and Note success/cancel selection behavior matches the spec.
- [ ] Verify private data isolation with two accounts and confirm Admin APIs/UI have no access path.
- [ ] Install the PWA, save 1731, go offline, search/copy/highlight/note/progress, restart, reconnect, and verify idempotent convergence.
- [ ] Publish a controlled sentence edit/split/merge/remove revision and verify automatic mappings plus both required conflict dialogs.
- [ ] Log out with pending mutations and verify private IndexedDB data/pending writes are gone while the public saved bulletin remains readable.
- [ ] Deactivate a test account through the grace period, hard-delete it, verify `hhc-web-api` private rows are erased, and prove retry safety by repeating the internal erasure.
- [ ] Record current/previous Chrome, Edge, Safari plus iOS/iPad Safari PWA and Android Chrome PWA evidence before declaring V1 complete.
