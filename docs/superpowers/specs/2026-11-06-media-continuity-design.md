# 官網影音：手機／桌面連續觀看設計

日期：2026-11-06（Asia/Taipei）。狀態：設計已核准，依既有 CI/CD 執行。正式基礎設施與資料變更仍須依 repository 流程提供預覽。

## 1. 目標與決策

整合四項需求：手機時間軸避免邊緣返回誤觸、同帳號跨裝置續看、直播零長度時間軸紅點靠右、手機與桌面跨頁迷你播放器。維持既有錄影／直播背景播放，不增加音訊模式切換操作。

使用者已選擇：B 接續不強制暫停 A。手機和桌面一起納入；影片內下拉縮小並回影音專區；浮窗右上有返回觀看頁按鈕。

### 採用方案與替代方案

- 採用：同一網站文件內只有一個持久播放 host；後端保存帳號進度；跨裝置顯示待點擊的續看卡片。手機／桌面共用生命週期，使用響應式控制列。
- 不採用：每頁重新建立播放器並 seek 回原位。會重新授權、重載串流，危及背景交接及直播連續性。
- 不採用：以系統 Picture-in-Picture 當站內浮窗。無法一致提供自訂控制、返回觀看頁與跨平台版面。
- 不採用：以客戶端時間的 last-write-wins 或最大觀看秒數合併。晚到的 A 可覆寫 B；取最大值則破壞倒退重看。

## 2. YouTube 行為證據與一致性範圍

查證日 2026-11-06。產品體驗對齊有證據的 YouTube 行為；不能聲稱複製未公開的同步演算法或每個 App 版本的像素。

| 行為 | 證據與本案處理 |
| --- | --- |
| 同帳號跨裝置接續位置 | YouTube 官方 Premium 說明確認；本案提供同等核心結果，不增加付費分級。 |
| 錄影、直播在站內迷你播放器繼續播放／暫停／展開／關閉 | 官方 Miniplayer 說明確認；納入手機與桌面。 |
| 桌面拖到四角、拖角調整尺寸 | 官方目前文件列出；納入桌面，避免只實作固定右下角卻稱完全一致。 |
| 迷你模式點其他影片 | 官方桌面文件說明新影片在迷你播放器播放；本案列表縮圖沿用此行為，另保留開啟觀看頁連結。 |
| 縮小返回位置 | 官方桌面為先前瀏覽頁；本案依使用者要求固定回影音專區，保留原搜尋／捲動狀態，這是明確差異。 |
| A 播放時 B 必定即時彈出、雙裝置進度衝突規則 | 官方未公開此保證；本案採下述可測試的產品政策，不標示為 YouTube 原規則。 |
| 手機實際浮窗尺寸、手勢、圖示位置 | 官方平台頁不足以建立現行 App 的完整視覺基準；實作前記錄 iPhone YouTube App 版本與實機錄影／截圖，對照原型。不能以桌面文件推定手機像素。 |

來源：

1. https://support.google.com/youtube/answer/6308116 （Continue watching）
2. https://blog.youtube/news-and-events/5-premium-features-to-up-your-youtube-game/ （跨 Android、iOS、Web）
3. https://support.google.com/youtube/answer/9162927?hl=en （桌面 Miniplayer）
4. https://support.google.com/youtube/answer/9162927?co=GENIE.Platform%3DiOS&hl=en （手機參考入口；本次重新擷取逾時，未完成實機比對）
5. https://developer.mozilla.org/en-US/docs/Web/API/Document/visibilitychange_event （離頁保存時機，非背景音訊應暫停的指令）
6. https://www.postgresql.org/docs/17/explicit-locking.html （交易／row lock；部署相容性以專案 PostgreSQL 版本為準）

## 3. 已查核程式基線

使用 fetch 後的 origin/main，沒有覆蓋 dirty checkout。以下是程式證據，不是正式部署版本宣告。

