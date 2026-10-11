# 網頁版週報閱讀器互動優化計劃

> **For agentic workers:** 使用 superpowers:executing-plans，依序實作並驗證；本計劃不授權自行派遣子代理。Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修正手機搜尋第一次點擊失效與跑版，維持正文寬度，補齊載入與離開確認，讓桌面、手機網頁及 PWA 的閱讀操作一致且可靠。

**Architecture:** 以既有 hhc-web 閱讀器為唯一修改入口，保留電子書重排、桌面紙張、原文定位與私人筆記資料模型。修正會話驗證與搜尋導航的時序，復用現有 UI、進度保存與授權邊界，不新增服務或依賴。

**Tech Stack:** TypeScript、React、Next.js、既有 @hallelujahhomechurch/ui、Lucide、Vitest、Testing Library。

**Spec:** 本對話截至 2026-10-12 已確認的需求，完整整理於下方「需求與驗收基準」。

**審核修訂：** 已補齊搜尋事件被 guard 攔截前的完整啟動辨識、單一離開確認與延後清理、請求超時及有界進度同步、筆記標記與正文定位 DOM 的隔離。checkbox 表示整項驗收（含實機），不以桌面模擬代替實機。

**實作進度（2026-10-12）：** 任務 1–5 已實作；獨立審視提出的重複導航、重驗證時離開框操作、手機標題筆記列三項問題均已用回歸測試重現並修正。全套 142 檔／1,133 個測試、正式 build、Docker build、靜態效能與發布政策檢查通過。桌面與手機瀏覽器模擬已核對搜尋面板、單次結果跳轉及取消返回保留位置；CI/CD 與正式 smoke 依序進行。手機實機搜尋與瀏覽器返回仍待驗收，不宣稱全平台验收完成。短期搜尋意圖另外抽成 hook；離開 hook 接收五語文案，並共用既有 AlertDialog。原生返回僅處理同 URL guard 的正常單步返回。

## 全域限制

- 手機維持電子書重排；桌面與 iPad 保留既有紙張與換頁樣式，不改正文、字型、顏色、縮放與版型。
- 手機仍只透過箭頭按鈕換章，不恢復上拉／下拉換章。
- UI locale 沿用官網五種語言；週報 contentLocale 與授權維持獨立。
- 不修改 PDF、轉換規則、管理後台或已發布內容；1742 繁中與簡中不因本輪重新產生、發布。
- 不改變會員資格、授權期限、帳號隔離、離線政策或授權撤銷行為。
- 不以取消授權驗證、直接在 touchstart 導航或固定延遲來掩蓋第一次點擊問題。
- 共用 AlertDialog、ReaderIconButton 與現有色彩／間距；觸控目標至少 44 × 44 CSS px。移除被替代的搜尋 CSS 與事件處理，不疊加另一套流程。

## 需求與驗收基準

| 項目 | 預定行為 | 驗收條件 |
| --- | --- | --- |
| 手機目錄 | 封面、信息回應、小組詩歌、封底；「原始 PDF 頁面」改「PDF 頁面」 | 僅改 UI 文案，不改 cover/body/worship/back 識別值；從 PDF 頁面定位仍將目標第一行對齊閱讀區頂端 |
| 手機筆記標記 | 有筆記的段落尾端增加短小、靠右的獨立標記列；同一段落合併顯示筆記數量 | 不保留整篇右側 44px 空白、不疊在字上；有無筆記時正文左右邊界及換行一致；桌面標記保持原樣 |
| 搜尋面板 | 右側面板；手機全寬；返回與搜尋框同列固定，只有結果清單捲動 | 返回鍵不被捲走、結果不穿過頂列；鍵盤開／關、直／橫向均不遮擋操作 |
| 搜尋結果 | 一次點擊收起搜尋並跳到目標；必要驗證不得默默丟掉該次導航 | 不要求第二次點擊；正常結果跳轉不另取授權憑證；驗證失敗有明確提示，不執行過期目標 |
| 離開確認 | Header Home 與瀏覽器返回離開閱讀器時確認；週報換章不用確認 | 取消保留原閱讀位置、面板與筆記草稿；未存筆記合併在同一確認；確認後只離開一次，維持原返回目的地，不無限等待同步 |
| 載入狀態 | 閱讀區中央顯示 loading icon 與「正在載入週報…」；重驗證保留版面尺寸 | 不出現左上角單行文字或整頁塌縮；light/dark、ARIA、reduced-motion 均正常；失敗或超時可重試，過期回應不得解鎖內容 |

