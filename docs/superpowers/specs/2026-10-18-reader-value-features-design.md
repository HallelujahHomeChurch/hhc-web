# 第三階段：閱讀加值功能規格草案

日期：2026-10-18。版本 D1.1（2026-10-19調查checkpoint）。狀態：原需求草案雙席保存檢驗PASS，第三階段F0兩席調查已完成並保存[證據與待決策](../../reviews/2026-10-19-reader-value-features-gates.md)；不是 API／資料模型已定稿，也不是可立即實作的 plan。入口：[總覽與發現追蹤](2026-10-18-reader-improvement-roadmap.md)。先完成第二階段依賴評估與本文件未決事項，更新 spec 並重過實作就緒 gate。

## 1. 目標、優先順序與不擴大的範圍

讓讀者帶走自己的筆記、命名常用位置。建議首批 P3-R1 Markdown匯出與 P3-R2 命名書籤；這是候選規格，來源為第一階段明列後續清單，沒有假稱五席一致投票或使用者已核准具體格式。第一階段資料可靠性、第二階段必要的查找／定位／可達性需整合；兩項可各自拆PR，但不能跳過契約與驗收。

不加入雲端文件整合、Email傳送、公開分享、AI摘要、整期受保護正文/PDF下載、筆記匯入、多人共編或第二套私人儲存服務。保留既有授權／到期／登出／revision／CAS，所有瀏覽器 API 經同源 gateway，私人資料仍由 hhc-web-api 擁有。

## 2. P3-R1 自己筆記的明確匯出

### 使用者流程與內容

由筆記面板一個次要「匯出筆記」入口啟動，先說明範圍與狀態再下載；不設常駐正文工具鈕。預設範圍是當前帳號、期數、版別、語言、文件及已載入revision的非刪除筆記；若面板有篩選，明確標示「目前篩選 N 筆」與「本期全部 N 筆」，使用者可選擇，預設本期全部。不擴成跨期全帳號匯出。

建議初版 Markdown UTF-8，包含期數、版別、內容語言、document revision、匯出時間、筆記數，以及每筆自己的文字、已保存引用、可解析的來源章節／原版頁碼與原頁連結。缺失anchor標示無法定位，不生成錯誤頁碼或整段正文補洞。引用只取既有note.quote；不額外爬全文。引用／下載權利是否允許必須先取得產品與授權契約證據；未解不能實作下載。

所有個人文字與引用以文字安全輸出，防止 HTML／Markdown link injection；不直接把不受信任標題、URL、檔名或註記拼成可執行HTML。檔名只含安全的期數/edition/locale，不含帳號、姓名、email、token、receipt或私有URL；來源link只用已核對的公開路徑與穩定語意anchor，不含查詢憑證。若Markdown轉義無法保證忠實可讀性，先在spec比較純文字格式，不能默默換格式。

### 保存狀態、快照與失敗

匯出不 flush、重試或修改任何 mutation，不清草稿。未儲存 editor draft 預設不包含且明確告知；使用者可返回儲存／保留草稿後再匯出，仍由第一階段確認規則處理。不能因按匯出而靜默放棄草稿。

先凍結當下合法可讀的資料快照（account/document/revision + note versions + sync狀態），再產生檔案。已確認雲端筆記與 durable 本機待同步筆記可包含，逐項／整份清楚註明待同步；結果不明、衝突或復原中若無法可靠判斷筆記版本，暫停匯出並指向既有復原入口，不猜成功，也不從舊cache補資料。此規則須在實作就緒檢驗前以真實state/replica契約確認，plan引用已確認結果，不能僅從樂觀UI判定持久。

只有已完整讀取的本期資料才能標「全部」；不完整、讀取失敗或到期先明示並重試，不能把半份輸出偽裝全量。離線匯出限於仍有效、已授權且可證明完整的本機資料；否則停用並說明。零筆不產生空成功檔；超量／儲存空間／下載不支援給可操作錯誤，不改原資料。檔案大小／筆數上限須依實際筆記上限與記憶體測量定稿，不先憑空承諾無上限。

