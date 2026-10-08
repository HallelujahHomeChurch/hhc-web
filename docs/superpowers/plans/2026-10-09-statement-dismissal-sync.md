# Statement Dismissal Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task in this session. Use subagents only if the user separately selects delegation. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 官網與 Account profile 共用以發布版本為單位的「不再顯示」；登入者跨裝置同步，匿名者保存在瀏覽器。

**Architecture:** `hhc-web-api` owns exact account/statement/published-version dismissals. Gateway exposes human-only same-origin routes on www and account; shared frontend packages carry the HTTP contract and anonymous persistence format. Existing published projections and authentication runtimes remain authoritative.

**Tech Stack:** Go、PostgreSQL、既有 net/http/Dapr trusted identity、Nginx JWT verifier、TypeScript、Next.js、React/Vite、Vitest、現有 frontend-platform packages。

**Spec:** [2026-10-09-statement-dismissal-sync-design.md](../specs/2026-10-09-statement-dismissal-sync-design.md)

## Global Constraints

- 勾選文字改為 **「不再顯示」**；五語確切文案依 spec 文案表。
- 隱藏狀態以 **聲明 ID＋已發布版本** 為單位，沒有一天期限、隱藏日期或過期判斷。
- 更新草稿不重彈；新版本成功發布、成為 public projection 後才重彈。
- 聲明列、完整文章與手動閱讀仍可使用。「不再顯示」只停止自動彈窗。
- 不讀匿名紀錄作帳號權威，不自動匯入帳號；checking/loading 不等於匿名。
- 保留聲明 popup window、public active response 的無個資性與既有閱讀／輸入保護。
- 新 API：GET `/api/me/statements/{statementId}/dismissal?publishedVersion=N`、PUT 同一路徑，body `{publishedVersion:N}`；envelope 與錯誤依 spec。
- 不新增第三方 dependency、微服務、推送 channel 或重置 UI；既有共享套件可由消費端安裝 exact release version。
- 每 repo 最新 origin/main、獨立 worktree／branch／PR；不可修改其他人 checkout 或 bypass CI。
- 本計畫是文件交付，尚未授權 implementation、merge／release 或 production mutation。

## Review Focus

- 舊 public projection 的 payload 沒有 publishedVersion：從同一 row 的 version 補齊；不能視為 0 或讀草稿版本。Task 1。
- 新版發布與舊版 dismiss PUT 同時發生：只影響實際顯示的 ref，不能 suppress 新版。Task 2。
- 帳號 A 的慢請求在切到 B／logout 後返回：不得改寫新 subject 的彈窗或偏好。Tasks 5、6。
- Cookie/localStorage 不可用、過期、不同子網域或舊一天格式：不阻斷閱讀，不推測永久選擇。Tasks 4–6。
- 新個人資料漏出 owner scope／帳號 erasure 之後可被並發 PUT 重建：owner isolation、cleanup fence 與 export 都需驗證。Task 2。

## 執行前檢查與文件位置

文件存放於 hhc-web 現有 `docs/superpowers/{specs,plans}`。文件工作可留目前 checkout；不在 main commit。實作開始時，先為下列各 repo 確認 status、worktrees、AGENTS.md、README、最新 remote main，建立本任務隔離分支，保留所有既有 docs 與 worktrees。

實作前重新核對已發布 SDK 與來源契約：本次看到的 hhc-web 使用 hhc-web-client 1.0.30，Account 尚未依賴此 client；frontend-platform 本地 checkout 不是 main。不得從其目前 docs branch 或 stale checkout 直接開始。

下列 path 均為 workspace-relative；實作時取各 repo 最新 origin/main 的同名檔案。新增 migration 編號不預先占用，使用該時点最高序號＋1 的 `*_statement_dismissal.sql`，並以 migration loader 的排序驗證。

### Task 1: 保證公開聲明版本來自已發布 projection

**Files:**
- Modify: `hhc-web-api/internal/postgres/content_repository.go`、`internal/postgres/statement_repository.go`
- Modify: `hhc-web-api/openapi.yaml`
- Test: `hhc-web-api/internal/postgres/statement_repository_integration_test.go`、`openapi_test.go`

