# 第三階段：閱讀加值功能規格

2026-10-19，S2，兩位Codex實作就緒檢驗PASS。使用者已明確選定「跨裝置書籤，含API/DB/SDK與前端」及「匯出只有自己的筆記文字與來源位置，不附週報引用」。本規格取代D1/D1.1未決選項；[F0證據與逐步紀錄](../../reviews/2026-10-19-reader-value-features-gates.md)。每一步雙席檢驗，最終停merge前；無正式資料寫入或部署。

## 1. 範圍與依賴

Web以第二階段PR236之8974b886為依賴，保留PR234/235/236；新分支feat/reader-value-features-20261019由fresh main1215fcc建立再FF236。跨repo producer以API b072123、SDK044232c、Gateway2fe7165為調查基底；實作分支須再次fetch確認最新main與獨立worktree。只變更hhc-web-api、frontend-platform及hhc-web；Gateway沿既有exact受保護state/mutations路由驗證，不新增route。

首批為Markdown筆記匯出、命名書籤。沒有整期正文/引用/PDF匯出、匯入、公開分享、Email、AI摘要、長期自動草稿、Undo或第二套同步queue。保留既有receipt、account/epoch/revision/DSR、CAS、UUID冪等與immutable renderer。

## 2. P3-R1 匯出自己的筆記

### 入口、內容與文字安全

僅筆記Tab列表內次要「匯出筆記」；不加正文常駐控制，不出現在編輯器。對話框預設本期全部，若有文字/段落篩選可選目前篩選，兩者明示非刪除筆記數；不跨期/edition/locale/account。列表把當時可見note IDs傳給root，不把篩選state搬進私人同步層。

Markdown UTF-8，包含固定系統欄位：期數、版別、內容語言、document revision、匯出ISO時間、筆記數、每筆自己的text、保存時間、來源章節/PDF頁碼與本期reader HTTPS連結。**不輸出note.quote、ranges內quote、inactiveAnchors文字或任何其他週報正文。** 使用者自己寫入text的內容原樣保留；不猜測其文字來源。

所有不受信任文字（包括標題、章節標籤、筆記）放進無語言標籤的動態長度反引號fenced code block：delimiter至少3且長於內容最長反引號連續段，單獨占行；不把文字插入HTML/Markdown link語法。系統來源URL另行生成，固定https://www.alive.org.tw加受驗證的locale/正整數期數/series/contentLocale reader路徑，不含token、receipt、account、query或假造#sentenceId。現有reader沒有語意URL deep-link契約，因此不聲稱連結直達原句；PDF頁碼與章節為純文字來源位置。

可解析的note ranges以原始scalar範圍對應manifest fragment/source page，無range用既有sentence對應。被刪除/隱藏/跨revision/需重綁或無法證明時寫「來源位置待確認」，不跳到同頁其他句也不補全文。檔名固定安全結構hhc-notes-期數-series-contentLocale.md，不含個資或不受信任標題。

### 完整性、durable快照與時序

producer的state是同account/document全量notes，無cursor/LIMIT且rows.Err使請求失敗；只在已成功載入、state綁定正確、非busy/loadError/paused/suspended、無pending未知操作、無conflict/recovery時可匯出。不可只依waiting/synced或樂觀畫面推斷。

新增唯讀快照路徑，沿現有hook單一exclusive/生命週期gate，取得前不flush、不retry、不送mutation。讀取中的新私人操作序列化；遇已有未完成操作就明示等待，不由匯出啟動同步。沒有有效本機save時使用已成功完成的雲端state。若有有效save且含本機變更，使用同一IDB transaction取得owner epoch、pointer/save instance/revision、confirmed/state及完整queue；不因讀取失敗回退成看似「全部」的雲端舊資料。

本機快照僅在queue entry全部sent === false且沒有result/replay/replayResult/resolution/recoveryReason時可用；存在任一上述未知或復原標記即阻擋並提供既有檢查同步入口。已提交的create/edit/reanchor note對應ID標示待同步，已刪除note不輸出；queue只有其他類型變更時不冒稱筆記待同步，但說明來源是本機快照。confirmed與state若無法證明一致binding或完整性則阻擋。舊版replica若沒有可驗證的完整state，不宣稱全部。

