# 線上閱讀器專業 Web App 體驗改善計劃

日期：2026-10-19。狀態：P1 兩席計劃檢驗 PASS。這一輪交付整合計劃；T0–T6 為後續執行步驟，本輪不執行產品實作、合併或發布。

目標是讓閱讀、選取、畫線、寫筆記、查找與匯出形成連貫的工作流程：操作立即有回應，版面穩定，動畫說明位置與狀態的變化，保存失敗仍可恢復。保留目前網站的字型、明暗色彩、圖示與閱讀正文，沿用設計 tokens 和 house UI，不重做品牌或加入裝飾性動畫。

## 1 最新產品決策

本計劃取代舊規格中以下決策：保留舊版標註 Tab、以句子為手機最小選取單位、保存完成才關閉編輯器、Markdown 只匯出自己的文字，以及將閱讀設定放進目錄。舊文件留作歷史紀錄。

| 項目 | 本輪定案 |
| --- | --- |
| 我的筆記 | 筆記、畫線、書籤三個 Tab；固定外框與標題列，Tab 固定，內容獨立捲動 |
| 舊版標註 | 完全移除使用者可操作的功能、Tab、恢復入口，不留折疊或隱藏頁 |
| 寫筆記 | 按儲存立即結束編輯、回筆記列表，內容立即可見；不等待網路回覆才關閉 |
| 畫線 | 點顏色後立即更新選取範圍的畫線並收起工具列，背景保存，不凍結閱讀 |
| 手機選取 | 以中文逗號或句號分段，支援相鄰片段合併，保留原文件定位 |
| 列表精簡 | 搜尋列對齊、只有 input；移除四個顏色篩選及畫線列表內三個換色按鈕 |
| 列表動作 | 畫線引用右側 X 清除；筆記前往原文、編輯、刪除用有標籤的 icon button |
| 手機面板 | 筆記、目錄、閱讀設定共用固定高度、底部開啟、標題與 X 固定的外殼；背景遮罩一致，無模糊 |
| 手機搜尋 | 不透明滿版搜尋頁，鍵盤出現後仍填滿鍵盤上方的可視區域，無模糊 |
| 目錄與設定 | 目錄只導航；模式、字級、行距、紙本縮放／方向集中於閱讀設定，桌面也有設定入口 |
| 退出確認 | 點背景、X、Escape 都等同繼續閱讀；只有明確確認離開才導航 |
| 匯出 | 預設 Word .docx，每則僅保存的引用與自己的筆記，清楚排版 |
| 動畫與通知 | 有目的的轉場、聚焦提示與微互動；成功不刷屏，失敗不一閃即逝 |

功能移除不執行正式資料清庫、不刪除有效畫線／筆記／書籤。舊客戶端與已入列的歷史 mutation 仍須可安全讀取與處理；一般版本衝突、筆記重新定位與 Recovery 仍保留，不重建舊版標註頁。

## 2 現況依據與修改邊界

- 文件分支從當時最新 `origin/main` 71a086a 建立，使用獨立 worktree。該版本已發布；後續實作仍須重新 fetch、確認實際部署與適用 AGENTS/README。
- 面板現況：`reader.css:93` 整個側欄捲動且只有 max-height；`:134` 手機 Drawer height:auto。`ReaderPrivateState.tsx` 已是列表與編輯共用外框。
- 畫線現況：`WeeklyReader.tsx:302–309` 等 mutate 回覆才清選取；`usePrivateReader.ts:160–180` 有離線副本時，已入列仍等待同步。
- 首次保存的合成重現：延遲 editNote 回覆，保存期間觸發 focus，重新驗證回傳同帳號／文件／revision 的新物件。第一次伺服器模擬狀態 v1→v2、applied，但編輯器未關；第二次相同 mutationId 重試，版本仍 v2，編輯器才關。重現說明競態，尚未證明使用者真機的觸發事件。
- 因果位置：`useReaderSession.ts:37–54` focus／visibility 重驗顯示 loading；`usePrivateReader.ts` 的 value 依賴 effect 會清理並取消 foreground；`NoteEditor.tsx` 靜默吸收 ReaderActionError。
- 退出確認現況：UI1.0.76 的 `overlays.js` 將 AlertDialog 的 isDismissable 寫死為 false，單在 reader 傳 true 無效。
- 以 hhc-web 為主要實作範圍，沿用正式 Website client1.1.0。沒有新服務、正式旗標變更或 renderer immutable assets 改寫。若可行性驗證指出共用 UI 或 producer 契約確須改動，先更新計劃範圍並重新雙席檢驗，不在 consumer 偷改依賴套件。

