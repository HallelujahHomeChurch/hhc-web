# Weekly Simplified Bulletin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Implement inline; one independent whole-change review at the end.

**Goal:** 從已校對繁中一般版產生可獨立編修、校對、發布的簡中線上週報，完成整鏈驗證，停在 merge 前。

**Architecture:** hhc-web-api 擁有衍生工作與版本；沿用現有 worker、排版驗證、三方比對和發布流程。使用固定 OpenCC 設定在後端轉換一次，不在讀者瀏覽器轉字，不另建服務。Admin 與官網透過既有共用 client 使用新契約。

**Tech Stack:** Go 1.25.13、PostgreSQL、既有 Node extractor runtime、opencc-js 1.4.1（from: tw, to: cn）、TypeScript/React、既有 renderer。

**Spec:** `../specs/2026-10-05-weekly-simplified-design.md`。使用者已於 2026-10-05 核准實作。

## Implementation status — 2026-10-05

Tasks 1–6 的程式已接入：固定 OpenCC 後端轉換、持久工作/CAS/比對、獨立簡中編輯發布、V2 renderer 與字型、Admin 操作與復原隔離、官網閱讀/下載獨立 fallback 及離線隔離。這不代表所有驗收已完成。

- 本機 PostgreSQL 與隔離 renderer 驗證通過；1739/1740 原 extraction/load gate 通過。獨立審查兩項 Important 已補 RED→GREEN：重試保留人工標題、相同來源不重複產生 incoming。
- 本機驗證：Web 683 tests、Admin 838 tests；兩者 lint/build 通過。API full race/vet 與 PostgreSQL 回歸、Gateway tests/vet/method matrix/nginx、Platform tests/lint/build/package/consumer checks 通過。這些不是遠端 CI 或 production 驗收。
- 2026-10-06 使用者授權繼續後，已在既有 Ego space 60 完成 Admin 本機 mock 操作驗收：繁中編輯/儲存/確認→產生簡中→簡中人工修改/確認/獨立發布→來源更新→三方保留人工稿。未儲存離開提醒、元件 Drawer、桌機/窄版預覽及發布確認視窗均實際操作；不是正式 API/Asset 整鏈驗收。
- 本輪 UI 修正：窄版 Admin 標頭與編輯器 sticky 標頭重疊（60px shell offset 與控制項 scroll margin）；比對標題使用元件名稱，不顯示內部 ID。390/768px 無橫向溢出且標頭不重疊；1440px compact、1680px 三欄檢視已確認。實體手機仍未驗收。
- 真實 upload→scan→Account 授權→worker→publish 整鏈與實體 iOS/Android/PWA 尚未驗收，不能以 mock 替代。
- 新 immutable renderer producer 尚未發布；API CI/release 仍引用舊 producer，須依授權的發行順序更新 pin，不能直接合併。
- 保留所有既有 dirty worktree；沒有 merge、push、deploy。逐項驗證與決策記錄在 `.superpowers/sdd/2026-10-05-weekly-simplified/progress.md`。

## Global Constraints

- 不重讀簡中 PDF、不使用 LLM；不是英文翻譯、兒童版模板或簡中 PDF 產生器。
- 同來源重複點擊須冪等；使用既有版本比對/CAS，失敗保留舊草稿及已發布版本。
- 簡中使用獨立 document identity、contentLocale=zh-Hans；私人筆記、標註、進度與離線 receipt 依各自 document 隔離。
- 不建立假的簡中 asset/grant；既有 exact-edition entitlement 繼續適用簡中。
- API、canonical OpenAPI、contract tests、generated client 同步修改；不得靜默改變已發布 immutable renderer。
- 保留既有未提交變更，沿用 `.worktrees/weekly-reader-review-20260930` 各 repo；不得 merge、部署或改 production。
- 每個任務先 RED 再 GREEN。任務結束檢查 diff；只提交本任務可清楚隔離的 hunks，不得批次提交既有使用者變更。

## Review Focus