凍結account/document/revision、receipt/session與hook generation、note IDs/versions/文字/來源、全queue及本機owner epoch/instance。產生後、觸發下載前，再檢查目前binding、allowAction、mount、資格、busy/loadError/unknown與notes/queue快照；跨tab IDB漂移亦拒絕。帳號切換/登出/到期/撤銷/文件更新/卸載/新筆記變更令舊快照失效，保留原資料並要求重新匯出。有效離線save允許同規則匯出；到期/clock rollback/locked不可。

不含未儲存editor draft，入口簡短說明；不清草稿或history restore選取。匯出檔含個人筆記，下載後登出不能收回；對話框一次說明。零筆不產生空檔。

### 資源與下載

上限200筆、輸出8MiB UTF-8，檔案整份超限拒絕、不截斷；可回列表縮小篩選。單筆仍沿既有10000 Unicode上限，匯出不改寫入限制。按筆數及受控字串大小先拒絕，再逐段計UTF-8/累計bytes，超限立即停止，不先組合無界大字串。最壞合成200×10000 emoji約8,003,691 bytes，反引號約6,002,891 bytes；[容量探針](../../reviews/reader-value-features-20261019/export-capacity-probe.json)只是Node序列化量測，不代表手機memory/Files接受。

先在站內對話產生快照及Blob，準備好後顯示明確「下載」按鈕。按下後先做最後一次async IDB快照重驗，再同步重驗目前binding/資格/notes generation，並實際檢查navigator.userActivation.isActive（不支援驗證視為不支援直接下載）；只有仍active才在同一continuation觸發a[download]。activation已失效時拒絕下載並保留準備狀態、顯示重新操作/瀏覽器限制，不能進入自動重試迴圈或聲稱下載成功；不把長await後的動作假稱仍有activation。受控filename、text/markdown;charset=utf-8、Object URL。取消/失敗/卸載與下載交給browser後的適當延後清理皆revoke；不提前revoke破壞下載，不持續保留無期限URL。不支援Blob/URL/download時明確錯誤、返回可複製個人筆記，不偽造成功。只能說「已交給瀏覽器」，不能證明Files保存完成。無上傳、分析、SW/cache存放。

## 3. P3-R2 跨裝置命名書籤

### Producer資料與契約

hhc-web-api擁有獨立Bookmark及資料表bulletin_reader_bookmark；主鍵(account_id,document_id,id)，FK至既有migration_state ON DELETE CASCADE。document隔離已含edition/locale，不以相同期數跨文件查找。記錄：id(UUID)、name、sentenceId、offset(Unicode scalar)、pageId、documentRevision(目標來源版本)、version、deleted、reanchorRequired、createdAt/updatedAt。無quote，不保存DOM或scroll座標。新migration additive，不改舊renderer/schema資料；down不可由本任務對正式站執行。

State增加bookmarks array，新producer即使空也回[]，作能力存在證據；SDK欄位optional以相容舊producer。舊producer/舊offline snapshot缺欄位不是空清單，顯示需連線或服務尚未支援，不能新增。舊客戶端忽略新增response欄位；新mutation只由新client使用。

沿現有GET state/POST mutations、trusted actor、subject/DSR fence、publication/parent serialization、批次1–100與1MiB限制、mutation UUID+完整payload fingerprint及91天dedupe/90天replay期限。四種新kind：

| kind | payload | baseVersion |
| --- | --- | --- |
| createBookmark | bookmarkId, name, sentenceId, offset, pageId | 不可有 |
| renameBookmark | bookmarkId, name | 必須正整數 |
| deleteBookmark | bookmarkId | 必須正整數 |
| reanchorBookmark | bookmarkId, sentenceId, offset, pageId | 必須正整數 |