## 3 面板與版面規格

### 3.1 手機統一底部面板

筆記、目錄、閱讀設定使用同一外殼規則；不是各自複製一份相似 CSS。

- 固定高度以可用視窗扣除實測 reader header、上方留白與安全區計算，不用各頁不同的 88vh／90vh 猜值。相同裝置與鍵盤狀態下，空／短／長內容高度一致。
- 標題文字的字級、字重、基線、顏色、左右 padding 完全一致。X 使用同一圖示、尺寸、hover／pressed／focus 樣式與至少44×44px可點範圍。
- title 與 X 固定在面板頂端；筆記列表的 Tabs 固定在其下。只有 body 可垂直捲動，避免 Drawer 與內容各捲一層。
- editor、書籤表單、刪除衝突與 Recovery 沿用同一外框高度。編輯器不額外塞 Tabs；取消／儲存列保持可達，鍵盤出現時按可視區域調整，不能被鍵盤壓住。
- 所有面板由下往上開啟，圓角、陰影、背景 surface 與 scrim 沿用筆記的設計 tokens。目錄不再從手機左側出現，目錄／設定也不再使用背景模糊。
- 背景內容 inert，焦點留在當前面板。關閉回到原觸發按鈕並保留閱讀位置。開另一個面板前先經既有草稿離開 guard；同時只開一個主要面板。
- 未改動的設定關閉即返回；有未保存草稿時，X／背景／返回都走同一決策，不默默丟稿。

### 3.2 桌面與列表

- 桌面保留正文旁側欄的工作方式，同樣固定 title、Tabs 與外框高度，body 捲動。目錄與設定保留合適桌面容器，不強制改成手機 sheet。
- 三個 Tabs 等分、文字水平垂直置中、至少44px高；窄畫面與五語長文字不得截斷成無法辨識的標籤。
- 筆記與畫線使用同一搜尋列結構／位置／高度。以 placeholder 加可及標籤辨識，不在 input 上堆額外文字。匯出移到搜尋下的次要工具列，不把筆記搜尋往下擠。
- 移除 color filter 的 UI、無用 state 與測試期待。畫線列表保留實際畫線色彩的視覺識別，不提供列內換色；原文選取工具列保留三色。
- 畫線每列為可換行的引用＋右側 X；X 的標籤為清除此畫線。筆記列用定位／鉛筆／垃圾桶圖示，保留 tooltip、aria-label、禁用狀態及站內刪除確認。
- 空白、查無結果、載入失敗、待同步與長筆記都有專用狀態；不以空列表誤代表尚未載入。移除焦點所在項目後，焦點到相鄰項或列表標題。

### 3.3 手機滿版搜尋

- 搜尋使用不透明 surface 覆蓋整個畫面，不沿用小側欄／底部 sheet，不透出正文、不加 blur。
- 自己的頂部列包含返回、搜尋 input 與清除；header 固定，結果區使用剩餘高度獨立捲動。
- 以 visualViewport 和安全區處理鍵盤：鍵盤出現時仍填滿鍵盤以上的可視區域，鍵盤收回就恢復全高；不能把結果藏在鍵盤後，也不縮成小彈窗。
- input 在當次操作取得焦點，不等轉場結束才 focus。IME 組字期間不提交／誤選結果；清除 query 不關閉搜尋。
- 返回／X／Escape／系統返回關閉最上層搜尋，回 reader 原位置；同文件重新開啟保留 query 與結果捲動，點結果則關閉搜尋並定位原文。既有帳號、文件與版本隔離保持。
- 目錄只有章節／段落／原稿頁等導航；閱讀設定有紙本／易讀、字級／行距或紙本縮放／方向。桌面設定入口必須同時補齊。

## 4 儲存體驗與可靠性

### 4.1 按儲存的可見結果

