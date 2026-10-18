# 第三階段閱讀加值功能：逐步檢驗紀錄

2026-10-19。使用者授權接續第三階段；每一步兩位Codex檢驗，spec→plan→實作→PR/CI，最終停merge前。沒有Gemini新請求、正式資料寫入或部署。

Web獨立worktree reader-value-features-20261019，分支feat/reader-value-features-20261019；由fresh origin/main1215fcc建立，再FF第二階段PR236的8974b886。第二階段PR236已讀回CI39147673697 SUCCESS且OPEN，原分支與worktree不變。主checkout有既有未提交文件，未改動。

## F0 可行性調查（兩席完成，需修訂D1）

兩席均唯讀，未跑程式／測試或讀正式筆記。跨repo以fresh origin/main查證：API b07212305b1b3852f4910af2f94856cb42438896；SDK044232cf4e68840b00a69dcaaa029188e562fabd；Gateway2fe7165ca38d3ecbc6f4f16c26ce72e6275a2bf9。既有主checkout在其他分支，缺字不能當最新契約不存在。

### Codex p3_export_feasibility

CHANGES_REQUIRED，工程可行但D1不得直接當實作就緒。

1. 引用匯出權利未確認。ReaderAccess無copy/export capability，ReaderDocument.download是PDF動作；ASSET_RIGHTS只有指定圖片與字型，copy.ts不能證明引用下載權利。待使用者選只匯出自己文字或明確允許已保存引用。
2. producer bulletin_reader_state.go:60–92是完整account/document全量notes讀取，無LIMIT且rows.Err失敗；SDK client.ts:437–441無cursor。每筆10000 Unicode/500 anchors，沒有總筆數上限。UI waiting/synced不可證明durability；必須依成功load provenance及IDB confirmed/state/完整queue快照。queue entry的sent === true，或存在result/replay/resolution/recoveryReason時阻擋匯出；sent === false且無上述復原標記的已提交durable queue可包含，並標示待同步；不觸發sync/mutation，不把部分輸出標全部。
3. 現有workspace.ts只有reader期數路徑，沒有已驗證hash/query deep link契約。首版可輸出受控HTTPS期數來源與純文字章節/PDF頁碼，不生成假的sentence URL。Markdown使用動態長度fenced文字，controlled檔名、大小上限整份拒絕、下載前重驗binding/資格、Blob URL釋放；瀏覽器接手不等於真機Files已保存。

### Codex p3_bookmark_feasibility

F0只讀完成，三項Important待spec處置。

1. API State／mutation與SDK沒有bookmarks。跨裝置需獨立bookmark model/table、既有state/mutation擴充與SDK/consumer，共3個變更repo。Gateway現有exact受保護GET state/POST mutations路由可沿用，不必新route。必須涵蓋DSR count/privacy export/cascade cleanup，不能只做CRUD。
2. resolveReadingAnchor會同頁／章節fallback，不適合直接當書籤跳轉。可以重用可見anchor擷取與scalar/page，但失效只能明示需重綁，不跳無關句；revision只採可驗證映射或明確重綁。
3. 裝置限定不能塞進server replica state/confirmed，會被refresh整體替換；若選此方案需獨立account/document/revision collection並沿既有IDB/epoch/purge/exclusive，不建立同步queue。return-state是30分鐘per-tab復原，不是持久書籤。

跨裝置可沿既有UUID+payload fingerprint冪等、parent serialization與version CAS；首版建議online CRUD、offline僅讀已確認快照。名稱長度、每document上限、重複名稱、revision重綁策略由後續spec明確定案。低密度UI沿既有側欄Tab與面板內次要入口，不新增常駐正文toolbar。

## F0調查時待決策（後續已批准）

F0 checkpoint曾向使用者詢問兩項：跨裝置（含API/DB/SDK相容變更）或僅此裝置；匯出是否附已保存引用。當時未收到選擇，不把預選當批准。其餘可獨立進行的調查與證據已保存；尚未改產品碼，也未寫實作plan。

## 發布依賴

跨裝置方案的相容順序是producer→SDK發佈→consumer精確pin。各repo分支與PR/CI獨立，不能靠未發布SDK宣稱consumer正式registry驗證已通過。停merge前時，保留尚未滿足的發佈gate及本地candidate證據；不偷merge／publish套件來解除依賴。


F0整合窄複核：p3_bookmark_feasibility PASS；p3_export_feasibility要求精確區分sent欄位存在與sent === true，root已按原席指定修句，保留正常durable待同步可包含。兩席原調查Important均已記錄；該checkpoint的引用與持久化產品決策尚待回覆，當時未進S2/plan gate。


## 使用者產品決策與S2

使用者已回覆「可以」，明確採跨裝置書籤（含API/DB/SDK/前端）及只匯出自己的筆記文字與來源位置、不附引用。root重寫S2，工程定案online-only CRUD/有效離線只讀、80scalar/100active/revision一律明確重綁、200筆/8MiB輸出與durable快照。

p3_spec_data初查PASS；p3_spec_ux實看4張既有候選，Important為source page含句子卻不含offset。root補canonical fragment.start<=offset<end及fixed-slot來源驗證、跨頁錯頁拒絕案例；另明確最後async IDB重驗後檢實際userActivation，失效拒絕，不虛稱gesture仍在；Tab draft統一採列表受控保留。S2原兩席窄複核均PASS：p3_spec_data維持PASS，p3_spec_ux確認跨頁offset Important解除。兩席均未執行程式／測試；activation／Files及真機接受仍保留。root同時納入queue的replayResult標記，不將其視為安全未送出資料。可進plan gate。

## Plan gate

p3_plan_data、p3_plan_ux兩席獨立只讀PASS，均抽查實際caller；無Critical/Important。資料席核對parent serialization／DSR count／queue merge及發布邊界；UX席核對root dirty gate／fallback resolver／controlled draft與視覺矩陣。未跑測試，不代替T1–T4實作檢驗。root開始T1。