| Repository | SHA | 關鍵事實 |
| --- | --- | --- |
| hhc-web | 7b7b56f9ce5e51c3df79316859562fbfdae2dc2e | UI 1.1.19；MemberVideoZone 離頁暫停並清 cookie；bookmark 只在記憶體。 |
| frontend-platform | 9c29470cc4dec61ace525bb62fdea6bce32b70fb | PlayerChrome 控制時間軸；liveWindow 保留 90 秒；use-background-audio 管理前景／背景輸出。 |
| hhc-web-api | b57c82aad151fbed4894ee21829eec54b992005e | 播放心跳每 15 秒；統計以 session sequence 去重，同帳號／影片重疊時數去重。 |
| api-gateway | 6373de71ffa8581c2775ad3de888df6506b195e3 | recordings 路徑採精確 allowlist，新增 API 必須新增政策並生成配置。 |

重要檔案：frontend-platform/packages/ui/src/player/{PlayerChrome.tsx,player.css,HlsPlayer.tsx,live-player.ts,use-background-audio.ts,use-audio-session.ts}；hhc-web/src/features/member-videos/{MemberVideoZone.tsx,LiveRecordingPlayer.tsx,useLivePlayback.ts,usePlaybackTelemetry.ts,api.ts}；hhc-web/src/app/[locale]/layout.tsx。

## 4. 四項行為契約

### 4.1 時間軸

- 手機完整播放器軌道左右至少內縮 24 CSS px，並取 safe-area inset 較大值；移除觸控樣式負 margin 導致的貼邊。
- 命中區高度至少 44 CSS px；視覺軌道可維持纖細。沿用 pointer capture、pointercancel 與鍵盤操作。
- 不攔截全頁返回手勢、不加假 history entry；不假設 touch-action 能擋住系統手勢。
- 橫向、全螢幕、RTL／語系排版、200% 文字縮放皆須檢查；現有雙擊 seek、長按加速、單擊控制列不退化。

### 4.2 續看與提示

- 錄影按會員＋recording ID＋不可變媒體版本保存 positionSeconds。title、cover 修改不清進度；package 更換不能誤套舊時間。
- 未指定時間時從雲端位置開始；`startAt` 分享連結優先；「從頭播放」明確寫入 0，不能被舊值覆蓋。
- 收到有效 ended 且 position 距 duration <= 1 秒才記 completed；不採 90% 自動完成，避免漏掉長片尾段。completed 保留 tombstone／owner，避免舊 A 將其復活；續看卡片排除 completed，重新播放會開新 generation。
- 同帳號最近一次「主動開始／接續」的項目用作跨裝置卡片。心跳更新位置，不改最近項目的排序，避免兩部片交替跳卡。
- B 登入、首次載入、回到可見分頁、重新連線時查詢；可見且無本地播放時每 30 秒刷新，單一 in-flight，前述觸發合併且最短間隔 5 秒。隱藏停止卡片輪詢。
- 卡片只顯示有權限的封面、標題、位置與「繼續觀看」；不載入 HLS、不換播放 cookie、不計觀看、不搶焦點、不自動出聲。
- 點擊時重新檢查權限並取得最新進度；已有本地播放（含暫停）時不彈卡、不替換。關閉在本 tab 的 sessionStorage 記住 account＋recording＋generation，心跳不令同一卡片復活；帳號切換清除。
- 進度上報獨立於 analytics 開關。每 15 秒最多一次定期保存，pause、seeked、ended、close、切片、visibility hidden、pagehide 補存最新 snapshot；合併重複事件，只保留最新待送一筆。
- 背景時保存 active audio 的位置，絕不因 visibility hidden 停音。iOS 暫停計時器／強制關閉時，最後一次補存不保證送達；健康前景正常網路的目標誤差 <= 15 秒＋請求延遲，不能宣稱 crash 時也保證此上限。
- 不新增跨啟動離線回放佇列。網路恢復只重送同 generation 的最新 snapshot；舊 owner 被拒絕後不自動搶回。失敗不阻擋已授權的播放。

### 4.3 直播紅點

- 直播有效視窗存在且 `edge <= start`：視覺紅點固定右端，slider 仍 disabled；不捏造可 seek 的時間／max。
- 尚無有效視窗：維持既有 loading；若顯示 disabled 軌道，紅點仍靠右。不要假裝已成功跟上直播。
- 當區間恢復，沿用原計算；DVR、暫停、buffering、直播結束轉錄影都不能被強制顯示為正在直播。
- 不改 `LIVE_HOLDBACK_SECONDS=90`、`LIVE_EDGE_TOLERANCE_SECONDS=20`、followLive、HLS 設定或真實 currentTime。
- 視覺 thumb 與原生 disabled range 分離處理，避免只把填色設為 100% 而 thumb 仍在左側；保留 range 的語意及無障礙標籤。

