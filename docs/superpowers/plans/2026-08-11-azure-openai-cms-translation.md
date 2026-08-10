# Azure OpenAI CMS Translation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let Admin generate review-only missing CMS translations from saved Traditional Chinese through Azure OpenAI without changing save or publish boundaries.

**Architecture:** `hhc-web-api` calls Azure OpenAI Responses API synchronously with strict JSON Schema, content-free telemetry, PostgreSQL fixed-window limits, and a translation-only response deadline. `admin-fe` issues independent target requests with concurrency two and inserts successful results into local dirty form state. The feature deploys disabled and is enabled only after infrastructure, privacy, and fluent-review gates pass.

**Tech Stack:** Go 1.25 standard `net/http`, PostgreSQL, Azure OpenAI Responses API, Azure Key Vault, Bicep, OpenTelemetry, React, TypeScript, Vitest

## Global Constraints

- Source locale is exactly `zh-Hant`; targets are `zh-Hans`, `en`, `ja`, or `ko`.
- Source aggregate limit is 20,000 characters.
- Azure timeout 40 seconds; handler 45 seconds; route write deadline 50 seconds; gateway 60 seconds.
- Per-actor limit is 10/minute; deployment limit is 60/minute.
- `store: false`, `background: false`, no tools, no retry.
- Preview never persists or publishes; logs, OTel, and audit rows never contain source/generated text.
- No OpenAI SDK, generic provider factory, job table, worker, polling, or Redis.

---

### Task 1: Add disabled-by-default Azure OpenAI configuration

**Repository:** `hhc-web-api`

**Files:**
- Modify: `internal/config/config.go`
- Modify: `internal/config/config_test.go`
- Modify: `infra/main.bicep`
- Modify: `.github/workflows/release.yml`

**Interfaces:**
- Produces:

```go
type TranslationConfig struct {
    Enabled          bool
    AzureEndpoint    string
    AzureDeployment  string
    AzureAPIKey      string
    ProviderTimeout  time.Duration // 40s
    HandlerTimeout   time.Duration // 45s
    WriteDeadline    time.Duration // 50s
    SourceCharLimit  int           // 20000
    ActorLimit       int           // 10/minute
    DeploymentLimit  int           // 60/minute
}
```

- [ ] **Step 1: Add failing config tests**

Test disabled mode with no Azure values; enabled mode requires HTTPS endpoint, deployment, and key; reject timeout ordering other than `provider < handler < write < 60s`; reject non-positive limits.

- [ ] **Step 2: Run tests and confirm failure**

Run: `go test ./internal/config`

Expected: FAIL because `TranslationConfig` is absent.

- [ ] **Step 3: Implement exact environment mapping**

Use `CMS_TRANSLATION_ENABLED`, `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_DEPLOYMENT`, and `AZURE_OPENAI_API_KEY`. Keep numeric/time limits code defaults; do not expose them to the browser.

- [ ] **Step 4: Add reviewed secret binding**

Add Key Vault secret reference `azure-openai-api-key` sourced from the existing runtime vault secret `hhc-web-azure-openai-api-key`. Add non-secret endpoint/deployment env values through Bicep parameters. Keep `CMS_TRANSLATION_ENABLED=false` in the first production release.

- [ ] **Step 5: Validate config and infrastructure**

Run: `go test ./internal/config && az bicep build --file infra/main.bicep --stdout >/dev/null`

Expected: PASS; output must not include a secret value.

- [ ] **Step 6: Commit**

```bash
git add internal/config infra/main.bicep .github/workflows/release.yml
git commit -m "feat: configure Azure OpenAI translation"
```

### Task 2: Implement strict Azure OpenAI Responses client

**Repository:** `hhc-web-api`

**Files:**
- Create: `internal/translation/types.go`
- Create: `internal/translation/prompt.go`
- Create: `internal/translation/azure_openai.go`
- Create: `internal/translation/azure_openai_test.go`
- Create: `internal/translation/prompt_test.go`

**Interfaces:**
- Produces:

```go
type Request struct {
    Module       string
    SourceLocale string
    TargetLocale string
    Fields       map[string]string
}

type Result struct { Fields map[string]string }

type Generator interface {
    Generate(context.Context, Request) (Result, error)
}
```

