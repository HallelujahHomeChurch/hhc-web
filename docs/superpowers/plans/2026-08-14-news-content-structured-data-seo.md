# News Content Structured Data and SEO Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish accurate news author and publication metadata from the CMS, then use it for localized article attribution, crawlable recent-news links, metadata, and `Organization`, `NewsArticle`, and `BreadcrumbList` JSON-LD.

**Architecture:** `hhc-web-api` remains the source of truth and adds backward-compatible fields to source records and public projections. `frontend-platform` publishes client `0.6.8`; `admin-fe` and `hhc-web` then consume that exact version. Releases remain sequential so no consumer depends on an unavailable contract.

**Tech Stack:** Go 1.25, PostgreSQL 17, OpenAPI 3.1, TypeScript 6, React 19, Vite 8, Next.js 16, Vitest 4, pnpm 10.

## Global Constraints

- Work only on focused `codex/news-content-seo` branches in isolated worktrees; never commit directly to `main`.
- Preserve the existing multilingual URL, canonical, `hreflang`, and locale-fallback model.
- `createdBy` and `updatedBy` remain private audit fields and are never used as public authors.
- `authorName` is optional, shared across locales, trimmed, and limited to 200 Unicode code points; blank means the localized HHC organization fallback.
- `displayDate` remains the activity date. It is never used for `datePublished` or `dateModified`.
- Existing `published_at` is the latest successful publication; new `first_published_at` preserves the first successful publication.
- For legacy published content, `first_published_at = published_at` is explicitly best-known history.
- Keep the API contract additive and fields optional during staged release.
- Retain the existing summary maximum of 500 code points and blank-summary 160-code-point body excerpt behavior.
- Use existing dependencies and native JSON/Intl behavior; add no new runtime dependency.
- Google Business Profile, Maps, local address data, tags, categories, manual relations, author profiles, and separate SEO-description fields remain out of scope.

---

### Task 1: Add the public-author domain contract and validation

**Repository:** `hhc-web-api`

**Files:**
- Modify: `internal/content/types.go`
- Modify: `internal/content/service.go`
- Test: `internal/content/service_test.go`

**Interfaces:**
- Produces: `content.WriteInput.AuthorName string`, `content.Item.AuthorName string`, `content.Item.FirstPublishedAt *time.Time`, and `content.PublicItem.{AuthorName,FirstPublishedAt,LastPublishedAt}`.
- Produces: normalized `authorName` accepted only for `ModuleNews`, with a 200-code-point limit.

- [ ] **Step 1: Write failing service tests**

Add tests that name the concrete regressions:

```go
func TestNewsAuthorIsTrimmedAndBounded(t *testing.T) {
	repo := &serviceRepository{}
	service := NewService(repo, time.Now)
	input := WriteInput{
		AuthorName: "  王牧師  ", DisplayDate: "2026-08-14",
		Translations: translations(),
	}
	item, err := service.CreateContent(context.Background(), ModuleNews, input, "admin", "author-create")
	if err != nil || item.AuthorName != "王牧師" {
		t.Fatalf("item=%#v err=%v", item, err)
	}
	input.AuthorName = strings.Repeat("人", 201)
	if _, err := service.CreateContent(context.Background(), ModuleNews, input, "admin", "author-too-long"); !errors.Is(err, ErrInvalid) {
		t.Fatalf("error=%v", err)
	}
}

func TestNonNewsRejectsPublicAuthor(t *testing.T) {
	service := NewService(&serviceRepository{}, time.Now)
	input := WriteInput{AuthorName: "王牧師", EventDate: "2026", Translations: translations()}
	if _, err := service.CreateContent(context.Background(), ModuleHistory, input, "admin", "history-author"); !errors.Is(err, ErrInvalid) {
		t.Fatalf("error=%v", err)
	}
}

func TestRestoreContentPreservesPublicAuthor(t *testing.T) {
	repo := &serviceRepository{
		item: Item{ID: "news-1", Module: ModuleNews, Version: 2, Slug: "news", DisplayDate: "2026-08-14", Translations: translations()},
		revision: Revision{Version: 1, Snapshot: Item{AuthorName: "王牧師", Slug: "news", DisplayDate: "2026-08-14", Translations: translations()}},
	}
	service := NewService(repo, time.Now)
	if _, err := service.RestoreContent(context.Background(), ModuleNews, "news-1", 1, 2, "admin"); err != nil {
		t.Fatal(err)
	}
	if repo.updateInput.AuthorName != "王牧師" {
		t.Fatalf("authorName=%q", repo.updateInput.AuthorName)
	}
}
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```bash
go test ./internal/content -run 'Test(NewsAuthor|NonNewsRejects|RestoreContentPreserves)' -count=1
```

Expected: compile or assertion failure because `AuthorName` does not exist or is not normalized/preserved.

- [ ] **Step 3: Implement the minimal domain changes**

Add fields with existing JSON naming conventions:

```go
type WriteInput struct {
	AuthorName string `json:"authorName,omitempty"`
	// existing fields
}