按儲存時先凍結文字、引用、目標、baseVersion 與單一 mutationId；保存任務的生命週期獨立於編輯器。按鈕於同一事件防重入，編輯器立即開始關閉，回筆記列表並顯示該筆內容與「正在儲存」。不等待授權更新、GET、網路重試或伺服器 acknowledgement。

畫線亦立即畫在選取範圍並開始收起工具列。背景中的操作不阻擋繼續閱讀、下一次畫線或下一筆筆記；同筆資料的依序修改由既有單一 writer／CAS 控制，不能盲目建立並行請求。讀取／滾動進度不能搶佔使用者保存。

### 4.2 本機持久性與單一 writer

- 現有 durable queue 依賴已下載的離線副本；只把 sync 呼叫改成 void 不足以支援所有使用者。
- 預設方案是擴充既有 IndexedDB private replica／queue 的 online-only binding 支援，沿用同一 mutation 格式、UUID、owner epoch、原子 enqueue／ack 與單一網路 writer。不另建第二套同步佇列，也不為了快速保存自動下載整期正文。
- online-only journal 只保存需要恢復的私人狀態／意圖與最小 binding（account/document/revision/edition/epoch/存取期限）；不保存 token、額外全文或可讓人離線繞過授權的資料。現有 document-key 沿用，讀寫 context 明確區分有效離線副本與 fresh online session，不能製造假 OfflineSave。
- UI 可在本機提交進行時立即離開 editor，但草稿保留於獨立 operation owner。IDB 交易完成後才顯示「已儲存在此裝置，待同步」；伺服器確認後才是「已儲存」。
- enqueue 不等待網路 writer，網路送出仍依序；晚回覆須合併至 confirmed，再重播較新的 queue，不以舊 state 全量覆蓋新本機狀態。連續編輯同筆時，確認前的後續意圖須依前一個成功版本產生 CAS，已送出的 payload／ID 不改寫。
- timeout／中斷標成結果待確認，保留原 ID 與 payload，重試同 ID；revision／CAS 衝突用可辨識的恢復介面，不假裝成功、不自動覆蓋雲端。
- 本機儲存被禁止／額度不足時，仍立即離開 editor 並在列表保留記憶體草稿；顯示持續的「尚未保存」及重試／恢復編輯。可嘗試線上保存，但不得標示已存此裝置。若尚未收到 server ack，離開／關頁須有未保存警告；不能宣稱這種降級狀態可抵抗瀏覽器被直接終止。
- 重新整理重播持久意圖前必須 fresh authorization；登出、切帳號、撤銷與跨 tab epoch 失效沿用既有鎖定／清理。正常登出前若有未同步內容應提示其後果；伺服器撤銷或另一 tab 登出不得為保留意圖而延後隔離。
- journal 使用受驗證 access window，不自行延長；過期內容鎖定、不得自動 replay，重新授權後才恢復。清理／移除離線副本須辨識 pending journal，不能連帶靜默刪除尚未確認的操作。
- 離開 reader 後若 writer 卸載，journal 保留，重進時安全續傳；不承諾關掉瀏覽器後仍持續傳送。

### 4.3 修復重新驗證競態

以 account/document/revision/owner epoch 定義 mutation owner，與 receipt 物件及視圖掛載分離。同 binding 且既有存取仍有效的背景重新驗證，不重建 writer、不丟成功回覆，也不以全頁 loading 遮住既有內容。尚有效存取與 initial loading／已知失效須分開。

帳號、revision、有效期限、撤銷／授權失敗改變時立即套用隔離，不因背景體驗取消安全防護。已送出的未知操作仍保留原意圖，重新取得有效資格才可核對／續傳。將「單次按儲存完成、列表正確更新、編輯器不重新彈回」列為回歸斷言。

### 4.4 退出確認