### 4.4 迷你播放器：手機＋桌面

- 狀態：idle／resume-card／watch／mini；fullscreen 是 watch／mini 上的暫時 presentation，不是另一個播放 session。
- 手機在影片非控制項區向下拖縮小；方向鎖定後才接管，下移 >= 64px 且垂直位移 >= 水平 1.5 倍才提交；右下斜拉只要符合此條件也成立。低於門檻、pointercancel 還原，不觸發 click／長按。這些是起始校準值，須實機比對後記錄調整。
- 全螢幕內先用既有退出機制返回 inline，再縮小；不和原生退出手勢競爭。時間軸、按鈕、設定選單不啟動縮小手勢。
- 手機／桌面均提供明確縮小按鈕，縮小後回影音專區（保留搜尋條件及捲動）；一般站內導覽離開觀看頁則自動 mini 並前往使用者指定頁面，不改導覽目的地。
- 右下角預設 mini；手機寬 `min(240px, viewportWidth - 32px)`，桌面預設 360px、可縮放範圍 240–640px 並受 viewport 限制；畫面比例 16:9。這是本案預設，非宣稱 YouTube 固定尺寸。
- 手機可拖曳吸附可用角落，桌面四角吸附及拖角縮放；旋轉／縮放／鍵盤開啟後 clamp 回可見區；不加手勢 dismiss，避免與移動混淆。
- 顯示播放／暫停、關閉、右上展開回原觀看頁；錄影有進度提示，直播有 LIVE 狀態。浮水印依舊可見；完整 seek／畫質設定可展開操作。
- 避讓網站固定導航、cookie／公告、safe area；真正 modal 開啟時浮窗不蓋住其互動層。非 modal 浮窗不鎖捲動、不 trap focus、不使用 aria-modal。
- Escape 先關設定／退出全螢幕，再關 mini；展開與關閉後焦點回合理目標。所有控制提供 44px 命中區、鍵盤、可讀名稱與 reduced-motion。
- 迷你模式點另一影片縮圖：在同一 host 切換內容，保持 mini；點「開啟觀看頁」才展開。切換先保存並停止舊來源，任一時刻只有單一 audible owner；過時 grant 回應不得覆蓋新片。
- 前進／返回同一觀看頁恢復 watch，不建立重複 history entry；不改 history 來阻止離站。跨 origin、重新整理、切語系若造成 document/layout 重建屬新 session，依續看恢復，不能承諾無縫音訊。

## 5. 多裝置一致性：明確寫入所有權

以下是 HHC 選定的工程政策，不是 YouTube 未公開實作。原則是「最後成功的主動開始／接續取得該影片進度的寫入權」，不是最後抵達的心跳勝出。

### 5.1 資料與排序

新增 `hhc_web.member_recording_progress`，主鍵 `(account_id, recording_id)`；欄位 media_version、mode(vod/live)、position_seconds、completed、owner_session_id、owner_generation(UUID)、claim_id(UUID)、last_sequence、claimed_at、updated_at、expires_at。直播另存 capture_id，position 不用作跨裝置 DVR 恢復。

- account 只取可信 identity，不接受 request body user ID。generation 為伺服器隨機 fencing token，並非播放憑證。
- media_version 由服務端當前 package/capture 識別建立，request 只能要求比對，不能任意指定授權版本。VOD 秒數採媒體相對座標；直播 timestamp 經現有 mediaOrigin 映射，不直接寫 raw PTS 當 VOD 秒數。
- 進度只保留目前媒體版本的一筆；首次 claim 後採 30 天 inactivity 上限，並不得晚於媒體到期。每日小批清理；不可見／過期／刪除內容立即從讀取結果排除。
- `claimed_at` 由資料庫時間產生，最近項目排序採 claimed_at DESC＋recording_id 穩定 tie-break；不同影片各有獨立 owner。periodic update 不改 claimed_at。
- completed 不刪 row，以避免 stale replay 復活；刪除後也只有新 claim 可建立 row，PUT 絕不 upsert。刪帳／restriction 使用既有 subject fence，晚到請求不可重建資料。
- 納入目前帳號資料治理盤點、刪除／限制／計數與可用匯出流程；不重建已退役的 DSR schema。30 天是本案工程保留上限提案，不代表法律決策已完成。

