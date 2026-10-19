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

## T1 API／SDK實作

API分支feat/reader-bookmarks-20261019，b6143e8a6ef6844beed0d0e63b49ea55b062d828，draft PR https://github.com/HallelujahHomeChurch/hhc-web-api/pull/265 。SDK分支feat/reader-bookmarks-sdk-20261019，0e6d29c77f58574841a3b446f7ac74c4882f2c0a，draft PR https://github.com/HallelujahHomeChurch/frontend-platform/pull/138 。兩者OPEN、mergedAt null、autoMerge null；CI執行中，不是release。

兩席p3_t1_data／p3_t1_contract初查各一Important，root修正後原席唯一窄複核均PASS。資料席要求UUID identity與PG canonical一致，現在驗證後正規化bookmarkId但不改原mutation fingerprint；純unit及獨立PG測大寫create、compact rename、大寫delete、braced tombstone conflict PASS。契約席要求SDK真實保留CAS，已在producer schema明確create baseVersion:false、其餘required integer，生成後create為never其餘number；4正向／4負向型別contract PASS。另補real HTTP→service→PG書籤持久化／replay／撤銷測試PASS。

SDK完整workspace build/test/lint、7 package contracts、generated無漂移、pack及真實packed Vite/Next consumer builds PASS；無套件發佈、正式package pins未變。API targeted race、隔離PG concurrency／CAS／dedup／DSR count／cascade／fence、migration constraints、go vet、OpenAPI（既有25warnings）、migration／release政策PASS。第一次全套因新worktree缺既有converter dependency失敗，依CI npm ci後5tool tests及onlinebulletins race重驗PASS；修正中的舊run另有舊production／新alias test編譯時差，已以固定head最終全套取代。目前最終go test -race ./... -count=1 -p=1仍執行，T1未進T2，最終結果待補。

T1 gate完成：exact API b6143e8之CI39151345044三組Go core/storage/contracts及verify_policy均SUCCESS；SDK本地完整驗證PASS，兩席Important均窄複核PASS。API本機最終postgres221.961s PASS，其餘尾端套件仍續記；未把未完成本機總run稱PASS。原生renderer／image與SDK CI仍屬T4交付追蹤。開始T2。

T1最終證據：本機完整go test -race ./... -count=1 -p=1以固定source完成，所有套件PASS。API PR265 head b6143e8 CI39151345044全部SUCCESS（含image/native renderer各shard/verify）；SDK PR138 head0e6d29c CI39151361617全部SUCCESS（prepare、三組renderer、verify）。兩者仍draft OPEN、mergedAt null、autoMerge null。

## T2 個人筆記匯出

兩席p3_t2_snapshot／p3_t2_ui各發現1 Important，root修正後原席唯一窄複核均PASS。資料席：移除不在allowlist內的canonicalMetadata.title，no-leak sentinel測試包含CMS標題；只有自己的text與系統來源位置。UI席：匯出modal冒泡翻頁鍵會誤觸正文，root keyboard handler在exportRequest存在時停止處理，整合測四種翻頁鍵modal保持、沒有mutation PASS。

實作：成功load provenance；同IDB transaction讀owner/epoch/key/save instance/access/state/confirmed/fullqueue，重播一致性與未知/復原標記阻擋；prepare及最後download重驗，無flush/retry/sync/mutation。Markdown動態fence、200筆/8MiB整份拒絕、受控HTTPS來源/檔名，不含quote、CMS標題、receipt、token/account。house Dialog、兩階段準備/下載、五語及本機待同步標記，正常正文無新常駐控制。

固定source本機完整176檔1404測試+8node檢查PASS；tsc、production build、static budgets PASS（CSS194892 bytes），lint零error/既有LegalRequiredNavigation warning；release policy PASS。修正前交錯編譯的舊run已停止並由final run取代，不把舊run失敗算PASS。targeted21+builder5+root keyboard1另有PASS證據。

真實元件合成本機預覽開啟列表→匯出→準備，DOM確認1筆ready，保存export-desktop-ready.jpg；無正式資料。後續browser download事件等待超時並重置工具，未取得檔案落盤證據，不能宣稱下載或Files接受。T4仍需實看三尺寸明暗/五語/短viewport與實際操作；目前僅此桌面準備圖。可進T3，保留T4與真機gate。

## T3 書籤 consumer