- 初始確認畫面：點背景、X、Escape、繼續閱讀都取消同一離開請求，不導航、不清稿、不改閱讀位置。
- 確認離開才處理當前離開意圖。持久入列的操作不需等網路才可離開；未持久保存與未按儲存的草稿，明確說明後才允許放棄。
- 離開前檢查若仍在進行，顯示「正在確認保存狀態」。取消必須使該 request token 失效；晚完成的檢查不得再觸發導航。若某一步無法取消，須明確呈現忙碌狀態並保持所有關閉入口一致，不能只讓部分按鈕看似可按卻沒反應。
- Reader 專用退出確認使用既有可設定 dismiss 的 Dialog 組合，保留 house focus trap／樣式；不嘗試覆寫無效的 AlertDialog prop，也不全域放寬其他刪除確認。站內確認不使用原生 confirm；關閉整個瀏覽器的 beforeunload 提示屬瀏覽器控制。

## 5 狀態與通知契約

| 狀態 | 使用者看到的內容與可做的事 | 顯示位置與期限 |
| --- | --- | --- |
| 取得初始資料 | 穩定骨架／載入提示，不露錯誤空列表 | 首次載入；保留 header 外形 |
| 正在保存意圖 | 立即退出 editor，內容出現在列表，顯示正在儲存 | 項目狀態；不假稱已落盤 |
| 本機保存成功 | 已存此裝置／待同步，可繼續操作 | 小型同步指示與筆記列 |
| 網路同步 | 正在同步與待同步數量，閱讀不鎖住 | 單一彙總狀態，不逐筆 toast |
| 已確認成功 | 已儲存，狀態短暫確認後回安靜樣式 | 筆記面板內；不逐筆通知、不在 header 下彈出 |
| 離線／網路恢復 | 離線待同步／恢復連線，依序續傳 | 筆記面板內彙總；恢復成功不另跳通知 |
| 結果不明 | 尚待確認，重試原操作 | 持續顯示、可進恢復，不自動消失 |
| 本機與網路皆未完成 | 尚未保存，重試／恢復編輯 | 持續可見，不能只出現 toast |
| 衝突／資格失效 | 需要處理，保留原意圖與明確下一步 | 固定狀態＋恢復入口，安全隔離 |
| 空筆記／查無結果 | 沒有筆記／沒有符合內容，提供對應方向 | 內容區；不混同載入中 |
| 匯出 | 準備中／可下載／已交給瀏覽器／可重試的失敗 | 匯出介面，不寫進 Word |

通知沿用既有 Toast／inline status，避免新增全域 notification manager。非關鍵訊息4秒自動消失，hover／鍵盤焦點停留時暫停；同一事件合併，不堆疊畫線成功提示。重要失敗持續留在可找到的狀態區。aria-live polite 合併播報，重要錯誤才 alert，不逐字／逐筆打斷螢幕閱讀器。同步提示預留位置，避免正文因狀態出現而跳動。

## 6 動畫與操作細節

動畫使用現有 house motion 能力及局部 CSS；先用 transform／opacity，不為此新增大型動畫依賴。時間為首版設計值，必須以 candidate 錄影與實機檢驗校正，動畫不得阻擋資料處理或輸入。

| 情境 | 動畫與視覺行為 | 驗收重點 |
| --- | --- | --- |
| 三種底部面板 | 開啟200ms ease-out上移，關閉160ms ease-in，scrim150ms淡入淡出 | 共用相同曲線／高度／header，無正文幾何跳動 |
| 筆記 Tabs | 選中底板180ms滑動、內容120ms淡入，文字始終置中 | 對齊手機 nav 的互動語言，焦點與selected即時更新 |
| 寫筆記保存 | 按下當下有pressed回饋，立即開始editor退出與列表接續；資料不等動畫 | 不重複提交，不在結束時突然回editor |
| 選取與畫線 | 短句選中底色／畫線120ms顯示，工具列120ms淡入退場 | 不改文字排版，下一次選取不被舊回覆關掉 |
| 前往原文／搜尋命中 | 定位後目標柔和強調約1秒；需要時平滑捲動 | 精確原位置，保留合理header offset與鍵盤焦點 |
| 列表新增／移除 | 新項目短淡入，刪除確認後退場；保留捲動錨點 | 不把使用者推到列表頂端，失敗仍有可找回項目 |
| 全頁搜尋 | 120ms surface淡入，不延遲input focus，不做會干擾鍵盤的縮放 | 鍵盤開合後依然滿版，返回位置穩定 |
| 確認與通知 | Dialog160ms淡入＋微小位移，通知短淡入 | 無彈跳／長時間縮放，失敗訊息可讀可操作 |

