# 影音專區搜尋：實作與交付

狀態：2026-10-09 已依最新授權實作影音搜尋，其他頁搜尋入口維持可見但 disabled；未做全域搜尋。API PR172、Gateway PR157、共用套件 PR106 與網站草稿 PR172 尚未合併／發布。2026-10-08 的正式版重審基準如下。搜尋不以直播實場驗收完成為前提。

基準：hhc-web `c0cf694607be13641fbd83bb464fc63ffee4fb99`，其中影音版型由 PR #165／`c43448af1895a3ac64b8eadf28a118afa501e913` 交付；hhc-web-api `2f105e880c714f69b2acbe2b9762071466cda159`；正式共用 UI／SDK `1.0.44`；api-gateway `fd50c25c27de6899b8291c80e9af7ae6efd810a8`。

本階段延續 Mac M4 的觀看頁、說明欄與 cursor 批次載入。會員留言仍依既有 M6 計畫另階段交付；Windows 外掛、編碼、seal、自動發布與直播播放契約不納入搜尋改動。

## 重審發現與版型決定

- 正式版桌面列表已有三欄大縮圖，沒有可見的最近錄影／總場次／分頁；觀看頁已有約 72/28 的播放器／建議影片比例。保留這些已確認的版型。
- 一般列表仍有 430–610px 的大 banner；實測 1470px 視窗時，第一張影片距頂端約 776px。搜尋入口依最新確認放進網站 header；搜尋結果模式不顯示大 banner，避免把主要操作與結果推離首屏。一般瀏覽模式的 banner 不在這次搜尋工作中另外重設。
- YouTube 搜尋結果是獨立的單欄橫向列表，不是三欄首頁或觀看頁側欄。在本次 1470px 桌面參考中，結果列約 1167px、縮圖約 500px；HHC 採獨立最大寬度約 1200px，縮圖約 42%、最大 500px。這是版型基準，不是所有尺寸的固定像素承諾。
- 目前觀看頁返回連結固定指向無查詢的 `/member-videos`；必須新增搜尋來源處理，否則點影片後會丟失查詢與位置。
- 目前 API 與 Gateway 的直播列表都拒絕所有 query parameters；Gateway 也不轉送 query。可選 `q` 必須在 GET 契約、API 驗證、Gateway 轉送與 SDK 同步新增，不能只在前端附上參數。

| 模式 | 主要內容與比例 | 搜尋列與返回 |
| --- | --- | --- |
| 一般瀏覽 | 延續桌面三欄；平板二欄、手機一欄 | 共用 header 搜尋入口；影音頁提示「搜尋影音」，空白查詢維持瀏覽模式 |
| 搜尋結果 | 單欄橫向列；縮圖左、資訊右；640px 以下改垂直卡片 | 沿用 header 搜尋入口；結果頂端只顯示查詢標題，不加總場次或分隔線 |
| 觀看影片 | 延續桌面約 72/28；1280px 以下建議影片在播放器下方 | 沿用 header 影音搜尋入口；有來源查詢時顯示「返回搜尋結果」 |

## 操作與畫面

- header 搜尋入口對所有訪客顯示。只有影音列表、結果與觀看頁可使用影片搜尋；其他頁面入口 disabled，無法展開或送出。沿用共用欄位與最小影音路由 adapter；不先建立全域 provider 框架。未來其他頁面補入功能後才取消 disabled；其資料來源、權限與 API 另行定義。
- 沿用共用 ExpandableSearchField。桌面入口在 avatar 左側；展開空間足夠時保留中間 nav，不足時暫以搜尋取代 nav，保留 logo 與帳號。手機展開成完整不透明 header row，完全覆蓋 logo；操作至少 44px。關閉保留草稿並還原焦點，清除只清除草稿。
- 搜尋入口可見性不代表影片存取權。影音頁送出搜尋沿用登入、entitlement 與法律條款流程；SSR 不注入會員結果。
- 輸入草稿與已送出的 q 分開。按 Enter／搜尋按鈕才送出，中文輸入法組字中的 Enter 不觸發。URL 使用 `/[locale]/member-videos?q=...`；重新整理、分享與瀏覽器前進／後退均重建已送出的查詢。再次送出相同 q 也重新取得第一批。
- 清除輸入按鈕只清除草稿；送出空白，或點無結果狀態中的「清除搜尋」，移除 q 並回到三欄瀏覽。不要每打一個字就清空結果或發請求。
- 第一階段搜尋影片標題與影片說明；不搜尋字幕或影片內容。不加入頻道、觀看次數、廣告、熱門排序或推薦演算法。
- 搜尋卡片保留相同 16:9 圓角縮圖與色彩；右側是最多兩行標題、上傳日期、最多兩行純文字說明。錄影長度在縮圖右下，直播中 chip 在右上；沒有頻道頭像、頻道名稱、觀看次數或操作選單。沒有說明就省略該行，縮圖失敗保留現有 placeholder。
- 結果沿用本次 LoadMoreTrigger，往下捲動逐批載入，載入失敗保留結果並提供重試。沒有結果時顯示查詢詞及清除搜尋的操作。
- 有符合查詢的直播時置頂，沿用紅色「直播中」chip；不符合查詢的直播不出現在結果。開播時間與上傳時間分開表達。
- 點結果進入 `/[locale]/member-videos/[id]?q=...`。觀看頁 q 只代表搜尋來源及搜尋列預填；選中影片的查詢、播放資格與右側最新建議影片仍獨立取得，不因 q 改變而消失。建議影片連結可沿用來源 q，返回連結僅以已知 locale 與 q 建構站內 URL，不接受任意 returnTo。
- 返回搜尋保留已載入深度與位置：僅在同一個登入身分／locale／q 的短期頁內記憶體保存一份批次數、影片 anchor 與位置，不保存結果資料、縮圖 Blob、token 或播放 grant。返回時重新驗證資格、由第一批逐批重讀至原批次數；cursor 耗盡提前停止。以仍存在的 anchor 定位，已到期／移除則把原位置限制在目前已載入範圍。還原失敗保留已讀批次及重試操作，不提前捲到尚未載入的位置。
- 重新整理、直接開啟分享連結或沒有導覽狀態時，由第一批開始；跨帳號、登出與查詢變更清除短期還原狀態。對無 q 的一般列表返回也沿用同一機制。