產生後、交給瀏覽器下載前，重查同binding、有效資格與當下load/session gate；切帳號、撤銷、到期、revision切換或卸載使舊工作失效。釋放暫存 Blob URL；不把匯出放進 SW/公開cache，不上傳伺服器、分析或第三方。一般瀏覽器另存完成後的本地檔案無法由登出遠端收回，入口需一次簡短說明檔案含個人筆記。

## 3. P3-R2 命名書籤

### 使用者流程

在當前可見句／章節建立命名位置，命名可編輯；建議預填章節名，長度、Unicode計數、數量上限與重複名稱語意待定稿。書籤列表提供跳轉、重新命名、刪除與空／載入／失敗狀態；不要擴成新常駐工具列或把書籤偽裝成筆記。未儲存名稱離開需有一致處置；跳轉、切頁與刪除沿用站內確認/焦點規則。

定位保存語意 anchor、原文件 revision 與原版頁碼 fallback；不可只記 scrollTop 或 DOM座標。不同閱讀模式、字級、旋轉仍定位同內容；目標失效不跳無關句，呈現需重綁，使用者明確選定新位置才更新。更新後名稱與新版目標可預覽。未知版本不能自動搬到另一版別／語言，即使期數相同。

### 所有權與持久化（實作阻塞）

帳號、edition、documentId、documentRevision為必要隔離維度；與閱讀進度、筆記、畫線分開，不把setProgress當書籤存放、也不拿假note代替。原API／SDK是否已有書籤能力需查 hhc-web-api 與 frontend-platform 原始契約，本輪沒有查證，故不得定義成「前端加欄位即可」。

推薦方向為跨裝置私人書籤，由 hhc-web-api 擁有並經既有SDK／gateway讀寫；這是待決策建議，不是確認存在的 endpoint/schema。若要支持，必須先寫 producer/SDK 契約spec（CRUD、穩定ID、CAS或等效衝突處理、idempotency、權限、limit、revision遷移、資料刪除／登出／到期、離線policy與相容性），評估是否需要DB migration，再分repo PR/CI並依producer→SDK→consumer順序。不得在本spec悄悄擴大資料層實作授權。

如決策改為裝置限定，需明確標示「僅此裝置」、account-bound儲存與刪除生命週期，不稱跨裝置同步，也不先偷做localStorage版。跨裝置或裝置限定須在spec選定一種並寫完整驗收後才可做plan；目前不能以方便為由任選。

離線可讀／可建／可改／可刪各須契約決策；未支援時精確停用並保留已存在資料，不做無法同步的樂觀成功。書籤一旦可寫，要與第一階段實際工作gate及帳號epoch協調，不能新增並行私人寫入旁路；錯誤保留原名稱／目標，可重試／衝突復原，不覆蓋較新跨裝置版本。

## 4. 保留但未納入首批的候選

| 候選 | 來源／價值 | Deferred原因與重啟條件 |
| --- | --- | --- |
| 刪除Undo | 原第4席建議，降低誤刪 | 先確認伺服器刪除／restore契約與CAS、離線 tombstone/queue語意；不能以舊note與新ID冒充復原。需獨立spec與接受條件 |
| 長期自動草稿 | 原第4席建議；現已有短期account-bound return-state | 先量測實際遺失場景、保留期/撤銷/個人資料暴露需求，避免重做第二個私有儲存庫；需與第一階段策略一致 |
| 逐筆同步徽章 | 原第4席建議；現已有SyncStatus | 先證明有逐筆可靠狀態及查找價值，取得低密度面板設計，不憑 optimistic state 宣稱已同步 |

## 5. 驗收與視覺護欄