reduced-motion 下移除滑動、縮放、平滑捲動與動態強調，以即時狀態／靜態框線取代；功能與焦點回復不變。正文、已存引用與文字大小不為裝飾特效抖動或自動放大。每次最多一個主要轉場，避免面板、背景、列表與通知同時各自搶注意力。

## 7 手機短句選取

- 預設在 canonical 句子內以中文「，」「。」分成短句，保留既有句尾邊界；標點與緊接的結尾引號附前一段，空白不產生可選單位。英文數字、小數、千分位不可因泛用逗點正則被誤切。
- 點一段選一段，點緊鄰未選片段可擴大連續範圍；點已選範圍取消當前選取，點不相鄰片段則重新從該片段選，不默默把中間未選文字一起加入。
- 選取保持全域連續；同 canonical sentence 合併為一組 scalar start/end，跨句也符合既有 continuity 檢查。不改 sentenceId、不替已存筆記或書籤重新切編號。
- 依 pointer 命中位置及已驗證 DOM fragment start/end 換算 scalar，不能只讀最近的 sentenceId。單一 hit-test adapter 於T0驗證手機 paper／easy、跨行／跨頁／縮放；不準確時不得選到不相關文字。
- 畫面只強調真正選到的範圍，不能仍把整句染成 selected。桌面原生文字選取保留；手機滾動、翻頁、雙指縮放、取消 pointer 不觸發選取。
- 同步調整 range quote、工具列計數、copy／createNote／highlight／clear、return-state、一般筆記重新定位及必要的鍵盤／螢幕閱讀器行為。跨頁只按正確 fragment 命中，不把另頁同句開頭當作選取點。

## 8 Word 匯出

- 產生真正的 .docx，預設取代 Markdown，不保留格式選單增加負擔。可用 Word 閱讀，也可匯入 Google Docs；首版不是建立雲端分享文件。
- 每則只有已保存 `note.quote` 與使用者 `note.text`，順序與筆記列表一致。不要誤用 range.quote 補入更長的原句；不加入刊物全文或 CMS 標題。
- 文件正文不放期數、版別、語言、revision、ID、匯出／保存時間、網址、同步狀態或技術欄位，不使用 Markdown code fences。必要的同步／草稿排除與下載提示留在匯出介面。
- 每則排成引用與我的筆記兩區：引用縮排、淡灰底；自己的筆記正常正文；保留段落、換行、繁簡日韓與emoji，字級舒適，則與則以留白區分。無多餘封面、頁首頁尾、診斷資訊或裝飾線。
- 標籤與下一段同頁，長內容自然跨頁；不要把整則長筆記設成不可分頁造成大片留白。引用缺失時只輸出自己的文字，在匯出介面說明缺少引用筆數，不造句或補全文。
- 保留已驗證全量／篩選快照、owner／epoch／revision／授權與下載前重驗，匯出不觸發同步。明確的已落盤未送出內容可匯出；結果不明／衝突／尚未落盤的操作不可冒充完整快照。
- 保留200筆與8MiB上限，計入引用與筆記UTF8輸入、未壓縮文件XML總量及最終檔案；壓縮不能繞過限制。超限整份拒絕，不輸出截斷文件。純文字經OOXML安全序列化，不嵌巨集、外部關聯或追蹤內容；檔案metadata不含帳號／token／真實作者資訊。
- 格式依賴先查現有可用能力；只有缺乏正確DOCX builder才新增一個有明確用途且瀏覽器可用的依賴，動態載入，不增加正常閱讀首包負擔。
- 以實際產品下載產生的合成 .docx 做內容檢查及 render→逐頁PNG視覺檢查；不能以另一套示範文件代替。涵蓋長引用、跨頁筆記、多語、emoji、XML特殊字元及原始換行。實機 Word／手機Files下載另行驗收。

## 9 執行步驟與每步雙席門檻