## 直播與錄影結果

- 共用搜尋詞規則，但保留兩種可見性：VOD 要求已發布、未到期、ready package；直播沿用既有 LiveAvailable、會員與法律條款檢查，不套用「完成並發布的 VOD」條件。
- 搜尋直播沿用現有 30 秒狀態更新；只有 live 狀態使用紅色「直播中」，starting／recovering／interrupted 保留實際狀態。ending／ended 不新增成可供新觀眾進入的搜尋結果，既有觀看 session 不受搜尋影響。
- 同一 recording ID 同時出現在直播與錄影時只呈現一次。直播移出結果時重新取得當前 q 的錄影第一批並合併，保留既有較舊批次的 continuation cursor；不能只刪直播或把第一批 cursor 當成已載入深度的 cursor。
- 尚未發布的會後錄影不偽造為可觀看；之後重新送出搜尋或返回結果會再查目前可見性。新增錄影不承諾在無互動的搜尋頁即時出現，不為此加入持續 VOD 輪詢。直播轉錄影的生產與發布流程維持原契約。

## 資料與契約

- hhc-web-api 負責搜尋與可見性判斷；VOD 與直播都沿用會員資格、影音 entitlement 與法律條款檢查，每次批次或重新進入均重新檢查。
- `GET /member/recordings?limit=12&q=...&cursor=...` 新增可選 q；非空 q 要求 limit。`GET /member/recordings/live?q=...` 同步新增可選 q，其他不支援的參數仍拒絕。q 重複值、非法 limit、無 limit 的非空 q／cursor、過長 q 與錯誤 cursor 依各端點原有 400 error envelope 拒絕；不更改 live playback POST 或 OBS capture 契約。
- 無 q／正規化後空 q 保留原有無 limit 的 legacy 列表回應與有 limit 的 batch 行為。SDK 原有無參數／signal 參數呼叫維持相容，搜尋選項與 q 為增量契約。
- 建議修正舊計畫的整句包含規則：q 去頭尾空白、Unicode 空白合併為一格，再按空白拆詞；最多 100 個 Unicode code points。每個詞以不分大小寫、字面包含匹配標題或說明，所有詞都要符合，可以分布在兩個欄位。例如標題有「主日」、說明有「信心」，搜尋「主日 信心」能命中。首版不做引號語法、OR、模糊搜尋、斷詞、同義字或日期解析。
- SQL 使用參數及轉義 `%`、`_`、反斜線，不把詞當 wildcard。篩選須先於 keyset limit，不能只過濾已下載的十二張卡片；VOD 與直播必須共用同一詞規則。
- 命中錄影按 uploadedAt DESC、ID DESC 排序，第一版不新增相關度分數。cursor 綁定查詢正規化值的 digest 與排序／格式版本；不要把最多 100 字的原文塞進現有 256 字上限的 cursor。舊無查詢 cursor 僅在 q 為空時接受，跨查詢 cursor 拒絕；OpenAPI 同步定義相容與錯誤情形。
- 已送出的 q 變更時取消舊請求、清空 cursor 與結果；防止較晚返回的舊查詢覆蓋目前結果。直播狀態更新維持去重，直播轉錄影後不重複顯示。
- 回應維持 private/no-store。縮圖沿用有權限檢查的 Blob URL 與元件期間記憶體暫存；不加入持久化私人縮圖快取。
- 查詢詞不寫進 GA、Sentry breadcrumb 或自行新增的原始搜尋紀錄；沿用 query URL 的 analytics 排除規則。搜尋結果繼續 noindex，不在公開 SSR／靜態 metadata 中嵌入會員影片內容。目前 API access log 使用路由 pattern，Gateway 使用不含 query 的 safe_uri；保留這些規則，新增 q 的 runtime logging 測試確認查詢詞不出現在記錄。
- 搜尋資料量與查詢耗時有實測瓶頸時再評估索引；本階段不引入搜尋服務或全文搜尋引擎。

