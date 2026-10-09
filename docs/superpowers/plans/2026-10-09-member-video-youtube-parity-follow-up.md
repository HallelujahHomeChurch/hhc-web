# 影音專區 YouTube 體驗對齊 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Status:** 使用者於 2026-10-09 說「開始實作」，核准 Tasks 1–10；logo 維持 PR172 全站首頁。程式與回歸測試已實作，完成一次整體獨立審查並修正三個實際問題；本機完整驗證通過（921 tests、lint、build、static budgets、release policy），PR CI 待執行。本輪尚未 merge／release，實際 iPhone Chrome 驗收仍待補。

**Goal:** 補齊影音專區進入播放、重試、桌面操作與手機瀏覽的主要差距，接近 YouTube 的觀看體驗。

**Architecture:** 沿用 MemberVideoZone、LiveRecordingPlayer、HlsPlayer、PlayerChrome 與既有 grant／cookie／bookmark 流程。手機持續觀看使用同一個 inline video；以一個 focused PR 及分任務 commits 交付（共用播放器／布局重疊，統一驗收），不新增播放器、播放服務或持久化私人媒體快取。

**Tech Stack:** Next.js 16.3.8、React、TypeScript、CSS Modules、hls.js、Vitest。

**Spec:** 本文件「範圍與基準」及各任務驗收條件；來自使用者的 YouTube 對齊要求、兩位獨立顧問的唯讀分析與現有程式。

## 範圍與基準

2026-10-09 原始兩位顧問分析基準為 PR175；本計劃已由主代理依最新 `origin/main` 的 `552f2f616698d554a8fff2a80e5079c84daf6a45`（PR172）重新審視，並重做正式站手機瀏覽／搜尋／觀看及桌面搜尋來源觀看布局檢查。primary checkout 有其他變更，未 pull 或修改其程式。其後依使用者要求再派兩位 agent，分別審查播放器／直播與導航／搜尋／手機布局；兩者均獨立核對最新 connected source、正式站及 YouTube 網站／官方文件。此文件已整合第二輪修訂，並標示需要核准的範圍。