type Item struct {
	AuthorName       string     `json:"authorName,omitempty"`
	FirstPublishedAt *time.Time `json:"-"`
	// existing fields, including PublishedAt
}

type PublicItem struct {
	AuthorName       string     `json:"authorName,omitempty"`
	FirstPublishedAt *time.Time `json:"firstPublishedAt,omitempty"`
	LastPublishedAt  *time.Time `json:"lastPublishedAt,omitempty"`
	// existing fields
}
```

Normalize and validate at the existing shared boundary:

```go
input.AuthorName = strings.TrimSpace(input.AuthorName)

if module != ModuleNews && input.AuthorName != "" {
	return false
}
if module == ModuleNews && !validText(input.AuthorName, 0, 200) {
	return false
}
```

Include `AuthorName` in news publishability input, restore input, and the in-memory test repository.

- [ ] **Step 4: Run focused and package tests and verify GREEN**

Run:

```bash
go test ./internal/content -count=1
```

Expected: PASS.

- [ ] **Step 5: Commit the domain slice**

```bash
git add internal/content/types.go internal/content/service.go internal/content/service_test.go
git commit -m "feat: model public news authors"
```

### Task 2: Persist authors and first/last publication timestamps

**Repository:** `hhc-web-api`

**Files:**
- Create: `internal/migrations/sql/025_news_seo_metadata.sql`
- Modify: `internal/migrations/migrations_test.go`
- Modify: `internal/postgres/content_repository.go`
- Modify: `internal/postgres/content_repository_test.go`
- Modify: `internal/postgres/repository_integration_test.go`

**Interfaces:**
- Consumes: Task 1 domain fields.
- Produces: `news_item.author_name`, `content_entry.first_published_at`, migrated news projections, and exact first/latest publish lifecycle behavior.

- [ ] **Step 1: Write failing migration and projection tests**

Add a migration-content test:

```go
func TestNewsSEOMetadataMigrationBackfillsSourceAndPublicProjections(t *testing.T) {
	contents, err := files.ReadFile("sql/025_news_seo_metadata.sql")
	if err != nil { t.Fatal(err) }
	sql := string(contents)
	for _, expected := range []string{
		"ADD COLUMN first_published_at timestamptz",
		"ADD COLUMN author_name text NOT NULL DEFAULT ''",
		"SET first_published_at=published_at",
		"'firstPublishedAt'", "'lastPublishedAt'", "'authorName'",
		"resource_type='news'", "etag=md5",
	} {
		if !strings.Contains(sql, expected) { t.Fatalf("migration missing %q", expected) }
	}
}
```

Extend `TestPublicNews...` in `content_repository_test.go` with hand-derived values:

```go
first := time.Date(2026, 8, 14, 1, 0, 0, 0, time.UTC)
last := first.Add(time.Hour)
got := publicContent(content.Item{
	Module: content.ModuleNews, Slug: "news", AuthorName: "王牧師",
	FirstPublishedAt: &first, PublishedAt: &last,
}, content.Translation{Locale: "zh-Hant", Title: "消息"})
if got.AuthorName != "王牧師" || !got.FirstPublishedAt.Equal(first) || !got.LastPublishedAt.Equal(last) {
	t.Fatalf("public=%#v", got)
}
```

Extend the real-PostgreSQL news publication integration test to assert:

```go
firstSuccessfulPublish := now.Add(2 * time.Minute)
republishTime := now.Add(5 * time.Minute)

var firstPublishedAt, lastPublishedAt time.Time
if err := db.QueryRowContext(ctx,
	`SELECT first_published_at,published_at FROM hhc_web.content_entry WHERE id=$1`, item.ID,
).Scan(&firstPublishedAt, &lastPublishedAt); err != nil { t.Fatal(err) }
if !firstPublishedAt.Equal(firstSuccessfulPublish) || !lastPublishedAt.Equal(republishTime) {
	t.Fatalf("first=%s last=%s", firstPublishedAt, lastPublishedAt)
}
```

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```bash
go test ./internal/migrations ./internal/postgres -run 'Test(NewsSEOMetadata|PublicNews)' -count=1
```

Expected: failure because migration `025` and persistence fields are absent.

- [ ] **Step 3: Add the additive migration and legacy projection backfill**

Create `025_news_seo_metadata.sql` using the repository's existing JSONB/ETag migration pattern:

```sql
ALTER TABLE hhc_web.content_entry
  ADD COLUMN first_published_at timestamptz;

ALTER TABLE hhc_web.news_item
  ADD COLUMN author_name text NOT NULL DEFAULT '';

