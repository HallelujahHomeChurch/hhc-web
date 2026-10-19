# 線上閱讀改善總覽與顧問發現追蹤

日期：2026-10-18。版本 D2（2026-10-19）。狀態：第二階段已完成調查、S2 spec與P1 plan雙席檢驗，T0–T3逐步實作各雙席通過；第二階段[PR236](https://github.com/HallelujahHomeChurch/hhc-web/pull/236)及最新head8974b886的CI39147673697通過、未merge。第三階段F0雙席調查完成，產品選擇待回覆。三階段是改善工作的交付分組，不代表每一個候選功能都已通過可行性或使用者接受。

## 1. 三階段與入口

| 階段 | 範圍 | 文件與狀態 |
| --- | --- | --- |
| 1 問題與資料可靠性 | 單次儲存／刪除、互斥、結果不明重試、復原、草稿、站內確認、局部載入錯誤 | [PR #234](https://github.com/HallelujahHomeChurch/hhc-web/pull/234)；實作及最終提交 CI 通過。本任務未 merge／release；真機與真實帳號驗收未完成 |
| 2 閱讀體驗與 UI／UX | 閱讀模式、側欄分區、筆記／畫線查找、搜尋脈絡、焦點／縮放、確認一致性 | [階段 2 spec](2026-10-18-reader-experience-design.md)，S2實作就緒及[P1 plan](../plans/2026-10-19-reader-experience.md)雙席通過；T0–T4及交付雙席通過；[PR236](https://github.com/HallelujahHomeChurch/hhc-web/pull/236) CI成功、OPEN，停merge前 |
| 3 加值功能 | 筆記匯出與命名書籤優先；Undo 等保留候選 | [階段 3 spec](2026-10-18-reader-value-features-design.md)，D1.1保存[F0雙席調查](../../reviews/2026-10-19-reader-value-features-gates.md)，引用匯出與書籤持久化產品決策待回覆；尚未實作就緒，尚無implementation plan |

第一階段的正式 [spec](https://github.com/HallelujahHomeChurch/hhc-web/blob/5d6e027f88e1a7c24a22f546d5ed67d9c7828779/docs/superpowers/specs/2026-10-18-reader-notes-reliability-design.md)、[plan](https://github.com/HallelujahHomeChurch/hhc-web/blob/5d6e027f88e1a7c24a22f546d5ed67d9c7828779/docs/superpowers/plans/2026-10-18-reader-notes-reliability.md)、[檢驗紀錄](https://github.com/HallelujahHomeChurch/hhc-web/blob/5d6e027f88e1a7c24a22f546d5ed67d9c7828779/docs/reviews/2026-10-18-reader-notes-reliability-gates.md)用不可變提交連結保存，避免本文件分支依賴尚未合併的本機檔案。

## 2. 當時顧問報告保存情況

原要求五席：三席 Codex、兩席 Gemini。本次找到原 Gemini 第 [4 席](../../reviews/reader-advisors-20261018/seat-4.md)與第 [5 席](../../reviews/reader-advisors-20261018/seat-5.md)完整回覆，已從暫存移入版控文件。原資料包只包含本次授權的前端原碼摘錄及合成問題；此處保存 response，不保存 prompts、憑證、正式筆記或整個 CLI payload。本次沒有向 Gemini 發出新請求；後續檢驗均使用 Codex。

目前未在本次定位的 repo 文件與該暫存資料夾找到其餘三席的獨立原始報告檔，不能聲稱五席原文完整留存。第一階段 spec 保留了部分整合後的根因、原碼定位與確定度；那是整合紀錄，不是三席原文替代品。後續 agent 必須讀此追蹤表並重新核對現碼；若找到其餘原報告，補上來源與差異，不憑對話記憶重建「原文」。

## 3. 發現與建議的處置

| ID | 來源與原觀察／建議 | 處置與後續驗收 |
| --- | --- | --- |
| F01 | 第4/5席：筆記放棄、刪除使用 window.confirm；無一致回饋 | 階段1已實作筆記／離開路徑；其餘畫線歷史、部分色彩復原、離線清單確認列 P2-R6，先查真實語意 |
| F02 | 第4/5席：queued/applied 混淆、刪除無 busy、重試入口在面板外 | 階段1已實作狀態分類與面板內復原；不得在階段2重新做第二套同步 queue |
| F03 | 第4/5席：首次儲存的鍵盤收合／IME 假說 | 仍待真機事件序列；不是確定根因。不能照抄 pointerdown preventDefault 建議；保留階段1真機 gate |
| F04 | 第4席：手動合併後 dirty 判斷及草稿保存 | 階段1已修；沿用現有 account/document-bound 短期 return-state，不另建無期限 localStorage 草稿 |
| F05 | 第5席：側欄堆疊、單段篩選沒有明確出口 | P2-R2；顯示篩選條件、可清除並保留草稿 |
| F06 | 第5席：結果有頁碼無章節，手機排除隱藏內容未說明 | P2-R4；保留明確提交搜尋、現有手機隱藏規則與原版頁碼，補模式範圍提示 |
| F07 | 原整合清單：紙本／易讀切換 | P2-R1；屬記錄過的方向，雙模式 renderer 可行性待調查；不當作五席一致結論 |
| F08 | 原整合清單：筆記／畫線搜尋與篩選 | P2-R3；查已授權載入資料，保留原始文字與精確 ranges |
| F09 | 原整合清單：焦點與瀏覽器縮放 | P2-R5；桌面、平板、手機分別驗收；既有右側搜尋與兩態方向 toggle 不推翻 |
| F10 | 原整合清單：筆記匯出 | P3-R1；候選預設 Markdown，純文字下載，不增加傳送服務；資料範圍／權利先定義 |
| F11 | 原整合清單：命名書籤 | P3-R2；確切文件版本與 anchor、帳號隔離、跨裝置需求與 owner 契約先定義 |
| F12 | 第4席：刪除 Undo | 保留候選，未排入階段3首批；需要新操作/CAS與刪除語意調查，不以舊資料覆寫雲端 |
| F13 | 第4席：本機草稿、同步徽章 | 階段1已有草稿保護與 SyncStatus；是否需要逐筆永久徽章待證據，不預設增加 UI 密度 |

原來源較早，行號與實作可能變動。F07–F11 的來源是第一階段 spec 的明列後續清單，沒有找到原席次對應，故不補造作者或票數。候選不等於需求已核准或功能已存在。

## 4. 接手與完成規則

1. 每次接手先讀本總覽、該階段 spec、第一階段契約／檢驗紀錄與現行 repo AGENTS.md；讀取最新 PR／origin/main，不把舊報告視為線上事實。
2. 先核對已存在的章節／頁碼導航、NFKC 搜尋、位置記憶、直橫方向、主題、字級、離線、畫線、重連與衝突復原，避免重做。
3. 依第二階段→第三階段排序；各自完成阻塞項調查與 spec 的兩位 Codex 檢驗，才可寫 implementation plan。plan 再由兩位 Codex 檢驗，完成後才執行已授權實作；每個實作步驟仍兩席檢驗，處置 Important/Critical 後才下一步。
4. 本次雙席文件檢驗只確認需求保留、邊界、風險與可驗收性，不代表未決定項目已被解答，也不代替未來各階段實作就緒 gate。原文件保存輪不寫第二、三階段plan或產品程式；2026-10-19使用者另授權接續第二階段，結果見[逐步紀錄](../../reviews/2026-10-19-reader-experience-gates.md)。第三階段F0已完成，實作就緒spec需先處置產品選擇。
5. 各階段 UI 變更先保存正常閱讀 baseline，再做可比較候選圖；維持既有視覺語言。模型審圖、瀏覽器 viewport、實體裝置、真實帳號、CI、merge、release 與 smoke 分別記錄。
6. 每個候選都必須有：證據、已確認／建議／未決定狀態、owner、驗收與決策結果。Deferred 項目留在追蹤表，不因 token/context 或暫存清除消失。

檢驗結果：[本輪雙席紀錄](../../reviews/2026-10-18-reader-roadmap-spec-gates.md)。