本輪已完成 [PR #175](https://github.com/HallelujahHomeChurch/hhc-web/pull/175)：

- live／recovering 使用簡短直播標籤，恢復中的額外「正在追上直播進度」段落隱藏；實際 loading、錯誤與重試保留。
- 縮圖容器自行維持 16:9、靠上對齊，標題連結正確套用行數限制。手機前兩筆長標題的時間不再跑到圖外。
- 873 個測試通過；lint、build、static budgets、release policy、CI 容器與安全掃描通過。lint 僅有既有 LegalRequiredNavigation 警告。
- [Production Release](https://github.com/HallelujahHomeChurch/hhc-web/actions/runs/37876879911) 成功。`hhc-web--0000170` 為 latest／ready、Healthy／Running／active；映像 digest `sha256:ab991e0231a7d5851d59edee2c9e6855bf5a16a2062cb849c9b3dc452abe16fd` 對應本次 merge。
- health、影音清單與觀看路由均 HTTP 200。正式站 390px／1440px 的前三筆推薦時間均在縮圖內；390px 長標題維持三行、縮圖高 86.46px。

## 最新版本重審結果

[PR172](https://github.com/HallelujahHomeChurch/hhc-web/pull/172) 已合併且 [Production Release](https://github.com/HallelujahHomeChurch/hhc-web/actions/runs/37879265387) 成功。正式站 `hhc-web--0000172` latest／ready、Healthy／Running／active，digest `sha256:1b82ea9913eb867e9a1643ff0ed246cc28c3c1ed8e86ba70577742240d35006b` 與 `main-552f2f6` 相符。PR175 的 revision 與測試數是歷史紀錄，不能拿來代表新版。

| 項目 | 最新狀態與計劃處理 |
| --- | --- |
| 影音搜尋 | 已實作。header 入口、URL q、搜尋結果、cursor 載入、來源 q 與返回位置都有程式／測試；正式站 q=OBS 實際顯示結果。從後續實作待辦移除。 |
| 手機導航 | 已改為文字事工／影音專區／我的；帳號移到右側底部入口，搜尋展開覆蓋 header。新布局作為後續驗收基準，不重做舊導航。 |
| 畫質切換可靠性 | 已修復 MSE 舊 buffer／EOS 與重新掛載期間指令保留，native HLS／live DVR 同步處理。這不是待修項目；後續改動必須保留這套流程與測試。 |
| 直播自動準備 | 仍缺少：LiveRecordingPlayer／useLivePlayback 未改，仍經 primary Play 起始。保留 Task 1。 |
| 錄影 media-error Retry bookmark | 仍缺少：start 的可選 resume 已存在，但 VOD 未傳 onBookmark，Retry 仍無參數。畫質切換保留狀態不等於新 grant 重試保留狀態。保留 Task 2。 |
| 桌面雙擊全螢幕 | surface 仍只有 click／pointer handlers，沒有 double-click。保留 Task 3。 |
| 手機大 banner | 一般瀏覽仍存在：390×844 第一張卡片 y596。搜尋模式已不顯示 hero，第一張結果 y218。Task 4 僅調整一般瀏覽。 |
| 手機 sticky player | 仍缺少：新版搜尋來源觀看頁向下捲動後，video bottom 為 −106.125，已完全離開 viewport。保留 Task 5，加入新版 header／搜尋／帳號選單驗收。 |
| 設定選單／scrubber | 仍為原生 select／既有觸控範圍；Task 6 命中區列入核心，Tasks 8／9 設定呈現另組核准，不重做已修好的畫質引擎。 |
| 搜尋來源觀看頁頂部留白 | 新版新增「返回搜尋結果」整列；手機 video top y194，相對無 q 的 y126 多 68px；1440px 桌面 video top y210、推薦 top y142，同樣相差 68px。新增 Task 7，保留返回能力並恢復播放器靠 header 的目標。 |

跨 repository 的搜尋契約已在 source 合併：hhc-web-api PR172／`453ba44`、api-gateway PR157／`33005aa`、frontend-platform PR106／`5a1f486`；網站使用正式 UI／Website SDK 1.0.49。本輪未重新部署這些服務，也未完整重跑跨服務權限驗收。

**導航需求差異與核准選項：** 最新 SiteHeader.tsx:137／README 明定桌面、手機 logo 都回 `/{locale}`，正式站一致；PR172 有意取代先前影音區 logo 的路由。建議預設維持新版：logo→網站首頁，影音導航→無 q 的影音列表，返回搜尋→同 locale／q 並還原合法位置，Browser Back→原瀏覽器歷史。這需要使用者明確接受與原要求的差異。若仍選原要求，則桌面／手機都改成影音上下文 logo→無 q 影音列表、其他頁→網站首頁，並同步 accessible label、README、語系與測試；不讓兩種裝置互相矛盾。此選項沒有開始實作。

## 已核准的工作範圍

| 核准組別 | 工作與完成後的行為 |
| --- | --- |
| A 核心（建議） | Tasks 1／2／3／7／4／5／6：直播進頁準備播放、起播前 readiness 恢復、錯誤重試保留最新觀看意圖、桌面雙擊全螢幕、搜尋來源頂部對齊、緊湊手機一般瀏覽、同觀看頁持續可見影片與可操作的時間軸。 |
| B UI 對齊（建議一併核准） | Tasks 8／9／10：桌面／手機設定子選單、Auto 實際解析度、錄影結束後明確重播。這些是呈現／互動補齊，不是目前所有功能都已損壞。 |
| L logo（需選擇） | 預設維持 PR172 全站首頁，或明確選擇影音上下文回影音列表。 |
| C 另案能力 | 精準 seek filmstrip、字幕／逐字稿／章節、跨路由 miniplayer、觀看歷史／稍後觀看、投放／PiP／離線、社群與直播 latency。先確認資料／媒體／授權政策，再另外規劃；不包含在 A／B。 |

已取得 A／B 實作授權，L 使用建議預設；本輪交付 reviewable PR 及 CI，merge／release 等待另外核准。C 未納入。

## 第二輪審查修訂摘要

- 直播 readiness 契約已讀：API `cbc3f6b0361e9a110aadf0003cc692c5a78af3b8` 的 `internal/recordings/live.go:219–224` 在 LastSequence<2 時回 ErrConflict，HTTP 映射為 409 capture_conflict；同 code 不只代表 readiness，禁止把所有 409 當 loading。未重新驗證此 API revision 的部署。
- 錄影 retry 的外部 last bookmark 不足：畫質重掛期間 HlsPlayer 故意不發 bookmark，最新 time／pause／rate 存在 qualityPosition。需要在 fatal error 前取得同一份權威 snapshot，避免 protective pause 覆寫。
- 桌面只加 onDoubleClick 不足：兩個 click 會暫停／播放，也可能把 followLive 改成 DVR；需明確處理單擊／雙擊仲裁。
- sticky 不能只設在短 `.video` wrapper 內，必須有涵蓋完整說明／推薦高度的 containing block；offset 取實際可見 header，不能硬編 68px 或新增第二套 scroll controller。
- 手機首屏條件改成可達成的尺寸化驗收；返回搜尋位置明確放在穩定標題／日期／live status 之後、可展開說明之前。
- 這次正式站有健康的 synthetic live：進頁只有 primary Play、videoCount=0，正常按 Play 後一個 video 播放。只證明健康直播的進頁差距，沒有建立直播或誘發來源轉態／斷線。

後續建議順序：Task 1 → 2 → 3 → 7 → 4 → 5 → 6。Task 8／9／10 是另外列明的 UI 對齊項目，可與核心一併核准，但獨立交付。Task 7 先於 Task 5；Task 8 與 9 可同一設定功能 PR。Tasks 1–10 已依依賴順序實作；下列原始步驟保留完整驗收條件，未勾項包含尚未完成的實機／發布條件。

## Global Constraints

- 本輪已有 Tasks 1–10 的實作授權；沒有取得本輪 merge 或 release 授權。
- 每個實作 PR 使用最新 origin/main 的獨立 worktree；不修改 primary checkout 的既有變更。改程式前讀 owning AGENTS.md／README 及安裝版 Next.js 的適用 guide。
- CI 通過才 merge；正式部署只使用合併後 CI/CD。每個 PR 都核對 revision、digest、health 與相關公開頁面。
- 有聲 autoplay 受瀏覽器政策限制；拒絕時提供中性中央 Play，不強制改成靜音，不重取 grant 當成解法。
- 保留會員、entitlement、法律條款、身份切換、grant 到期與 cookie cleanup；禁止將導覽快取當成授權。
- recovering 可播放已驗證媒體，但不能冒充健康即時直播、強制跟隨或自動拉走暫停中的 DVR。
- 全螢幕、手機 sticky 與重試保留 watermark；不新增第二個 video 或放寬 PiP／投放政策。
- 五語系、鍵盤、觸控、320／390px、桌面與減少動態效果均納入適用驗收。

## Review Focus

- StrictMode、離頁與身份切換期間的晚到 grant／exchange：舊 session 不可回掛或殘留授權 cookie（Task 1）。
- 起播前尚無可播媒體、播放中恢復與暫停 DVR：不得把暫時 readiness 誤判成永久關閉（Task 1）。
- 錯誤處理主動 pause 後重試：恢復錯誤前的觀看意圖，不以保護性 pause 覆寫它（Task 2）。
- 同一手勢產生 click／double-click、pointercancel：不得閃停、誤跳或留下 2× 速率（Tasks 3、6）。
- iPhone WebKit、旋轉、動態 browser chrome／safe area 與 sticky／fullscreen：維持同一 video、可退出、不遮住控制項（Task 5 與實機驗收）。

## Task 1：直播進頁自動準備與有聲播放嘗試（優先）

**Evidence:** `LiveRecordingPlayer.tsx:18–28` 只透過 primary Play／Retry 呼叫 start；`useLivePlayback.ts:73–79` 初始不取得 grant，wake 也要求既有 scope。VOD 已在 `MemberVideoZone.tsx:275–278` 自動準備，兩者不一致。

**Files:** 修改 `src/features/member-videos/LiveRecordingPlayer.tsx`；測試同名 `.test.tsx`、`MemberVideoZone.test.tsx`、`HlsPlayer.test.tsx`。只有生命周期測試顯示缺陷才修改 `useLivePlayback.ts`。

**Interfaces:** 使用既有穩定的 `session.start(): Promise<void>`、session.closed 與 capture／recording 身份；播放器沿用 HlsPlayer 的 autoplayBlocked 與中央 Play。

- [ ] 先加 failing tests：eligible entry 自動準備、terminal／closed 不準備、progress／renewal 不重建 session、autoplay rejection 不再取得 grant。
- [x] 加契約案例：同 capture 的 starting／LastSequence<2 對應 409 capture_conflict；其他 409、授權與終止錯誤不得冒充準備中。起播暫時 readiness 顯示中性 Preparing，真錯誤保持 Retry。
- [x] 在 component effect 呼叫現有 start；首次起播依賴穩定身份與 eligibility，避免 progress／renewal／pending 的 render churn 重開 session。沿用 hook 路徑，但先驗證跨 effect generation 的 cookie cleanup：舊 exchange 的清理不可刪掉新 same-scope cookie。若測試證實缺陷，再最小修正 hook；避免永久 once ref 擋住 StrictMode 有效 setup。
- [x] 現有 hook 五次 transient backoff 約兩分鐘後不再排 retry。加入 starting 超過預算後才 ready 的案例；沿用同 capture 的 ready／progress 轉換觸發一次準備，不無限 polling，不讓 closed／terminal／revoked scope 復活。
- [x] 準備時直接顯示中性 placeholder／loading；取得媒體後嘗試有聲播放。NotAllowedError 保留同一 video／grant，以中央 Play 讓使用者開始；真錯誤保留明確 Retry。
- [ ] 加入 StrictMode、離頁／身份切換、晚到 exchange、starting readiness、paused DVR／quality／rate 保留測試。recovering 不啟用 canFollow，也不顯示來源診斷文字。
- [ ] 跑相關測試、完整 delivery checks；以可控直播環境與實際 iPhone Chrome 驗證，再提交獨立 PR。

## Task 2：錄影重試保留觀看位置與設定（優先）

**Evidence:** `MemberVideoZone.tsx:346,389,397` 的 media error 會 pause，Retry 呼叫無 bookmark 的 start，VOD 也未提供 onBookmark。現有 HlsPlayer 已能記錄及恢復 time／paused／rate／quality；直播與 live→VOD 已使用。

**Files:** 修改 `MemberVideoZone.tsx`、`HlsPlayer.tsx`，同步相關 live caller；測試 `MemberVideoZone.test.tsx`、`HlsPlayer.test.tsx` 及受影響的 LiveRecordingPlayer cases。

**Interfaces:** 重用 PlayerBookmark、onBookmark、qualityPosition／qualityRef 與 start(resume?)。HlsPlayer fatal onError 增量改為 `onError?: (resume?: PlayerBookmark) => void`，接受可選 pre-error snapshot，既有忽略參數的 callback 保持相容；只保存當前身份／recording／package 的記憶體狀態。

- [ ] 加 failing test：47:00、1.5×、720p 發生 media error 後 Retry 取得新 grant，恢復位置、速率、畫質與錯誤前 pause／play 意圖。
- [x] onBookmark 記錄正常狀態；fatal 時在 HlsPlayer 內組合 snapshot，pending qualityPosition 的 time／paused／rate 優先，合併 qualityRef 與 DVR intent。沒有 pending 時取有效位置／rate 和已確認的使用者播放意圖，不能直接採用 error 後 video.paused。
- [x] 在 parent protective pause／teardown 前同步保存 snapshot，當次 failure 只 freeze 一次；後續 error-induced pause／currentTime=0 不可覆寫。Retry 讀取 frozen scoped resume，重新失敗仍保留；換身份／影片／package 清除。初始尚無有效播放位置時不捏造 bookmark。同步檢查 live retry，不留下兩套互相矛盾的 fatal snapshot 規則。
- [ ] 測試換影片／身份／package 時不套用舊 bookmark、位置超出新 duration 時 clamp、重試失敗仍可再次 Retry；不持久化 URL、grant 或跨裝置觀看歷史。
- [x] 保留新版 qualityPosition／onPlaybackChange 的重新掛載保護；涵蓋畫質切換中 seek／pause／rate 指令後發生錯誤與 Retry，不恢復 stale 指令，也不以暫時 video.currentTime／paused 覆寫正確 bookmark。
- [ ] 跑相關測試與 delivery checks，獨立 PR。

## Task 3：桌面雙擊切換全螢幕

**Evidence:** `PlayerChrome.tsx:240` 只有 surface click；正式站雙擊未進全螢幕。顧問在同輪 YouTube 桌面直播頁雙擊，確認進全螢幕且播放持續。

**Files:** 修改 `PlayerChrome.tsx`；測試 `HlsPlayer.test.tsx`。

**Interfaces:** 重用既有 toggleFullscreen；只作用於桌面 surface，觸控 double-tap ±10 保持原行為。

- [ ] 加 failing tests：playing／paused 時雙擊進出全螢幕均保持原意圖；不得有 constituent clicks 的閃停；控制項／選單不觸發。
- [x] 採用最小的桌面 pointer single／double click 仲裁，雙擊不得先發 constituent toggle；測試 playing／paused 與 followLive／DVR。若單擊需短暫延遲，明列為 UX 取捨並做操作驗收；keyboard detail=0 與 toolbar 仍立即回應。timer 在離頁／cancel 清除，保留 fullscreen fallback、拒絕錯誤與水印／觸控手勢。
- [ ] 測試 fullscreen 拒絕、觸控雙擊與取消手勢不回歸；雙擊的 constituent clicks 不污染新版 onPlaybackChange／qualityPosition 暫存意圖。瀏覽器操作驗證後跑 delivery checks，獨立 PR。

## Task 4：手機影音入口改成緊湊瀏覽畫面

**Evidence:** 最新版 390×844 正式站一般瀏覽第一張卡片仍從 y596 開始，430px hero 加上頁首與留白，影片標題在首屏外。搜尋模式已移除 hero、首張結果 y218，不列入本任務重做。`src/app/[locale]/member-videos/page.tsx:40` 使用 AboutHero；`AboutHero.tsx:27,42` 設定 430px。

**Files:** 修改 `src/app/[locale]/member-videos/page.tsx`、`MemberVideoZone.module.css` 的影音範圍 spacing；需要時只擴充 MemberVideoZone 的現有輸入。不全域修改 AboutHero。

- [ ] 在 320／390px 建立現況視覺基準，檢查登入、條款／權限、loading／retry 與五語系。
- [x] 僅在手機一般瀏覽使用既有在地化標題／副標題的 compact heading，縮小影音清單頂部留白；桌面 hero 可保留。搜尋結果仍沿用現有 heading／結果列表，不增加另一組搜尋入口。
- [ ] 390×844 allowed content：第一張完整縮圖、clamped title 與日期在底部 nav 以上。320×568：至少完整縮圖與標題開始可見、完整名稱仍可及，無水平 overflow；不承諾任意高度／放大字級全部首屏。條款、LINE notice、denied／error 可讀性優先，不為首屏數字壓縮必要訊息。其他頁 hero 不變，搜尋不重做。
- [ ] 跑 lint／build／適用視覺與 delivery checks，獨立 PR。

## Task 5：手機捲動閱讀時保留可見播放器

**Evidence:** 最新版正式站搜尋來源觀看頁滑到推薦清單時，video bottom −106.125，完全離開視窗。這是接近 app 觀看體驗的目標調整，不是 PR175 回歸；本輪沒有實際操作原生 YouTube app。

**Files:** 修改 `MemberVideoZone.tsx`、`LiveRecordingPlayer.tsx` 的 player wrapper／資訊布局與 `MemberVideoZone.module.css`；必要時銜接既有 header offset。測試相關 component／HlsPlayer 生命周期。

- [ ] 先加驗收基準：從長說明一直滑到最後一筆推薦都保持可操作影片；DOM video、grant、watermark、時間與設定不重建。這是 HHC 同觀看頁的設計目標，不冒稱為已驗證的原生 YouTube app／跨頁 miniplayer。
- [x] 先讓 sticky containing block 跨完整 watch 內容／推薦高度，再分開 media 與 metadata；檢查 grid area、ancestor overflow／transform，不把 sticky 限在短 `.video` group。使用同一 video 的 CSS 布局，不 portal／複製播放器。
- [x] offset 取實際可見 top chrome（含 statement／LINE notice）並沿用 useScrollChrome／searchOpen；只有缺乏可靠資訊才加共用量測，不新增另一套 scroll controller 或硬編 header 高度。visible viewport 剩餘高度不足、landscape、fullscreen 時採正常 flow／既有 fullscreen 路徑，避免 trapping scroll。
- [ ] 驗證控制項不被 statement／nav／browser chrome 蓋住，description／推薦可讀，沒有第二個播放器或重掛 session。加入新版搜尋展開時 blocked chrome、底部「我的」popover、帶／不帶 q 的觀看頁與返回位置還原測試；popover 不可被播放器 z-index 蓋住。
- [ ] 在實際 iPhone Chrome 驗證 portrait→landscape→portrait、fullscreen swipe／button exit、safe area、暫停與進度／速率／畫質保留，再跑 delivery checks，獨立 PR。

## Task 6：手機時間軸擴大觸控命中區（核心）

**Files:** `PlayerChrome.module.css`、`PlayerChrome.tsx`（只有互動需要時）、`HlsPlayer.test.tsx`。

**Evidence:** 現有 coarse-pointer scrubber 操作區約 24px，已有單張 cue preview／release commit；完整上拉 precision 並未實作。

- [ ] 先驗收 320px、portrait／fullscreen、3 小時影片的 touch drag、pointercancel／lost capture。
- [x] 擴大 coarse-pointer hit area 至適當觸控大小，保留細進度線與 existing cue preview，不侵入 fullscreen／center buttons。
- [x] 取消不 commit seek、paused／playing intent 保持、時間 clamp、preview 失敗降級成時間提示；不能把這項稱為完成 YouTube filmstrip。
- [ ] 跑相關 tests／視覺與實機、delivery checks，獨立小 PR。

## Task 7：搜尋來源觀看頁保留返回能力，避免播放器上方整列

**Evidence:** 新版 `MemberVideoZone.tsx:377` 在播放器前渲染返回搜尋 Link，`.back` 最少 44px 加 grid gap 24px；手機實測播放器比無 q 多往下 68px；1440px 桌面播放器 y210、推薦清單 y142，頂部不同高。這是本輪新增搜尋後的布局差異。

**Files:** 修改 `MemberVideoZone.tsx` 的既有返回 Link 位置，必要時調整 `MemberVideoZone.module.css`；測試 `MemberVideoZone.test.tsx`。

- [ ] 建立帶／不帶 q 的觀看頁視覺驗收；1280px 以上播放器與右側清單頂部對齊，手機影片靠 header。
- [x] 預設將既有返回 Link 放在穩定 title／date／live status 之後、expandable description／推薦之前，VOD 與 live 一致，44px target。左側不再多一列擠下播放器；保留 locale＋q、identity-scoped 深度／anchor 還原，不新增任意 returnTo 或另一套 history store。
- [x] 載入／播放資格失效／終止 live／missing recording 也保留有用返回連結，不為不存在的播放器製造空洞。桌面左內容 column1、recommendations column2 row1 的對齊在 theater／fullscreen exit 後維持。
- [ ] 驗收 VOD 與 live、keyboard focus、搜尋來源推薦連結、搜尋無結果與頁面返回；單純調整位置不能卸載 video 或重取播放授權。
- [ ] 與 sticky 的先後依實作順序測試，跑適用視覺／delivery checks，獨立 PR。

## Task 8：設定選單與子選單（B 組 UI 對齊）

**Files:** `PlayerChrome.tsx`、`PlayerChrome.module.css`、適用 HlsPlayer tests；先讀現有安裝 UI primitives。

- [x] 用現有速率／畫質 callback，桌面與手機都有 Settings→Speed／Quality→選項、目前 checkmark 與 Back，不建立第二套 quality engine。
- [x] 預設選單保持在 fullscreen container 內；手機依可用高度採 anchored panel，空間不足才用同 root 的 sheet／subview，320px 與短 landscape 仍可操作，不用 body portal 破壞 containment。不要假造 Higher quality／Data saver ABR policy。
- [ ] 驗收 keyboard arrows／Enter／Escape／Back、焦點還原、outside press、touch dismissal、loading／failed gating、quality reattachment 中的新指令、五語系。
- [ ] 原生 select 是有效 fallback，但保留它不能宣稱達到同等 app 選單呈現。跑 tests／device／delivery checks。

## Task 9：Auto 顯示實際解析度（B 組，可搭配 Task 8）

**Files:** `HlsPlayer.tsx`、`PlayerChrome.tsx` 及測試；無 producer 變更前提。

- [x] 先讀安裝版 hls.js 對 active/rendered rendition event／levels 的定義；不得拿 advertised list、requested nextLevel 或 selected Auto 推算。
- [x] 得到可靠 active rendition 才顯示 Auto (720p) 等文字；native 有可信 video dimensions 才顯示，unknown 仍為 Auto，切 source／teardown 清除。
- [x] ABR 轉換更新文字但不 remount／regrant、不影響畫質切換保護；測試 pending→active、native unknown、false resolution 不顯示。與設定 UI 同 PR 或獨立交付。

## Task 10：錄影結束後明確重播（B 組 UI 對齊）

**Files:** `PlayerChrome.tsx`／CSS、HlsPlayer tests、五語系 label；若需 restart callback 沿用 HlsPlayer 路徑。

- [x] valid ended VOD 顯示可發現的 Replay icon／label，idle 後仍保留；重播同一 video／session 從 0 開始，保留速率／畫質。
- [ ] 點擊／keyboard、play rejection 中央 fallback、seek-to-end 與 ended→restart 均測試；不新增自動下一部或 countdown。
- [x] 不把 live ENDLIST 當 VOD ended：保留授權 DVR、replayUntil 與明確 live→VOD handoff；不誤丟播放位置。
- [x] 先確認現有 ended state／play() 已能重播，此項是提示及確定性補齊，不以未驗證「重播壞了」為前提。

## 本輪實作與驗證紀錄

- Tasks 1／2：real-hook StrictMode 自動準備、起播 readiness 超過重試預算後恢復、同 scope 跨 generation cookie cleanup；fatal snapshot 優先採用 in-flight qualityPosition，VOD／live callers 同步保存。首次失敗尚未定位不捏造 paused bookmark，Retry 可重新嘗試有聲起播。
- Tasks 3／10：雙擊沿用 fullscreen 路徑；桌面 surface 單擊延遲 500ms 仲裁，toolbar／keyboard 立即。Replay 使用原 video／session，保留 rate／quality；結束後改拖位置不誤從零重播，live ENDLIST 不產生 VOD Replay。
- Tasks 4／5／6／7：手機 compact hero；display:contents 讓 player sticky containing block 跨全部 metadata／推薦；量測 header 與 viewport resize（沒有第二套 scroll controller），剩餘閱讀空間不足回 normal flow；44px scrub row、取消／lost capture 不 commit；返回搜尋在穩定 metadata 後。
- Tasks 8／9：Settings→Speed／Quality、checkmark／Back／keyboard／focus、同 fullscreen root 的 scrollable panel。Auto 只採 installed hls.js 1.7.3 LEVEL_SWITCHED 的正在播放 fragment 或 native videoHeight；fatal quality 選项禁用、換 source 清除未知解析度。
- 一位 fresh reviewer 審查全分支，指出首次失敗 paused bookmark、ended seek 與 350ms 雙擊三項；均以 failing regression 證實並修正。沒有新增 reviewer 或假裝實機驗收。
- 本機 Chromium controlled-media fixtures：320×568／390×844 第一張完整縮圖、clamped title／date 可見；五語系 390px date bottom 507.11px、無 overflow。1440px 與1280px 帶 q player／rail 同高；767／768／1279／1280 resize 維持 video identity／grant=1。捲到最後推薦維持同一 video／grant=1；44px scrub；搜尋展開 header 保留可用、349px tall chrome 時降為 static；container fullscreen 設定仍在 player 內。另驗證 844×390 viewport fallback 速度子頁可捲動、menu 在 root 內、退出仍維持 video／grant=1。所有 fixture、假 API 與媒體已移除，不提交為 production route。
- 最終 `test:run`：134 files／921 tests，另8個 script tests及12個不可變資產檢查；lint 只有既有 LegalRequiredNavigation 警告；正式 build／static budgets／release policy 通過。最後補 pointercancel 單擊 timer 取消與 recovery fixture 型別，暫存 dev route validator 已移除。
- Browser autoplay 被拒時實際觀察到未靜音的中央 Play；沒有利用新 grant 或強制靜音規避政策。iPhone 原生 WebKit、實際 notice/account popover 組合及正式直播故障轉態未完整實機驗收，仍為 gate。

## 平台能力覆蓋與另案前提

| 能力 | 此版／此計劃處理 |
| --- | --- |
| Library／private covers／live-first／cursor load retry | 已有，保留；A 僅改善手機入口與觀看布局。 |
| Header search／q URL／IME／server title-description search／來源返回 | 已發布，做 regression；沒有第二次搜尋實作。 |
| Shortcuts／double-tap／hold 2×／fullscreen swipe／watermark／quality switch | 已有，保留；A 補 double-click／fatal retry／hit area。 |
| Healthy live、DVR、renewal／buffering／grant errors | 已有部分能力；A 補入頁準備、starting readiness、fatal snapshot 與轉態驗收，不承諾 producer latency 接近 YouTube。 |
| 設定子選單／Auto 實際解析度／Replay | B 有具體可核准工作。 |
| 上拉 precision filmstrip | 可沿用現有 authenticated VOD preview cues，但需要另案 gesture arbitration、bounded cache／降級／iPhone 驗收；不含 live 虛構 preview。 |
| 字幕／逐字稿／章節／heatmap | 先要真實 track／chapter timestamps／analytics 契約、內容流程與授權；不從空資料產生 UI，也不做假熱度。 |
| 歷史／Continue watching／稍後觀看／播放清單 | 需 account-bound data、保存／刪除政策及 API；目前短期 anchor／Retry bookmark 不等同這些功能。 |
| 跨 route draggable miniplayer | 不等同 Task 5 sticky；另案 app-shell／session／navigation／auth cleanup／fullscreen ownership。 |
| PiP／casting／offline／background audio | 先確認私人媒體、水印與裝置政策；不默默取消既有 disable flags。 |
| Comments／live chat／likes／subscriptions／社群推薦 | 既有留言計劃或另案產品／管理能力；不列為 A／B 補完所必需的播放器重寫。 |
| Filters／sort／relevance／transcript search | 後續 query／cursor／index／內容契約；已發布標題說明搜尋不冒充這些能力。 |

## 既有計劃與暫不擴大項目

- 搜尋已由 PR172 實作並發布，包含 producer／SDK／consumer 與 header adapter，不再安排第二次搜尋工程。原 [搜尋計劃](https://github.com/HallelujahHomeChurch/hhc-web/blob/552f2f616698d554a8fff2a80e5079c84daf6a45/docs/superpowers/plans/2026-10-08-member-video-search.md) 開頭仍寫 PR 未合併，屬過期交付狀態；以實際 merge／release 及 source 為準。留言仍屬原有獨立規劃。
- 現有快捷鍵、暫停 idle auto-hide、桌面 feedback、手機 double-tap／hold 2×／fullscreen swipe 已有實作，不重列成缺失。
- 推薦縮圖約 60% rail 寬度，在顧問觀察的 YouTube 也相近；本輪不以 synthetic 長標題推導需要重做 rail。
- recovering 的灰色／disabled LIVE 是安全語義。若要可回到最新可用片段，另案拆分 seek-available-edge 與 healthy-live-follow；不直接放寬 canFollow。
- 直播 30 秒安全 media edge 與 producer latency 不靠 UI 改動降低。直播 preview、PiP／投放、字幕等先確認真實媒體能力與水印／授權政策，再另案評估。

## Delivery checks 與實機驗收

每個適用 PR：相關 Vitest → `corepack pnpm test:run`、`corepack pnpm lint`、`corepack pnpm build`、`corepack pnpm perf:static`、`./scripts/test-release-policy.sh` → required CI 全通過 → review／merge → Production Release → revision／digest／Gateway health／公開頁面 smoke。不能把 CI 成功當成裝置驗收。

視覺／互動矩陣：320×568、390×844、768×1024、1280×800、1440×960；767/768 與1279/1280 breakpoints、五語系、無／有 statement、LINE notice、正常／q／invalid／empty search、grant／load errors、VOD／live／expired／missing、theater／fullscreen。DOM identity＋沒有額外 grant/start 的檢查與可控故障 fixtures 優先，不對正式站注入錯誤。

整體 iPhone Chrome 最終驗收：有聲 autoplay 被拒後點擊開始、連續 ±10、hold 2× 的 lift／cancel／background、旋轉與全螢幕退出、watermark、safe area、慢網路 spinner／recovery、返回深度載入清單、長標題與時間位置。Chromium emulation 不足以證明 WebKit media events、iOS fullscreen、背景暫停或 system volume 正常。

原顧問輪次未有進行中的正式站直播；第二輪 agent 已正常觀看既有健康直播，但沒有驗證 starting／recovering／ending 轉態、建立測試直播、製造正式環境斷線或實際 iPhone／原生 YouTube app 驗收。直播轉態及 retry continuity 目前為 connected-code findings；後續實作依上列可控測試與裝置驗收補證據。

## YouTube 比對來源

- 顧問本輪實際桌面觀察：https://www.youtube.com/watch?v=rFZHOHl-L8A （UI 會受帳號／實驗影響）。
- [官方快捷鍵](https://support.google.com/youtube/answer/7631406?hl=en)、[官方直播延遲取捨](https://support.google.com/youtube/answer/7444635?hl=en)。
- [官方 iPhone precise seeking](https://support.google.com/youtube/answer/12825599?co=GENIE.Platform%3DiOS&hl=en)、[iPhone fullscreen／手動旋轉](https://support.google.com/youtube/answer/72689?co=GENIE.Platform%3DiOS&hl=en)、[press-to-2×](https://blog.youtube/news-and-events/youtube-new-features-2023/)。
- 新增官方比對：[iOS miniplayer](https://support.google.com/youtube/answer/9162927?co=GENIE.Platform%3DiOS&hl=en)、[iOS quality](https://support.google.com/youtube/answer/91449?co=GENIE.Platform%3DiOS&hl=en)、[search filters](https://support.google.com/youtube/answer/111997?co=GENIE.Platform%3DiOS&hl=en)。原生 app 未直接操作；網站觀察和官方文件不能替代 iPhone 驗收。
- 第二輪獨立報告：`/tmp/hhc-yt-plan-player-review.md`、`/tmp/hhc-yt-plan-navigation-review.md`；必要修訂與批准選項已收錄本文件。
- 原始顧問報告：`/tmp/hhc-yt-desktop-live-audit.md`、`/tmp/hhc-yt-mobile-library-audit.md`。上列內容已將必要結論與驗收收錄，不依賴暫存報告才能執行。