段落尾端筆記列是前輪分析的預設方案，不是既有產品行為。標記定位沿用私人筆記的原始 ranges，不能把桌面部分文字筆記擴成整句或改寫其範圍。

## 已確認證據與尚需釐清的時序

- 8.5 秒 iPhone 錄影：鍵盤已收起；約第 2～3 秒整頁變為左上角載入文字，隨後回到同一搜尋結果，後續再次點擊才跳轉。
- `AuthorizedReader` 在 `session.validating` 時對整個閱讀器套用 `hidden`／`inert`，並插入未使用狀態版型的文字。這可解釋整頁消失及左上角提示。
- `useReaderSession` 在 window focus、online、可見性變動及離線版本更新時重新驗證；操作 guard 在 validating 時拒絕事件。錄影未包含事件記錄，不能斷定是哪一個來源中斷點擊。
- 搜尋表單採 sticky 加負 margin，而返回按鈕位於另一個可捲動 header，可解釋返回按鈕消失與文字露在搜尋列上方。
- 手機也套用全域 `padding-inline-end: 44px`，因此有筆記時正文變窄。
- 搜尋結果目前只在 `onClick` 呼叫 onJump；若按下後驗證開始，ancestor guard／inert 可在 callback 前切斷事件。僅在 onJump 內新增待處理導航不能補回未到達的事件。
- `closeNotes()` 同時詢問原生放棄確認並清除 editor 狀態，不能直接當成共用離開確認之前的檢查。
- 現有 reader API 與 `flushProgress()` 沒有明確的請求超時；單純沿用 catch／retry 不能處理一直 pending 的請求。文字定位另依賴 sentence 容器的完整 textContent，筆記 UI 不能插進該容器。

## 優先審查情境

1. 點擊結果與會話驗證同時發生：完整點擊只執行一次；捲動、pointercancel、多指及鍵盤未完成啟動執行零次，也不在失效授權下顯示或操作內容。
2. 實機鍵盤、瀏覽器地址列高度及螢幕旋轉：搜尋頂列固定，跳轉不被第二次 resize 拉走。
3. 點擊後文件版本、帳號或目的章節改變：取消舊導航，不跨帳號／版本套用目標。
4. 返回確認期間有未存筆記、連續返回或永不回應的請求：只出現一個確認；取消不清草稿，確認不無限等待網路；載入超時可重試，晚到回應不覆寫新狀態。
5. 部分文字筆記、跨段／標題筆記與字型或裝置寬度改變：標記仍對到原段落，不進入正文 sentence 容器，不影響原文與 ranges。

## 實作順序

- [ ] 實作開始前，從最新 origin/main 建立本輪專用 branch／隔離 worktree，帶入本計劃；不使用或清理其他任務的 worktree，保留主 checkout 既有修改。

### Task 1: 搜尋與重新驗證時序

**檔案：** `src/features/weekly-reader/useReaderSession.ts`、`src/components/weekly-reader/WeeklyReader.tsx`、`ReaderSearch.tsx`；測試為 `useReaderSession.test.tsx`、`WeeklyReader.test.tsx`、`ReaderSearch.test.tsx`。

**介面：** 保留 `useReaderSession().allowAction(): boolean` 與 `ReaderSearch.onJump(sentenceId: string): void`。結果按鈕增加 `data-reader-search-target={sentenceId}` 供限定範圍的捕捉使用；閱讀器內只保留一個進行中的 pointer activation 與一個已完成、待驗證的導航意圖，綁定帳號、documentId、revision 及 sentenceId，不寫入 DB／離線儲存，也不混入標註 mutation queue。