mutation.documentRevision必須等於目前可操作revision，沿原revision_changed/recovery_required語意。名稱trim首尾Unicode空白後1–80 Unicode scalar，保留內部字元，不強制唯一；重複名稱允許，ID區分。每account/document最多100個未刪書籤，父鎖內檢查，超限回bookmark_limit而非部分成功。offset必須0<=offset<句子scalar長度，pageId必須在canonical manifest存在同sentenceId且fragment.start <= offset < fragment.end的fragment；fixed-slot則依該slot的canonical來源文字及scalar區間驗證。create/reanchor共用此驗證，不能僅用Snapshot.SentencePages判斷「該頁含該句」；producer snapshot需攜帶可驗證的來源fragment區間。來源component由canonical sentence解析，不接受偽造quote/owner。bookmarks增刪改採clone不變更原state。

既有ID重建、版本不符、已刪除、找不到均回bookmark_conflict及目前bookmark（若存在），不覆蓋。Result增加optional bookmark。成功version遞增，delete清空name/anchor個資並留tombstone，createdAt不變；terminal結果與state同交易保存。較舊result重試回相同receipt，不以舊結果覆蓋最新collection；保留原client對response.state為最新狀態的處理。

新表納入readerPrivateCountSQL與帳號清理cascade/remaining/DSR fence測試；核對現有privacy/export所有caller，只有既有固定reader欄位投影存在時才補bookmarks，不創造另一個DSR服務。F0曾提到privacy export，但origin/main的online_bulletin_reader_privacy.go實際是trace lookup，不能當現成bookmark export入口。

### Revision與定位

首版保守策略：任何文件published revision變更，所有未刪且尚未失效書籤保留原name/anchor/documentRevision，設reanchorRequired=true，version遞增一次；不自動猜測跨revision映射。已失效的書籤不因多個中間revision重複遞增。rename可保留失效狀態；重新定位只能以目前revision下明確選定的新sentence/offset/page更新並清標記。不能直接使用resolveReadingAnchor的同頁/章節fallback。

同revision、同document且exact sentence/scalar/來源頁可證明時才跳轉。另一模式隱藏目標時顯示需切模式/選擇位置，不跳無關內容；可使用者明確切到紙本再跳同一anchor。字級/旋轉只改呈現不改bookmark。目標失效保持列表入口與名稱，顯示「需重新定位」，不默默刪除。

### 寫入、離線與衝突

首版online CRUD；offline只讀有效已確認snapshot，不建/改/刪、不排入離線queue。狀態顯示「離線唯讀」。所有新kind經同一usePrivateReader foreground/exclusive/timeout/unknown-id gate，不能獨立fetch旁路。保留原筆記/畫線queue、進度與retry行為。

送出前確認online、fresh支持bookmarks、同binding/資格、無既有unknown/conflict與durable queue待處理；有待同步內容先提示既有同步入口，不由書籤表單靜默丟棄或替換。新kind走既有executor中的online分支，跳過enqueuePrivateMutation；保存原mutation ID至既有短期return-state以便結果不明明確重試，validAction/Recovery須識別新kind。不另外建立queue。

有offline save時更新bookmarks已確認snapshot；保存時以同IDB transaction重驗owner epoch/pointer/instance/revision，只更新state/confirmed的bookmarks，保留其他tab新入列的notes/highlights/progress與queue；UI採合併後state，不把cloud整份覆寫本機pending資料。可用現有account sync WebLock與exclusive序列化網路工作，但不能只靠鎖假設其他tab不會enqueue。server已確認、local cache失敗時仍視server ack為已知，明示離線副本未更新，保留download/queue，不生成新ID重送或誤稱未存。

網路回應未知/逾時保留name與目標及原mutation ID；確認重試經既有入口。revision_changed必須保留原動作並進行明確人工重綁/新操作，不修改舊ID指紋；bookmark_conflict顯示雲端目前name/目標/版本與本機草稿，明確保留雲端或重新以最新baseVersion提交新ID，不盲覆寫。雲端已刪不能偷偷create復活。載入與單次save的late response不能關閉新表單、清掉新草稿或跨帳號發布。

### UI