1. 轉換跨字型 span／增減字數，不可使標註 offset、搜尋結果或強調範圍偏移（Task 1）。
2. 背景轉換期間來源或簡中人工版本變動，不可用舊結果覆蓋新版（Task 2）。
3. 簡中已有 PDF／人工標題，但首次產生線上稿，不可覆蓋既有 canonical metadata（Task 2、3）。
4. 簡中沒有 PDF 仍能獨立發布線上稿，但不能繞過語言版本權限（Task 3、6）。
5. 跨語言切換、離線與復原，不可帶入另一份文件的私人資料（Task 5、6）。

## Workspace and file ownership

所有下列路徑相對各自 repo，並非同一 Git repo。

- `hhc-web-api`: `internal/onlinebulletins/{admin,validation,worker}.go`、`internal/bulletins/online.go`、`internal/postgres/online_bulletin_*.go`、`internal/httpapi/{handler,online_bulletin_handlers}.go`、`openapi.yaml`：商業規則、資料與契約。
- `frontend-platform`: `packages/hhc-web-client/{openapi/hhc-web-api.yaml,src/client.ts,src/generated.ts}`、`packages/ui/src/bulletin-reader/`、`tools/bulletin-renderer/`：client 與不可變排版資產。
- `admin-fe`: 現有 `OnlineBulletinEditorPage`、online recovery、比對與語言入口：操作與人工校對。
- `api-gateway`: `conf.d/api/admin/40-bulletins.conf`、`docs/openapi.yaml`、`docs/openapi_test.go`：明確路由與權限白名單。
- `hhc-web`: `src/app/[locale]/literature-ministry/` 與既有首頁、reader/entry helper tests：語言入口及會員閱讀。

預檢已 fetch 四個 repo 的 origin/main；web/API/admin/platform 分別落後 4/3/8/4 commits。執行前比較相關上游差異與 migration 編號；不得直接 rebase/reset dirty worktree。若上游改到本功能契約，先報告衝突再整合，不把舊基底測試說成最新 main 驗證。

### Task 1: Deterministic structured conversion

**Files:** Create API `tools/bulletin-conversion/{package.json,package-lock.json,convert.mjs,convert.test.mjs}`、`internal/onlinebulletins/simplified.go`、`simplified_test.go`; modify `Dockerfile.extractor`。

**Interfaces:** `ConvertSimplified(ctx context.Context, source Document) (Document, error)`；Node stdin/stdout JSON 只接收結構化文件，固定 opencc-js 1.4.1/tw2s，不接受可執行參數。

- [ ] RED: `TestConvertSimplifiedPreservesStructure`：component/block/sentence ID 不變，locale=zh-Hans；文字／標題轉換，來源物件不變。`TestConvertSimplifiedSpanOffsets`：跨 span 詞彙、emoji、增減字數後範圍仍對齊文字；不能對齊時產生阻擋校對問題，不靜默丟棄樣式。
- [ ] Run `node --test tools/bulletin-conversion/convert.test.mjs` 和 `go test ./internal/onlinebulletins -run Simplified -count=1`，確認為預期失敗。
- [ ] Implement whole-sentence conversion with explicit source-to-output boundaries；只轉可見文字，不轉 ID、URL 或 provenance。重算文字範圍與 hash；沿用現有 bounded subprocess/timeouts，不加入 CGO 或網路服務。Docker 安裝鎖定依賴並保留授權。
- [ ] 重跑上述測試及 extractor image smoke；確認無 runtime 字典下載、timeout/無效 JSON/輸出超限安全失敗。
- [ ] Review task diff; isolate checkpoint commit when safe.

### Task 2: Durable jobs, provenance and safe incoming revisions

**Files:** API `internal/onlinebulletins/{admin,worker}.go`、新增 `internal/postgres/online_bulletin_derivation.go` 與 tests、新增下一個可用 migration `*_online_bulletin_derivation.sql`。

**Interfaces:** `QueueSimplifiedInput{CanonicalVersion, SourceOnlineVersion, TargetOnlineVersion int64; SourceRevision string}` → existing `QueuedExtraction` job-envelope shape。工作保存來源 document/revision/content hash/metadata version、轉換器及設定版本；target 固定 general/zh-Hans。