| ID | 案例與必要證據 |
| --- | --- |
| P3-A1 匯出範圍 | 本期全部/目前篩選、不同期/edition/locale/account、不完整/零筆/失敗、無草稿副作用；自己的文字與既有引用範圍正確 |
| P3-A2 匯出內容安全 | 中日韓/emoji/全形/換行/Markdown特殊字元/HTML/惡意link/檔名輸入、缺anchor/revision、超量、Blob釋放；不含token/私有URL/整期正文 |
| P3-A3 匯出時序 | durable待同步、unknown/conflict、快照後有新寫入、產生中切帳號/撤銷/到期/切revision/卸載、離線有效與到期；不自動sync，不下載失效快照 |
| P3-A4 書籤定位 | 建立/重新命名/刪除/空/重複/超量、紙本/易讀、字級、旋轉、原版頁碼fallback、目標刪除與重綁、同一期不同語言隔離 |
| P3-A5 書籤資料 | 所選持久化契約的真實producer/SDK/consumer回歸、CAS/idempotency或等效、離線能力、跨裝置衝突、登出/撤銷/expiry/epoch/late response；裝置限定方案不得假報同步 |
| P3-A6 可達性 | 桌面/平板/手機、明暗/五語、44px/鍵盤/focus/200%zoom/短viewport、下載支援；iOS檔案與真機IME/soft keyboard另驗收 |
| P3-A7 外觀與回歸 | 正常閱讀不新增常駐佔位；面板次要入口、空/錯誤/長列表/長名稱的baseline/candidate由兩位Codex實際看圖；保留既有正文/PDF/畫線/草稿/復原契約 |

瀏覽器可觸發下載不等於使用者已在真機保存成功；單機mock不等於跨裝置同步已成立。匯出一旦產生本地檔案，產品無法遠端撤回，須精確說明。

## 6. 實作前未決事項

- O3-1：匯出引用權利、格式、來源連結、資料完整性與durable快照如何取得；部分資料不能標全部。
- O3-2：匯出最大筆數／檔案大小與中低階手機成本；iOS下載/檔案支援；不支援時的可操作訊息。
- O3-3：書籤跨裝置 vs 裝置限定的產品決策、名稱/數量限制、既有producer/SDK能力與ownership；未查前不建schema。
- O3-4：書籤revision遷移／失效目標／重綁、離線與衝突/冪等契約、帳號刪除與資料生命週期。
- O3-5：跨repo部署順序與向後相容，consumer不能先依賴未發布契約；功能旗標/回退策略及第二階段實際依賴。
- O3-6：所選設計的低密度方案、合成baseline、實機驗收資源與每個新增可寫caller的gate整合。

本輪只補需求文件。下一輪先調查並解決阻塞、修訂spec，由兩位Codex檢驗後才寫plan；plan再兩席檢驗。任何實作仍需依最新授權逐步雙席檢驗，PR/CI完成後停在merge前；不執行正式資料寫入或部署。


## 7. F0 調查 checkpoint（未定稿）

2026-10-19使用者授權接續調查。兩位Codex查最新API b072123、SDK044232c、Gateway2fe7165；完整notes可由現有全量private state取得，但無全文件總筆數上限，必須另設匯出資源界限，且durability依成功load與IDB queue證明。waiting不是durable的同義詞。sent === true或result/replay/resolution/recoveryReason阻擋；sent === false且無復原標記的已提交queue可包含並標待同步。

目前未找到引用匯出授權或來源URL的語意deep-link契約；不得把copy能力與假造#sentenceId當證據。可以採已核對的HTTPS期數連結及純文字來源位置。匯出是否保留quote已送使用者選擇，未收到回覆前不刪減D1需求或實作下載。

目前沒有bookmark state/kind。跨裝置方案需API資料表及CAS/冪等/遷移/DSR、SDK與consumer相容變更；現有Gateway state/mutation路由可沿用。推薦首版線上CRUD、離線僅讀已確認快照。裝置限定若被選定，應獨立account/document/revision持久集合，不能塞進會被cloud refresh替換的replica，亦不能用30分鐘return-state。

書籤跳轉不得默默使用閱讀模式同頁/章節fallback；僅exact target可直接跳轉，失效明示需重綁。跨裝置vs裝置限定已向使用者詢問，產品選擇未收到；本checkpoint不代表spec實作就緒。名稱/數量/重複語意、revision及offline策略由選定方案的下一版spec明確定案並雙席檢驗。

跨repo順序producer→已發布SDK→consumer正式registry驗證；停merge前不得偷publish或把local packed候選當已發布。尚未寫implementation plan或產品碼。