**Interfaces:**
- Consumes: `content.PublicItem.PublishedVersion int64`、`public_projection.version`。
- Produces: 有聲明的 ActiveStatement，其 `statement.publishedVersion` 必為該 localized published snapshot 的正整數發布版本；各語系同一發布版本一致。

- [ ] 新增 `TestActiveStatementUsesPublishedProjectionVersion`：projection v7＋draft v9 -> 回 v7；draft 更新／publishing／失敗仍回 v7；publication projection 切到 v10 才回 v10。
- [ ] 新增 `TestActiveStatementLegacyPayloadGetsRowVersion`：payload 缺 publishedVersion、row.version=7 -> 回7；fallback 同樣正確。測試不同語系、projection 更新與 window scan race，回應內容及 ref 必須一致。
- [ ] 跑 `go test ./internal/postgres -run 'TestActiveStatement' -count=1`，提供獨立 test PostgreSQL，確認新測試先失敗。
- [ ] 修改 PublicNews 的 projection row 讀取取得 version；填入 snapshot version，不讀 mutable draft、不回寫舊 projection。驗證 int64 正值／JS safe integer；active OpenAPI 明定版本可用，維持舊 envelope。
- [ ] 重跑指定 integration tests 與 `go test ./... -run 'OpenAPI|Statement' -count=1`；不能把 PostgreSQL test 的 skip 當通過。Commit focused backend version change 至 task branch。

### Task 2: 帳號 dismissal API、儲存及資料生命週期

**Files:**
- Create: `hhc-web-api/internal/content/statement_dismissal.go`、`statement_dismissal_test.go`
- Modify: `hhc-web-api/internal/content/types.go` 的 Repository interface 及其全部測試 stub
- Create: `hhc-web-api/internal/postgres/statement_dismissal.go`、`statement_dismissal_integration_test.go`、下一個 additive migration `internal/migrations/sql/*_statement_dismissal.sql`
- Create: `hhc-web-api/internal/httpapi/statement_dismissal.go`、`statement_dismissal_test.go`
- Modify: `hhc-web-api/internal/httpapi/handler.go`、`internal/httpapi/bulletin_watermark_dsr.go`、`internal/postgres/bulletin_watermark.go`、`openapi.yaml`、`openapi_test.go`
- Test: `hhc-web-api/internal/migrations/migrations_test.go`、`internal/postgres/bulletin_watermark_test.go`、既有 DSR handler tests
- Verify consumer: `account-api/internal/dsrcontract/` 與 `account-api/internal/services/` 的 Website export parsing；僅在 compatibility test 證明需要時新增獨立 PR。

**Interfaces:**
- Add content types: `StatementRef {StatementID string; PublishedVersion int64}`、`StatementDismissal {StatementID string; PublishedVersion int64; Dismissed bool}`，JSON 使用 spec 的 camelCase。
- Service: `GetStatementDismissal(ctx context.Context, accountID string, ref StatementRef) (StatementDismissal, error)`；`DismissStatement(ctx context.Context, accountID string, ref StatementRef) (StatementDismissal, error)`。
- Repository: 同名 owner-scoped methods，由 Service 驗證 ref，再由 repo transaction 確認 published statement version 並讀寫 exact tuple；沿用 `ErrInvalid`、`ErrNotFound`，新增 `ErrStatementVersionChanged`。
- Produces: spec 的 GET／PUT HTTP contract；current exact-ref PUT 可安全重試，舊版本409。

