# Locale Contract Safety and Shared Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make existing CMS writes safe for future locales, expose resolved public-content language semantics, and publish the shared locale/control foundation.

**Architecture:** `hhc-web-api` fails closed when a client omits a persisted translation and exposes both selected and exactly available locales on public content. `frontend-platform` separates Admin UI locales from product/content locales and refines existing React Aria controls without adding another component system.

**Tech Stack:** Go 1.25, PostgreSQL, OpenAPI, TypeScript, React Aria, Vitest, pnpm

## Global Constraints

- Preserve all existing three-locale requests and rows.
- An old client may receive `409 locale_set_mismatch`; it must never delete an unknown locale.
- Fallback selects one complete `zh-Hant` projection.
- Keep existing public package names; alias `ghost` to `utility` for one consumer migration.
- No new runtime dependency.

---

### Task 1: Fail closed on omitted CMS translations

**Repository:** `hhc-web-api`

**Files:**
- Modify: `internal/content/types.go`
- Modify: `internal/content/service.go`
- Modify: `internal/content/service_test.go`
- Modify: `internal/postgres/content_repository.go`
- Modify: `internal/postgres/content_repository_test.go`
- Modify: `internal/httpapi/content_handlers.go`
- Modify: `internal/httpapi/content_handlers_test.go`
- Modify: `openapi.yaml`

**Interfaces:**
- Consumes: persisted `Item.Translations` and existing optimistic version checks.
- Produces: `WriteInput.DeleteLocales []string`, `ErrLocaleSetMismatch`, HTTP `409 locale_set_mismatch`.

- [ ] **Step 1: Write service tests for omission and explicit deletion**

```go
func TestUpdateContentRejectsOmittedPersistedLocale(t *testing.T) {
    // Persisted item contains zh-Hant and ja; input contains only zh-Hant.
    // Expect ErrLocaleSetMismatch and zero repository update calls.
}

func TestUpdateContentAllowsExplicitLocaleDeletion(t *testing.T) {
    // Input names ja in DeleteLocales and keeps zh-Hant.
    // Expect the repository to receive only zh-Hant.
}
```

- [ ] **Step 2: Run the focused tests and confirm failure**

Run: `go test ./internal/content ./internal/httpapi ./internal/postgres`

Expected: FAIL because `DeleteLocales` and `ErrLocaleSetMismatch` do not exist.

- [ ] **Step 3: Add the minimal write contract and guard**

```go
type WriteInput struct {
    // existing fields...
    Translations  []Translation `json:"translations"`
    DeleteLocales []string      `json:"deleteLocales,omitempty"`
}

var ErrLocaleSetMismatch = errors.New("locale set mismatch")
```

In `Service.UpdateContent`, load the current item, validate `DeleteLocales`, reject overlap between submitted and deleted locales, and reject every persisted locale absent from both sets before calling the repository.

- [ ] **Step 4: Map the typed error and document the API**

Return status `409` with code `locale_set_mismatch`. Add `deleteLocales` as an optional array of `Locale` in `ContentWriteInput`; document that omission is preservation-protected, not deletion.

- [ ] **Step 5: Run service, HTTP, repository, and OpenAPI tests**

Run: `go test ./internal/content ./internal/httpapi ./internal/postgres ./internal/migrations && go test ./...`

Expected: PASS.

- [ ] **Step 6: Commit and deliver through PR**

```bash
git add internal/content internal/httpapi internal/postgres openapi.yaml
git commit -m "fix: protect omitted content locales"
```

### Task 2: Add resolved and available locale semantics to public content

**Repository:** `hhc-web-api`

**Files:**
- Modify: `internal/content/types.go`
- Modify: `internal/postgres/content_repository.go`
- Modify: `internal/postgres/content_repository_test.go`
- Modify: `internal/postgres/repository_integration_test.go`
- Modify: `openapi.yaml`

**Interfaces:**
- Consumes: requested route locale, selected projection locale, exact published projection rows.
- Produces:

```go
type PublicItem struct {
    // existing fields...
    ResolvedLocale   string   `json:"resolvedLocale"`
    AvailableLocales []string `json:"availableLocales"`
}
```

- [ ] **Step 1: Add failing projection tests**

Cover list and detail where requested `ja` resolves to `zh-Hant`, `availableLocales` is `[]string{"en", "zh-Hant"}`, and returned `Href` starts with `/ja/`. Cover exact `ja` winning after publication.

- [ ] **Step 2: Run the focused tests and confirm failure**

Run: `go test ./internal/postgres -run 'Public(Content|News|Fallback)'`

Expected: FAIL because locale metadata is absent and fallback href remains `/zh-Hant/...`.

