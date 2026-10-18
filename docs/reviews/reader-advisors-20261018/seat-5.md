# 原始顧問第 5 席回覆（歷史存檔）

來源：2026-10-18 原五席調查的本機 `result-5.json`，本次從既有輸出取回，沒有再次呼叫 Gemini。
requested model：`gemini-4-argon-high`；CLI exit 0，回傳 status `SUCCESS`。requested model 不代表服務端已提供可靠 returned-model 證明。

以下為原 response 原文。行號、暫存 file URL 與建議均屬原調查時點，不代表現碼、真機驗證或已接受設計。特別是 IME／pointerdown 假說不得直接當修法；需先取得事件證據。後續處置見 [追蹤總覽](../../superpowers/specs/2026-10-18-reader-improvement-roadmap.md)。

---

### 一、現有功能確認（確定事實，不建議重做）
* **導航與目錄**：已具備章節切換、原版頁碼縮圖 `PageNavigator`、段落導航 `SectionNavigator` (`src/components/weekly-reader/WeeklyReader.tsx:601-604`)、直橫排切換 (`WeeklyReader.tsx:593-595`)、桌面縮放 (`src/components/weekly-reader/ReaderToolbar.tsx:8-12`)、行動版字級行高 (`WeeklyReader.tsx:588,606`)、深淺主題 (`WeeklyReader.tsx:589`)、位置記憶 (`WeeklyReader.tsx:203-209`) 與離開攔截 `AlertDialog` (`src/features/weekly-reader/useReaderExitGuard.ts:72-86`)。
* **搜尋與離線**：已有 NFKC 全文搜尋、摘要高亮與頁碼跳轉 (`src/components/weekly-reader/ReaderSearch.tsx:14,27-47`)；Service Worker 離線儲存與憑證續期 (`src/components/weekly-reader/OfflineControl.tsx:23,36-42`)。
* **筆記與畫線**：已有句/範圍畫線、歷史還原、頁邊指標過濾 `noteFilter`、失效錨點重綁 `NoteReanchor`、離線重試與雲端衝突三選一 (`WeeklyReader.tsx:613-627,649-686`, `src/components/weekly-reader/NoteEditor.tsx:32-47`, `src/components/weekly-reader/NotesPanel.tsx:9-19`)。

### 二、5 項重要發現與機會
1. **關閉與刪除出現 iOS 原生確認（確定事實）**：離開閱讀器已用網站 `ReaderExitDialog` (`WeeklyReader.tsx:577`, `useReaderExitGuard.ts:72`)，但放棄未存筆記 (`WeeklyReader.tsx:166`) 與刪除筆記 (`WeeklyReader.tsx:672,681`) 卻直接呼叫 `window.confirm`，在 iOS 觸發系統原生彈窗。
2. **首次儲存需按兩次（推測＋需真機驗證）**：**事實**為 `<textarea autoFocus>` (`NoteEditor.tsx:42`) 搭配 `<form onSubmit>` (`NoteEditor.tsx:38,49`)。**推測**在行動端鍵盤展開時，首次點儲存先觸發 `textarea` 失焦收鍵盤與視窗重排而吞掉點擊，或受輸入法組字未完成影響。**缺證據/需驗證**：缺 `ReaderPrivateState` 與 CSS，需真機監測 `pointerdown/blur/submit` 事件序。
3. **刪除似乎不成功（確定事實＋推測＋需真機驗證）**：**事實**為刪除鈕無 `disabled`/載入態 (`NotesPanel.tsx:17`)，且非 `applied/queued` 時僅設 `notice` (`WeeklyReader.tsx:195-201`)，列表靠 `note.deleted` 過濾 (`NotesPanel.tsx:9`)。**推測**為 `window.confirm` 被阻擋，或慢網/佇列下 `privateReader.state` 未樂觀更新。**缺證據/需驗證**：缺 `privateReader.mutate` 實作，需真機驗證狀態更新與 API 回應。
4. **筆記側欄資訊架構堆疊且篩選無出口（確定事實）**：未篩選時側欄垂直堆疊畫線、歷史、筆記三區塊 (`WeeklyReader.tsx:675-682`)；由頁邊 `NoteIndicators` 點入會設 `noteFilter` 並隱藏畫線區 (`WeeklyReader.tsx:174,675`)，卻無「顯示全部」切換鈕。
5. **搜尋無章節脈絡且行動版靜默過濾（確定事實）**：搜尋須送出表單才執行 (`ReaderSearch.tsx:18`)，結果僅顯示頁碼無章節名 (`ReaderSearch.tsx:30`)，且行動版直接排除 `bulletinMobileDetails` 句子 (`ReaderSearch.tsx:13-14`) 而無提示。

### 三、3 項漸進功能建議
1. **統一網站 Dialog 與刪除樂觀回饋**
   * **設計**：複用 `AlertDialog` (`useReaderExitGuard.ts:2,72`) 取代三處 `window.confirm` (`WeeklyReader.tsx:166,672,681`)；`NotesPanel.tsx:17` 補上 `busy` 禁用與刪除中狀態。
   * **價值/成本**：高（消除原生彈窗與刪除無反應困惑）／低。
   * **驗收**：iOS 放棄與刪除皆開網站 Dialog；刪除時按鈕禁用並即時反映狀態。
2. **行動端儲存失焦防護與本機草稿保護**
   * **設計**：儲存鈕 (`NoteEditor.tsx:49`) 以 `onPointerDown` 防止鍵盤收合吞掉點擊，並延伸 `sessionStorage` (`WeeklyReader.tsx:203`) 暫存 `draft`。
   * **價值/成本**：高（解決點兩次痛點、防長文遺失）／低至中（缺 iOS 鍵盤實測證據）。
   * **驗收**：行動端鍵盤展開時單擊即送出；重整頁面可還原未存草稿。
3. **筆記側欄分頁（Tabs）與篩選清除列**
   * **設計**：將 `WeeklyReader.tsx:675-680` 畫線、歷史、筆記改為 Tabs，有 `noteFilter` 時顯示「單段篩選中・顯示全部」；搜尋 (`ReaderSearch.tsx:13,30`) 補上章節名與行動版隱藏內容提示。
   * **價值/成本**：中高（理順筆記與搜尋查找動線）／中（缺 `ReaderPrivateState` 內部結構證據）。
   * **驗收**：側欄可一鍵清除 `noteFilter` 並切換 Tabs；搜尋結果顯示章節名稱。

<!-- End original response -->