- [ ] 在驗證用 build 記錄 pointerdown/up/cancel、click、window focus/blur、visibilitychange、驗證起迄、導航接受／取消與面板開關的時序。僅記錄事件類型與相對時間，不記錄搜尋字詞、正文、帳號或憑證。
- [ ] 用同一操作在 iPhone 重現一次，指出第一個中斷事件。未取得時序時，不將 focus 假說當成已確認根因，也不直接改成 touchstart 導航。
- [ ] 補失敗測試 `search jump survives validation between pointerdown and click`、`cancelled or scrolled pointer never queues search navigation`、`keyboard activation navigates once`、`pending search jump is cancelled on account or revision change`、`ordinary search jump does not request a receipt`。透過實際事件序列驗證有效導航最多一次，失效帳號／版本與未完成手勢零次。
- [ ] 先執行上述測試，確認能重現失效而非只直接呼叫 callback。
- [ ] 在祖先 guard／inert 之外捕捉「已允許開始」的搜尋結果 activation：閱讀器掛載期間使用 window capture 的 pointerdown/up/cancel listener，僅辨識帶 data-reader-search-target 的結果按鈕。pointerdown 只記錄 target、pointerId、座標與綁定，不收起面板、不建立待導航意圖、不導航。驗證開始仍立即遮罩並鎖定正文，但保留 DOM 與幾何尺寸，使已開始的 activation 可結束。
- [ ] 正常情況仍由原生 click 呼叫 onJump。若驗證在 pointerdown 與 click 之間截斷事件，僅在同一 primary pointer 完成 pointerup、釋放於原結果範圍、位移不超過 8 CSS px，且期間無捲動、resize、pointercancel、多指、失焦或面板關閉時，才轉為待驗證意圖；消耗該次 activation，避免後續 click 再執行一次。驗證開始後的新觸控不可建立 activation。鍵盤維持原生按鈕啟動；完整 click 才可建立意圖，不從單次 keydown 猜測導航。取消、卸載及綁定變更清除 listener 狀態。
- [ ] 依已取得時序修正驗證觸發邊界。重複通知不得反覆重啟同一請求；真正回到網頁、重新連線與撤銷資格仍必須重新驗證。必要驗證期間最多保留一個已完成的最新搜尋導航意圖；成功後重查帳號、documentId、revision、目標存在與 allowAction，才執行；失敗、超時、關閉搜尋、卸載或綁定變更即丟棄。
- [ ] 跳轉前收起鍵盤，沿用 `onAnchor`、`pendingAnchor` 與 `readingInset` 完成定位。不得在鍵盤 resize 後繼續套用舊座標；不增加固定毫秒的導航延遲。
- [ ] 執行 `corepack pnpm exec vitest run src/features/weekly-reader/useReaderSession.test.tsx src/components/weekly-reader/ReaderSearch.test.tsx src/components/weekly-reader/WeeklyReader.test.tsx`，全部通過後提交獨立 commit。合併前移除暫時事件記錄。

### Task 2: 載入與重驗證版面

**檔案：** 新增 `src/components/weekly-reader/ReaderLoading.tsx`／`ReaderLoading.test.tsx`；修改 `WeeklyReader.tsx`、`OfflineReaderShell.tsx`、`reader.css`、`src/features/weekly-reader/api.ts`、`useReaderSession.ts` 及對應 `api.test.ts`、`useReaderSession.test.tsx`、`usePrivateReader.test.tsx`。

**介面：** `ReaderLoading({label, overlay = false}: {label: string; overlay?: boolean})`，只負責顯示。`api.ts` 內部使用 `withReaderDeadline<T>(operation: (signal: AbortSignal) => Promise<T>, signal?: AbortSignal): Promise<T>`，20,000ms 為一次 reader API 邏輯操作的總上限；既有 createReaderApi 公開方法與 signal 參數不變，不修改共用 client。