- [ ] **Step 1: Add failing `httptest.Server` contract tests**

Assert request path `/openai/v1/responses`, `api-key` header, configured deployment in `model`, `store:false`, `background:false`, no tools, strict JSON Schema field allowlist, source content only in an untrusted-data message, and successful parsing from `output[].content[]` where `type == "output_text"`. Accept top-level `output_text` only as a compatibility fallback. Require `status == "completed"`, `error == nil`, and no refusal, incomplete response, or content-filter failure. Cover malformed JSON, unknown fields, Azure non-2xx, and 40-second context cancellation using a short injected test timeout.

- [ ] **Step 2: Run tests and confirm failure**

Run: `go test ./internal/translation`

Expected: FAIL because the package does not exist.

- [ ] **Step 3: Implement the focused standard-library client**

Build the request with `encoding/json`, `http.NewRequestWithContext`, and an injected `*http.Client`. Limit response reads to 1 MiB. Never log request or response bodies. Map Azure failures to package errors without copying provider body text.

- [ ] **Step 4: Add prompt-version and schema tests**

Set prompt version `cms-translation-v1`. Assert Japanese `です・ます`, Korean `해요체`/contextual `합니다체`, terminology preservation, no new facts/emoji/commentary, and field-specific rules are present. Do not snapshot subjective translations.

- [ ] **Step 5: Run tests and commit**

Run: `go test ./internal/translation`

```bash
git add internal/translation
git commit -m "feat: add Azure OpenAI translation client"
```

### Task 3: Add atomic PostgreSQL rate limits and content-free audit

**Repository:** `hhc-web-api`

**Files:**
- Create: `internal/migrations/sql/023_translation_rate_limits.sql`
- Modify: `internal/migrations/migrations.go`
- Modify: `internal/migrations/migrations_test.go`
- Create: `internal/postgres/translation_repository.go`
- Create: `internal/postgres/translation_repository_test.go`
- Modify: `internal/postgres/repository_integration_test.go`

**Interfaces:**
- Produces:

```go
func (r *Repository) ReserveTranslation(ctx context.Context, actor string, now time.Time, actorLimit, deploymentLimit int) error
func (r *Repository) RecordTranslationAudit(ctx context.Context, event translation.AuditEvent) error
```

- [ ] **Step 1: Add failing SQL and integration tests**

Test atomic actor/deployment counters, minute rollover, concurrent reservations never exceeding limits, opportunistic deletion of windows older than one hour, and audit payload containing only actor/resource/locales/provider/deployment/prompt version/character count/duration/outcome.

- [ ] **Step 2: Run tests and confirm failure**

Run: `go test ./internal/migrations ./internal/postgres`

Expected: FAIL because migration 023 and repository methods are absent.

- [ ] **Step 3: Implement one counter table and audit writes**

Use a primary key `(scope, window_start)` and `INSERT ... ON CONFLICT ... DO UPDATE SET count=count+1 ... RETURNING count` inside one transaction for deployment then actor. Roll back both increments if either limit would be exceeded.

- [ ] **Step 4: Run tests and commit**

Run: `go test ./internal/migrations ./internal/postgres`

```bash
git add internal/migrations internal/postgres
git commit -m "feat: limit and audit CMS translations"
```

### Task 4: Add typed preview service and HTTP endpoints

**Repository:** `hhc-web-api`

**Files:**
- Create: `internal/translation/service.go`
- Create: `internal/translation/service_test.go`
- Create: `internal/httpapi/translation_handlers.go`
- Create: `internal/httpapi/translation_handlers_test.go`
- Modify: `internal/httpapi/handler.go`
- Modify: `internal/httpapi/handler_test.go`
- Modify: `cmd/server/main.go`
- Modify: `cmd/server/telemetry_test.go`
- Modify: `openapi.yaml`

**Interfaces:**
- Produces:
  - `POST /api/admin/content/{module}/{contentId}/translation-previews/{targetLocale}`
  - `POST /api/admin/bulletins/{issueId}/translation-previews/{targetLocale}`
  - errors `invalid_translation_request`, `translation_exists`, `version_mismatch`, `translation_rate_limited`, `translation_provider_error`, `translation_timeout`.