UPDATE hhc_web.content_entry
SET first_published_at=published_at
WHERE published_at IS NOT NULL AND first_published_at IS NULL;

WITH rewritten AS (
  SELECT projection.projection_key,
    projection.payload_json
      || jsonb_build_object(
        'firstPublishedAt', entry.first_published_at,
        'lastPublishedAt', entry.published_at
      )
      || CASE WHEN news.author_name<>''
        THEN jsonb_build_object('authorName', news.author_name)
        ELSE '{}'::jsonb
      END AS payload_json
  FROM hhc_web.public_projection projection
  JOIN hhc_web.content_entry entry ON entry.id=projection.resource_id
  JOIN hhc_web.news_item news ON news.entry_id=entry.id
  WHERE projection.resource_type='news' AND entry.published_at IS NOT NULL
)
UPDATE hhc_web.public_projection projection
SET payload_json=rewritten.payload_json,
    etag=md5(rewritten.payload_json::text)
FROM rewritten
WHERE projection.projection_key=rewritten.projection_key
  AND projection.payload_json IS DISTINCT FROM rewritten.payload_json;
```

- [ ] **Step 4: Implement persistence and publication lifecycle behavior**

Update typed news writes to persist `author_name`; update list/detail scans to load it and `first_published_at`.

For successful synchronous publication and asynchronous news completion, use:

```sql
UPDATE hhc_web.content_entry
SET status='published',
    first_published_at=COALESCE(first_published_at,$2),
    published_at=$2,
    updated_at=$2