- [ ] 先寫 service、handler、repository 失敗測試：A 隱藏 `(id,7)` -> A true／B false；重複PUT不增加列；v8仍false；GET舊ref與PUT舊ref均409；draft-only／general news／unpublished／unknown ID=404；UUID、0、negative、unsafe int、unknown body fields=422。
- [ ] 加 identity tests：無 caller／偽造 user header／cookie-only／service principal 拒絕；一般human不需member或admin scope；其他 methods 405；每個回應 no-store；body >1KiB拒絕。
- [ ] 跑 `go test ./internal/content ./internal/httpapi -run 'StatementDismissal|DismissStatement' -count=1` 與 Postgres integration 測試，確認先失敗。
- [ ] 建立 exact triple PK table，content FK cascade；Repository 使用目前 publication transaction 可相容的 projection row lock，同一 transaction 校驗+insert `ON CONFLICT DO NOTHING`。Service 不含HTTP、handler不直存DB；新增 `/api/me/` trusted human mux，僅 Gateway caller，可沿用目前 principal middleware。
- [ ] 更新 OpenAPI、主機無關 routes、stable error code 與 mocks/stubs，無 account_id 輸入；PUT使用Bearer及JSON，不新增cookie-only認證。
- [ ] 擴充既有 Account cleanup transaction 的 count、delete、postcondition與subject fence；dismiss寫入持有相同subject lock並拒絕已erased subject，防止cleanup後重建。以兩連線測試「v7讀到後發布v8」、「cleanup與PUT同時執行」。
- [ ] 擴充既有 private DSR export 的分頁：新增 `statement:` cursor 與 recordType `statement_dismissal`，recordKey=`statementId:publishedVersion`、data只有ref；owner由既有私有DSR授權決定。新增 coverage 並保持既有頁面／limit／cursor契約；驗證 Account consumer 接受新增 record，若不接受先交付獨立 additive Account compatibility PR。
- [ ] 測試 erasure重試冪等／foreign owner untouched／FK刪除／export跨多頁不遺漏；重跑unit、integration及OpenAPI checks。Commit本task，與Task1組成一個 focused backend PR。

### Task 3: Gateway 在兩個主機公開 human-only 個人路由

**Files:**
- Create: `api-gateway/conf.d/api/www/35-statement-dismissal.conf`
- Modify: `api-gateway/conf.d/api/account/80-statement.conf`
- Create: `api-gateway/scripts/test-statement-dismissal-routing.sh`
- Modify: `api-gateway/scripts/runtime-smoke.sh`、README.md、既有 verifier route-policy tests（搜尋全部 route ID 使用處）

**Interfaces:**
- Consumes: Task2 的 `/api/me/statements/{uuid}/dismissal` GET／PUT。
- Produces: www/account同源可用；route ID `statements.me.dismissal`；human-only、required scopes/roles空字串、可信X-HHC標頭、body limit1KiB；public active路由仍匿名可用。

- [ ] 新 routing fixture tests：兩主機human GET/PUT被轉送；匿名401、service403、跨主機／私有path不可繞過、unsupported methods拒絕、overlarge body拒絕、client forged headers被清除。沿用existing local fake issuer／Dapr fixtures。
- [ ] 執行新script並確認先失敗；加入exact UUID限定路由、protected.conf與method policy，不使用寬泛 `/api/me/*` allowlist。
- [ ] fixture中Bearer PUT成功，cookie-only form失敗；routing response保留backend no-store，不添加credentialed CORS。跑 `go test ./...`、`go vet ./...`、`./scripts/test-auth-method-matrix.sh` 及新routing script。
- [ ] Build image並`nginx -t`；review所有routes與CI runtime-smoke覆蓋後commit。此repo獨立PR，release須晚於Backend。

### Task 4: 共享型別、HTTP client與匿名格式

**Files:**
- Modify: `frontend-platform/packages/hhc-web-client/openapi/hhc-web-api.yaml`、`src/generated.ts`、`src/client.ts`、`src/client.test.ts`
- Create: `frontend-platform/packages/preferences/src/statement-dismissal.ts`、`statement-dismissal.test.ts`
- Modify: `frontend-platform/packages/preferences/src/index.ts`、既有package版本／release manifest（按repo流程）
- Modify: `frontend-platform/scripts/test-packed-consumers.mjs`

**Interfaces:**
- Export SDK type `StatementRef = {statementId: string; publishedVersion: number}`、`StatementDismissal = StatementRef & {dismissed: boolean}`。
- SDK methods `getStatementDismissal(ref: StatementRef, signal?: AbortSignal): Promise<StatementDismissal>`、`dismissStatement(ref: StatementRef, signal?: AbortSignal): Promise<StatementDismissal>`；使用既有`createHhcWebClient`的token／refresh／fetcher。
- Preferences helpers `statementRefKey(ref: StatementRef): string`、`readAnonymousStatementDismissal(ref: StatementRef): boolean`、`writeAnonymousStatementDismissal(ref: StatementRef): boolean`。寫入回true表示至少一種儲存成功；false由consumer普通關閉並報storage不可用。helper於呼叫時存取browser，module import可SSR。