- Consumes saved resources through:

```go
type ContentSource interface {
    GetContent(context.Context, content.Module, string) (content.Item, error)
}

type BulletinSource interface {
    GetIssue(context.Context, string) (bulletins.Issue, error)
}
```

`cmd/server/main.go` injects the existing `content.Service` and `bulletins.Service`; the translation package never reads PostgreSQL directly.

- [ ] **Step 1: Add failing service tests**

Cover saved source lookup, `If-Match`, exact missing-row semantics, explicit replacement, module field allowlists, 20,000-character rejection before reservation/provider call, structured-result validation, no persistence, and metadata-only audit for every outcome.

- [ ] **Step 2: Add failing handler/deadline tests**

Assert `cms:write`, strict body decoding, `If-Match`, typed status mapping, disabled feature response, and that only these handlers call `http.NewResponseController(w).SetWriteDeadline(now+50s)`. Add `Unwrap() http.ResponseWriter` to the access-log `statusWriter`; never ignore a `SetWriteDeadline` error. In `internal/httpapi`, test `statusWriter.Unwrap()` and handler behavior with an instrumented deadline setter. In `cmd/server/telemetry_test.go` (`package main`), exercise the complete `newHTTPTraceHandler(handler.Routes())` chain with injected clock/durations so tests do not sleep; prove translation gets 50 seconds while an ordinary route keeps the server-wide 30-second deadline.

- [ ] **Step 3: Run focused tests and confirm failure**

Run: `go test ./internal/translation ./internal/httpapi`

Expected: FAIL because service/routes are absent.

- [ ] **Step 4: Implement the minimum service and route wiring**

Create a 45-second child context, let the Azure client stop at 40 seconds, set the route write deadline at entry, return HHC `504` while the connection is still writable, and leave `http.Server.WriteTimeout` at 30 seconds globally.

- [ ] **Step 5: Add content-free OTel attributes**

Record module, target locale, outcome, prompt version, deployment identifier, character count, and duration. Never attach title/body/source/output or provider response body.

- [ ] **Step 6: Run full verification and commit**

Run: `go test ./...`

```bash
git add internal/translation internal/httpapi cmd/server/main.go openapi.yaml
git commit -m "feat: add CMS translation previews"
```

Merge and release with `CMS_TRANSLATION_ENABLED=false`; verify ordinary endpoints still terminate at the existing 30-second server budget.

### Task 5: Separate Admin UI locale and expose five content locales

**Repository:** `admin-fe`

**Files:**
- Modify: `src/preferences/locale-context.tsx`
- Modify: `src/preferences/preferences.test.ts`
- Modify: `src/components/AppLayout.tsx`
- Modify: `src/index.css`
- Modify: `src/pages/content/ContentEditorPage.tsx`
- Modify: `src/pages/content/ContentEditorPage.test.tsx`
- Modify: `src/pages/content/ContentModulePage.tsx`
- Modify: `src/pages/BulletinDetailPage.tsx`
- Modify: `src/pages/BulletinDetailPage.test.tsx`
- Modify: `src/pages/CampaignPages.tsx`
- Modify: `src/pages/CampaignSchedulePages.tsx`

**Interfaces:**
- Consumes: shared `AdminUiLocale`, `ContentLocale`, `adminUiLocales`, `contentLocales`, `localeMetadata`, and utility `Select`.
- Produces: `LocaleContextValue.setLocale(locale: AdminUiLocale): void`; five-locale editor tabs/counts; explicit translation deletion intent.

- [ ] **Step 1: Add failing Admin preference tests**

Test `hhc_admin_locale` read/write, host-only cookie serialization, Admin `ja/ko` browser detection → `en`, selector reload persistence, and no read of `hhc_locale`.

- [ ] **Step 2: Add failing editor compatibility tests**

Load an item containing `ja`/`ko`, save without editing, and assert all translations are retained. Confirm a dedicated delete action adds the locale to `deleteLocales` only after confirmation. Assert completion counts use `/5` while console messages remain `/3` locales.