沿現有ReaderNotesList側欄增加「書籤」Tab，Tabs可換行、44px、鍵盤。列表內次要「加入目前位置」，從目前可見exact sentence/scalar/source page擷取；留白/沒有可證明句子時請先選位置，不以同頁首代替。名稱預填可辨識章節名，無名稱用本地化「書籤」；80字顯示Unicode計數，重複允許。列表提供跳轉、重新命名、刪除、重新定位及空/錯誤/離線/上限/長名稱。

名稱/重綁表單沿站內dirty/operation gate；Tab切換採列表層受控draft保留（同既有history restore），不依賴TabPanel保持掛載，也不在單純切Tab時送出或清掉內容。關閉整個側欄、跳轉或換文件時才沿站內dirty確認。前後焦點回到觸發項，刪除共用站內單一decision入口。既有note editor、delete-conflict、Recovery保持完整流程；新Tab不能繞過。匯出與書籤入口均不增加正常正文/工具列常駐佔位。五語與明暗沿既有tokens/houseUI，不加依賴或新設計系統。

## 4. SDK、相容性與交付邊界

API OpenAPI為producer source，新增Bookmark/schema/kinds/status/result；frontend-platform複製對齊其SDK OpenAPI、generate types與client exports，check:generated與packed consumer驗證。版本依最新main確定，不事先假定registry已有新版本。既有reader方法/route不另造client。

順序producer migration/API→已發佈SDK→consumer精確pin/標準CI。使用者要求停merge前，因此不merge、不tag、不publish套件來解除依賴。API與SDK各自PR/CI；consumer匯出（不依賴新SDK）可獨立標準CI PR。書籤consumer以本地packed SDK完成真實元件/合約/型別/建置驗證並保存可審查diff；在新SDK尚未發佈時，不把未發佈版本或file/tarball依賴提交到正式package.json/lockfile，不把packed通過當registry CI。此發布依賴明列未完成gate，保留worktree與候選供merge後依序接續，不要求使用者改變停止邊界。

舊producer必須讓書籤UI停用；server rollback到舊版不刪新表或離線snapshot，保留名稱/待確認動作；只回報暫不可用。新producer對舊note/highlight/progress行為不變，DSR/權限/不可公開cache均需回歸。

## 5. 必要驗證

- P3-A1/A2：完整/篩選/零筆/超限/無quote/來源缺失；五語Unicode/emoji/全形/換行/backticks/HTML/惡意link/控制檔名；Markdown文字安全，檔案不含任何quote/token/receipt/account，Blob支援/釋放。
- P3-A3：成功load provenance、durable未sent queue、sent/result/replay/replayResult/resolution/recoveryReason阻擋、IDB/資格/epoch/instance/notes漂移、切帳號/到期/卸載、無sync/mutation/draft副作用；失敗不產出半檔。
- P3-A4/A5：四種bookmark操作、CAS/原ID冪等/改payload拒絕、100筆競爭、名稱80 scalar/重複、offset/source page（含同句跨頁offset在另一頁的拒絕案例與fixed-slot）、revision失效/重綁、account/edition隔離、DSR cascade/count/late writes；online-only不入queue、未知retry/衝突/網路/cache失敗/跨tab queue保留。
- P3-A6/A7：三裝置明暗、五語長標籤/長名稱、正常正文baseline/candidate、keyboard/focus/44px/短viewport/200%；兩席實際看圖。不用DOM替代視覺接受；真機IME/Files/safe area/旋轉/螢幕閱讀器/真帳號跨裝置及真實文件PDF另列未驗收。
- 各repo適用完整tests/lint/build/generated/contract/packed/CI，不繞過失敗。所有實作步驟兩席只讀，Critical/Important處置後才下一步。最終PR exact head、CI、OPEN/unmerged及未滿足發布依賴由兩席獨立讀回。保留所有未合併worktree。

## 6. 已決與保留

O3-1、3產品選擇已獲使用者「可以」；本規格定案格式/來源/完整性、上限、名稱、持久化、revision與offline策略。O3-5發布依賴已明確，停merge前保留SDK發佈與consumer registry gate。O3-2/6真機資源與接受仍未有證據，不假稱完成；各步先保存合成baseline/candidate。