- [ ] **Step 3: Populate locale metadata at the repository boundary**

Keep stored projection payloads locale-exact. After selecting the requested-or-`zh-Hant` projection, set `ResolvedLocale` from the selected projection row, load exact published locales for every returned resource in one bulk query for list endpoints (one query for detail), sort them in canonical locale order, and rewrite only the response `Href` prefix to the requested locale. Add a SQL-mock assertion that list retrieval does not issue one availability query per item.

- [ ] **Step 4: Update OpenAPI and contract tests**

Add required `resolvedLocale: Locale` and `availableLocales: Locale[]` to every public content item schema. Do not add them to Admin draft translations.

- [ ] **Step 5: Run all repository and API tests**

Run: `go test ./internal/postgres ./internal/content ./internal/httpapi && go test ./...`

Expected: PASS.

- [ ] **Step 6: Commit and release before five-locale migrations**

```bash
git add internal/content internal/postgres openapi.yaml
git commit -m "feat: expose resolved public content locales"
```

### Task 3: Split locale responsibilities in shared preferences

**Repository:** `frontend-platform`

**Files:**
- Modify: `packages/preferences/src/index.ts`
- Modify: `packages/preferences/src/index.test.ts`

**Interfaces:**
- Produces:

```ts
export const adminUiLocales = ['zh-Hant', 'zh-Hans', 'en'] as const
export type AdminUiLocale = (typeof adminUiLocales)[number]
export const productLocales = ['zh-Hant', 'zh-Hans', 'en', 'ja', 'ko'] as const
export type ProductLocale = (typeof productLocales)[number]
export const contentLocales = productLocales
export type ContentLocale = ProductLocale
export const localeMetadata: readonly {
  code: ProductLocale
  shortLabel: string
  nativeLabel: string
}[]
```

- [ ] **Step 1: Write detection and cookie tests**

Test `ja-JP → ja`, `ko-KR → ko`, `zh-CN → zh-Hans`, other `zh-* → zh-Hant`, unsupported product language → `en`, and Admin `ja/ko → en`. Test `hhc_locale` domain serialization and host-only `hhc_admin_locale` serialization.

- [ ] **Step 2: Run the package test and confirm failure**

Run: `pnpm --filter @hallelujahhomechurch/preferences test:run`

Expected: FAIL because the named sets/helpers are absent.

- [ ] **Step 3: Implement named sets and responsibility-specific helpers**

Retain the old `locales`/`Locale` export as a deprecated three-locale compatibility alias for this package release only. Consumers in later plans must move to named types.

- [ ] **Step 4: Run package tests and type build**

Run: `pnpm --filter @hallelujahhomechurch/preferences test:run && pnpm --filter @hallelujahhomechurch/preferences build`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/preferences/src
git commit -m "feat: split admin and product locales"
```

### Task 4: Redesign shared AccountMenu and Select

**Repository:** `frontend-platform`

**Files:**
- Modify: `packages/ui/src/overlays.tsx`
- Modify: `packages/ui/src/controls.tsx`
- Modify: `packages/ui/src/styles.css`
- Modify: `packages/ui/src/primitives.test.tsx`

**Interfaces:**
- Consumes: existing React Aria menu/select primitives and tokens.
- Produces: `Select` variant `utility`; `ghost` remains an alias for one release; consistent `AccountMenu` identity/action geometry.

- [ ] **Step 1: Add failing interaction/accessibility tests**

Test consistent row classes for normal/danger actions, selected option state, full accessible locale names, Escape/outside dismissal, focus restoration, pointer versus keyboard focus modality, disabled state, reduced motion, and identity text accessibility when visually truncated.

- [ ] **Step 2: Run UI tests and confirm failure**

Run: `pnpm --filter @hallelujahhomechurch/ui test:run`

Expected: FAIL on the new utility variant and shared row state assertions.

- [ ] **Step 3: Implement the minimum component and token changes**

Reuse current React Aria components. Remove the sign-out-specific floating margin/divider surface; keep danger foreground semantics. Use one inset `:focus-visible` treatment, `forced-color-adjust`-safe borders, 40px utility and 44px form hit areas, and `prefers-reduced-motion` overrides.

- [ ] **Step 4: Run test, build, lint, and package contract checks**

Run: `pnpm test && pnpm build && pnpm lint && pnpm check:packages && pnpm pack:packages && pnpm test:consumers`

Expected: PASS.

- [ ] **Step 5: Commit and publish the first package release through PR/main CI**

```bash
git add packages/ui packages/preferences
git commit -m "feat: refine shared utility controls"
```

Record the immutable package versions in the coordinating release ledger.
