# Mobile and Desktop Media Continuity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. 本計畫已獲執行與既有 CI/CD 發布授權。進度見 evidence/2026-11-06-media-continuity/baseline.md。

**Goal:** 一次整合四點影音改善，手機與桌面支援跨頁迷你播放器、跨裝置續看，且不破壞既有背景播放。

**Architecture:** frontend-platform 維持共用播放器與強型別 client；hhc-web 的持久 host 管理同文件內唯一播放工作階段；hhc-web-api 保存 fenced account progress；api-gateway 精確開放新路由。觀看統計與續看進度分開，B 接續不停止 A。

**Tech Stack:** 現有 Next.js 16.4.2／React 19.2.7／TypeScript／hls.js 1.7.3、Go、PostgreSQL、Nginx route generator；不新增 runtime dependency。

**Spec:** [2026-11-06-media-continuity-design.md](../specs/2026-11-06-media-continuity-design.md)。所有產品常數、狀態、衝突規則以上述設計為準。本計畫和設計一起審閱；不是宣稱已通過實機或已發布。

## Global Constraints

- 使用者已決定 B 接續不強制暫停 A；進度 ownership 不得控制 A 的播放授權。
- 保留 `LIVE_HOLDBACK_SECONDS=90`、`LIVE_EDGE_TOLERANCE_SECONDS=20`，第三點只改外觀。
- 單一 audible owner、既有背景交接／pause intent／late play 防線不得弱化；不增加音訊模式。
- 每 repo 自 latest origin/main 建 isolated worktree／task branch；不碰既有 dirty main 或其他工作樹。
- 先讀該 repo 的 AGENTS.md、README、CI；Next 實作前讀安裝版本的 node_modules/next/dist/docs，不能照舊版假設。
- 新 API、migration、package、consumer 各自 PR／required CI／release；不得跳過失敗檢查或本地直接部署。
- 新持久資料包含帳號清理與 restriction fence；未核實正式設定不能宣稱 production ready。
- YouTube 官方可證行為、HHC 自選規則、待實機比對項目分開記錄。

## Review Focus

1. iOS 在同一 React 元件但 DOM reparent 或 portal target 改變時仍可能中斷 media：Task 4/7/9 驗證節點 identity 與音訊。
2. B 接管後 A 的 late ended／offline retry／claim 重播可能覆蓋 B：Task 2 的 DB 競爭測試固定結果。
3. analytics 路由 reload、auth modal、locale layout remount 可能破壞跨頁持久性：Task 4/7 明定無縫邊界及私人路由安全。
4. 背景音訊在 video 停住時仍前進：Task 5/9 只從 active owner 保存，不能以 video.currentTime 冒充真實位置。
5. 直播媒體 origin、錄影 package 替換、completed tombstone 清理可能復活錯誤續看：Task 2/6/9 分別測試。

## File map / ownership

路徑相對各自 repo。新檔名為規劃名稱；migration 序號在執行時以最新 main 下一號分配，不能預先佔用。