獨立worktree reader-bookmarks-consumer-20261019，branch feat/reader-bookmarks-consumer-20261019，從fresh origin/main1215fcc建立後FF9009179；產品commit636c9e4已push。package.json / lock不變。SDK tgz SHA dc4c6162fe5542a2dd9e9169802683530e89418ba6ef479dc3ce55cdbda5c221，僅替換ignored node_modules候選；Turbopack不接受外部temp symlink，移到node_modules內的候選extract後build通過，無產品設定補丁。

兩席p3_t3_data／p3_t3_ui初查共3 Important。資料席指出舊GET／note ack會覆寫新書籤tombstone；共用retainNewerBookmarks涵蓋seed／ack／bookmark merge，測延遲逆序並保留note queue。原席窄複核PASS。UI席指出筆記儲存會丟失隱藏書籤草稿及表單卸載焦點消失；finishNoteEditor保留草稿、initial Tab復原，原席窄複核確認草稿PASS，但滿100 Add disabled仍需fallback。root補enabled row action／section fallback及99→100 busy→false回歸；最後兩席各自獨立確認此修正PASS。沒有把該原席CHANGES_REQUIRED抹成PASS。

固定來源完整179檔1423測試+8node checks PASS；type/lint/build/perf/releasepolicy PASS，lint僅既有LegalRequiredNavigation warning，CSS195547bytes。修正中的舊mixed-source run不列入PASS。source與測試未在最後全套執行期間變動。

## T4 視覺與交付

p3_t4_delivery PASS；p3_t4_visual初查唯一Important為200%截圖未含Download底部，root補原生Zoom200／完整Download及鍵盤focus證據，原席唯一窄複核PASS。兩席都真看baseline/candidate及指定新UI圖片，未執行測試。沒有新增第三席或Gemini。

三尺寸明暗正常正文與長名、五語短畫面明暗form/export、empty/dirty/house delete/conflict/offline/legacy均有合成fixture畫面；正常六組與Phase2 immutable baseline的max-channel差>30像素比為0。原生200%實際AX確認Download focus並完整入鏡，Return顯示交給browser；還原100%。完整證據及限制在 [candidate evidence](reader-value-features-20261019/README.md)。桌面實際檔案1057bytes已保存、noquote/CMS title斷言PASS；download event timeout不再當阻塞，但不擴張成真機Files接受。

讀回exact-head：API PR265 b6143e8 CI39151345044、SDK PR138 0e6d29c CI39151361617、Web匯出PR237 9009179 CI39196694373全部SUCCESS，皆draft OPEN／mergedAt null／autoMerge null。Consumer636c9e4僅source branch與packed驗證可review，未開一個明知缺已發布SDK的PR。保留producer→published SDK→consumer exact registry pin/CI gate。

最終停止merge前；未merge/tag/publish/deploy，無正式帳號資料寫入。保留所有未合併worktree／branch。真機iOS/Android IME／Files、PWA、safe area／旋轉、screen reader、真帳號跨裝置及真v1–v10/PDF仍是獨立接受項，不能用本機fixture或CI代替。

## 依賴整合前置更新（04:37 UTC）

使用者要求優先釐清收尾，仍保留merge前停止點。兩席依賴核對找出SDK1.0.76與既有正式版本碰撞；root在SDK feature分支整合最新main11464e8，協調8個manifest為候選1.0.78，commit8c5fcdc已push PR138。兩席修正複查PASS；完整本機workspace/build/test/lint/generated/contracts/pack/real packed Vite+Next及9個renderer gate tests PASS。新CI39200281237仍進行中，舊head的CI39151361617不代表此新head通過。未發布／未改consumer正式pin，完整順序、版本斷言與授權／實機缺口見 [dependency checkpoint](2026-10-19-reader-dependency-integration.md)。

依賴前置最終結果：SDK8c5fcdc的CI39200281237五項（prepare、legacy／v7-v8／v9-v10、verify）全部SUCCESS；consumer只在ignored node_modules使用新packed1.0.78，固定source再跑179檔1423測試+8Node及type/lint/build/perf/policy全部PASS。七個registry與v1.0.78 tag在可用性快照均未占用，發布前仍須重查。正式consumer manifest/lock/version assertion仍為1.0.75，未把本機候選說成registry整合。仍需API→SDK合併／tag發布的新授權；這輪未合併任何PR或發布。
