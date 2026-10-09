# 教會聲明：跨裝置同步與版本式不再顯示

日期：2026-10-09（Asia/Taipei）  
狀態：規格草案，供審閱；尚未實作、測試或發布。  
實作計畫：[statement-dismissal-sync](../plans/2026-10-09-statement-dismissal-sync.md)

## 目的與已確認需求

官網與 Account profile 的聲明彈窗使用同一個「不再顯示」規則。登入者按帳號同步所有裝置；未登入者只記住瀏覽器選擇。同一則聲明更新並正式發布後，重新彈出。

1. 勾選文字改為 **「不再顯示」**。
2. 隱藏狀態以 **聲明 ID＋已發布版本** 為單位，沒有一天期限、隱藏日期或過期判斷。
3. 已登入：官網與 Account profile 讀寫同一份帳號狀態，跨裝置同步。
4. 未登入：保留瀏覽器本地記憶與同裝置跨子網域共用，不做裝置註冊或帳號同步。
5. 更新草稿不重彈；新版本成功發布、成為 public projection 後才重彈。
6. 新聲明 ID 與新已發布版本均視為未隱藏。
7. 聲明列、完整文章與手動閱讀仍可使用。「不再顯示」只停止自動彈窗。
8. 聲明本身的 `popupStartsAt`、`popupEndsAt`、`serverNow`、`nextChangeAt` 仍保留；移除的是使用者隱藏狀態的日期計算。

## 現有實作證據

- `hhc-web/src/components/statements/StatementProvider.tsx` 使用每聲明的 localStorage hidden-day 與 `hhc_statement_hidden_day` cookie；document lifetime 的 `prompted` 目前只使用聲明 ID。
- `account-fe/src/components/StatementStrip.tsx` 使用相同共享 cookie，但沒有帳號後端狀態；`prompted` 同樣只使用聲明 ID。
- 兩端均已有每分鐘、focus 刷新。官網另有 visibilitychange 與輸入中不彈出的保護。
- `hhc-web-api/internal/content/types.go` 的 `PublicItem` 已有 `PublishedVersion`；`internal/postgres/content_repository.go` 的 publication snapshot 以 `item.Version` 填入該值。`PublicNews` 只讀 public projection，不讀 mutable draft。
- `ActiveStatement` 目前回傳 `serverNow`、`nextChangeAt` 與 localized `statement`；後端需確保舊 projection 也能取得可靠的發布版本，不能把缺值當成 0。
- Gateway 已在 www 與 account 主機提供公開的 `GET /api/statements/active`。新增帳號狀態另走受保護路由，公開回應保持不含個人資料。

以上是程式碼證據，不代表目前 production revision 或裝置驗收結果。

## 決策與範圍

### Ownership

狀態屬於教會聲明產品行為，由 `hhc-web-api` 管理；Account API 繼續只提供帳號身分與既有驗證，不把 CMS 聲明狀態寫入 IAM profile。Account profile 是此狀態的消費端。

主要涉及五個 repository：`hhc-web-api`、`api-gateway`、`frontend-platform`、`hhc-web`、`account-fe`。共享套件負責型別、HTTP client 與匿名儲存格式，避免兩個前端各自定義協定。Account API 的既有 DSR 消費契約需驗證相容；若拒絕新的 export record/coverage，需加一個獨立相容性 PR，不能略過資料生命週期。

不增加微服務、WebSocket、裝置清單、管理員重置介面或批次清除全帳號工作。

### 發布版本

`StatementRef = { statementId: string; publishedVersion: number }`，其中 ID 為 UUID，版本為正整數且必須在 JavaScript safe integer 範圍。

版本來自實際 public projection 的 `version`，與回應文章 snapshot 一致。不得使用草稿 `content_entry.version`、讀取時間、語系或 `lastPublishedAt` 作識別。

同一發布版本的所有語系與 fallback 共用狀態。成功重新發布出現新的 `publishedVersion` 就重彈，包括標題、正文、圖片、翻譯或排程修改；不另外比較正文是否相同。即使內容與舊版本相同，只要產生新的發布版本仍重彈。發布失敗或尚在 publishing 時，舊 projection 與舊隱藏狀態繼續有效。

版本缺失／不合法時仍可讀文章及普通關閉，不儲存永久隱藏，也不推測版本。新後端需從同一 projection row 的 version 補齊舊 payload 缺值，不重發內容、不更新既有聲明。

## 資料與 HTTP 契約

### 帳號儲存

新增 `hhc_web.statement_dismissal`：