- [ ] **Step 3: Implement the selector and generated locale types**

Place the three-language utility selector in `AppLayout` header before `AccountMenu`. Derive content tabs from generated `ContentLocale` plus shared metadata; remove page-local locale tuples.

- [ ] **Step 4: Run focused and full frontend verification**

Run: `pnpm test:run && pnpm build && pnpm lint`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/preferences src/components/AppLayout.tsx src/index.css src/pages
git commit -m "feat: separate Admin and content locales"
```

### Task 6: Add Admin translation-preview workflow

**Repository:** `admin-fe`

**Files:**
- Modify: `src/lib/cms-api.ts`
- Modify: `src/lib/cms-api.test.ts`
- Modify: `src/lib/mock-cms-api.ts`
- Create: `src/lib/translation-previews.ts`
- Create: `src/lib/translation-previews.test.ts`
- Modify: `src/pages/content/ContentEditorPage.tsx`
- Modify: `src/pages/content/ContentEditorPage.test.tsx`
- Modify: `src/pages/BulletinDetailPage.tsx`
- Modify: `src/pages/BulletinDetailPage.test.tsx`
- Modify: `src/preferences/locale-context.tsx`

**Interfaces:**
- Produces:

```ts
export type TranslationPreview = {
  sourceLocale: 'zh-Hant'
  targetLocale: ContentLocale
  sourceVersion: number
  translation: Record<string, string>
}

export async function mapWithConcurrency<T, R>(values: readonly T[], limit: 2, run: (value: T) => Promise<R>): Promise<PromiseSettledResult<R>[]>
```

- [ ] **Step 1: Add failing API and concurrency tests**

Test exact endpoints/body/`If-Match`, concurrency never above two, populated/partial locale rows skipped by batch, successes retained when another target fails, per-language retry, and `replaceExisting:true` only after confirmation.

- [ ] **Step 2: Run tests and confirm failure**

Run: `pnpm test:run -- src/lib/translation-previews.test.ts src/lib/cms-api.test.ts src/pages/content/ContentEditorPage.test.tsx src/pages/BulletinDetailPage.test.tsx`

Expected: FAIL because preview methods/UI do not exist.

- [ ] **Step 3: Implement preview-only local draft updates**

Generate only currently reviewable fields: news title/body/imageAlt, history event title/body, video title, bulletin title/subtitle. Mark generated tabs dirty and AI-generated; do not call save or publish.

- [ ] **Step 4: Add typed error UX**

Render per-language retry for `429`, `502`, and `504`; require reload for `412`; preserve all successful local previews. Never display provider response bodies.

- [ ] **Step 5: Run full frontend verification and commit**

Run: `pnpm test:run && pnpm build && pnpm lint`

```bash
git add src/lib src/pages src/preferences
git commit -m "feat: preview missing CMS translations"
```

Merge and release after the disabled backend revision is live.

### Task 7: Enable production after provider and language-review gates

**Repositories:** Azure infrastructure, `hhc-web-api`, operational evidence

**Files:**
- Modify: `docs/release-evidence/five-locale/README.md`

**Interfaces:**
- Consumes: deployed Azure resource/deployment, Key Vault binding, data/retention review, Japanese/Korean sample review.
- Produces: approved `CMS_TRANSLATION_ENABLED=true` configuration revision.

- [ ] **Step 1: Verify Azure deployment without exposing credentials**

Record resource region, deployment name/model version, structured-output support, quota, content-filter configuration, data-processing/retention review, and secret binding status.

- [ ] **Step 2: Run representative fluent review**

For news, history, video, and bulletin, review at least one Japanese and one Korean preview for meaning, naturalness, register, and terminology. Record only record IDs and pass/fail evidence, not draft text.

- [ ] **Step 3: Enable through the normal configuration PR/release path**

Set `CMS_TRANSLATION_ENABLED=true`, merge only with green CI, and smoke one Japanese plus one Korean preview.

- [ ] **Step 4: Verify timeout and privacy behavior**

Confirm an induced provider delay returns application `504` before 50 seconds and before gateway 60 seconds; inspect sampled logs/traces to confirm content is absent.