- [ ] RED: `TestQueueSimplifiedRequiresConfirmedSource`、`TestQueueSimplifiedIdempotent`、`TestSimplifiedJobRejectsStaleVersions`、`TestSimplifiedIncomingPreservesManualDraft`：未校對拒絕；相同來源/設定重試同 job；stale CAS 不覆蓋；有人工稿只新增 incoming。
- [ ] Run `go test ./internal/onlinebulletins ./internal/postgres -run Simplified -count=1`，確認失敗；DB 測試使用 repo 現有隔離 PostgreSQL harness。
- [ ] 最小新增 durable conversion job/provenance 資料，沿用 lease/重試模式，不塞假的 SourceAssetID 到 PDF extraction job。首次成功建立 local + converted baseline；後續以最後採納的 converted baseline / 人工 local / 新 incoming 比對。失敗不改任何已發布 pointer。
- [ ] 在交易中保護來源與 target 版本；缺 Hans edition metadata 時合法建立無 PDF 的版本記錄，有既有 metadata 則保留。新轉換標題/副標列為待審候選，不背景覆寫 canonical 欄位。記錄更新 baseline 的採納時機，拒絕已被取代 job。
- [ ] 重跑測試、migration policy、空 DB/含既有繁中及 Hans PDF 資料的 upgrade tests；再檢查 diff/checkpoint。

### Task 3: Locale-aware editing and independent publication

**Files:** API `internal/bulletins/online.go`、`internal/postgres/online_bulletin_{admin,publication,review,history,compare,metadata}.go`、`internal/onlinebulletins/validation.go` 及對應 tests。

**Interfaces:** 原先只接收 issueID 的 Admin repository methods 加入 `series, contentLocale string`，所有呼叫端同步傳遞；PDF extraction 仍 general/zh-Hant-only。

- [ ] RED: `TestSimplifiedOnlineOnlyPublication`、`TestOnlineDraftLocaleIsolation`、`TestSimplifiedExactEditionAuthorization`：无 Hans PDF 可完成校對發布；寫簡中不改繁中；繁中授權不能讀簡中；兒童/英文拒絕本轉換。
- [ ] Run `go test ./internal/bulletins ./internal/postgres ./internal/httpapi ./internal/onlinebulletins -count=1`，記錄預期失敗。
- [ ] 移除線上發布對同語言 PDF published 的不當依賴，但保留 revision/layout/confirmation/metadata CAS 與權限要求。沿用 PDF 原流程；簡中 source preview 明示「繁中來源 PDF」，不捏造簡中下載。
- [ ] provenance 僅 Admin 可見；會員 projection 使用 allowlist。確認 source revision immutable、metadata 更新需重新校對，既有 locale 的 publish/unpublish/restore 行為不退化。
- [ ] 重跑套件及 entitlement/member projection tests；review/checkpoint。

### Task 4: Renderer and public contracts

**Files:** Platform `packages/ui/src/bulletin-reader/`、`tools/bulletin-renderer/` 與 manifest tests；API `openapi.yaml`、`openapi_test.go`、HTTP handlers；Platform generated client；Gateway 上述三個檔案。

**Interfaces:** `POST /api/admin/bulletins/{issueId}/online/general/zh-Hans/conversions`，If-Match=target online version（首次 0），body 包含 canonicalVersion/sourceOnlineVersion/sourceRevision；202 回 Task 2 envelope。Admin state 回 derivation provenance + stale flag；無讀者端 provenance。