- [ ] SDK測試GET query、PUT JSON、Bearer／401 refresh、abort與409 error保留；fixtures exact `{statementId:'018f0000-0000-7000-8000-000000000001',publishedVersion:7}`。
- [ ] Helper測試v7=true、v8=false、不同ID false、cookie bridge雙向同步、固定Max-Age=34560000／production Domain／Secure、本地host不加production Domain、舊day cookie忽略、storage throw時不crash。凍結日期並換日，結果必須相同，helper不得使用Date或日期formatter。
- [ ] 跑 `corepack pnpm --filter @hallelujahhomechurch/hhc-web-client test:run` 與 preferences test:run確認先失敗。
- [ ] 同步Backend OpenAPI、generate SDK、新增兩個client方法。新增小型pure-format及browser-storage helper；localStorage新key=`hhc:statement:{id}:dismissed-version`，cookie=`hhc_statement_dismissed`、value=`id.version`。重用CookieContext/domain conventions，不新增hook/framework。
- [ ] 跑generate後確認只有預期generated diff；commit後跑 `check:generated`。完整執行 `corepack pnpm test`、`lint`、`build`、`check:packages`、`pack:packages`、`test:consumers`。
- [ ] 依tag release流程發布兩個exact package versions；驗證registry artifacts，兩frontend只使用已發布版本。不要在plan預填未存在版本號。

### Task 5: 官網接入帳號狀態並移除 hidden-day

**Files:**
- Modify: `hhc-web/src/components/statements/StatementProvider.tsx`、`StatementDialog.tsx`
- Modify: `hhc-web/src/features/statements/visibility.ts` 及其 tests
- Modify: `hhc-web/src/components/statements/StatementProvider.test.tsx`、其他使用labels的fixtures
- Modify: `hhc-web/src/i18n/locales/{zh-Hant,zh-Hans,en,ja,ko}.json`
- Modify: `hhc-web/package.json`、`pnpm-lock.yaml`

**Interfaces:**
- Consumes: Task4 SDK/helpers；`useAccountAuth()`區分checking與authenticated/anonymous；既有authorization hook取得token與refresh，沿用既有transport，不新建auth。
- Produces: `StatementDialog.onClose(dismissPermanently: boolean)`；label `doNotShowAgain`，另加translated sync failure message；prompt key含subject與ref，dialog key含ref。

- [ ] 先測auth checking不彈、帳號query完成才判斷、A hidden不彈／B不受影響、匿名hidden不影響A、PUT body為displayed version、日期改變仍hidden、成功更新v8重新彈且checkbox reset。
- [ ] 加logout／switch account／慢GET及PUT responses／401-refresh／409-refetch／GET及PUT 5xx／storage拒絕測試。斷言舊subject回應不更新新subject；GET失敗不閃彈、PUT失敗可普通關閉並顯示sync failure。
- [ ] 跑 `corepack pnpm exec vitest run src/components/statements/StatementProvider.test.tsx` 確認新behavior先失敗。
- [ ] Upgrade exact已發布套件；接入backend state與匿名helper，移除taipeiDay、hiddenDayKey、sharedHiddenDay/setSharedHiddenDay所有callers。保留statementIsActive、window offset與boundary timer。
- [ ] `prompted`以subject/ref識別；effect cleanup abort；身份／版本變動先讓old projection失效再查新狀態。按focus／visibility／60秒刷新，保留typing、article、maintenance/legal route suppression與manual reading。
- [ ] 更新五語文案／types／callbacks／fixtures；用既有notice或Toast顯示錯誤並保留dialog焦點／Escape／scroll保護，mutation pending禁重複submit。普通關閉不PUT。
- [ ] 跑 `corepack pnpm test:run`、`lint`、`build`、README要求的Docker build，核對新Next APIs前先讀installed Next guide；commit focused frontend PR。

### Task 6: Account profile對齊同一規則