| 欄位 | 型別／約束 | 用途 |
| --- | --- | --- |
| account_id | uuid NOT NULL | Gateway 驗證的 human subject |
| statement_id | uuid NOT NULL，FK content_entry ON DELETE CASCADE | 聲明 |
| published_version | bigint NOT NULL，CHECK > 0 且 <= 9007199254740991 | 已隱藏的發布版本 |

主鍵 `(account_id, statement_id, published_version)`。不存 `hidden_day`、`hidden_until` 或 expiry；不增加 preference timestamp。新增 migration 只能 additive，編號使用實作時最新 origin/main 的下一個可用序號。

使用獨立版本列避免延遲的舊版寫入覆蓋新版隱藏紀錄。重複 PUT 為冪等。發布新版本不刪除舊紀錄：exact version 不匹配便自然失效，且不需掃描所有帳號。刪除聲明、帳號清理／DSR erasure 時移除相關列；既有個資 export 也必須包含此帳號自己的紀錄，不能以新增表為由忽略。

### 公開聲明

保留 `GET /api/statements/active?locale=...` 與原 envelope，保證有聲明時 `statement.publishedVersion` 為正確、非零的發布版本。匿名與登入者讀到相同公開文章，不加入個人 hidden 欄位。

### 個人狀態

新增以下同源 route，在 www 與 account 主機均由 Gateway 路由至 `hhc-web-api`：

| Method/path | 輸入 | 成功回應 |
| --- | --- | --- |
| GET `/api/me/statements/{statementId}/dismissal?publishedVersion=N` | 正整數 N | `200 {data:{statementId,publishedVersion,dismissed:boolean}}` |
| PUT `/api/me/statements/{statementId}/dismissal` | JSON `{publishedVersion:N}` | `200 {data:{statementId,publishedVersion,dismissed:true}}` |

輸入不接受 account_id；永遠從 trusted principal 取得 subject。GET 查詢 exact tuple；聲明仍公開但版本已更新時，對旧版本 GET 回 409 `statement_version_changed`，前端重新取 active。聲明未公開／不存在／不是 statement 回 404。PUT 只接受目前已公開的 exact version，與 projection 的版本校驗及 INSERT 在同一 transaction 完成；發布並發時不得把舊版選擇套到新版。選擇序列化鎖須與現有 publication transaction 相容，並以兩連線 integration test 證明 race 行為。

UUID／版本／JSON 不合法回 422 `invalid_request`；identity 缺失回 401，service principal 回 403；不支援方法回 405；無法儲存回既有 5xx envelope。每個回應包含 `Cache-Control: no-store`。PUT JSON 限 1 KiB、不得接受未知欄位或重複 JSON document。

保留 Gateway 本地 JWT 驗證、human-only route、可信身分標頭、Dapr caller/token 驗證與既有 rate limit。不要求 church membership、CMS scope 或 admin role，因為所有已登入的人都能管理自己的彈窗狀態。PUT 要求 Bearer access token 與 application/json；不新增 cookie-only mutation 或 credentialed CORS，因此不能被第三方頁面透過 cookie-only form 改寫。

## 前端行為

### 已登入

1. 等待 auth bootstrap 結束；不把 checking/loading 當成匿名。
2. 取得 active statement，再查該帳號該發布版本的 dismissal；在查詢完成前不要先閃出彈窗。
3. `dismissed=true` 關閉自動彈窗；false 依 document prompt 規則彈出。
4. 勾選並關閉時 PUT exact displayed version。成功後立即關閉並記住目前 account/ref 的投影。
5. PUT 失敗可普通關閉，顯示「未能同步『不再顯示』設定，請稍後再試。」；不能宣稱永久／全裝置已隱藏。版本衝突另重新抓 active。不要把失敗偷偷改成匿名永久記憶。
6. GET 失敗仍可顯示文章與普通關閉，停止該輪自動彈窗以避免已隱藏的人反覆被打擾；focus／下一輪刷新再嘗試，錯誤送既有 handled-error 管道。
7. 初始化、focus、visibilitychange 可見與可見狀態的 60 秒 interval 刷新狀態。其他已開啟裝置最晚在下一輪成功刷新同步；不承諾即時推送。
8. Logout／subject 切換後清除個人投影、abort 舊請求；舊帳號的慢速讀寫回應不得更新新帳號 UI。正在保存期間不得重複提交。

登入狀態不讀匿名 cookie/localStorage 作為權威，也不自動把匿名紀錄匯入帳號。

### 未登入

新格式存 exact `StatementRef`，每聲明的 localStorage value 是發布版本；共享 cookie 的 value 是 `statementId.publishedVersion`，名稱改為 `hhc_statement_dismissed`。cookie 仍共用 production `alive.org.tw` 的 www/account 子網域，保留 Path=/、SameSite=Lax、HTTPS Secure；不含帳號 ID、token 或閱讀內容。

