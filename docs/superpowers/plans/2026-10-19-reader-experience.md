# 第二階段閱讀體驗實作計畫

日期2026-10-19，P1。依據 [S2 spec](../specs/2026-10-18-reader-experience-design.md) 第7節定案；spec及plan雙席已處置完成，T0–T3各雙席通過；T4本機整合與兩席檢驗通過，提交checkpoint待PR/CI。使用者已授權逐步實作，最終PR/CI停merge前。

## 範圍與基底

feat/reader-experience-20261018，獨立worktree，origin/main 1215fcc + PR234 5d6e027 + PR235 29cb626（整合9c2b414）。保留原PR不變。產品僅hhc-web；不改sharedUI/API/SDK/server schema/鎖定依賴，第三階段不在此計畫。新local save instance為舊IndexedDB的optional欄位，不升DB version，不建立新queue。

## T0 基準與依賴（產品碼前）

- [x] 用現有合成preview fixture，保留第一階段功能；使用固定account/document/note與font-ready/visible-paper等待。保存三裝置390×844／768×1024／1440×900 × light/dark正常／list／editor共18張，另保存每裝置明暗目錄／搜尋（提交合成query）12張，及正文、toolbar邊界量測；baseline取整合9c2b414；fixture列表包含筆記、有效畫線與歷史三類合成資料。既有proposal18張只算概念，不算baseline。
- [x] 檢查已安裝UI1.0.76 Tabs/renderer exports與本地Next use-client guide，保持現有同源／授權與immutable template驗證。
- [x] T0兩位Codex只讀實看圖與來源記錄，處置後才T1。

## T1 分離裝置與閱讀模式（P2-R1、R5）

- [x] 在workspace.ts增加read/write mode小函式：`${storageKey}:mode` = paper/easy，非法/缺值null；失敗不阻閱讀。Reader一個可空偏好state，effective reflow=explicit easy或未指定時mobile；mobile只決定外殼、輸入選取、Chrome/Drawer/觸控尺寸。mode跟同account/document/revision的position key清除規則一致。
- [x] 逐項分類WeeklyReader mobile：render/章節／sourcePageStart exclusions／搜尋範圍／linefit／progress observer／RangeHighlights layoutKey／NoteIndicators形狀由reflow；工具列Chrome/selection strategy/native pinching/suspension由mobile。ReaderSearch沿用mobile prop時明定其是隱藏政策或另加reflow prop；不偷偷改其他caller語意。
- [x] 檢查CSS：外殼responsive media query保持；Ebook字級/行距/正文shape用data-reading-mode，不套手機紙本。desktop easy有可讀max-width與原typography；紙本維持現有正常幾何。觸控sentenceState.selected仍依裝置；Ebook selectable只在觸控適用時啟用。
- [x] 目錄panel加兩態模式控制；easy字級/行距、手機paper zoom/direction收既有panel；桌面paper保持原zoom/direction，easy不顯示無效paper控制。保留chapter+PDF導航及既有void/Promise callers。移除Ctrl/Cmd +/- preventDefault，瀏覽器可自行縮放。
- [x] navigation.ts新增最小純fallback resolver與DOM可見anchor擷取（若只一caller則局部函式）；anchor含sentence/component、scalar start與source page，對跨頁同句依fragment定位。切換通過既有dirty/operation gate並再次驗generation/binding/mount/allowAction/mode；取消保持不變。先same anchor offset，後同來源頁visible fragment，最後原component章首+局部提示。不能把隱藏anchor直接當success。
- [x] 切換只改本地呈現、不發private mutation；抑制模式轉場造成的程序式scroll progress，真實後續捲動才record。未明選的responsive切換亦保留語意位置。模式偏好不寫服務端。
- [x] 測workspace corrupted/storage拒絕/帳號隔離，navigation同句跨頁offset/hidden/fallback，WeeklyReader四組合/dirty取消/一次切換/invalid binding/selection與Ctrl/Cmd。既有renderer/template/畫線/章節/搜尋/first-save測試回歸。
- [x] focused：workspace/navigation/text-range + PaperViewport/WeeklyReader/useReaderSelection。tsc/lint；拍三裝置明暗正常+mode設定、desktop easy/phone paper與short viewport。T1兩Codex，一位看資料/定位，一位實看baseline/candidate與caller；阻塞處置後才T2。

## T2 筆記分區與查找、正文搜尋（P2-R2–R5）