**Files:**
- Modify: `account-fe/src/components/StatementStrip.tsx`、`StatementDialog.tsx`、`StatementStrip.test.tsx`
- Modify: `account-fe/src/i18n/messages.ts`、locale tests與相關fixtures
- Modify: `account-fe/package.json`、`pnpm-lock.yaml`

**Interfaces:**
- Consumes: Task4 SDK/helpers；existing `useAuth()`提供status/profile與token transport，401 refresh使用既有runtime。
- Produces: 與Task5同樣的ref、owner、doNotShowAgain及onClose語意；不改StatementStrip目前掛載route scope。

- [ ] 先寫與Task5一致的account state cases，另測profile bootstrap尚未完成、anonymous適用render、Account勾選後同browser官網bridge／同account其他裝置backend state、生效語系fallback與新publishedVersion。
- [ ] 跑 `corepack pnpm exec vitest run src/components/StatementStrip.test.tsx` 確認先失敗。
- [ ] 安裝exact已發布hhc-web-client及preferences，使用createHhcWebClient取代該component自行定義的ActiveStatement/raw fetch，復用existing authenticated transport。不要將CMS client方法加入AccountApi。
- [ ] 移除taipeiDay、day state、isHidden/hideToday cookie函式；由共享helper儲存匿名ref。加subject/ref隔離、abort、visibilitychange、60秒refresh及錯誤提示，普通關閉不寫永久state。
- [ ] 更新Dialog與五語labels，延續native dialog accessibility；跑 `corepack pnpm test:run`、`lint`、`build`與repo CI-required checks，commit独立Account frontend PR。

### Task 7: 整體檢查、發布排序及跨裝置驗收

**Files:**
- Modify: 各repo README／既有release smoke/runbook適用段落
- Update: 本計畫checkbox與驗證結果；不要以推測的production狀態填通過

- [ ] 全workspace搜尋 `hideToday|hidden_day|hidden-day|taipeiDay` 相關聲明callers，確認產品程式與文案不再使用一天隱藏；其他用途或歷史docs不做無關刪除。
- [ ] Backend完整CI：`go test -race ./... -count=1 -p=1`（獨立Postgres）、`go vet ./...`、`npx --yes @redocly/cli@2.47.0 lint openapi.yaml`、migration policy、image build／scans及所有required CI。其他repo完整CI與Task3–6指定checks全綠後才可merge。
- [ ] Review gates：使用者審閱此spec/plan後授權implementation；code/PR review後另授權merge/release。若Account DSR consumer需改，先發布相容consumer，再發布Backend producer；沒有必要則Account API不修改。
- [ ] Producer先發布：Backend -> Gateway -> frontend-platform packages -> 官網與Account。每repo使用既有immutable artifact流程，記錄commit/artifact/deployed revision、health/readiness與route smoke，不能以CI成功代替release驗證。
- [ ] 使用獲授權測試帳號，在桌機官網勾選既有聲明版本後，手機官網與profile同帳號皆不彈；再測profile->官網方向、不同帳號、匿名及登入切換。此操作會寫測試帳號偏好，需在授權scope內。
- [ ] 在獨立測試環境發布fixture v2，確認兩端重彈、草稿保存不重彈、window外不彈、同語系fallback不重彈、同期PUT race。不得為驗收直接編輯production聲明；若無isolated環境，只宣告該部分尚未完成。
- [ ] 驗證focus與60秒刷新上限、同步錯誤提示、old-day部署後可能再彈一次、匿名browser storage清除後恢復提示，记录真實裝置證據。
- [ ] Release故障按repo rollback，保留additive表與偏好，不直接down migration。全部merge/release/smoke成功且無follow-up，才移除本任務新建的clean worktrees與已納入origin/main的local branches；主checkout clean時才`git pull --ff-only`。

## 審閱與執行建議

建議由目前session依序執行，因為五個repo緊密依賴同一版本與API契約；先確定producer與SDK，再接兩個consumer較容易控制差異。使用者若另選並行agent工作，才採subagent-driven-development。

本次僅完成spec／plan文件及一致性自審；不執行上列產品測試、不建立implementation worktree、不commit main、不開PR或發布。