沿用一顆 cookie 作為目前 active statement 的跨主機 bridge，localStorage 保存該 origin 每則聲明的版本。平台既有限制同時只有一則 active statement；新增聲明／重新發布會使用不同 ref。讀到匹配 cookie 時同步到 localStorage；讀到 localStorage 匹配時更新 bridge。測試中確認兩者不會把舊版本套到新版。

cookie 可使用固定瀏覽器允許的最長 Max-Age 作持久化（預設 34560000 秒），但不以時間計算顯示資格，不寫日期、不逐日檢查。這是瀏覽器保存期限，不是產品的「一天有效」。localStorage 沒有應用層 TTL；清除資料、無痕模式、cookie 到期／封鎖或瀏覽器清理可能失去記憶。匿名跨裝置不同步，跨子網域同步仍受瀏覽器 cookie 限制。

儲存不可用時普通關閉仍有效，使用本 document 記憶防止同一版本反覆跳出；不宣稱已永久保存。

### Document prompt 與閱讀保護

`prompted` 的 key 改為 `anonymous/statementId/publishedVersion` 或 `accountId/statementId/publishedVersion`。普通關閉只影響本 document 的本 subject/ref；重載可重新提示。勾選永久隱藏以持久化狀態為準。版本改變，dialog React key 也改變，checkbox 必須重置，不能把舊版選擇提交給新版。

當前正在閱讀同一文章、輸入中、維護／法律頁等既有 suppression 保護保留。Account 與官網在對應 route 範圍採同一版本語意；不擴張 Account 目前掛載 StatementStrip 的頁面範圍。

## 文案與舊資料

兩端 label key 與 boolean 命名由 `hideToday` 改為 `doNotShowAgain`，callback boolean 使用 `dismissPermanently`；所有呼叫端、fixtures、測試與五語文案一起更新。

| 語系 | 勾選文案 |
| --- | --- |
| zh-Hant | 不再顯示 |
| zh-Hans | 不再显示 |
| en | Do not show again |
| ja | 今後表示しない |
| ko | 다시 표시하지 않기 |

停止讀寫 `hhc_statement_hidden_day` 與 `hhc:statement:{id}:hidden-day`。它們沒有發布版本，不能安全轉成永久偏好，因此新程式忽略，不計算旧日期、不匯入帳號、不回填永久值。舊 cookie 讓瀏覽器自然清理，不對 unrelated storage 做清除。部署後原本選了「今天不再顯示」的人可能再看到一次，此為預期遷移行為。

## 驗收

| 情境 | 預期 |
| --- | --- |
| 帳號 A 官網勾選 v1，另一裝置登入 A 的官網或 profile | 下一輪成功刷新後 v1 不彈出 |
| Account profile 勾選 v1，再開官網 | 同樣不彈出 |
| 帳號 B／匿名瀏覽器 | 不被 A 的選擇影響 |
| 匿名官網勾選，切到同裝置 Account 的匿名適用頁面 | cookie 可用時同 v1 不彈出 |
| 隔天或日期跨月／跨年 | 隱藏狀態不變，不執行日期判斷 |
| 更新草稿或發布失敗 | v1 仍不彈出 |
| v2 成功發布且仍在 popup window | 已登入及匿名皆重新彈出，checkbox 未勾選 |
| 切換語系／使用 fallback | 同發布版本不重彈 |
| 在 v1 dialog 保存時，後端已切到 v2 | v1 不會隱藏 v2；409 後刷新 |
| 新版本不在 popup window 或聲明已下架 | 不自動彈出 |
| 狀態服務失敗、storage 被拒或切帳號時慢請求返回 | 可閱讀與普通關閉，不污染別的 subject/ref |
| 聲明刪除／帳號 erasure、DSR export | 對應紀錄刪除／只匯出本人紀錄 |

## 交付與風險

依序交付 additive backend、Gateway routes、共享套件版本，再交付兩個 frontend。每個 repo 使用最新 origin/main 的 isolated worktree、独立 task branch／PR／CI；共享套件按既有 tag 流程發布不可變版本，兩個 frontend pin exact version。

目前只授權文件整理。實作、merge／release、production data/infrastructure mutation 不因本文件自動取得授權。產品程式完成後須經必要 CI、release revision／health／route smoke；實體跨裝置驗收另記證據，不把 unit test 當成裝置驗收。

Rollback 按各 repo 既有流程恢復健康 artifact，保留 additive 表；旧 frontend 仍可讀舊 public contract，但會回到原本一天隱藏語意。新偏好沒有日期 TTL，無需時間 scheduler。匿名 cookie 受 browser 限制，與真正跨裝置的帳號儲存不同。