| 步驟 | 交付與成功條件 | 兩席檢驗面向 |
| --- | --- | --- |
| P0 本計劃 | 全部最新決策、交互狀態、動畫、風險、驗收明確；處置Critical/Important | 資料與可落地性／專業UX與完整性 |
| T0 基準與可行性 | fresh main獨立worktree；保存現況三尺寸明暗圖與流程錄影；新增原失敗序列的回歸；決定journal最小相容metadata、儲存降級、短句hit-test及DOCX產物原型；做真實元件面板／滿版搜尋視覺提案 | 生命週期與資料契約／實看提案與可操作性 |
| T1 保存與背景同步 | 修復重驗競態；有／無offline save、IDB失敗兩路都不靠第二次儲存；單writer及快速連續操作、lateack不丟稿；狀態真實 | 時序與資料保護／即時回饋與恢復操作 |
| T2 統一外框與精簡 | 三手機sheet同height/title/X/scrim；三Tabs；移除舊版標註、colorfilter與列內換色；iconactions；退出背景取消 | 邊界與回歸／實看三尺寸明暗與鍵盤 |
| T3 導航搜尋與動態 | 目錄設定分離、桌面入口；手機滿版搜尋與鍵盤；共用motion、通知與焦點／原文聚焦 | 搜尋IME與路由／真實轉場與狀態錄影 |
| T4 短句選取 | paper/easy均有正確scalar範圍、連選、跨頁、滾動不誤選；存copy/highlight/note一致 | 範圍與相容／手機觸控與可及性 |
| T5 Word匯出 | 產品實際DOCX僅引用與筆記；安全快照、上限、download／render逐頁通過 | 快照與輸出安全／實看Word排版與下載 |
| T6 整合與交付 | 完整檢查、視覺／錄影矩陣、獨立PR/CI及已做／待做接受；無未處置Critical/Important | 整合與交付／視覺與裝置接受 |

每步先由root完成對應工作及驗證，再派兩位獨立Codex只讀檢驗；一位對資料與邊界，另一位實看可見流程與視覺。無Gemini。每席預設5分鐘、每輪最多10分鐘；同席在原預算內最多一次針對性窄複核。未能處置的重要問題停在該步，不先開始下一步；新head／實質修訂使用新的明確gate紀錄，不把未完成席次算PASS。

T0若發現本機journal、hit-test或Word生成不能滿足本規格，先修訂此計劃並雙席處置，不到後面才降低體驗。後續執行結果追加本文件的交付紀錄或連結其證據，歷史spec不重寫成已驗收。

## 10 驗收矩陣

- 固定390×844／768×1024／1440×900三尺寸明暗基準，加375px寬、390×568短畫面、200%瀏覽器縮放；五語繁中／簡中／英／日／韓長標籤。正常正文與工具列baseline/candidate不得有無意義外觀退化。
- 同尺寸切空／長筆記／畫線／書籤／editor／Recovery時面板bounding rect一致，title/X/Tabs不跟body捲；手機目錄／設定與筆記對照header高度、字型、X尺寸、scrim、開關曲線。
- 全頁搜尋在鍵盤展開／收回、橫豎切換、IME、清除／查無／返回／點命中後，header與結果完整可達，無blur／背景漏出／雙重捲動。
- 對每個動畫保存實際互動短錄影及狀態時間軸；截圖只驗靜態，不能代替轉場順暢度。預熱合成環境的20次操作，pressed／開始關閉等視覺回應目標p95≤100ms；另記CPU降速與真機測量，不能以網路延遲當動畫開始時間。
- 2秒／10秒延遲、timeout、429、斷線重連、IDB denied／quota、refresh與連續操作均有可理解狀態；首次儲存→focus／visibility→fresh同版receipt→lateack，只一次有效寫入且editor正確退出。另有無focus對照。
- 帳號／epoch／revision變化、撤銷、跨tab queue、相同note連續edit、舊ack晚到、progress佔用writer與元件卸載；不跨帳號顯示，不覆蓋新稿，不把pending誤稱synced。沒有offline save也必須測，不只測已下載的人。
- 輸出真正產品DOCX內容與逐頁render，檢查僅quote/text、沒有技術欄位及隱私metadata，Word自然換頁；下載前快照漂移、activation失效、空／超限都不產錯檔。
- house Dialog鍵盤焦點、Escape／背景取消、確認離開與late completion、系統返回、reduced-motion、screen reader live regions、44px目標及對比。不能只靠顏色表達狀態。
- 適用完整test:run、lint、TypeScript、build、perf:static、release-policy、frozen-template、依賴／Docker掃描與exact-head CI；新增DOCX動態chunk有明確預算，保留原閱讀包預算，不任意放寬。
- iPhone Safari、iPhone installed PWA、Android Chrome至少驗鍵盤／IME、safe-area／旋轉、逗號選取、Word Files下載；真帳號跨裝置與真實v1–v10/PDF對照沿用必要回歸。無設備／帳號時列未完成，不以模擬器、fixture或桌面截圖替代。