| Repo | 修改／新增 | 責任 |
| --- | --- | --- |
| frontend-platform | packages/ui/src/player/PlayerChrome.tsx、player.css、HlsPlayer.tsx、index.ts 及既有 tests | 時間軸、presentation callbacks，保留背景引擎。 |
| frontend-platform | packages/hhc-web-client/src/client.ts、generated.ts、index.ts；新增 recording-progress.test.ts | API contract、validation、fixtures；generated 依既有生成流程。 |
| hhc-web-api | 新增 internal/recordings/playback_progress.go、internal/postgres/recording_playback_progress.go、internal/httpapi/recording_playback_progress.go 及各 *_test.go | 進度 domain、交易與 handlers。 |
| hhc-web-api | internal/httpapi/recording_interaction.go、internal/migrations/sql/*_recording_playback_progress.sql、openapi.yaml | 路由註冊、additive schema、正式契約。 |
| hhc-web-api | internal/postgres/recording_interaction.go、bulletin_watermark.go、recording_subject_reader.go、docs/data-governance.yaml | subject count／erase／restriction／目前 subject read 覆蓋及治理登錄；先追溯現行方法再接入。 |
| api-gateway | routes/www/42-recordings.toml、conf.d/api/www/42-recordings.conf、docs/openapi.yaml、docs/recording_interactions_test.go | 精確路由與生成配置；新增 scripts/test-recording-progress-routing.sh。 |
| hhc-web | 新增 src/features/member-videos/PlaybackProvider.tsx、PlaybackHost.tsx、useVodPlayback.ts、usePlaybackProgress.ts、ContinueWatching.tsx、mini-player.module.css 及 colocated tests | 穩定 host、擷取現有 VOD session 邏輯、同步與 mini UI。不要再建立通用播放器 framework。 |
| hhc-web | src/app/[locale]/layout.tsx、MemberVideoZone.tsx、LiveRecordingPlayer.tsx、useLivePlayback.ts、usePlaybackTelemetry.ts、ThumbnailPreview.tsx、api.ts | 搬遷 owner、頁面 slot、preview arbitration、client wiring。 |
| hhc-web | src/components/layout/AnalyticsBoundary.tsx、AccountControl.tsx（必要時）、src/i18n/locales/*.json、package.json、pnpm-lock.yaml | 導覽／登出協調、五語系、精確 package pin。 |
| hhc-web | 新增 scripts/media-continuity-browser-fixture.mjs、docs/superpowers/evidence/2026-11-06-media-continuity/ | deterministic browser fixture／實機證據；優先沿用既有 fixture tooling。 |

## Task 0: 固定基線與 YouTube 對照

**Interfaces:** consumes spec §§2–3；produces baseline.md 與 scenario checklist，列清 OS/browser/YouTube App 版本及已證／待證。

- [x] 重新 fetch 四 repo，記錄 SHA、乾淨 isolated worktree 與 package versions；保留本文件中的原基線供比較。
- [ ] 讀取目前 use-background-audio tests、useLivePlayback renew、VOD renew、AnalyticsBoundary、AccountControl 登出及所有 HlsPlayer callers，畫出 owner／cleanup／cookie 流程。
- [ ] 同一 iPhone 實測 YouTube 縮小、拖移、展開、關閉、其他影片選取；桌面測四角及縮放。以可觀看的普通影片測跨裝置提示；不動 YouTube 帳號設定、不送訊息或購買。
- [ ] 將與 YouTube 的差異寫入證據：固定回影音專區、右上返回 icon、本案多裝置 ownership。沒有 App 存取或實機時標 pending，仍可繼續其他計畫工作，不能標視覺完全一致。
- [ ] 建立 HHC 改前相同素材基線：VOD 有／無 ready audio、初始 live、DVR、鎖屏／解鎖、授權續期。正式測試只使用已授權素材／直播。

**Deliverable:** 已知基線與無縫路由範圍；任何會 reload 的目標路徑在 Task 4 開工前有明確處置。

## Task 1: 時間軸兩項獨立修正

**Files:** frontend-platform/packages/ui/src/player/{PlayerChrome.tsx,player.css,PlayerChrome.test.tsx,live-player.test.ts}。

**Interfaces:** 不變更 HlsPlayer callers；以既有 live/followLive/seekable state 決定 thumb presentation。

- [x] 加 failing tests：`live_zero_window_thumb_at_end_and_disabled`（thumb 右端且 disabled；currentTime、seek range、90 秒常數不變）、`live_unknown_window_not_reported_as_playing`、`vod_zero_duration_not_live`、`live_dvr_not_forced_to_edge`。
- [x] 跑 `corepack pnpm --filter @hallelujahhomechurch/ui test:run`，確認新 assertions 確實失敗。
- [x] 改 touch 軌道 24px safe inset／44px target；零視窗用獨立視覺 thumb，native range 保持真實 min/max／disabled。保留 keyboard、preview、pointercancel。
- [x] 重跑 UI tests、lint、build；browser fixture 查 320/390/844px、橫向與 fullscreen computed geometry。
- [ ] 在 iPhone Safari/Chrome 從 0 秒拖曳 20 次，無誤觸返回；不得靠阻止全頁 history 達成。提交 focused commit／PR；可獨立先發布。

## Task 2: 後端進度與雙裝置 fencing

**Files:** API 新 progress domain/store/handler/tests、migration、openapi.yaml、recording_interaction.go、治理／subject integration。

**Interfaces:** GET snapshot、POST claim、PUT progress、GET continue-watching，schema 完全採 spec §7。Go domain 型別 `ProgressSnapshot`、`ProgressClaim`、`ProgressUpdate`、`ResumeItem`；methods `GetPlaybackProgress(ctx,id,user)`、`ClaimPlaybackProgress(ctx,id,user,input)`、`UpdatePlaybackProgress(ctx,id,user,input)`、`GetContinueWatching(ctx,user)`，回值對應 DTO＋error。不從統計資料推導 canonical progress。

- [ ] 先建立 table-driven validation 與真 PostgreSQL failing tests：NaN/Inf/負值/越界、他人身份、版本過期、權限撤銷／法律資格、body bound。
- [ ] 加競爭測試 `ClaimSameGenerationHasOneWinner`、`FirstClaimConcurrentInsert`、`LateAUpdateCannotOverwriteB`、`OldClaimRetryCannotReclaim`、`DuplicateSequenceNoOp`、`RewindPersistsLowerPosition`、`OldEndedCannotCompleteNewOwner`、`DeletedProgressCannotBeUpsertedByUpdate`、`DifferentRecordingsDoNotShareOwner`。
- [ ] 在隔離測試 DB 跑 `go test ./internal/recordings ./internal/postgres ./internal/httpapi -run 'Progress|ContinueWatching'`，記錄 fail；絕不把測試 DB 環境指向正式資料庫。
- [ ] 實作 additive migration 與短交易：所有 claim/update 共用既有 subject fence，鎖順序一致；claim 分配 UUID generation，update conditional owner＋sequence，PUT 不 upsert。期間不呼叫 Asset／Account 遠端服務持鎖等待。
- [ ] 實作 latest query：只查有資格可見內容，排除 completed/過期，排序 claimed_at＋id；不對每個歷史項目逐一呼叫 Asset。
- [ ] 整合帳號 erase／restriction／subject count／目前可用 subject read；補 `ErasureRejectsLateProgress`、`RestrictionBlocksClaim`、`ResumeReadNeverLeaksUnavailableTitle`、`ExpiryPurgeDoesNotResurrect`。更新資料盤點，確認 30 天上限及媒體到期清理。
- [ ] 分離直播與 VOD version；加 `LiveArchiveDoesNotRestoreRawPTS`、`TitleChangePreservesProgress`、`PackageReplacementResetsPosition`、`CompletedOwnerTombstone`。
- [ ] 以獨立 requests 保留原 analytics 心跳與去重語意；加原統計 regression，續看卡片／claim 不計觀看。不要為省一次 request 將進度綁到 analytics enabled。
- [ ] 通過 focused tests 後跑 repository Go lanes（`python3 scripts/test-go-lanes_test.py`、`python3 scripts/test-go-lanes.py`）、`go vet ./...`、migration policy、OpenAPI lint 與 required CI；記錄 isolation fixtures。提交 PR。

## Task 3: Gateway 與型別 client

**Files:** file map 所列 Gateway files；frontend-platform/packages/hhc-web-client/src/{client.ts,index.ts,generated.ts,recording-progress.test.ts}、package metadata。

**Interfaces:** client methods `getRecordingProgress`、`claimRecordingProgress`、`updateRecordingProgress`、`getContinueWatching`；request/response 對應 Task 2 OpenAPI，沿用 AbortSignal、error code、同源 auth。

- [ ] 加失敗 contract tests：DTO decoding、409 codes、null item、live item、keepalive request auth、401/403；API fixtures 使用 synthetic IDs 不含正式觀看紀錄。
- [ ] Gateway 加 exact `/continue-watching` 與 UUID progress/claim routes，位於 fallback 前；method、query、encoded path、body 4KiB、no retry、private/no-store 與現有 auth 一致。
- [ ] 透過 `python3 scripts/routegen.py generate` 產生配置，不能只手改 conf；加 runtime route tests 覆蓋 public `/priv` 拒絕、匿名拒絕、錯誤 method/query、超大 body、會員正例。
- [ ] 以 `python3 scripts/routegen.py generate --check`、`go test -race ./...`、`go vet ./...`、新增 routing script 及既有 required CI 驗證。
- [ ] client 實作 bounded keepalive 能帶既有 auth headers；不以 sendBeacon 當授權替代。進度 helper 不改其他 client 預設。
- [ ] frontend-platform 跑 test/lint/build/check:packages/pack:packages/test:consumers；依 repo 版本/tag CI 發布精確 package，消費端不得引用未發布版。

## Task 4: 持久播放 host，先維持原外觀

**Files:** hhc-web PlaybackProvider/PlaybackHost/useVodPlayback、新 tests、locale layout、MemberVideoZone、LiveRecordingPlayer、useLivePlayback、AnalyticsBoundary、ThumbnailPreview。

**Interfaces:** `PlaybackProvider` owns one session；`usePlayback()` returns `{state,start(request),minimize(),expand(),close(),registerSlot(element)}`。`state.presentation` 為 idle/resume-card/watch/mini；`request` 為 discriminated VOD/live，帶內容 IDs 與 watchHref，不由 route page 持有 grant。最小接口只在本 feature 內使用。

- [ ] 加 failing integration tests：切頁仍是相同 video/audio DOM；不呼叫 clearCookie/pause；回觀看頁不重建；不同影片只替換一次；late old grant 不能回寫新片。
- [ ] 把現有 VOD grant/renew/clear 邏輯原樣抽到 useVodPlayback；live 沿用 useLivePlayback。先不順便重構背景 engine／授權策略。
- [ ] 在穩定 layout host 掛載播放器，watch 頁註冊 slot；採同 parent 定位而非改 portal target。layout geometry 更新不呼叫 media API。
- [ ] 搬 telemetry 與 media refs 到 session owner，預覽在 active playback 存在時停用；頁面只持有列表／評論／詳情等頁面資料。
- [ ] 加 auth 失效、logout、account switch、legal-required、route modal 的停止／清理測試。cookie clear 只清該 session scope，續期／切片序列化保留。
- [ ] 實作 spec §6 private-media document 策略：資格未明延後 GA；具影音資格的會員 document 不載入 GA，關閉播放器也不重啟。已載入 GA 才登入時先 clean-document navigation，私人 host/card 等它完成。新增 AnalyticsBoundary tests，驗 /member-videos → /about → /literature-ministry → 閱讀內頁 → /member-videos 均不重載且無 GA request；匿名 opt-in 不退化。
- [ ] 跑 `corepack pnpm exec vitest run src/features/member-videos`、`corepack pnpm lint`、`corepack pnpm build`；browser fixture 證明 node identity、單一 audible owner；提交獨立 PR。

## Task 5: 前端持久續看與所有權衝突

**Files:** usePlaybackProgress.ts/test、api.ts、PlaybackProvider、MemberVideoZone tests、usePlaybackTelemetry tests。

**Interfaces:** `usePlaybackProgress` consumes active owner `playbackMediaRef`、account identity、recording/mediaVersion、server claim result；produces `flush(reason)` 與同步狀態，不控制播放。`start(request)` 先 GET 選起點，交給 HlsPlayer resume；首次成功 playing 後才用 observedPositionSeconds claim，回應不再 seek。

- [ ] 加 failing fake-timer tests：15 秒上報、pause/seek/end/hidden coalescing、音訊 owner 位置、單一 in-flight、只留最新 pending、old sequence、429/5xx backoff。
- [ ] 加 `BClaimDoesNotPauseA`、`SupersededStopsProgressOnly`、`FocusAndQualityChangeNeverClaim`、`ResumeClickReadsFreshPosition`、`ExplicitStartAtOverridesResume`、`RestartWritesZero`、`FailedPlaybackDoesNotClaim`、`LocalPausePlayClaimsLocalPosition`、`ProgressServiceDownStillPlays`。
- [ ] 接上 Task 3 client；使用 server generation，state 更新與 async callbacks 綁 session identity，不能將前帳號待送資料寫入新帳號。
- [ ] claim conflict 不自動重搶；explicit pause→play 使用本地 active position，成功 playing 後才重新 claim。timeout 最多同 claimId/expectedGeneration 重試3次（5/10/20秒），不能刷新 expectedGeneration。離線時沿既有授權播放，未成功 claim 不寫雲端；網路回復不憑舊點擊取得新 owner。
- [ ] keepalive 補存與正常上報共用 sequence，close 不先 abort 掉必要補存；有期限、錯誤不阻塞 UI。background hidden 不是 pause／close。
- [ ] 通過 focused tests 與全部 member-video suite；驗證舊 telemetry 的 unique viewers／overlap credit 沒變，提交 PR。

## Task 6: 跨裝置「繼續觀看」卡片

**Files:** ContinueWatching.tsx/test、PlaybackProvider、i18n/locales/*.json、mini-player.module.css。

**Interfaces:** consumes `getContinueWatching` + `usePlayback().start`；卡片與 active mini 共用外框，不共用 media instance，卡片尚未播放不能建立 video/audio。

- [ ] 加 tests：非會員零請求；idle visible 30 秒 polling；focus/online 最短 5 秒合併；hidden 停讀；本地 paused/playing 均不彈卡。
- [ ] 加關閉抑制 tests：same account＋recording＋generation 心跳不復活；新 generation 可提示；換帳號清 state；storage disabled 不 throw。
- [ ] 實作封面／片名／位置／繼續按鈕；live 顯示返回直播，processing 隱藏，expired/denied 不洩露資訊。
- [ ] 點擊才新取 progress/claim/grant；再驗證無 HLS preload、MediaSession registration、播放 heartbeat 或自動音訊。
- [ ] 依五語系補文案與 a11y；測 B 開站、B 已開分頁及 A/B 不同影片排序；提交 PR。

## Task 7: 手機／桌面 mini 與手勢

**Files:** PlaybackHost、mini-player.module.css、PlayerChrome/HlsPlayer additive callbacks、MemberVideoZone/list callers、對應 tests。

**Interfaces:** shared UI optional `onMinimize?:()=>void`，維持既有 consumers；網站 presentation geometry／navigation 由 host 負責，不能塞入共用播放引擎。

- [ ] 加 tests：64px＋1.5 direction lock、控制項排除、pointercancel、長按／雙擊互斥；gesture 縮小只導航一次，browser back/forward 不循環。
- [ ] 實作手機 down-drag 與明確按鈕；縮小固定回影音列表，其他站內導航保持目的地。取代播放器內頁面 cleanup，不能靠在新頁立即重新 play 掩飾中斷。
- [ ] 實作右下初始位置、手機拖移吸附、桌面四角／240–640px resizing；viewport clamp、safe area、固定 UI 避讓、modal z-order。
- [ ] 實作展開回原 watchHref、close 保存／停止／clear、Escape 優先序、focus return；五語系／鍵盤／reduced motion。
- [ ] 列表點新片保持 mini，開啟詳情連結展開；single host 防多聲。thumb preview 保持停用至關閉 active player。
- [ ] 與 Task 0 YouTube baseline 對照，將固定回影音專區等 intentional differences 記錄；精確尺寸可經實機校準，不能改播放生命週期。
- [ ] 跑 shared UI tests、web tests、fixture browser regression；手機／桌面視覺驗收後提交 PR。

## Task 8: 上線前整合、容量與回復驗證

**Files:** hhc-web package.json/pnpm-lock、各 repo required checks、evidence/results.md。

- [ ] consumer pin 已發布 UI/client exact versions；所有新 props backward compatible，其他 frontend consumers tests 通過。
- [ ] 用隔離 DB 量測 100 concurrent owners、每 15 秒寫入＋既有 telemetry；記 DB pool wait、lock wait、p95/p99、錯誤率與 deadlock。與相同負載舊版比對：不得有 lost update/deadlock/新增 5xx；progress endpoint p95 目標 <200ms（本地受控測試，非正式 SLO）。
- [ ] 測兩 tab／兩 browser context／兩實體裝置競爭矩陣；測新舊 client 並存、API 不可用、429、重新登入、內容撤銷、migration 前後及 consumer rollback。
- [ ] hhc-web 跑 `corepack pnpm test:run`、`corepack pnpm lint`、`corepack pnpm build`、README 所列 Docker build；frontend-platform 跑 test/lint/build/check:packages/pack:packages/test:consumers。
- [ ] API 跑既有 Go lanes、vet、OpenAPI、migration/release policy 及 required CI；Gateway 跑 route generation check、Go race/vet、routing/runtime image checks 及 required CI。遵循選擇式 CI，不另起無關重複 heavyweight jobs。
- [ ] 記錄兩個可獨立回復的邊界：新 progress API／schema additive 可留；web 回到上一個健康 immutable revision 即停新 host／sync。rollback 後新 API 未被舊 client 呼叫不影響播放。

## Task 9: 實機／正式驗收矩陣

每列記錄 pass/fail/pending、版本、素材、時間、證據；正式環境需另有授權，測試直播不得擅自通知會員。

| 測試 | 平台／條件 | 必要結果 |
| --- | --- | --- |
| 從 0 秒拖時間軸 20 次 | iPhone Chrome/Safari，直橫向 | 不返回上一頁；既有 seek/預覽正確。 |
| 直播 0／小於90／等於90／超過90秒可用窗 | 單元＋真 live | disabled 時紅點右側；實際時間與 holdback 不變。 |
| watch→mini→影音列表→文字事工→關於我們→watch | 手機與桌面 | 同 video/audio identity、無額外 grant exchange、無聲音重複／中斷。 |
| 錄影鎖屏至少10分鐘，跨兩次 grant renew | iPhone Safari/Chrome，mini/watch 各一次 | 有聲、解鎖同步、不需再按播放；原生 pause 正確維持。 |
| 直播鎖屏至少10分鐘＋DVR＋轉錄影 | iPhone Safari/Chrome | 同上；live→VOD origin 正確，不套用舊 capture 位置。 |
| 背景 active audio 與 video 位置不同 | fake owner＋真裝置 | 儲存 audible owner 位置，切回不倒退。 |
| A/B 同片、不同片、倒退、晚到 ended、離線重送 | 兩裝置／兩 browser | 完全符合 spec §5.3；B 不強停 A。 |
| 播放器關閉、登出、資格失效、grant expiry | mini/watch/background | 依原授權停止／清理；無 late play 復活。 |
| 無 ready audio、新音訊稍後 ready | 手機 | 沿既有 fallback，不能錯誤承諾背景能力／熱切換。 |
| 30分鐘混合切頁／鎖屏 soak | 至少 iPhone Safari＋Chrome | 無持續 stutter/desync、多聲、資源增長與需要重按播放。 |
| 320px、橫向、200%字體、鍵盤／VoiceOver | 手機＋桌面 | 控制可操作、焦點合理、浮窗不遮必需控制。 |
| 桌面拖四角、縮放、Escape／fullscreen優先 | Chrome/Safari/Firefox/Edge | 布局可見且無誤關閉；Android Chrome 亦驗 mini。 |
| 卡片輪詢、封面載入與背景計時器 | 受控網路 | 無未點擊串流下載，無額外觀看統計。 |

## Task 10: 發布、smoke 與交付

- [ ] 各 repo required CI 全綠、PR 通過審閱；先 API migration/runtime，驗 health/ready；再 Gateway exact routes；再 shared package tag CI；最後 hhc-web pinned release。Task 1 可先以獨立 package/consumer PR 發布。
- [ ] 所有變更用 CI/CD immutable artifacts，記 image digest/package version/deployed revision；不把 main 合併當作部署成功。
- [ ] 經授權以測試會員驗 GET progress/card、claim/update、跨兩 browser 接續、公開頁／影音頁 smoke；敏感資料不寫 log。檢查 `/health`、`/ready` 適用端點與 public route。
- [ ] 若背景播放、權限或多裝置進度退化，依 repository rollback path 回復 web 健康 revision，保留 additive DB；不要現場改 holdback／雙影音同步策略掩飾問題。
- [ ] 至少24小時觀察已發布新流量的 errors、latency、progress conflicts/retry rate 與 DB 資源；沒有實際負載則標證據不足，不能泛稱正式穩定。
- [ ] Task 9 實機必需列完成後才能宣告完整體驗驗收；YouTube layout 未實機比對時列 pending，不寫「完全一致」。
- [ ] merge/release/smoke 成功且無後續工作後才移除本任務乾淨 temporary worktree；branch commits 全在 origin/main 才刪 local branch。dirty primary main 不更新。

## 本次規劃交付狀態

- [x] 最新 origin/main 程式責任與四 repository 影響範圍確認。
- [x] 官方 YouTube 核心功能、未知同步規則與本案差異分開記錄。
- [x] 雙裝置權限、順序、冪等、倒退、完成與離線處理定義。
- [x] 背景播放不變條件、實作順序、測試／發布／回復列入。
- [ ] 產品碼實作、CI、部署、iPhone／YouTube App 實機比對：本次未執行。

## 規格審閱修正紀錄

2026-11-06 builder check 提出的四項已納入：同步 API 不可用時播放降級、A 主動重播採本地位置、B 成功 playing 才 claim、AnalyticsBoundary 的會員 private-media document 策略。這是文件一致性審閱，非產品實機驗收。