- [ ] 補失敗測試 `revalidation preserves reader geometry while blocking actions`、`loading does not expose protected content to focus or accessibility`、`loading becomes retryable error on failure`、`reader request times out after 20 seconds`、`late response after timeout cannot unlock or replace reader`、`timed out mutation retains its original id for retry`。用 fake timers 與不回應／不遵守 abort 的假請求確認有界結束，不只測 rejected promise。
- [ ] 先執行以上失敗測試，再為 open／renew／current／privateState／mutate 套用同一內部 deadline；open 的 discovery 與文件取得共用 20 秒預算，不各自重設。到期終止 request signal 並令等待 promise reject；即使底層忽略 abort，晚到結果也不再交給呼叫者。呼叫者取消／卸載與超時須可區別，finally 清理 timer 與 listener。
- [ ] deadline 以 `TypeError('reader_request_timeout')` 結束，沿用既有 readerFailureAction 的 retain 分類與離線授權期限，不使用會落入 lock 的一般 Error／DOMException，也不當成撤銷資格或自行 purge。未確認 mutation 保留原 mutationId 與既有待同步資料，不宣稱已存到伺服器。useReaderSession 在 timeout 走錯誤／既有合格離線分支，在卸載 abort 不更新 state；清除任務 1 的待導航，重試另起 attempt，舊 attempt 不得回寫。
- [ ] 統一初次開啟、授權檢查、字型等待與離線 shell 的載入呈現。保持殼層尺寸；已有內容重新驗證時使用不透明遮罩，內容仍為 inert／aria-hidden，授權失敗後依原政策清除或鎖定。
- [ ] 載入圖示與短文置於閱讀區中央，沿用 light/dark tokens；`aria-busy`／status 適當宣告。顯示延遲採 250ms，僅延遲圖示，不延遲驗證或安全遮罩；關閉 reduced-motion 時才旋轉，不製造假進度百分比。
- [ ] 沿用現有錯誤與 retry，不把驗證失敗轉為可用內容；檢查超時與重試後沒有殘留遮罩、重複 API 請求或重複導航。字型等待以同一 20 秒上限結束為可重試載入錯誤，不用未驗證文件或改用另一組字型掩蓋錯誤。
- [ ] 執行任務 1 測試以及 `corepack pnpm exec vitest run src/features/weekly-reader/api.test.ts src/features/weekly-reader/usePrivateReader.test.tsx src/components/weekly-reader/ReaderLoading.test.tsx src/components/weekly-reader/OfflineReaderShell.test.tsx`；確認綠燈後提交。

### Task 3: 搜尋面板與目錄文案

**檔案：** `ReaderSearch.tsx`、`WeeklyReader.tsx`、`reader.css`、`ReaderSearch.test.tsx`、`WeeklyReader.test.tsx`、`src/i18n/locales/{zh-Hant,zh-Hans,en,ja,ko}.json`。

**介面：** 沿用既有 panel、搜尋結果與 component/sentence anchor，不新增搜尋 API 或章節 ID。

- [ ] 補失敗測試 `search header keeps close control with input`、`mobile contents use approved labels without changing chapter ids`、`PDF page navigation aligns first visible line`。
- [ ] 搜尋面板改為固定頂列與獨立結果捲動區。返回按鈕與搜尋框位於同一列；取消舊 sticky 負 margin 組合。手機全寬，桌面沿用右側 380px 上限；使用現有 sidebar 遮罩與 focus 管理。
- [ ] 保留單一清除輸入按鈕；hover 僅套用支援 hover 的指標設備，觸控 feedback 不改尺寸或要求第二次點擊。
- [ ] 修改繁中目錄為「封面／信息回應／小組詩歌／封底」及「PDF 頁面」，同步其餘四種 UI 語言的對應翻譯，不改週報文字或 contentLocale。
- [ ] 執行任務 1 的元件測試；以實機與桌面捲動結果清單、開關鍵盤並旋轉，確認頂列沒有被蓋住或捲走，再提交。

### Task 4: 手機筆記不壓縮正文

**檔案：** `NoteIndicators.tsx`、`WeeklyReader.tsx`、`reader.css`；更新既有 `NoteIndicators.test.tsx`、`WeeklyReader.test.tsx` 與 `src/features/weekly-reader/text-range.test.ts`，不修改共用 renderer。

**介面：** 在 `NoteIndicators` 加入 `mobile?: boolean`，其 `onOpen(noteIds: string[], trigger: HTMLButtonElement)`、筆記 ranges 與資料格式不變。桌面繼續使用原 absolute markers。