## 11 交付與停止點

本輪只整理並檢驗計劃。實作後維持focused worktree/branch、最新main、各repo獨立PR與必要CI，保留不相關變更。若後續另獲發布授權，才按既有CI/CD發布，核對實際digest、readiness、公開／受保護路由smoke及兩席發布後檢驗；不本機部署、不調正式旗標／基礎設施。

完成定義分開記錄：計劃就緒、實作／自動化完成、視覺與動畫接受、實機／真帳號接受、發布驗證。專業體驗必須包含可見操作與失敗恢復的證據，不以測試綠燈或程式碼完成取代使用者接受。

## 12 本輪檢驗紀錄

- 原始材料：本輪使用者決策、上線版本原碼、兩席原碼分析及兩席合成重現／提案檢驗。正式私人筆記未讀寫。
- `reader_professional_plan_data_review`：PASS，確認立即退出editor、online-only journal／既有queue、IDB降級、CAS與lateack、帳號與期限隔離、短句range及DOCX安全邊界；沒有Critical/Important。
- `reader_professional_plan_ux_review`：PASS，確認三手機sheet的fixed title/X、滿版搜尋／鍵盤、動畫／通知／退出取消、短句與Word排版及錄影／真機驗收矩陣；沒有Critical/Important。
- 兩席皆只讀、未執行產品／真機測試；PASS僅表示計劃就緒。產品碼未改、未實作或發布。手機面板、滿版搜尋、退出遮罩與title/X對齊等最新補充均已納入。
- 文件PR／CI的最新head及交付狀態以PR讀回為準，不由計劃檢驗推定CI或產品驗收通過。

## 13 實作交付紀錄

2026-10-19 使用者授權開始實作，最終停在 merge 前。獨立分支 `feat/reader-professional-experience-20261019`，base `d2d5ff6`。P0 文件 PR #245 仍是獨立未合併的規劃歷史；本分支保留其計劃作為實作依據。

- T0 首輪：資料／UX 兩席 FAIL；缺少 lifecycle 相容細節與可複核的基準、提案、動態及 DOCX 證據。沒有先進 T1。
- T0 候選 2：相容表、六張基準、實際元件面板／滿版搜尋提案、流程影格／影片、browser DOCX 原型及三頁 render 已補齊，詳見 `docs/reviews/reader-professional-20261019/T0.md`。等待該候選新一輪雙席 gate；原 FAIL 保留，不以補檔推定 PASS。
- 產品功能 T1–T6、真機接受、PR CI、merge／release 仍未完成。

T0 候選 `dd12ca5` 第二輪：資料席 `reader_t0_data_gate`、UX席 `reader_t0_ux_gate` 均 PASS，無 Critical/Important。兩席只讀核對契約、原碼、實際截圖／影格與 DOCX 產物；沒有重跑測試或真機接受。T1 開始；T0 低幀率錄影只供流程原型檢查。

### 2026-10-19 補充：安靜的背景操作

正常閱讀、背景資格驗證與儲存不可在 header 下反覆顯示載入／處理／請稍候訊息框。操作立即反映；正常同步狀態僅在筆記面板以低干擾文字或圖示呈現，成功不逐次 toast。只有網路失敗、裝置無法安全保存、權限失效或衝突等需要處理的情況顯示持續可恢復提示。首次載入使用骨架；背景更新保留內容、焦點與捲動。T1、T2、T3 及 T6 的兩人檢驗都必須涵蓋。