WHERE id=$1;
```

Before serializing news projections:

```go
item.Status = content.StatusPublished
if item.FirstPublishedAt == nil {
	first := now
	item.FirstPublishedAt = &first
}
item.PublishedAt = &now
```

Map source metadata in `publicContent`:

```go
value.AuthorName = item.AuthorName
value.FirstPublishedAt = item.FirstPublishedAt
value.LastPublishedAt = item.PublishedAt
```

Do not modify timestamps in publish start, failure, unpublish start, or unpublish completion paths.

- [ ] **Step 5: Run repository tests and migration policy checks**

Run:

```bash
go test ./internal/migrations ./internal/content ./internal/postgres -count=1
./scripts/test-migration-policy.sh internal/migrations/sql/*.sql
```

Expected: PASS; PostgreSQL integration tests may report SKIP when `HHW_TEST_DATABASE_URL` is unset, and CI must later run them against PostgreSQL 17.

- [ ] **Step 6: Commit the persistence slice**

```bash
git add internal/migrations internal/postgres
git commit -m "feat: persist news publication metadata"
```

### Task 3: Publish the backward-compatible API contract

**Repository:** `hhc-web-api`

**Files:**
- Modify: `openapi.yaml`
- Modify: `openapi_test.go`

**Interfaces:**
- Consumes: Tasks 1-2 fields.
- Produces: optional `authorName` on `ContentWriteInput`/`ContentItem`, and optional `authorName`, `firstPublishedAt`, `lastPublishedAt` on `PublicContentItem`.

- [ ] **Step 1: Write a failing OpenAPI behavior test**

```go
func TestOpenAPIDocumentsNewsSEOFields(t *testing.T) {
	contents, err := os.ReadFile("openapi.yaml")
	if err != nil { t.Fatal(err) }
	document := string(contents)
	for _, expected := range []string{
		"authorName: { type: string, maxLength: 200 }",
		"firstPublishedAt: { type: string, format: date-time }",
		"lastPublishedAt: { type: string, format: date-time }",
	} {
		if !strings.Contains(document, expected) { t.Fatalf("OpenAPI missing %q", expected) }
	}
}
```

- [ ] **Step 2: Run the OpenAPI test and verify RED**

Run:

```bash
go test . -run TestOpenAPIDocumentsNewsSEOFields -count=1
```

Expected: FAIL with the first missing property.

- [ ] **Step 3: Add optional schema properties**

Add to `ContentWriteInput.properties`:

```yaml
authorName: { type: string, maxLength: 200 }
```

Add to `PublicContentItem.properties`:

```yaml
authorName: { type: string, maxLength: 200 }
firstPublishedAt: { type: string, format: date-time }
lastPublishedAt: { type: string, format: date-time }
```

Do not add them to `required` lists.

- [ ] **Step 4: Run all API verification**

Run:

```bash
go test ./... -count=1
go vet ./...
./scripts/test-migration-policy-test.sh
./scripts/test-migration-policy.sh internal/migrations/sql/*.sql
./scripts/test-what-if-policy.sh
./scripts/test-release-policy.sh
```

Expected: PASS, with integration tests skipped only when their documented local database environment is absent.

- [ ] **Step 5: Commit the API contract**

```bash
git add openapi.yaml openapi_test.go
git commit -m "feat: expose news SEO metadata"
```

- [ ] **Step 6: Deliver and verify the API producer before client generation**

Push the branch, open a focused PR, wait for every required check, and squash
merge only after success. Wait for `Production Release`; verify the migration
job succeeded, the deployed revision matches the merge commit, `/health` and
`/ready` return 200, and one published news response contains optional
`authorName`, `firstPublishedAt`, and `lastPublishedAt`. Stop before Task 4 if
the producer release is not healthy.

### Task 4: Generate and publish frontend client `0.6.8`

**Repository:** `frontend-platform`

**Files:**
- Modify: `packages/hhc-web-client/openapi/hhc-web-api.yaml`
- Modify: `packages/hhc-web-client/src/generated.ts` (generated)
- Modify: `packages/hhc-web-client/src/client.test.ts`
- Modify: `package.json`
- Modify: `packages/account-client/package.json`
- Modify: `packages/hhc-web-client/package.json`
- Modify: `packages/preferences/package.json`
- Modify: `packages/ui/package.json`

**Interfaces:**
- Consumes: released Task 3 OpenAPI contract.
- Produces: exact package version `@hallelujahhomechurch/hhc-web-client@0.6.8` with generated optional fields.

- [ ] **Step 1: Write a failing client contract test**

Add one runtime serialization test using the real client:

```ts
it('sends public author metadata and reads publication timestamps', async () => {
  const response = (data: unknown) => new Response(JSON.stringify({data, meta: {}, error: null}), {
    status: 200, headers: {'Content-Type': 'application/json'}
  });
  const fetcher = vi.fn<typeof fetch>()
    .mockResolvedValueOnce(response({
      id: 'news-1', module: 'news', status: 'draft', version: 3,
      authorName: 'Pastor Wang', displayDate: '2026-08-14', translations: [],
      isPublished: false, createdBy: 'admin', updatedBy: 'admin',
      createdAt: '2026-08-14T00:00:00Z', updatedAt: '2026-08-14T00:00:00Z'
    }))
    .mockResolvedValueOnce(response({
      id: 'news-1', title: 'News', resolvedLocale: 'en', availableLocales: ['en'],
      authorName: 'Pastor Wang', firstPublishedAt: '2026-08-14T01:00:00Z',
      lastPublishedAt: '2026-08-14T02:00:00Z'
    }));
  const client = createHhcWebClient({baseUrl: '/api', getAccessToken: () => 'token', fetcher});
  await client.updateContent('news', 'news-1', 2, {
    authorName: 'Pastor Wang', displayDate: '2026-08-14',
    translations: [{locale: 'en', title: 'News'}]
  });
  const request = fetcher.mock.calls[0]![0] as Request;
  await expect(request.json()).resolves.toMatchObject({authorName: 'Pastor Wang'});
  await expect(client.getNewsBySlug('en', 'news')).resolves.toMatchObject({
    authorName: 'Pastor Wang',
    firstPublishedAt: '2026-08-14T01:00:00Z',
    lastPublishedAt: '2026-08-14T02:00:00Z'
  });
});
```

- [ ] **Step 2: Copy the producer schema, generate types, and verify the test turns GREEN**

Run after the API contract commit is final:

```bash
cp ../hhc-web-api-news-content-seo/openapi.yaml packages/hhc-web-client/openapi/hhc-web-api.yaml
corepack pnpm --filter @hallelujahhomechurch/hhc-web-client generate
corepack pnpm --filter @hallelujahhomechurch/hhc-web-client test:run
```

Expected: generated `ContentWriteInput` and `PublicContentItem` include the three optional properties, and tests PASS.

- [ ] **Step 3: Bump the synchronized workspace package version**

Set the root and all four publishable package manifests from `0.6.7` to `0.6.8`. Do not change dependency ranges or add packages.

- [ ] **Step 4: Run complete package verification**

Run:

```bash
corepack pnpm install --frozen-lockfile
corepack pnpm test
corepack pnpm lint
corepack pnpm build
corepack pnpm check:packages
corepack pnpm pack:packages
corepack pnpm test:consumers
```

Expected: PASS and four version-aligned package tarballs.

- [ ] **Step 5: Commit the package release candidate**

```bash
git add package.json packages
git commit -m "feat: publish news SEO client contract"
```

- [ ] **Step 6: Deliver and publish package `0.6.8` before consumer upgrades**

Push the branch, open a focused PR, wait for every required check, and squash
merge only after success. Create tag `v0.6.8` on the merge commit, push it,
wait for `Release packages`, and verify
`@hallelujahhomechurch/hhc-web-client@0.6.8` is downloadable. Stop before Task
5 if the package is unavailable.

### Task 5: Add Admin public-author and summary guidance

**Repository:** `admin-fe`

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `src/pages/content/ContentEditorPage.tsx`
- Modify: `src/pages/content/ContentEditorPage.test.tsx`
- Modify: `src/preferences/locale-context.tsx`
- Modify: `src/lib/mock-cms-api.ts`

**Interfaces:**
- Consumes: `@hallelujahhomechurch/hhc-web-client@0.6.8`.
- Produces: one shared optional person-name author field and localized summary guidance/count for news translations.

- [ ] **Step 1: Upgrade only the HHC web client dependency**

Change `@hallelujahhomechurch/hhc-web-client` from exact `0.6.7` to exact `0.6.8`, then refresh `pnpm-lock.yaml` after the package release is available.

- [ ] **Step 2: Write failing editor behavior tests**

Add tests using the real rendered editor:

```tsx
function renderNewsEditor() {
  const router = createMemoryRouter([{
    path: '/content/news/:contentId',
    element: <Providers><ContentEditorPage module="news" /></Providers>,
  }], {initialEntries: ['/content/news/news-1']});
  render(<RouterProvider router={router} />);
}

it('loads and saves one shared public news author', async () => {
  cmsApi.getContent.mockResolvedValue({...item, authorName: 'Pastor Wang'});
  renderNewsEditor();
  const author = await screen.findByRole('textbox', {name: 'Public author (optional)'});
  expect(author).toHaveValue('Pastor Wang');
  await userEvent.clear(author);
  await userEvent.type(author, 'Pastor Lin');
  await userEvent.click(screen.getByRole('button', {name: 'Save draft'}));
  await waitFor(() => expect(cmsApi.updateContent).toHaveBeenCalledWith(
    'news', 'news-1', 1, expect.objectContaining({authorName: 'Pastor Lin'}),
  ));
});

it('shows localized summary guidance and a live 500 character count', async () => {
  renderNewsEditor();
  const summary = await screen.findByRole('textbox', {name: 'Summary'});
  expect(summary).toHaveAttribute('maxLength', '500');
  expect(screen.getByText('Write one or two sentences specific to this page.')).toBeInTheDocument();
  expect(screen.getByText('7 / 500')).toBeInTheDocument();
  await userEvent.type(summary, ' updated');
  expect(screen.getByText('15 / 500')).toBeInTheDocument();
});
```

Use the test file's existing router/provider setup rather than adding a new helper unless the same setup is already repeated and extractable without behavior change.

- [ ] **Step 3: Run focused tests and verify RED**

Run:

```bash
corepack pnpm test:run src/pages/content/ContentEditorPage.test.tsx
```

Expected: author and summary controls are absent.

- [ ] **Step 4: Implement the minimal editor controls**

For news basic settings, render the existing date control plus:

```tsx
<label className="content-field">
  <span>{messages.publicAuthor}</span>
  <input
    aria-label={messages.publicAuthor}
    maxLength={200}
    value={draft.authorName ?? ''}
    onChange={(event) => onChange({...draft, authorName: event.target.value})}
  />
  <small className="form-hint">{messages.publicAuthorHint}</small>
</label>
```

For each news translation, render the currently stored summary:

```tsx
<label className="content-field">
  <span>{messages.summary}</span>
  <textarea
    aria-label={messages.summary}
    maxLength={500}
    value={value.summary}
    onChange={(event) => update({summary: event.target.value})}
  />
  <small className="form-hint">
    {messages.summaryHint} {value.summary.length} / 500
  </small>
</label>
```

Add `publicAuthor`, `publicAuthorHint`, and `summaryHint` copy to the existing Traditional Chinese, Simplified Chinese, and English Admin message objects. Keep `authorName` in dirty-state/save/revision/mock flows through existing object spread; send it only for news in `cleanInput`.

- [ ] **Step 5: Run Admin verification**

Run:

```bash
corepack pnpm test:run
corepack pnpm lint
corepack pnpm build
```

Expected: PASS.

- [ ] **Step 6: Commit the Admin slice**

```bash
git add package.json pnpm-lock.yaml src
git commit -m "feat: edit news SEO metadata"
```

### Task 6: Map publication metadata and render the localized article footer

**Repository:** `hhc-web`

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `src/features/content/locale.ts`
- Modify: `src/features/news/types.ts`
- Modify: `src/features/news/api.ts`
- Modify: `src/features/news/api.test.ts`
- Modify: `src/components/news/NewsDetailArticle.tsx`
- Modify: `src/components/news/NewsDetailArticle.test.tsx`
- Modify: `src/i18n/locales/zh-Hant.json`
- Modify: `src/i18n/locales/zh-Hans.json`
- Modify: `src/i18n/locales/en.json`
- Modify: `src/i18n/locales/ja.json`
- Modify: `src/i18n/locales/ko.json`

**Interfaces:**
- Consumes: `@hallelujahhomechurch/hhc-web-client@0.6.8` public fields.
- Produces: raw activity/publication timestamps on `NewsDetail`, localized visible dates, and muted attribution footer.

- [ ] **Step 1: Upgrade only the HHC web client dependency**

Change `@hallelujahhomechurch/hhc-web-client` from exact `0.6.7` to `0.6.8` and refresh the lockfile after package publication.

- [ ] **Step 2: Write failing mapping and visible-output tests**

Add an API mapping assertion:

```ts
expect(await getNewsBySlug('en', 'news-1', client)).toMatchObject({
  authorName: 'Pastor Wang',
  displayDate: '2026-08-14',
  firstPublishedAt: '2026-08-14T01:00:00Z',
  lastPublishedAt: '2026-08-14T02:00:00Z'
});
```

Extend the component test:

```tsx
render(<NewsDetailArticle
  news={{...news, authorName: '', firstPublishedAt: '2026-08-14T01:00:00Z', lastPublishedAt: '2026-08-14T02:00:00Z'}}
  backHref="/ja/news"
  backLabel="戻る"
  activityDateLabel="開催日"
  authorLabel="著者"
  publishedAtLabel="公開日"
  updatedAtLabel="更新日"
  organizationName="ハレルヤ・ホームチャーチ"
/>);
expect(screen.getByText('開催日')).toBeInTheDocument();
expect(screen.getByText('ハレルヤ・ホームチャーチ')).toBeInTheDocument();
expect(screen.getByText('公開日').nextElementSibling).toHaveAttribute('datetime', '2026-08-14T01:00:00Z');
expect(screen.getByText('更新日').nextElementSibling).toHaveAttribute('datetime', '2026-08-14T02:00:00Z');
```

Add a separate first-publish case where equal timestamps omit the updated line.

- [ ] **Step 3: Run focused tests and verify RED**

Run:

```bash
corepack pnpm test:run src/features/news/api.test.ts src/components/news/NewsDetailArticle.test.tsx
```

Expected: new fields/labels are absent.

- [ ] **Step 4: Implement mapping, date formatting, and footer**

Add raw fields to news types:

```ts
displayDate: string;
authorName: string;
firstPublishedAt?: string;
lastPublishedAt?: string;
```

Map them directly from the client while retaining the existing formatted `date` field. Add one native formatter:

```ts
export function formatContentTimestamp(value: string, locale: Locale): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return new Intl.DateTimeFormat(locale, {dateStyle: 'medium', timeZone: 'Asia/Taipei'}).format(parsed);
}
```

Relabel the heading date as activity date and set `dateTime={news.displayDate}`. Append a muted footer after the body. Use `authorName || organizationName`; show Updated only when both timestamps parse and `last > first`.

Add localized `activityDate`, `author`, `publishedAt`, and `updatedAt` keys in all five public locale JSON files.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run:

```bash
corepack pnpm test:run src/features/news/api.test.ts src/components/news/NewsDetailArticle.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit the public attribution slice**

```bash
git add package.json pnpm-lock.yaml src/features src/components/news src/i18n
git commit -m "feat: show news publication metadata"
```

### Task 7: Add normalized metadata and structured data

**Repository:** `hhc-web`

**Files:**
- Create: `src/lib/structured-data.ts`
- Create: `src/lib/structured-data.test.ts`
- Modify: `src/app/page.tsx`
- Modify: `src/app/page.test.tsx`
- Modify: `src/app/[locale]/news/[slug]/page.tsx`
- Modify: `src/app/[locale]/news/[slug]/page.test.ts`

**Interfaces:**
- Consumes: Task 6 `NewsDetail` fields and existing `siteConfig`/locale messages.
- Produces: reusable HHC organization node, safe JSON-LD serializer, root `WebSite`+`Organization` graph, news `Organization`+`NewsArticle`+`BreadcrumbList` graph, and whitespace-normalized descriptions.

- [ ] **Step 1: Write failing helper/root/news tests**

Create tests with literal expectations:

```ts
expect(normalizeMetaDescription('  First\n  second   sentence.  ')).toBe('First second sentence.');
expect(serializeJsonLd({'@context': 'https://schema.org', name: '</script>'})).toContain('\\u003c/script>');
expect(organizationStructuredData).toMatchObject({
  '@type': 'Organization',
  '@id': 'https://www.alive.org.tw/#organization',
  name: 'HHC',
  url: 'https://www.alive.org.tw/'
});
```

Update root rendering expectation to one graph containing both types:

```ts
expect(JSON.parse(jsonLd!)).toMatchObject({
  '@context': 'https://schema.org',
  '@graph': [
    {'@type': 'WebSite', name: 'HHC'},
    {'@type': 'Organization', '@id': 'https://www.alive.org.tw/#organization'}
  ]
});
```

For a Japanese article fixture, assert a graph with canonical Japanese URLs, `inLanguage: 'ja'`, `datePublished`, later `dateModified`, `Person` author, organization publisher, and three breadcrumb positions. Add a blank-author fixture that references the organization and omits equal `dateModified`.

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```bash
corepack pnpm test:run src/lib/structured-data.test.ts src/app/page.test.tsx 'src/app/[locale]/news/[slug]/page.test.ts'
```

Expected: helper module and graph nodes are absent.

- [ ] **Step 3: Implement the minimal shared helper**

```ts
export const organizationId = 'https://www.alive.org.tw/#organization';

export const organizationStructuredData = {
  '@type': 'Organization',
  '@id': organizationId,
  name: 'HHC',
  alternateName: [
    '哈利路亞家教會', '哈利路亚家教会', 'Hallelujah Home Church',
    'ハレルヤ・ホームチャーチ', '할렐루야 가정교회'
  ],
  url: 'https://www.alive.org.tw/',
  logo: 'https://www.alive.org.tw/assets/brand/logo.png',
  sameAs: [siteConfig.social.youtube, siteConfig.social.facebook]
} as const;

export function normalizeMetaDescription(value: string) {
  return value.trim().replace(/\s+/g, ' ');
}

export function serializeJsonLd(value: unknown) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}
```

- [ ] **Step 4: Convert root structured data to one graph**

Keep the existing `WebSite` node and render:

```ts
const rootStructuredData = {
  '@context': 'https://schema.org',
  '@graph': [websiteStructuredData, organizationStructuredData]
};
```

Remove the nested `@context` from `websiteStructuredData`, because the graph
owns the only context. Use `serializeJsonLd(rootStructuredData)`; do not add a
second script.

- [ ] **Step 5: Add article and breadcrumb graphs plus metadata normalization**

Build absolute canonical paths from `news.resolvedLocale`. Include image only when present and convert relative paths with `new URL(image, siteConfig.url).toString()`.

Use these exact conditional fields:

```ts
const dateModified = news.firstPublishedAt && news.lastPublishedAt
  && Date.parse(news.lastPublishedAt) > Date.parse(news.firstPublishedAt)
  ? news.lastPublishedAt
  : undefined;

const author = news.authorName
  ? {'@type': 'Person', name: news.authorName}
  : {'@id': organizationId};
```

Construct the article and breadcrumb nodes without extra schema fields:

```ts
const newsArticle = {
  '@type': 'NewsArticle',
  mainEntityOfPage: canonicalUrl,
  headline: news.title,
  description,
  inLanguage: news.resolvedLocale,
  ...(news.imageSrc ? {image: new URL(news.imageSrc, siteConfig.url).toString()} : {}),
  ...(news.firstPublishedAt ? {datePublished: news.firstPublishedAt} : {}),
  ...(dateModified ? {dateModified} : {}),
  author,
  publisher: {'@id': organizationId}
};

const breadcrumbList = {
  '@type': 'BreadcrumbList',
  itemListElement: [
    {'@type': 'ListItem', position: 1, name: messages.site.nav.home, item: homeUrl},
    {'@type': 'ListItem', position: 2, name: messages.news.title, item: newsListUrl},
    {'@type': 'ListItem', position: 3, name: news.title, item: canonicalUrl}
  ]
};
```

The page graph is:

```ts
{
  '@context': 'https://schema.org',
  '@graph': [organizationStructuredData, newsArticle, breadcrumbList]
}
```

Normalize the selected summary once and use it consistently for Metadata, Open Graph, Twitter, and `NewsArticle.description`; fall back to the localized news description when normalized output is blank.

- [ ] **Step 6: Run focused tests and verify GREEN**

Run:

```bash
corepack pnpm test:run src/lib/structured-data.test.ts src/app/page.test.tsx 'src/app/[locale]/news/[slug]/page.test.ts'
```

Expected: PASS.

- [ ] **Step 7: Commit structured data**

```bash
git add src/lib/structured-data* src/app/page* 'src/app/[locale]/news/[slug]/page.tsx' 'src/app/[locale]/news/[slug]/page.test.ts'
git commit -m "feat: add news structured data"
```

### Task 8: Add crawlable recent-news links with fail-soft loading

**Repository:** `hhc-web`

**Files:**
- Modify: `src/app/[locale]/news/[slug]/page.tsx`
- Modify: `src/app/[locale]/news/[slug]/page.test.ts`

**Interfaces:**
- Consumes: existing `getNewsPage` and `NewsSection`.
- Produces: at most three newest links from the article's resolved content locale, excluding the current stable ID.

- [ ] **Step 1: Write failing page-render tests**

Mock a resolved Japanese detail and four newest Japanese items, including the current ID. Render the real async page and assert that the current item is absent and the three other crawlable `href` values are present.

```ts
const current = {id: 'current', title: 'Current', summary: '', date: '', displayDate: '', authorName: '', imageAlt: '', href: '/ja/news/current', requestedLocale: 'ja', resolvedLocale: 'ja', availableLocales: ['ja']};
const newestA = {...current, id: 'a', title: 'A', href: '/ja/news/a'};
const newestB = {...current, id: 'b', title: 'B', href: '/ja/news/b'};
const newestC = {...current, id: 'c', title: 'C', href: '/ja/news/c'};
getNewsPage.mockResolvedValue({
  items: [current, newestA, newestB, newestC],
  meta: {page: 1, pageSize: 4, total: 4}
});
const markup = renderToStaticMarkup(await NewsDetailPage({
  params: Promise.resolve({locale: 'ja', slug: 'current'})
}));
expect(getNewsPage).toHaveBeenCalledWith('ja', 1, 4);
expect(markup).not.toContain('href="/ja/news/current"');
for (const href of ['/ja/news/a', '/ja/news/b', '/ja/news/c']) expect(markup).toContain(`href="${href}"`);
```

Add a failure case where `getNewsPage` rejects and the article still renders without the Latest News section.

- [ ] **Step 2: Run the page test and verify RED**

Run:

```bash
corepack pnpm test:run 'src/app/[locale]/news/[slug]/page.test.ts'
```

Expected: `getNewsPage` is not called and links are absent.

- [ ] **Step 3: Implement the smallest fail-soft loader**

After resolving the article:

```ts
const recentNews = await getNewsPage(news.resolvedLocale, 1, 4)
  .then(({items}) => items.filter((item) => item.id !== news.id).slice(0, 3))
  .catch(() => []);
```

Render the existing `NewsSection` below the article only when `recentNews.length > 0`, using `messages.news.title` and `/${news.resolvedLocale}/news`. Do not label chronological entries as semantically related.

- [ ] **Step 4: Run complete public-site verification**

Run:

```bash
corepack pnpm test:run
corepack pnpm lint
corepack pnpm build
corepack pnpm perf:static
./scripts/test-release-policy.sh
```

Expected: PASS.

- [ ] **Step 5: Commit recent links**

```bash
git add 'src/app/[locale]/news/[slug]/page.tsx' 'src/app/[locale]/news/[slug]/page.test.ts'
git commit -m "feat: link recent localized news"
```

### Task 9: Deliver sequentially and verify production

**Repositories:** `hhc-web-api`, `frontend-platform`, `admin-fe`, `hhc-web`

**Files:** No new product files; this task uses repository CI/CD and live read-only checks.

**Interfaces:**
- Consumes: Tasks 1-8 verified commits.
- Produces: completed producer verification, merged Admin/public PRs, deployed revisions, and live SEO evidence.

- [ ] **Step 1: Review each branch against the approved design**

For each repository, run:

```bash
git status --short --branch
git diff origin/main...HEAD --check
git diff --stat origin/main...HEAD
```

Confirm no Google Business/Profile, Maps, address, auth, gateway, asset, campaign, notification, tag, author-page, or separate SEO-description changes entered the diff.

- [ ] **Step 2: Confirm the already-delivered API producer remains healthy**

Recheck the Task 3 production release before consumer deployment. Verify:

```text
GET /health -> 200
GET /ready -> 200
GET /api/news/{published-slug}?locale=zh-Hant -> optional authorName plus firstPublishedAt/lastPublishedAt
```

Confirm the deployed Container Apps revision still matches the merged commit and the migration job succeeded.

- [ ] **Step 3: Confirm package `0.6.8` remains available**

Verify the package published in Task 4 is downloadable and both consumer lockfiles resolve the same immutable `0.6.8` artifact.

- [ ] **Step 4: Push and merge `admin-fe` after required CI passes**

Wait for production release and verify the deployed Admin bundle/release corresponds to the merged commit. In the live editor, verify author load/save/reload, blank fallback hint, summary count, and no exposure of CMS audit identities.

- [ ] **Step 5: Push and merge `hhc-web` after required CI passes**

Wait for production release and verify deployed revision, `/health`, root `/`, and one representative news detail in all five locales. Confirm:

```text
activity date remains near the title
author and publication footer is muted
updated date is conditional
root graph has WebSite + Organization
article graph has Organization + NewsArticle + BreadcrumbList
latest-news links exclude the current article and stay in the resolved locale
canonical and hreflang remain unchanged
```

- [ ] **Step 6: Validate Google-facing output**

Run Google's Rich Results Test on a representative published news URL and Search Console URL Inspection/live test. Record validity and request indexing only when the live page is indexable. Treat enhanced display as eligibility, not a guarantee.

- [ ] **Step 7: Prepare the deferred local-search handoff**

Report, without mutating Google Business Profile or Maps:

```text
what business/profile ownership must be verified
how the official name, categories, branches, address/service area, phone, hours, website URL, and photos should be reconciled
how map listings should link to the correct localized or branch page
which duplicate or stale listings need review before any merge/removal
```

Do not change local-search provider data without a separate reviewed preview and explicit approval.
