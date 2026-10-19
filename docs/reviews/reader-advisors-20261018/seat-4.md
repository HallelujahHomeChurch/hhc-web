# 原始顧問第 4 席回覆（歷史存檔）

來源：2026-10-18 原五席調查的本機 `result-4.json`，本次從既有輸出取回，沒有再次呼叫 Gemini。
requested model：`gemini-4-argon-high`；CLI exit 0，回傳 status `SUCCESS`。requested model 不代表服務端已提供可靠 returned-model 證明。

以下為原 response 原文。行號、暫存 file URL 與建議均屬原調查時點，不代表現碼、真機驗證或已接受設計。特別是 IME／pointerdown 假說不得直接當修法；需先取得事件證據。後續處置見 [追蹤總覽](../../superpowers/specs/2026-10-18-reader-improvement-roadmap.md)。

---

### 第4席顧問報告（對話框一致性、操作回饋、資料信任、行動鍵盤/IME）

#### 一、整體分析
* **程式確定事實**：離開閱讀器採用站內 [`ReaderExitDialog`](file:///private/tmp/hhc-reader-consult-20261018/src/components/weekly-reader/WeeklyReader.tsx#L577)（[`src/features/weekly-reader/useReaderExitGuard.ts:72-86`](file:///private/tmp/hhc-reader-consult-20261018/src/features/weekly-reader/useReaderExitGuard.ts#L72-L86)），但捨棄未存筆記與刪除卻直接呼叫瀏覽器原生 `window.confirm`（[`src/components/weekly-reader/WeeklyReader.tsx:166`](file:///private/tmp/hhc-reader-consult-20261018/src/components/weekly-reader/WeeklyReader.tsx#L166)、[`src/components/weekly-reader/WeeklyReader.tsx:672`](file:///private/tmp/hhc-reader-consult-20261018/src/components/weekly-reader/WeeklyReader.tsx#L672)、[`src/components/weekly-reader/WeeklyReader.tsx:681`](file:///private/tmp/hhc-reader-consult-20261018/src/components/weekly-reader/WeeklyReader.tsx#L681)），導致出現 iOS 原生確認框。此外，儲存與刪除將 `queued` 與 `applied` 視為同等完成且不發 `notice`（[`src/components/weekly-reader/WeeklyReader.tsx:199`](file:///private/tmp/hhc-reader-consult-20261018/src/components/weekly-reader/WeeklyReader.tsx#L199)、[`src/components/weekly-reader/WeeklyReader.tsx:686`](file:///private/tmp/hhc-reader-consult-20261018/src/components/weekly-reader/WeeklyReader.tsx#L686)），[`NotesPanel`](file:///private/tmp/hhc-reader-consult-20261018/src/components/weekly-reader/NotesPanel.tsx#L17) 刪除鈕亦無 `busy` 鎖定。
* **推測／需真機驗證**：「首次儲存需按兩次」有二因：(1)**確定事實**：若首次送出為 `queued` 或需點 [`confirmRetry`](file:///private/tmp/hhc-reader-consult-20261018/src/components/weekly-reader/WeeklyReader.tsx#L618-L627)，因無回饋易誤認失敗；(2)**推測（需真機驗證）**：[`src/components/weekly-reader/NoteEditor.tsx:42-49`](file:///private/tmp/hhc-reader-consult-20261018/src/components/weekly-reader/NoteEditor.tsx#L42-L49) 在手機鍵盤展開或中文 IME 組字未上屏時，首次點擊先觸發 `textarea` 失焦、鍵盤收合位移或組字落地（此前 `!draft.text.trim()` 為禁用），需按第二次才觸發 `onSubmit`。

---

#### 二、五大優先發現、最小改善與驗收條件（AC）

1. **[P0] 對話框不一致：捨棄與刪除混用 `window.confirm`**
   * **根因（確定事實）**：[`closeNotes`](file:///private/tmp/hhc-reader-consult-20261018/src/components/weekly-reader/WeeklyReader.tsx#L166) 與兩處刪除（[`src/components/weekly-reader/WeeklyReader.tsx:672`](file:///private/tmp/hhc-reader-consult-20261018/src/components/weekly-reader/WeeklyReader.tsx#L672)、[`src/components/weekly-reader/WeeklyReader.tsx:681`](file:///private/tmp/hhc-reader-consult-20261018/src/components/weekly-reader/WeeklyReader.tsx#L681)）使用原生 `window.confirm`，未接入站內 `AlertDialog`（[`src/features/weekly-reader/useReaderExitGuard.ts:72-86`](file:///private/tmp/hhc-reader-consult-20261018/src/features/weekly-reader/useReaderExitGuard.ts#L72-L86)）。
   * **最小改善**：移除 `window.confirm`，統一以站內 `AlertDialog` 狀態管理捨棄與刪除確認。
   * **AC**：iOS 及各平台關閉未存筆記或刪除時，皆顯示符合主題的站內 Dialog，零原生彈窗。

2. **[P1] 刪除似未成功：缺忙碌鎖定與 `queued` 狀態回饋**
   * **根因（確定事實）**：[`src/components/weekly-reader/NotesPanel.tsx:9-18`](file:///private/tmp/hhc-reader-consult-20261018/src/components/weekly-reader/NotesPanel.tsx#L9-L18) 未接收 `busy`；[`deleteNote`](file:///private/tmp/hhc-reader-consult-20261018/src/components/weekly-reader/WeeklyReader.tsx#L195-L202) 回傳 `queued` 時若 `note.deleted` 未即時更新，筆記仍留存畫面且無 `notice`。
   * **最小改善**：傳入 `busy` 禁用 [`NotesPanel`](file:///private/tmp/hhc-reader-consult-20261018/src/components/weekly-reader/NotesPanel.tsx#L4-L18) 按鈕；區分 `applied`（提示已刪除）與 `queued`（提示待同步並標示待刪視覺態）。
   * **AC**：點刪除後按鈕立即 `disabled`；完成時顯示 `role="status"` 提示，佇列中項目顯示「待同步刪除」。

3. **[P1] 首次儲存需按兩次：手機鍵盤/IME 失焦與回饋缺口**
   * **根因（事實＋需真機驗證）**：[`src/components/weekly-reader/NoteEditor.tsx:23-28`](file:///private/tmp/hhc-reader-consult-20261018/src/components/weekly-reader/NoteEditor.tsx#L23-L28) 與 [`src/components/weekly-reader/WeeklyReader.tsx:686`](file:///private/tmp/hhc-reader-consult-20261018/src/components/weekly-reader/WeeklyReader.tsx#L686) 未對 `applied`/`queued` 發出 `notice`；行動端 IME 組字或鍵盤收合易吞掉首次點擊（需真機驗證）。
   * **最小改善**：監聽 `onCompositionStart/End`，儲存鈕於 `onPointerDown` 避免失焦位移；[`onComplete`](file:///private/tmp/hhc-reader-consult-20261018/src/components/weekly-reader/WeeklyReader.tsx#L686) 依狀態設定 `setNotice`。
   * **AC**：真機於虛擬鍵盤開啟及中文選字後，單次點擊即送出並顯示「已儲存」或「已排入同步」。

4. **[P1] 資料損失風險：衝突「手動合併」後未儲存保護失靈**
   * **根因（確定事實）**：[`src/components/weekly-reader/WeeklyReader.tsx:672`](file:///private/tmp/hhc-reader-consult-20261018/src/components/weekly-reader/WeeklyReader.tsx#L672) 手動合併直接改寫 `setNotes({...deletion.cloud!, text: ...})` 且未設 `noteEditorState`，使 `editingNote.text` 等於合併文字，[`hasUnsavedNote()`](file:///private/tmp/hhc-reader-consult-20261018/src/components/weekly-reader/WeeklyReader.tsx#L162) 誤判為 `false`。
   * **最小改善**：`setNotes` 保留雲端原物件，將合併文字寫入 `setNoteEditorState({draft: ...})`。
   * **AC**：點選「手動合併」後未按儲存即關閉或離開，必觸發未儲存確認。

5. **[P2] 重試提示與筆記面板割裂**
   * **根因（確定事實）**：[`ReaderRecovery`](file:///private/tmp/hhc-reader-consult-20261018/src/components/weekly-reader/WeeklyReader.tsx#L613-L627) 與 `confirmRetry` 位於主舞台上方，開啟 [`ReaderPrivateState`](file:///private/tmp/hhc-reader-consult-20261018/src/components/weekly-reader/WeeklyReader.tsx#L665) 時難以察覺。
   * **最小改善**：於筆記面板頂部同步渲染 `pendingMutation`/`canRetry` 橫幅。
   * **AC**：筆記面板開啟時若需重試，面板內可直接檢視並點擊重試。

---

#### 三、可加的好功能
1. **草稿本機暫存**：於 [`src/components/weekly-reader/NoteEditor.tsx:15`](file:///private/tmp/hhc-reader-consult-20261018/src/components/weekly-reader/NoteEditor.tsx#L15) 同步寫入 `sessionStorage`，防意外重整掉字。
2. **刪除 Undo Toast**：刪除後提供 5 秒復原，兼顧流暢度與防誤刪。
3. **同步狀態徽章**：在 [`src/components/weekly-reader/NotesPanel.tsx:12`](file:///private/tmp/hhc-reader-consult-20261018/src/components/weekly-reader/NotesPanel.tsx#L12) 標示「已同步／待同步」，提升離線信任感。

<!-- End original response -->