## 交付與驗證

1. API：在同一 PR 更新兩個 GET 的 canonical OpenAPI、查詢驗證、詞匹配、VOD／直播可見性與 query-bound keyset 測試；先發布並驗證真正接受 q。
2. api-gateway：只調整直播列表 GET，移除全 query 拒絕並轉送 `$is_args$args`，由 API 驗證可接受的參數；播放 POST 維持拒絕 query。新增路由、會員授權、參數轉送與安全 logging 測試。API 先發布，Gateway 再發布並以正式 same-origin 路由 smoke；兩者就緒前網站不送 q。
3. frontend-platform：同步 canonical schema 與兩個 SDK 方法的 q 選項，驗證原無參數呼叫；發布正式版本。繼續使用現有 LoadMoreTrigger，沒有 UI package 改動時不為搜尋另造共用元件。
4. hhc-web：固定已發布 SDK 版本，將既有 header 搜尋入口接到影音 adapter，加入 searchParams 處理、結果版型、查詢來源與返回還原。共用 UI 保留查詢 callback，實際影片查詢與返回狀態由影音 feature 擁有；其他頁 disabled，後續按實際需求擴充。影片 card 的重用限網站影音 feature；共用套件不承擔會員授權、搜尋排序或返回狀態。

實作驗收案例：

- 中文／英文、單詞與跨標題／說明多詞、Unicode 空白、大小寫、SQL 特殊字元、含 emoji 的 100／101 code points、重複 q；空白能回一般三欄。
- 資料超過十二筆後仍可命中；空批次但 nextCursor 非 null 繼續讀；跨 q cursor 拒絕，無 q 舊 cursor 與原呼叫保留相容。
- 組字 Enter、同 q 重送、URL 重新整理／分享／前進／後退、查詢切換時舊請求晚到、失敗重試保留已載入結果。
- 搜尋點影片、觀看頁再次搜尋、點右側建議影片、返回深層結果、結果到期／刪除、還原途中失敗及登出／跨帳號；不得恢復舊的 private bytes 或 grant。
- 直播符合／不符合、狀態更新、直播與 VOD 同 ID、直播移出後第一批更新與 continuation、不即時發布的會後錄影在下次查詢才出現。以既有 C1 fixtures 驗證，不等待 Windows 真場直播才測搜尋。
- 320／390／768／1024／1440／1920px，搜尋結果獨立寬度、16:9 縮圖、紅色 chip／時間位置、無總場次／分頁／分隔線、鍵盤 focus、載入與無結果的可讀狀態；正式會員錄影播放及權限檢查仍須 smoke。

## 實作驗證與發布 gate（2026-10-09）

- API [PR172](https://github.com/HallelujahHomeChurch/hhc-web-api/pull/172)：`c75f5ea`，完整 Go race／PostgreSQL 搜尋與游標測試、vet、OpenAPI 與發布政策已在本機通過。
- Gateway [PR157](https://github.com/HallelujahHomeChurch/api-gateway/pull/157)：`5b8d93c`，protected GET q forwarding；live playback POST 仍拒絕 query。路由／Docker runtime／安全日誌驗證通過。
- 共用套件 [PR106](https://github.com/HallelujahHomeChurch/frontend-platform/pull/106)：`54769dc`，預備 `1.0.49`。SDK 76、UI 116 tests 與打包消費端通過；schema 只同步本次兩個影音 GET canonical path，其他域沿用最新版 main 已合併的契約，保留 V6 renderer 與打包驗證。
- 網站 [草稿 PR172](https://github.com/HallelujahHomeChurch/hhc-web/pull/172)：加入標題／說明搜尋、query-bound 分段、返回結果深度與位置、直播移出更新及其他頁 disabled。最新上游整合後完整 875 tests、production build、lint、靜態效能與發布政策用本地 preview 套件通過。官方 manifest 仍保留已發布版本，未提交 file dependency。
- `1.0.48` 已由上游 V6 PR107 使用；本次共用分支已 rebase `80bc70d` 並預備 `1.0.49`，網站也 rebase `030da9b` 保留最新播放器修正。官方網站原先 SDK pin 已更新為 `1.0.47`，UI 仍為 `1.0.44`；1.0.49 正式發布前不提交暫存依賴。
- 獨立覆核發現並修正：nullable account identity、同關鍵字 refresh 舊 continuation、直播轉錄影擠出批次邊界、返回時等待直播首批；新增回歸測試。
- 依 API → Gateway → 共用套件 → 網站順序，在各 PR CI 通過與核准後合併／發布。共用套件正式發布後，網站再固定 UI／SDK 的正式精確版本、產生 lockfile並重跑 CI；草稿目前不可合併。不得以本地 preview 代替正式 CI。
- 正式環境搜尋、會員權限與播放 smoke，以及實體手機驗收仍待發布後執行。全域搜尋／字幕索引／搜尋引擎不在本次範圍。