- [ ] 補失敗測試 `mobile note rows do not reserve an article gutter`、`partial-range notes retain their exact anchors`、`notes in the same paragraph share one marker`、`note markers never change sentence text or text ranges`、`heading and cross-paragraph notes have valid marker hosts`、`switching to desktop removes mobile portal hosts`、`desktop note markers retain their gutter`。
- [ ] 將右側 44px gutter 限制在桌面模式。依 ranges 找到 sentence 所屬 data-block-id 區塊，將獨立 marker host 放在該段落／標題區塊之後、所有 data-sentence-id 容器之外，不能插在同一區塊的文字 fragments 之間。inline 區塊使用所屬 p／h2／h3 作為完整區塊邊界；固定元素沒有 blockId 時沿用其完整段落邊界。使用合法 HTML host 與 React portal，不移動正文、不重寫 innerHTML。
- [ ] 同段落合併 note IDs；跨段筆記在每個涉及區塊各顯示一次，點擊仍開啟同一原筆記。host 不承載 sentence／fragment 屬性，按鈕不得觸發正文句子選取。建立前確認 host 與祖先不帶 data-sentence-id；找不到安全宿主時放在所屬 component 結尾，不猜測文字 offset 或改寫 ranges。
- [ ] 點擊標記開啟既有筆記列表；刪除、改字型、換章、切回桌面或卸載後清除過期定位與 portal hosts。移除手機原 absolute markers，不保留兩套同時可見的標記。
- [ ] 執行 `corepack pnpm exec vitest run src/features/weekly-reader/text-range.test.ts src/components/weekly-reader/NoteIndicators.test.tsx src/components/weekly-reader/WeeklyReader.test.tsx`。比較每個 sentence 容器插入前後的 textContent、fragment 屬性與 renderedTextRanges；瀏覽器核對正文邊界／換行及原範圍，包含繁簡中、標題、emoji、跨段與切回桌面，再提交。

### Task 5: 首頁與瀏覽器返回的離開確認

**檔案：** `ReaderTabs.tsx`、`WeeklyReader.tsx`、`OfflineReaderShell.tsx`；新增 `src/features/weekly-reader/useReaderExitGuard.ts`／`useReaderExitGuard.test.tsx`，更新 `ReaderTabs.test.tsx`、`WeeklyReader.test.tsx`、`src/features/weekly-reader/progress.test.tsx` 及五種 locale 文案；沿用 return-state.ts 的本機進度保存。

**介面：** `useReaderExitGuard({hasUnsavedNote, beforeLeave}: {hasUnsavedNote: () => boolean; beforeLeave: () => Promise<boolean>})` 回傳 `{confirmLeave: (kind: 'home' | 'back') => Promise<boolean>, dialogProps: AlertDialogProps}`，型別沿用 UI package 的公開匯出。hasUnsavedNote 為不改狀態的檢查；beforeLeave 只在 dialog 確認後執行，不再詢問。沿用 progress.flush(): Promise<void>，退出時最多等待 2,000ms；只限制等待，不清除或重建既有同步 mutation。