### 5.2 Claim 與 update

1. GET 取得當前 mediaVersion、generation（無 row 為 null）與 position。
2. 明確開始／接續先 GET 最新位置並取得播放授權，按 resume／0／指定時間定位；已在播放的 A 暫停後再按播放，也 GET 最新 generation，但使用 A 本地 active media position，不跳到 B 的雲端位置。首次成功 playing 後才發 claim：`{sessionId, claimId, expectedGeneration, mediaVersion, startKind:'resume'|'restart'|'at', observedPositionSeconds}`。observedPositionSeconds 是成功播放當下的真實位置，套用與 update 相同的 finite／範圍驗證。從頭播放先 seek 0，再記開始播放後的實際位置，不能以舊 bookmark 取代。
3. 在現有 subject admission/fence 下，以同一 account/recording 的短交易序列化 claim；處理 row 不存在的競爭（既有交易鎖或 INSERT ON CONFLICT 後 row lock），不可只鎖不存在的 row。比對 expectedGeneration，生成新 UUID，以 observedPositionSeconds 初始化並回傳；回應不可再 seek 播放器。重複相同 claimId＋sessionId 且仍為 owner 時回傳現有結果，不重設 position／sequence。
4. expectedGeneration 不符回 409 `progress_conflict`。不自動循環重試 claim、不以新 generation 偷渡舊意圖；顯示可再點擊的「繼續觀看」，下一次明確點擊使用最新 snapshot。
5. 授權、載入或 play 失敗時不發 claim、不搶 A 寫入權、不改最近項目。autoplay blocked 顯示播放按鈕；成功 playing 只消耗一次明確意圖，後續背景交接／buffer recovery 的 playing 不再 claim。B 從點擊時重新 GET 的最新已存位置接續，不保證包含 A 尚未上報的秒數；claim 提交前 A 仍可更新，提交後 B 才取得寫入權。claim 不計觀看統計。
6. update：`{sessionId,generation,sequence,mediaVersion,positionSeconds,state}`；只有 owner、版本一致且 sequence 遞增可改 canonical position。相同／較舊 sequence 是 idempotent no-op；不同 owner 回 409 `progress_superseded`，前端停止此 session 的進度上報但保留播放與既有統計。
7. automatic play、背景交接、品質切換、授權更新、seek、focus、online、進度心跳都不 claim。舊 A 若要重新成為寫入方，必須主動暫停後再播放／重新開啟影片；UI 不因 owner 改變跳播放位置。
8. GET 不可用仍可用指定時間或本地已知位置（無則 0）沿既有授權播放；未取得 expectedGeneration 就不 claim。claim timeout 最多用同 claimId／expectedGeneration 重試 3 次（5/10/20 秒），conflict 停止；不能刷新 generation 偷渡舊意圖。恢復連線不生成新 claim，須下一次明確操作。update 429 遵守 Retry-After，5xx 退避 5/10/20/30 秒並只留最新待送。401/403/404 交由既有授權流程確認失效，必要時停止播放；同步不可用不能誤認為觀看權撤銷。任何錯誤不清空已確認的 progress。

### 5.3 競爭與結果表