- [ ] RED: contract tests 鎖定 request/response、CAS 409、非人工/缺 scope/錯 locale 拒絕、Gateway 不放行額外 method。Renderer tests 驗證簡中固定文案、金句 scripture 字型、Hans 字型覆蓋及穩定 page map。
- [ ] Run `go test ./...`（API 與 Gateway 各自）及 `corepack pnpm test`（Platform），記錄新增案例失敗。
- [ ] 新模板/renderer version 承載簡中 fixed text 與所需字型；保留既有 V1 digest/assets，依現有封裝工具計算新 digest。字型須合法、確實含所需簡中字形；缺字阻擋校對，不静默以錯誤量測結果發布。
- [ ] 更新 canonical OpenAPI → client snapshot/generated output → client wrapper/tests；Gateway 僅增明確 route 與必要 Hans 既有編輯 route，使用 cms:bulletins:write/read 原有政策，不 wildcard 開放。
- [ ] 重跑 contracts、renderer verification/package tests、Gateway method matrix；review/checkpoint。

### Task 5: Admin conversion and independent review

**Files:** Admin 現有 `OnlineBulletinEditorPage`、recovery helper、online copy、route 與 mocks/tests；沿用既有 ThreeWayCompare 與 component editor。

**Interfaces:** 共用 client conversion method 呼叫 Task 4 endpoint；編輯器與 recovery key 使用 issue/series/contentLocale/document/account 完整身份。

- [ ] RED: UI tests 驗證未儲存/未校對不能轉換；點擊一次 queue，重試不重複建稿；工作失败有重試；來源落後可更新；Hans 手改經 reload/比對不被覆蓋；切換 locale 不回填另一語言復原稿。
- [ ] Run `corepack pnpm test:run -- --maxWorkers=2`，確認新增案例失敗。
- [ ] 在既有一般繁中線上編輯頁增加「產生簡中草稿」；已有衍生稿時顯示開啟/更新與來源狀態。Hans 沿用同編輯頁、確認與發布流程；沒有 Hans PDF 不顯示壞掉下載/假預覽。沿用既有 canonical metadata 編輯入口確認標題候選。
- [ ] 重跑 tests、lint、build，桌機/窄版實際操作一次 queue→edit→compare→review；記錄 mock 與真後端的差別；review/checkpoint。

### Task 6: Reader entries and end-to-end closeout

**Files:** Web 首頁及 `src/app/[locale]/literature-ministry/`、reader entry/private/offline tests；上述各 repo verification docs。

**Interfaces:** online availability 與 PDF availability 分開；讀者使用 published exact document identity，不在 client 呼叫 OpenCC。

- [ ] RED: Hans online-only 顯示正確閱讀入口而不捏造 Hans PDF；缺 Hans online 時走既定 Hant fallback；一般/兒童互不混用；下載繼續使用既定獨立 fallback。跨語言 highlights/notes/progress/offline 不互串。
- [ ] Run `corepack pnpm test:run`（Web），確認新增案例失敗；實作最小入口條件修正，保持已確認的桌機/手機設計。
- [ ] 使用 1739/1740 來源在隔離本機環境走真實 upload→scan-ready→extract→人工修改→layout→confirm→publish→會員閱讀，再走 Hans conversion→人工改字→來源更新→三方採納→獨立發布。缺真實依賴就列 blocker，不用 demo 成功替代。
- [ ] API: `go test -race ./... -count=1 -p=1`、`go vet ./...`、migration policy 與 CI extractor isolation/load gate；Gateway: `go test ./...`、`go vet ./...`、`./scripts/test-auth-method-matrix.sh`、container nginx configuration check。
- [ ] Platform: `corepack pnpm test`、`lint`、`build`、`check:packages`、`pack:packages`、`test:consumers`；Admin/Web: tests、lint、build；各 repo `git diff --check`。依各 repo CI 補相同必要檢查，不觸發 production。
- [ ] 一次獨立 whole-change review，修正已確認問題並重跑受影響檢查。交付各 repo diff、測試/CI/真實整鏈/實體 iOS Android PWA 分開的狀態；未驗證即明列未驗證。停在 merge 前。

## Self-review

Spec 的來源、身份、metadata、CAS、人工修訂、授權、renderer、入口與驗收均有對應任務。Admin 顧問前輪修正不重新實作；本輪僅做 locale 回歸與未完成整鏈驗證。無需新增 Account/Asset 服務邏輯或授權模型。
