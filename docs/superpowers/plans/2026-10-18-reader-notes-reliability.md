# 線上週報筆記可靠性實作計畫

日期：2026-10-18。版本：P3。狀態：S4/P3 與 T0–T5 均已完成兩席檢驗；[PR #234](https://github.com/HallelujahHomeChurch/hhc-web/pull/234) 已開；最終全量結果見 PR 與最新 CI。各階段狀態記於 gate record；最終停在 merge 前。

Spec：[S4](../specs/2026-10-18-reader-notes-reliability-design.md)。Review：[gate record](../../reviews/2026-10-18-reader-notes-reliability-gates.md)。

2026-10-18 最新使用者決定：不再使用 Gemini。T2 缺席席次改由獨立 Codex 補驗；之後每步兩席均為 Codex。下文及 spec 中已完成 Gemini 檢驗保留歷史記錄，未執行步驟的 Gemini 席次均由 Codex 取代；仍逐步檢驗、最終停在 merge 前。

## 1. 交付範圍與執行界線

這份 plan 只實作 spec 第一批 R1–R6／A1–A12。入口是 hhc-web 現有 reader，不新增依賴、後端 endpoint、DB migration、SDK schema、共用 UI package 或第二套持久 queue；畫線／reanchor 是相容性驗證範圍。紙本／易讀版切換、側欄 tabs／搜尋、匯出、書籤及其餘原生確認另列後續。

2026-10-18 使用者已追加授權：補齊視覺門檻並完成兩席檢驗後，依序實作、每步兩席檢驗、開PR並完成CI，最終停在merge前。不得merge／release。任何需改 producer contract／共用 UI 的發現先回到 spec／plan，不用消費端替代實作。

## 2. 基準與重用

文件 worktree：`.worktrees/reader-notes-reliability-20261018`，分支 `docs/reader-notes-reliability-20261018`，基準 `6fd3fd0d9bc44a61aff9b252df613b27ca61fbfb`。原 dirty main 與其他 worktree 不變。

取得實作授權後重新 fetch 最新 origin/main，檢查 reader diff；由最新 main 建立另一個專用 feature worktree，帶入已審閱文件，不重用／刪除其他任務 worktree。先讀該 worktree AGENTS.md、README、Next 本地版本文件及 affected callers；若基準變動影響結論，先更新文件並重審。

重用：`usePrivateReader` 的 mutate／pending／retry、`useReaderProgress` 的 debounce、IDB replica／queue／Web Lock、reader API 20 秒 deadline、return-state 的同帳號文件 30 分鐘復原、`AlertDialog`／`Drawer`、`SyncStatus`、`ReaderRecovery`、五種 locale。

## 3. 預定檔案與契約

| 範圍 | 預定檔案 | 需一起檢查的 callers／tests |
| --- | --- | --- |
| 序列寫入與最新 state | src/features/weekly-reader/usePrivateReader.ts、progress.ts | usePrivateReader.test.tsx、progress.test.tsx、WeeklyReader.tsx 中所有 mutate／progress callers |
| 離線結果分類與取消 | usePrivateReader.ts；sync.ts 僅必要 signal／結果傳遞調整 | sync.test.ts、offline-private.test.ts、upgrade.test.ts；核對 upgrade.ts 的 replay／finish mutate callers；offline-store.ts 的 transaction／claim／ack 契約只讀核對，除非測試證明必要不改 schema／演算法 |
| 操作、草稿、Dialog 與導航 | src/components/weekly-reader/WeeklyReader.tsx、NoteEditor.tsx、NotesPanel.tsx、ReaderPrivateState.tsx、ReaderRecovery.tsx | 各同名 test；ReaderTabs.test.tsx、useReaderExitGuard.test.tsx、return-state.test.ts、NoteReanchor.test.tsx；必要時調整 return-state.ts 的 operation-aware patch |
| 局部載入復原 | usePrivateReader.ts、OfflineControl.tsx | usePrivateReader.test.tsx、OfflineControl.test.tsx；useReaderSession 原安全失效邊界不變 |
| 狀態與可達性 | reader.css、src/i18n/locales/{zh-Hant,zh-Hans,en,ja,ko}.json | ReaderPrivateState.test.tsx、WeeklyReader.test.tsx、既有 locale 一致性檢查 |

上表不要求每個檔案都修改；依失敗測試選最小 diff。不得複製 private state、授權、modal library 或離線引擎。ReaderMessages 從現有 getMessages 推導，不手寫第二套型別；無新增 package export。

## 4. 依序實作任務

### T0 視覺基準與合成預覽

- [x] 先完成S4／P3增補條款的Codex＋Gemini兩席檢驗。
- [x] 使用既有 reader preview fixture，以合成帳號／文件／筆記保存baseline六種viewport/theme的正常閱讀、列表及editor畫面與正文／工具列量測；所有狀態使用固定內容，記錄build/SHA、viewport、字型ready、theme及場景。
- [x] 截圖及Gemini官方圖片輸入可用性在改UI前確認；不安裝另一套瀏覽器或以正式私人筆記作fixture。
- [x] 這些畫面作為T3/T4/T5視覺比較基準；新增的dirty/delete Dialog以既有同系統AlertDialog作樣式參照，無須捏造舊版自訂Dialog。最終兩席看baseline/candidate圖片後才可視覺通過。



### T1 先建立失敗重現與狀態保護測試

- [x] 用現有 readerFixture／Testing Library／fake timers／deferred promises，在 usePrivateReader 與 WeeklyReader 真正按鈕事件建立 A1/A2：progress 在途、點一次 Save／Delete、timeout／lost ack、面板內重試與取消等待。
- [x] 測相同 act／microtask 內前一操作完成、不經 rerender 立即續送；第二筆失敗 rollback 仍保留第一筆 note／highlight／progress 結果。加入重載與 mutate 回應反序。
- [x] usePrivateReader 現有測試把 supportsOfflineReader 固定為 false；新增有界、可控制的離線分支 fixture 或獨立測試檔，沿用 fake-indexeddb，不能只用線上 mock 代表 A7。重現 Web Lock 長占用、多筆 queue、IDB commit 失敗及 sync note_conflict 被壓成 queued。
- [x] 為 A3/A9/A10 測試原完整 envelope 不變、舊帳號／revision／generation 回應不生效、撤銷／到期仍拒絕、畫線 ranges／重連 CAS 不變、快速連點最多一筆。
- [x] 在真實 ReaderRecovery deferred retryPending／choose 期間觸發 hook 明確 retry／背景 progress；直接路徑及 upgrade replay／finish 均核對。以共同 api.mutate 計數器斷言同一 reader 的在途峰值為 1、每筆 envelope 正確，timeout／關閉不提前釋放 gate，無重入鎖死。
- [x] 首先執行 focused 測試，記錄預期的失敗斷言及具體呼叫序列；若無法重現原碼假說，不臆測修正已解決裝置問題。

**完成條件：** 測試能在未改 production source 時證明目標 race／資料保護缺口，沒有把既有功能本身改成不符合契約的 mock。

### T2 修共用寫入入口與結果分類

- [x] 先在 hook 內建立一個實際工作互斥與同綁定最新 state/status/value 的 ref。所有 state 發布經同一個小型本地更新入口同步 ref／React state；每次執行取最新基底，response／reload 使用 generation 或等效 fence。不引入通用 scheduler class。
- [x] 明確將 ReaderRecovery.retryPending／choose 的直接 api.mutate，以及由 recovery 啟動的 upgrade.prepare／finish replay，納入同一 reader 的 execution gate；不能只改 hook.mutate 或依靠 recovery 自有 busy。由 parent 注入同一個有界工作入口／等效局部介面；保留 recovery 的 prepared revision、使用者決策與原 envelope，不把 recovery 強套成 pinned revision 的普通 edit。鎖順序固定為本地 gate → 既有 account Web Lock；高層流程取 gate 一次，內層 transport 不重複取同一 gate，避免巢狀 deadlock。既有跨分頁 Web Lock 與 CAS 仍保留，這不是新分散式鎖。
- [x] mutate 依 kind 區分 setProgress 與使用者寫入；保留最多一個未送使用者意圖與一個最新未送進度。只合併未送進度；不替換已送／未知 envelope。新寫入前檢查 binding、allowAction、paused 及離線 epoch；非筆記 caller 亦走相同互斥，不自行旁路。
- [x] 前景意圖保存不可變 payload／CAS／ranges。等待背景時接收第一次完整啟動並呈現等待，重複啟動不新增意圖；後續使用者操作不能靜默覆蓋已接受的一筆。
- [x] 20 秒 UI timer 從接受意圖起算，涵蓋 lock／IDB／整段 sync。UI 等待與實際工作生命週期分開：逾時取消未送續送意圖、恢復 editor，晚到不自動續送；實際工作 Promise 未結束不釋放互斥，不開並行 retry。支援 signal 的等待取消；IDB 已 commit 的 queue 保留。
- [x] 原 pending 不明時要求明確原 ID 重試。成功後只續送仍有效且未逾時的原意圖一次；使用者取消／改字／切換／離開即失效。重試按鈕說明會否接著儲存或刪除。原工作結束但 ack 不明時可重試，不要求先查得成功。
- [x] hook 內部完成結果區分 applied、純 queued、已知 conflict／revision_changed 與局部等待取消／逾時；可用小型 discriminated union 或現有 result 加本地分類，不改 SDK 型別。已知離線 conflict 不回純 queued。局部協調結果由 UI 處理，不傳給 readerFailureAction 當授權撤銷；真正 API 失敗仍走既有 onFailure。
- [x] 原 pending 與 durable replica 各守既有位置；不因 UI cleanup 清除未知操作。所有 reload／abort／finally 只更新其 generation 的 UI，不使舊操作清掉新工作的 busy。

**完成條件：** A1–A4、A7、A9–A10 的 hook／整合測試通過；慢鎖／慢 queue 可恢復 UI 且實際寫入無競爭，CAS／同 ID 去重保護保留。

### T3 統一筆記結果、同步狀態與復原入口

- [x] WeeklyReader 的 saveNote／deleteNote／reanchor／明確 retry／ReaderRecovery onPendingChange 使用同一套最小本地結算規則，按 operation identity＋draft generation 對應 editor，不按 kind 就全域清空。
- [x] applied 宣告已同步；純 queued 宣告已存本機待同步；已知衝突保持 draft 可達並進入既有 recovery。delete／reanchor 各進正確衝突流程，queued 重試不能落空。舊 operation 完成不可清較新 draft／等待意圖。
- [x] 接上既有 SyncStatus；面板外與內一致呈現。局部動作新增 waiting／sending／unknown／load error 的小型 UI state，不把既有 ReaderSyncStatus enum 改成後端契約。
- [x] NoteEditor 的 own busy 覆蓋等待及實際送出，文字快照凍結後停編輯；NotesPanel 傳入操作狀態，刪除顯示處理中並防重複。純背景 progress busy 不直接使第一次 Save／Delete 無效。
- [x] 已入列刪除保留可見的待同步摘要與 recovery 入口，衝突時顯示受影響項目；不用額外 tombstone DB 或 Undo。
- [x] 面板內可直接啟動原操作重試／recovery。沿用既有 ReaderRecovery 邏輯，以內嵌內容或單一頂層 Drawer 呈現；保留 editor 狀態，不疊兩個互搶焦點的 Drawer，不把入口留在 inert 背景。
- [x] recovery 的 prepare 可能 replay 未確認操作，不能當作純讀取旁路；與 retryPending／choose／finish 一起走 T2 gate。驗證 recovery 傳送期間另按 retry、背景進度、關閉／逾時，不並行、不漏掉原本 prepared revision，也不錯誤清除新 editor。
- [x] return-state 更新 action 時保留同綁定 draft；清除僅限對應操作。測試重試 queued／delete conflict／reanchor conflict、登入往返與舊結算不清新草稿。

**完成條件：** A2–A4／A7 的每個結果在面板中可辨識、可操作；無已知衝突被當成一般成功清草稿。

### T4 網站確認框、合併草稿與所有關閉 callers

- [x] 在 WeeklyReader 內複用 AlertDialog，保留既有 ReaderExitDialog。dirty 判斷、確認請求與不詢問 cleanup 分開；同時最多一個決策。取消 promise 必須 settle；卸載或 binding 變動令舊決策失效。
- [x] closeNotes 原為同步 boolean，改成可等待的筆記關閉確認後，完整調整 openNotesList、openPanel、onPage、onAnchor、onChapter、ReaderTabs.beforeNavigate、方向 toggle、editor cancel 及 ReaderPrivateState X／Escape／遮罩 callers。若內部 onPage 改 Promise<boolean>，逐一修正所有 if(onPage(...))、return 值與呼叫鏈，不能把 Promise 當 true；元件公開 onPage/onJump void callback 以明確 void async 包裝，不要求外部元件處理 Promise。
- [x] 使用者導航僅在確認成功後執行原目標一次；捕捉目標與 binding，續行前再驗證。恢復閱讀位置等非使用者 record=false 路徑不觸發新確認，不將既有搜尋事件／手勢辨識流程重做。
- [x] 刪除與刪除衝突後再刪都走站內 Dialog；取消不 mutate，確認後沿用 CAS。X／Escape／遮罩在背景 progress 時仍可關閉；筆記已送出時依 spec 暫停面板關閉至完成或 UI 上限，Home／返回仍可經單一確認有界離開。
- [x] 手動合併保持雲端原 note baseline，立即初始化受控 dirty draft（最新 id/baseVersion＋合併文字），寫入既有 return-state。未編輯直接關閉仍提醒；採用雲端視為已決策，不再走一般 discard。雲端已刪除時停用會靜默轉 createNote 的 local/manual 路徑，保留文字供人工 recovery。
- [x] 對 ordinary note conflict／delete conflict／reanchor、原 Home／返回 guard 測一次確認、取消完整保留、焦點復原。不要修改既有 2 秒 exit flush 的上限，不清除已送但結果不明的 pending；abort／unmount 後同帳號重開仍能明確原 ID 重試。

**完成條件：** A5/A6/A9 通過，這次筆記與離開路徑不呼叫 window.confirm；畫線歷史／部分色彩復原／離線清單的原生確認不計入本次通過宣稱。

### T5 局部載入錯誤與裝置可達性

- [x] hook 提供同 binding 的 privateState 局部 reload／error，顯示 loading 或 unavailable＋retry，不重新整理整頁；重載 fenced 且不覆寫 pending／replica／草稿。
- [x] OfflineControl 區分 unsupported／loading／init error／available／saved，讀取失敗不空 catch。提供 init retry，quota／commit 失敗保留原稿及原資料，不宣稱離線成功。
- [ ] 新文案同步五種 UI 語言；aria-live/status 不重複洗版，錯誤與確認清楚。沿用既有 tokens、safe area、44px 控制項；檢查軟鍵盤下長 editor 的捲動與按鈕可達性，無證據不加 pointerdown preventDefault 或固定延遲。（軟體與 viewport 部分完成；真機／真實 PDF 驗收仍未完成，見 gate record。）
- [x] 狀態UI遵守V1/V2：不新增常駐橫幅，面板內單一主要訊息，成功短暫顯示且不累積toast；aria-live同時只有一處宣告。
- [ ] 按V3/V4保存candidate同條件截圖與量測，兩席實際看圖；檢查正文邊界／換行、正常閱讀無新佔位，Dialog長文／鍵盤高度與safe area可達。圖片或截圖不可用明列阻塞，不能用DOM量測冒充視覺接受。（軟體與 viewport 部分完成；真機／真實 PDF 驗收仍未完成，見 gate record。）
- [ ] 新增／更新 locale keys 的 parity 及型別檢查，檢查手機／桌面原版內容、PDF 對照與畫線 ranges 不受 CSS 改動影響。（軟體與 viewport 部分完成；真機／真實 PDF 驗收仍未完成，見 gate record。）

**完成條件：** A8 的 privateState 503／IDB init reject／quota 各有可達重試、無假成功；A11/A12 準備可重現的測試帳號與裝置步驟。

## 5. 驗證與證據

每任務先跑最小有關測試，測試失敗先處理，不降低斷言。預定 focused 指令（新建測試檔必須加入）：

```sh
corepack pnpm exec vitest run src/features/weekly-reader/usePrivateReader.test.tsx src/features/weekly-reader/progress.test.tsx src/features/weekly-reader/sync.test.ts src/features/weekly-reader/offline-private.test.ts src/features/weekly-reader/upgrade.test.ts src/features/weekly-reader/return-state.test.ts
corepack pnpm exec vitest run src/components/weekly-reader/WeeklyReader.test.tsx src/components/weekly-reader/NoteEditor.test.tsx src/components/weekly-reader/NotesPanel.test.tsx src/components/weekly-reader/ReaderPrivateState.test.tsx src/components/weekly-reader/ReaderRecovery.test.tsx src/components/weekly-reader/OfflineControl.test.tsx src/components/weekly-reader/ReaderTabs.test.tsx src/features/weekly-reader/useReaderExitGuard.test.tsx
```

整合後依 README／CI 完整執行，不以 focused 取代：

```sh
corepack pnpm test:run
corepack pnpm lint
corepack pnpm build
corepack pnpm perf:static
./scripts/test-release-policy.sh
git diff --check
```

CI 另須完成既有 dependency scan、使用既有 secret 掛載方式的 Docker build、image scan；不將憑證寫進文件、命令輸出或測試 fixture。不新增本地部署捷徑。

| 證據層 | 必須記錄的結果 | 接受界線 |
| --- | --- | --- |
| 自動測試 | A1–A10、完整測試／lint/build/perf/policy、CI run／SHA | 沒有預期失敗或未解 Required check |
| 瀏覽器合成情境 | 正常／延遲／lost ack／503／IDB reject／quota／offline→online、鍵盤與主題 | 只用合成或核准測試資料，不把正式筆記當刪除樣本 |
| 真機 | iPhone Safari＋加入主畫面、Android Chrome、iPad Safari＋分割畫面、桌面鍵盤 | A11/A12：中文組字、鍵盤開關、長文、旋轉、Dialog、關閉與返回；記錄OS/browser/build |
| 發布後 smoke | 部署 revision／immutable image、/health、公開 reader 路由、核准帳號的筆記單次保存／刪除與重新讀取 | 測試資料專用；沒有核准帳號／裝置時標未驗收，不假報完成 |

真機先使用本地／測試環境與合成筆記；需認證寫入時只用明確核准測試帳號及資料，禁止操作使用者既有正式筆記。若 first tap 仍失效，記錄不含文字／帳號／token 的相對事件序列再判斷；不得以永久攔截觸控掩蓋根因。視覺截圖、無障礙與真機證據獨立於 JSDOM。

## 6. PR 與後續發布／回復（本次不執行發布／回復）

1. 實作經授權後，任務按 T0→T5 推進；每個實作步驟完成依使用者持續要求由兩席獨立 Codex 檢驗（依使用者最新決定），處理阻塞後才下一步。顧問只讀且只取得必要公開／明確授權資料，不擴大外傳。整合後全量檢查及裝置驗收分開記錄。
2. 預設一個 hhc-web focused PR；根據任務切小 commit。若確實需跨 repo，另列 branch／PR／CI／順序，不默默加入。Required CI 全綠及兩席視覺檢驗完成後停在 merge 前，由使用者決定合併；測試帳號／真機缺席時明列未驗收，不以模擬結果代替。
3. main 合併由現有 release.yml 建置 immutable artifact 並部署；核對 deployed revision、image 與 live smoke，不能用未合併 commit 本地部署。
4. 回復沿用既有 last healthy revision／workflow 路徑，先檢查前版讀得懂原 IDB／return-state 格式；本次不改儲存 schema。回復不清除本機 queue／pending 或正式筆記，未同步資料不得以清 cache 解決。
5. 只有 merge／release／smoke 成功且無後續工作才清理本次實作的乾淨 temporary worktree；文件 worktree 及其他既有 worktree 不自行移除。主 main 只在 clean 時 pull --ff-only。

## 7. 本輪停止點與授權更新

- [x] spec 兩席檢驗與修訂完成（紀錄見 gate record）。
- [x] plan 兩席檢驗與修訂完成。
- [x] 文件 links／需求測試對應／diff 檢查完成。
- [x] 文件已備妥供使用者審閱，停在開始 T1 前；產品測試與真機接受尚未進行。

以上舊勾選是前次文件階段完成紀錄。本輪實作進度逐項更新並記錄兩席檢驗結果；允許feature branch commit/push與PR，最終停在merge前，不release、不操作既有正式筆記。視覺／真機缺口明列於PR，不能虛報完成。

T0–T5 的勾選對應本次合成 fixture／程式及自動化驗證範圍；真機、真實使用者與發佈後 smoke 不在完成範圍。最終交付仍以 PR CI 結果為準。