T1 root 候選完成：儲存／背景同步與安靜通知已實作，276 項範圍測試分組通過、TS／相關 ESLint／diff PASS；實際合成 Chromium 慢網路雙重編輯證據見 `docs/reviews/reader-professional-20261019/T1.md`。等待 T1 新一輪雙 Codex gate；未開始 T2，不推定產品或真機接受。

T1 `1845175` 首輪雙席 FAIL（四項 Important，無 Critical）：普通刪除誤清 RAM head、RAM writer 未共用帳號 lock、等待 ack 時未持續顯示儲存降級警告、站內離開未納入已接受但未安全儲存的操作。修訂候選已補 expected-ID 保護、共用所有私人寫入 writer、警告與退出文案、revision recovery／90-day guards；新瀏覽器 quota 證據與 291 項範圍驗證見 T1.md。等待第二輪雙席 gate，未進 T2。

T1 `116392c` 第二輪 UX PASS／資料 FAIL：一般離線下載仍能切走舊 pending queue pointer。第三版候選補同 transaction 的拒絕與恢復指引，並固定線上背景驗證的 revision；同分頁 RAM replica 在暫時登入卸載後保留全佇列，重新資格／epoch 檢查後以原 ID 續傳，帳號變動即清除並中止 writer。297 項範圍案例分組 PASS，TS／相關 ESLint／diff PASS；見 T1.md。等待第三輪雙席 gate，未開始 T2。

T1 `4a7c8b0` 第三輪：資料、UX 兩位 Codex 均 PASS，無 Critical/Important；T1 gate 完成，開始 T2。T2 固定筆記框架／Tabs／編輯器、簡化搜尋與圖示、移除舊版標注 UI、可取消退出 dialog 已形成候選，瀏覽器幾何與深淺色證據見 `docs/reviews/reader-professional-20261019/T2.md`；尚待檢查及雙席 gate，未進 T3。

T2 `ed749d6` 首輪 UX PASS／資料 FAIL（1 Important）：長 inline Recovery 超出固定框後無法捲到恢復操作。修訂候選改為受限 body 捲動並讓獨立 Recovery 共用外殼；高度改讀實測 ReaderTabs header，加16px留白。另補刪除後回相鄰項／列表標題的焦點。48項面板／Recovery／退出測試及14項關鍵整合測試 PASS，TS／相關ESLint／diff PASS；新實際長筆記／Recovery捲動、400px viewport與刪除焦點證據見T2.md。等待T2第二輪雙席，未進T3。

T2 `940ebca` 第二輪：資料與 UX 兩位 Codex 均 PASS，無未處置 Critical/Important；兩席只讀核對修訂與實際畫面／捲動證據。T2 完成，開始 T3。真機 IME／VoiceOver 與完整 CI 仍屬 T6；沒有 merge／release。

T3 實作中，尚未雙席 gate：目錄／設定共用手機筆記外框、獨立桌面設定入口、滿版搜尋與同步聚焦、返回鍵與焦點、共用動畫已形成工作版本。最新 30 項面板／Recovery／退出與 9 項關鍵整合案例 PASS，TS／相關 ESLint／diff PASS；完整畫面與動畫矩陣因瀏覽器擷取持續逾時尚未完成。詳見 `docs/reviews/reader-professional-20261019/T3.md`；保留工作樹，不把初步截圖或程式測試當視覺／真機接受，未進 T4。


T3 root 候選已完成範圍實作與可重現視覺證據：手機／平板／桌面深淺色矩陣、實際轉場影格與動畫位置、滿版搜尋／系統返回／原文焦點及 reduced-motion。176 項範圍測試全通過，另補鍵盤循環回歸並通過窄重跑；共177個不同案例有通過紀錄，TS／相關 ESLint／diff PASS。錄影為低幀率流程證據，不代表真機流暢度，詳細限制與歷史失敗見T3.md。等待雙 Codex gate；未開始T4，沒有merge／release。


T3 `e6276a1` 首輪 UX PASS／資料 FAIL（1 Important）：standalone Recovery 漏接系統返回。修訂將 Recovery 放在既有 decision 之後、導航／筆記之前處理，沿用 busy／deciding／suspended guard；2 個實際 history 回歸通過，合成瀏覽器閒置／忙碌返回證據見 T3.md。未進 T4，等待新候選雙席 gate。