| 情境 | 結果 |
| --- | --- |
| A 同片 10:00，B 接續 | B 點擊重新 GET，成功 playing 後 claim；A 繼續播放，接管提交後 A 更新被 fencing。 |
| B 倒退至 08:00 | 儲存 08:00，不能使用 MAX(position)。 |
| A 10:30 的舊 heartbeat 在 B 08:00 後抵達 | 不覆蓋 B；統計依既有規則處理。 |
| B 關閉，A 仍自動播放 | 不自動移轉寫入權；下次續看仍以 B 最後位置。A 主動暫停再播放才可接管，從 A 本地位置繼續。 |
| A、B 同時 claim 同片且讀到同 generation | 交易只接受其中一個，另一個 409；不用客戶端時間決定先後。 |
| A 看 X、B 看 Y | 各存各的進度；最近卡片按成功主動開始排序，不被另一影片心跳搶回。 |
| A 舊 ended／close 晚到 | 不得完成或清除 B 的進度。 |
| B 刷新／同帳號開新 tab | 新 session；用雲端續看，舊 session 不可覆蓋。 |
| 伺服器已接受但回應遺失 | 同 claimId 重試保持冪等；若已有新 owner，回 conflict，不重奪。 |
| 離線 A 回來、裝置時間差數小時 | 同 generation 才補存；不比較裝置 wall clock、不自動 claim。 |

## 6. 播放生命週期與背景保護

- 在 `src/app/[locale]/layout.tsx` 的 AccountControlProvider 之內建立穩定 `PlaybackProvider`／`PlaybackHost`，位於 route children、AnalyticsBoundary、會切換 key 的頁面之外。保留 server-rendered children，不把全站變成 client-rendered。
- 持久 host 中掛載同一 HlsPlayer／video／audio；觀看頁只註冊定位 slot 與內容。host 留在同一 DOM parent，以定位／尺寸呈現 watch 或 mini；不可把 React portal target 從頁面切到浮窗，也不可搬移／重新插入 video DOM 來冒險觸發 iOS 中止。
- watch slot 的 ResizeObserver／捲動更新只調整定位，不觸碰 media URL、key、currentTime、playbackRate、play/pause；移除 slot 自動 mini。hidden 停止位置繪製，音訊、授權生命週期照舊。
- 把 VOD grant renew、cookie exchange 序列化、expiry、錯誤恢復、live scope／capture／renewal 及 telemetry 由頁面 owner 移到持久 session owner。頁面 unmount 不再 stop/clear；close、換片、登出、授權失效、document teardown 才清理。
- 不重寫 `use-background-audio` 的 audible owner、late play 防線、pause intent、quality rebuild 或 native HLS 選擇；以現有 playbackMediaRef／playbackPauseRef 取得真實輸出。
- 保留同 scope cookie 續期競爭防線；遠端進度 owner 與播放 grant／scope 完全分離。B claim 不得 revoke A 的 grant、cookie 或 background intent。
- 新 host 只在真正播放時載入播放器 runtime；續看封面不初始化 HLS、MediaSession 或隱藏 audio。非會員不查私人進度。
- 同 tab 列表 ThumbnailPreview 若 active player 存在，停用影音預覽（保留封面），避免 iOS audio session／帶寬／cookie 競爭。不能只依 muted 假設安全。
- 同文件內路由改變時，MediaSession metadata/actions、watermark、速度、音量、品質、字幕如有、grant generation 不重設。
- 直播轉錄影沿用現有轉換語意；雲端提示對仍在 live 的項目只「返回直播」，processing 暫不提供續看，archived 首次新 VOD session 不沿用 live DVR 秒數。既有當頁轉換所做的 mediaOrigin bookmark 映射仍保留。
- 已確認 publicAnalyticsRoute 將 /about、/literature-ministry 視為公開，但 /member-videos 與文字事工閱讀內頁排除。AnalyticsBoundary 在已啟動 GA 的 document 進入排除路由時 location.replace，僅搬 host 不足。
- 採 private-media document 策略：資格尚未判定時延後 GA 初始化；具會員影音資格的登入者在此 document 不初始化 GA（即使 consent granted），讓私人播放器／續看卡片可安全進入公開頁。關閉播放器不重啟 GA，保持到 document 結束；匿名／不具資格且無私人內容的流程維持既有 opt-in。
- 若在已載入 GA 的 document 登入或取得影音資格，先完整導覽至乾淨 document，完成前不 mount 私人 host/card。這是登入邊界的一次性重載，不是播放中的跨頁重載；不能以刪 script tag 假裝移除已執行分析程式。
- 此策略會減少會員流量的 GA 記錄，是本案為隱私與連續播放提出的明確取捨。不得為恢復 GA 而重載播放中的頁面；維運沿用安全 operational telemetry。

## 7. API 合約草案（實作時寫入 OpenAPI）