- [ ] 補失敗測試 `home cancel preserves position and draft`、`browser back cancel does not alter reader tabs`、`confirmed back leaves once to original destination`、`chapter navigation never asks to leave`、`dirty note exit shows one combined confirmation without native confirm`、`cancel never calls cleanup or flush`、`confirmed exit stops waiting for progress after 2 seconds`、`late flush completion never navigates again`。取消須檢查草稿文字、editor／panel 狀態及 history，而不只檢查 dialog 是否關閉。
- [ ] 先執行上述測試，再將 WeeklyReader 的 closeNotes 拆為純 hasUnsavedNote 檢查與不詢問的 editor cleanup。其他既有關閉筆記／切 tab 路徑保留原放棄確認並共用 cleanup；本輪離開路徑不呼叫會跳 window.confirm 的 closeNotes，也不在顯示 dialog 前清理。
- [ ] 共用對話框標題「離開週報閱讀？」、取消「繼續閱讀」；Home 確認「返回文字事工」，瀏覽器返回確認「離開」。未存警告由純檢查加入同一框；dialog 開啟期間停止編輯，連續返回共用同一待決結果，確認前重查綁定，避免清理新帳號或新版文件的草稿。allowAction 失效時禁止受保護的讀寫，但不得因此禁止離開閱讀器；跳過無權執行的同步並沿用原失效處理。
- [ ] 只有確認後才在 beforeLeave 記錄當前可見位置、沿用 saveReaderReturn 保存 pageId／revision 與既有 anchor（不覆寫其他 action／draft）、執行有界 flush。同步成功／失敗／2 秒等待到期後均只繼續一次離開；保留既有未確認 mutationId／queue。再清理經明確同意放棄的 editor 草稿與相應復原紀錄；取消則完全不執行這些步驟。本機儲存被禁用時不宣稱進度已保存，不能用同步失敗鎖住離開。
- [ ] Header Home 呼叫 confirmLeave；一般週報 tab 切換保留原有未存筆記保護，不額外加離開確認。關閉最後一個週報 tab 並返回文字事工時，走相同離開確認。
- [ ] 對正常單步瀏覽器返回，以閱讀器專用、同 URL 的歷史 guard entry 接住導航再詢問；只建立一個受控 entry，不覆寫 Next.js 或 offline shell 的既有 history state。取消以既有 entry 恢復原位置，不重複 push 並刪掉前進歷史；確認後放行到原上一頁，不把所有返回都導到文字事工。重新整理可辨識自身 marker，不再新增 entry；history.length 為 1、沒有上一頁時不製造假的返回目的地，仍保留 Home 確認。
- [ ] 額外測試直接網址進入、重新整理、連續返回、取消後再返回、瀏覽器前進、PWA／離線返回與卸載清理。不得無限補 entry、鎖住返回或重複開 dialog；同 URL guard 不能被 OfflineReaderShell 當成另一份週報。
- [ ] 不用 beforeunload 作為共用客製確認框。跨文件跳轉、長按返回選擇更早歷史、關閉分頁或 OS 終止不宣稱能全面攔截；保留既有草稿／進度保存，實機列明可控與不可控範圍。
- [ ] 執行 `corepack pnpm exec vitest run src/features/weekly-reader/useReaderExitGuard.test.tsx src/features/weekly-reader/progress.test.tsx src/components/weekly-reader/ReaderTabs.test.tsx src/components/weekly-reader/WeeklyReader.test.tsx src/components/weekly-reader/OfflineReaderShell.test.tsx`；以永不回應／延遲回應請求核對離開與草稿，實機返回驗證通過後提交。

瀏覽器限制依據：[MDN popstate](https://developer.mozilla.org/en-US/docs/Web/API/Window/popstate_event) 說明歷史變更事件不等於可取消導航；[MDN beforeunload](https://developer.mozilla.org/en-US/docs/Web/API/Window/beforeunload_event) 說明原生文案不能自訂且手機事件不可靠。因此驗收以受控的正常返回路徑為準，不承諾攔截所有 OS／瀏覽器退出方式。

## 整合驗證與交付

- [ ] 完成任務 1 → 2 → 3 → 4 → 5，各自提交小型 commit；清理被替代的邏輯與測試假設，再執行 `corepack pnpm test:run`、`corepack pnpm lint`、`corepack pnpm build` 及 README 的 Docker build 驗證。
- [ ] 用 1742 繁中／簡中核對搜尋跨章、PDF 頁面定位、筆記與閱讀位置；以 1739／1741 做相容回歸。唯讀場景不更改發布內容；需要筆記資料時使用測試帳號。
- [ ] 第一輪合併檢查桌面、iPad、iPhone 網頁、Android 網頁與 PWA 的 light/dark、320px 小螢幕、鍵盤、慢速請求及必要離線操作；一次修正發現事項後再做一次確認，避免無限樣式調整。
- [ ] iPhone 實機須重做錄影中的搜尋步驟：捲動後單次點結果，不出現左上載入、不退回結果清單、直接定位。桌面觸控模擬不得代替此項。未取得實機證據就標示待驗收。
- [ ] 開 PR，所有必要 CI 綠燈後依既有批准邊界 merge；由 CI/CD 上版，再核對部署 revision、/health 與正式閱讀路由。分開回報本機／CI、合併、上版、實機驗收狀態。

**完成定義：** 六項需求全部通過對應測試與瀏覽器驗證，搜尋與返回另有手機實機證據；新增的完整 activation、單一確認／取消不清草稿、超時／晚到回應及正文 DOM 隔離測試全部通過；正式版 revision 與 PR 相符。僅文件、單元測試綠燈或桌面模擬成功，都不能標示整輪完成。