- [x] 抽出ReaderNotesList小元件承擔列表顯示state與現有UI Tabs，不把save/Recovery邏輯搬走；notes/highlights/history各自內容。僅notes==='list'掛載；原editor/delete-conflict/reanchor/Recovery不變。history restore編輯state提到list層受控或使用可保留掛載的TabsPanel（先確認現有house Tabs行為，不依賴預設保留），切tab不得默默丟選取；若不能保留則明確站內確認並留原內容。
- [x] 單段noteFilter由parent保留，列表顯示目前段落與顯示全部；切其他tab清note ID條件，不混sentence IDs。篩選state不改draft generation、不呼叫closeNotes，不打API或progress。query/色彩分tab記憶體、長度256、binding卸載清除；歷史獨立不納有效畫線搜尋。
- [x] NotesPanel加可見count/empty結果；HighlightsPanel可接query/color，先產生原scalar range的entries再NFKC比對引用、不重算寫入range；存在失效anchor時保留歷史/重連入口，不造假的空資料。notes與highlight的全部／條件交集、同步後結果重新計算，loading/error仍root唯一狀態。
- [x] ReaderSearch透過canonical component/title及現有chapter labels補label，有缺只用PDF頁碼；IME composition guard（ref及keyDown/submit邊界），native submit正常。保留常駐hidden aside與原結果scroll/導航hook；不建全域cache，不紀錄query。
- [x] 測純filter不mutate/generation不變、單段清除/切tab、NFKC繁簡日韓emoji/全形、顏色交集/空集合/資料更新、history編輯保留或取消、editor/Recovery不可由tab繞過、搜尋chapter/IME/reopen scroll/一次跳轉。
- [x] 五語同步新增keys，不改舊語意；CSS只面板內44px/wrap，Tabs完整鍵盤，短viewport整體捲動。focused元件+WeeklyReader+locale parity、tsc/lint；三裝置light/dark實際list各tab/search/error/長文與對比圖。T2兩Codex資料/互動與視覺/可達性審查，處置後才T3。

## T3 剩餘站內確認與離線刪除保護（P2-R6）

- [x] 擴現有reader單一決策入口為可明確傳title/description/confirmLabel的局部interface；保留confirmNote的相容wrapper與generation/mount/allowAction/exit互斥，不另做全域dialog manager。確認history clear與partial color由parent注入Promise callback；unmount/cancel必settle false。
- [x] HighlightHistory凍結history ID/revision，await confirm後檢最新entry、busy/suspended及binding，再產生一筆原kind mutation；pending必包含決策期間以防雙點。partial color凍結prepared/conflict/color，await後prepared identity仍相同才run原exclusive；取消/late response零mutation。保持原full-target覆寫警告與非partial路徑。
- [x] offline-store新增一個取得removal snapshot函式：同IDB readwrite transaction讀owner、pointer、目前save，舊save補local instance；收集實際刪除範圍所有revision private queues完整JSON fingerprint（排序key）、本tab relevant return raw fingerprint（不persist/log）；每次commitSave/Upgrade都產生新instance。
- [x] removeOfflineSave加optional expected（既有內部caller保持相容），同readwrite transaction比owner/pointer/document/revision/instance/全部queue snapshot。return只在本tab交易前/提交前/完成後同步比對；提交前漂移abort，完成後cleanup僅清仍匹配快照，絕不清新return。不能假稱IDB+sessionStorage原子，也不能保護其他tab尚未入列的memory/return。保留原全revision刪除範圍與notify。
- [x] OfflineContentPage本地AlertDialog記snapshot，loading/pending防重點；owner/binding/unmount失效，pending警告準確。expected漂移取消並reload列表供重新決策，錯誤不移除項目；supported鎖定／到期download仍可移除，不需重開私人讀取權限。現有auth owner filter不放寬。
- [x] 測三caller取消/確認/失敗/雙點/卸載/account/revision/busy drift；real IDB測same revision新save instance、任一舊revision queue改變、非空queue payload改變、epoch/pointer更動、return新稿不被清。remove其他caller與upgrade/offline tests回歸。斷言目標三處無window.confirm。
- [x] focused offline-store/session/contentpage + History/Recovery/WeeklyReader、tsc/lint；明暗各確認長文/強警告/錯誤實際candidate。T3兩Codex，資料原子性與UI/決策；處置後進最終整合。

## T4 整合、交付與停止

- [ ] 完整corepack pnpm test:run（含FontTools/Brotli與frozen template）、lint、tsc、build、perf:static、scripts/test-release-policy.sh、diff checks。build需既有Google fonts網路；限制本機測試worker避免資源競爭，不放寬timeout/斷言、不跳失敗。Docker/build/scan依標準CI。
- [ ] 對照P2-A1–A7與實際candidate，三裝置light/dark、四模式組合、五語長標籤、短viewport、200%瀏覽器縮放、鍵盤與empty/error/conflict。兩Codex最終整合檢驗含實際看圖；完成前處置Critical/Important。不把DOM代替視覺接受。
- [ ] 真實v1–v10文件／PDF correspondence、iOS/Android實體IME/soft keyboard/safe area/旋轉、螢幕閱讀器、真帳號同步與installedPWA若無證據明列未驗收。自動化與合成圖不代表可部署接受。
- [ ] 本phase PR以PR234分支為base（stacked）只呈現第二階段及必需文件；明列依賴PR234/235，將來依序合併時需refresh CI但本次不合併任何PR。更新roadmap狀態，保持第三階段未實作。推送feature branch，PR最新head所有標準CI通過後停merge前；worktree保留。

每步先實作/驗證，然後兩位只讀Codex獨立檢驗；同席可一次窄補查。不得在gate未處置前開始下一步，也不要求user重複批准已授權工作。所有結果追加[gate record](../../reviews/2026-10-19-reader-experience-gates.md)，失敗、blocked與未驗收分開記錄。


2026-10-19執行補充：T0–T3勾選代表程式／focused驗證與兩席處置完成；T1原列short viewport合併在T4執行。T4原生200%快捷鍵與無橫向溢出已量測，但截圖工具只擷取720×336，完整底部操作列未驗收；真機與實際文件/PDF接受仍未完成。