所有路由同源、human member、資格／法律接受／subject fence，`private, no-store`。不返回播放 URL、授權 token、其他裝置名稱、完整歷史。

| Method / path | 契約 |
| --- | --- |
| GET /api/member/recordings/continue-watching | `{item: ResumeItem|null}`；有權限且未 completed 的最近主動項目，最多回一個。 |
| GET /api/member/recordings/{id}/progress | `{progress: ProgressSnapshot|null,mediaVersion:string}`；fresh version 由後端判定。 |
| POST /api/member/recordings/{id}/progress/claim | 上述 claim；回 `{generation,positionSeconds,mediaVersion,sequence:0}`；相同 owner 重試 sequence 回現值。 |
| PUT /api/member/recordings/{id}/progress | 上述 update；回 `{accepted:boolean,sequence:number}`；重播 no-op accepted=false。 |

`ResumeItem`：recordingId、publicId、title、mode、captureId?、mediaVersion、positionSeconds、durationSeconds?、generation、claimedAt、updatedAt；封面沿既有受保護 cover route，不嵌 grant。

`ProgressSnapshot`：generation、mediaVersion、positionSeconds、completed、mode、updatedAt；sessionId 不向其他客戶端暴露。

位置必須 finite、>=0 並限於服務端可信 duration（超出誤差 <=1 秒可 clamp，其餘 400），live 不以 VOD duration 驗證；sequence 正整數且 <= JS safe integer；UUID、body 4KiB、拒絕未知 mode/state。state 為 playing/paused/waiting/ended；session 與 generation 都必須匹配當前帳號及內容。

關閉頁面使用既有可帶授權的 client，加上 bounded fetch keepalive；不能直接改成無 Authorization 的 sendBeacon 來繞過 gateway。補存失敗只損失最近進度，不放寬安全邊界。

## 8. 效能、安全與發布界線

- 使用既有 PostgreSQL，不加 Redis、WebSocket、跨裝置遙控服務。首次先採獨立 progress request，避免改統計語意與 analytics gate；相同 timer 可協調，但不能共用容易 abort 的生命週期。
- 每個有效 owner 最多 4 次定期寫入／分鐘；可見 idle tab 最多 2 次提示讀取／分鐘，重複觸發合併。100 個 owner 約 6.7 progress writes/s，另有既有統計流量，必須量測而非假設免費。
- API 索引：(account_id, claimed_at DESC, recording_id)、expires_at；最近提示用 SQL 可見性／completed 條件及 LIMIT，不做每卡片 Asset fan-out。
- 不在 log／GA／Sentry 記完整 member ID、影片觀看位置、title 或憑證；僅低基數 outcome／latency／superseded／retry counters。維持現有隱私路由策略。
- 發布順序：API additive migration＋後端 → Gateway routes → shared UI/client package → hhc-web pinned consumer。共用 UI 的 1／3 修正可先獨立發布。
- feature rollback 以回退 hhc-web immutable revision 為主；新增 DB schema 保留，禁止破壞性 down migration；獨立同步 API 失效不能影響舊播放器。
- 正式部署、合成直播或修改正式資料另依授權與 reviewed preview 執行；本計畫不授權啟動會通知會員的測試直播。

## 9. 驗收與完成定義

實作計畫列出逐項測試。必須包括真實 iPhone Safari＋Chrome、Android Chrome、桌面 Chrome／Safari／Firefox／Edge；記 OS/browser/app 版本，不以 Playwright WebKit 取代 iOS。

優先 gate：同 video/audio 節點 identity、背景 audible owner 不變；錄影與直播鎖屏至少 10 分鐘跨過兩次授權更新，解鎖恢復同步；watch→mini→關於我們／文字事工→watch，不 reload／重設播放位置。用 30 分鐘混合切頁／鎖屏 soak，並和改前相同素材／網路對照。

既有可接受的鎖屏瞬間短暫停頓不宣稱消失；不可新增持續卡頓、不同步、雙重聲音、需要再按播放。音訊尚未 ready 的素材不被宣稱具備既有音訊背景保證。

完成需分別列本地測試、CI、正式 release/smoke、實機與 YouTube 對照結果。任何未完成列 pending，不以工程測試代替使用者體驗驗收。
