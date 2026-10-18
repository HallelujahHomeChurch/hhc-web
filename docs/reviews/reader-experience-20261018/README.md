# 第二階段閱讀體驗畫面證據

2026-10-19。本頁先保存靜態概念提案，再列T0基準與T1–T4真實元件candidate；所有圖均不是實體裝置接受。以下提案段以第一階段合成正常閱讀圖作背景，新增HTML面板只用來比較位置、密度與既有tokens；按鈕不連API。真實UI與操作證據另見後續各步紀錄。

手機 390×844、平板 768×1024、桌面 1440×900；各light/dark，筆記／畫線／閱讀模式設定。原正常閱讀基準見相鄰 [第一階段視覺紀錄](../reader-notes-reliability/README.md)。

| 裝置與主題 | 現況筆記面板 | 提案筆記 | 提案畫線 | 提案目錄與模式 |
| --- | --- | --- | --- | --- |
| phone-light | [現況](../reader-notes-reliability/candidate-phone-light-list.jpg) | [筆記](proposal-phone-light-notes.jpg) | [畫線](proposal-phone-light-highlights.jpg) | [模式](proposal-phone-light-settings.jpg) |
| phone-dark | [現況](../reader-notes-reliability/candidate-phone-dark-list.jpg) | [筆記](proposal-phone-dark-notes.jpg) | [畫線](proposal-phone-dark-highlights.jpg) | [模式](proposal-phone-dark-settings.jpg) |
| tablet-light | [現況](../reader-notes-reliability/candidate-tablet-light-list.jpg) | [筆記](proposal-tablet-light-notes.jpg) | [畫線](proposal-tablet-light-highlights.jpg) | [模式](proposal-tablet-light-settings.jpg) |
| tablet-dark | [現況](../reader-notes-reliability/candidate-tablet-dark-list.jpg) | [筆記](proposal-tablet-dark-notes.jpg) | [畫線](proposal-tablet-dark-highlights.jpg) | [模式](proposal-tablet-dark-settings.jpg) |
| desktop-light | [現況](../reader-notes-reliability/candidate-desktop-light-list.jpg) | [筆記](proposal-desktop-light-notes.jpg) | [畫線](proposal-desktop-light-highlights.jpg) | [模式](proposal-desktop-light-settings.jpg) |
| desktop-dark | [現況](../reader-notes-reliability/candidate-desktop-dark-list.jpg) | [筆記](proposal-desktop-dark-notes.jpg) | [畫線](proposal-desktop-dark-highlights.jpg) | [模式](proposal-desktop-dark-settings.jpg) |

決策：同一aside/Drawer內用現有Tabs分區；查找工具只在列表，editor與Recovery維持原完整流程。沿用桌面右欄、平板右側Drawer與手機sheet。目錄面板納入模式與相關設定，正常正文與工具列不增加常駐控制項。

背景來源：第一階段不可變提交5d6e027中的合成fixture畫面。前景是依其token系統製作的靜態HTML示意；桌面/手機切換模式的實際正文形狀不由本提案模擬，須後續真實candidate。

本機概念來源：[proposal.html](proposal.html)（保留本次工作路徑，需由既有Vite合成預覽提供CSS與背景，不是可部署頁面）。

## T0 實際產品基準（不同於上方概念圖）

整合HEAD9c2b414，固定合成筆記／有效畫線／舊版歷史，三裝置×明暗×normal/list/editor/contents/search共30張，均等待font ready與可見正文、可操作筆記。

| 尺寸/主題 | 閱讀 | 列表 | 編輯 | 目錄 | 搜尋 |
| --- | --- | --- | --- | --- | --- |
| phone/light | [normal](baseline-phone-light-normal.jpg) | [list](baseline-phone-light-list.jpg) | [editor](baseline-phone-light-editor.jpg) | [contents](baseline-phone-light-contents.jpg) | [search](baseline-phone-light-search.jpg) |
| phone/dark | [normal](baseline-phone-dark-normal.jpg) | [list](baseline-phone-dark-list.jpg) | [editor](baseline-phone-dark-editor.jpg) | [contents](baseline-phone-dark-contents.jpg) | [search](baseline-phone-dark-search.jpg) |
| tablet/light | [normal](baseline-tablet-light-normal.jpg) | [list](baseline-tablet-light-list.jpg) | [editor](baseline-tablet-light-editor.jpg) | [contents](baseline-tablet-light-contents.jpg) | [search](baseline-tablet-light-search.jpg) |
| tablet/dark | [normal](baseline-tablet-dark-normal.jpg) | [list](baseline-tablet-dark-list.jpg) | [editor](baseline-tablet-dark-editor.jpg) | [contents](baseline-tablet-dark-contents.jpg) | [search](baseline-tablet-dark-search.jpg) |
| desktop/light | [normal](baseline-desktop-light-normal.jpg) | [list](baseline-desktop-light-list.jpg) | [editor](baseline-desktop-light-editor.jpg) | [contents](baseline-desktop-light-contents.jpg) | [search](baseline-desktop-light-search.jpg) |
| desktop/dark | [normal](baseline-desktop-dark-normal.jpg) | [list](baseline-desktop-dark-list.jpg) | [editor](baseline-desktop-dark-editor.jpg) | [contents](baseline-desktop-dark-contents.jpg) | [search](baseline-desktop-dark-search.jpg) |

[基準量測](baseline-metrics.json)。非實體裝置，不代表IME／safe area或正式帳號接受。

## T1–T3 真實元件候選圖

同一合成fixture、三裝置明暗，T1為18張正常／另一模式／設定；T2為24張筆記／有效畫線／歷史／已提交搜尋；T3為18張歷史清除／離線移除／局部畫線整段覆寫確認。均為目前feature工作樹真實元件，不是上方靜態提案。

| 裝置/主題 | T1 模式 | T2 筆記/畫線/歷史/搜尋 | T3 歷史/離線/覆寫 |
| --- | --- | --- | --- |
| phone/light | [normal](t1-phone-light-normal.jpg) · [alternate](t1-phone-light-alternate.jpg) · [settings](t1-phone-light-settings.jpg) | [notes](t2-phone-light-notes.jpg) · [highlights](t2-phone-light-highlights.jpg) · [history](t2-phone-light-history.jpg) · [search](t2-phone-light-search.jpg) | [history](t3-phone-light-history-confirm.jpg) · [offline](t3-phone-light-offline-confirm.jpg) · [partial](t3-phone-light-partial-confirm.jpg) |
| phone/dark | [normal](t1-phone-dark-normal.jpg) · [alternate](t1-phone-dark-alternate.jpg) · [settings](t1-phone-dark-settings.jpg) | [notes](t2-phone-dark-notes.jpg) · [highlights](t2-phone-dark-highlights.jpg) · [history](t2-phone-dark-history.jpg) · [search](t2-phone-dark-search.jpg) | [history](t3-phone-dark-history-confirm.jpg) · [offline](t3-phone-dark-offline-confirm.jpg) · [partial](t3-phone-dark-partial-confirm.jpg) |
| tablet/light | [normal](t1-tablet-light-normal.jpg) · [alternate](t1-tablet-light-alternate.jpg) · [settings](t1-tablet-light-settings.jpg) | [notes](t2-tablet-light-notes.jpg) · [highlights](t2-tablet-light-highlights.jpg) · [history](t2-tablet-light-history.jpg) · [search](t2-tablet-light-search.jpg) | [history](t3-tablet-light-history-confirm.jpg) · [offline](t3-tablet-light-offline-confirm.jpg) · [partial](t3-tablet-light-partial-confirm.jpg) |
| tablet/dark | [normal](t1-tablet-dark-normal.jpg) · [alternate](t1-tablet-dark-alternate.jpg) · [settings](t1-tablet-dark-settings.jpg) | [notes](t2-tablet-dark-notes.jpg) · [highlights](t2-tablet-dark-highlights.jpg) · [history](t2-tablet-dark-history.jpg) · [search](t2-tablet-dark-search.jpg) | [history](t3-tablet-dark-history-confirm.jpg) · [offline](t3-tablet-dark-offline-confirm.jpg) · [partial](t3-tablet-dark-partial-confirm.jpg) |
| desktop/light | [normal](t1-desktop-light-normal.jpg) · [alternate](t1-desktop-light-alternate.jpg) · [settings](t1-desktop-light-settings.jpg) | [notes](t2-desktop-light-notes.jpg) · [highlights](t2-desktop-light-highlights.jpg) · [history](t2-desktop-light-history.jpg) · [search](t2-desktop-light-search.jpg) | [history](t3-desktop-light-history-confirm.jpg) · [offline](t3-desktop-light-offline-confirm.jpg) · [partial](t3-desktop-light-partial-confirm.jpg) |
| desktop/dark | [normal](t1-desktop-dark-normal.jpg) · [alternate](t1-desktop-dark-alternate.jpg) · [settings](t1-desktop-dark-settings.jpg) | [notes](t2-desktop-dark-notes.jpg) · [highlights](t2-desktop-dark-highlights.jpg) · [history](t2-desktop-dark-history.jpg) · [search](t2-desktop-dark-search.jpg) | [history](t3-desktop-dark-history-confirm.jpg) · [offline](t3-desktop-dark-offline-confirm.jpg) · [partial](t3-desktop-dark-partial-confirm.jpg) |

T3離線確認曾發現portal未套44px規則，已修正並重拍六圖；[實際操作尺寸](t3-offline-target-metrics.json)。局部衝突fixture第一次privateState回較新revision，檢查同步後回傳合成partial conflict；離線列表fixture只在loopback存合成local-fixture-account的空資源下載與return草稿。未讀正式私人筆記、未寫正式站。

本機預覽：loopback Vite 7150、已安裝UI1.0.76及真正WeeklyReader/OfflineContentPage；API與帳號為synthetic-only，無外部帳號呼叫。圖片不代表真機IME、安全區域、真實文件/PDF逐頁對照、真帳號同步或installed PWA接受。

## T4 整合證據

五語 × 明暗 × 390×600短viewport，各highlights/settings兩張（20張），檔名 `t4-short-{en,ja,ko,zh-Hans,zh-Hant}-{light,dark}-{highlights,settings}.jpg`；[DOM量測](t4-short-locale-metrics.json)確認無橫向溢出、Tabs至少44px且可換行。先前縮放後截圖工具比例異常的20圖已全部由乾淨分頁重拍，實際JPEG均390×600。

另有[空查找](t4-short-en-light-empty.jpg)、[筆記載入錯誤](t4-short-dark-loaderror.jpg)、[儲存結果不明保留草稿](t4-short-light-save-unknown.jpg)。實際鍵盤從Highlights按ArrowRight，焦點及selected均到Earlier annotations。

瀏覽器原生應用快捷鍵實測：100%→110→125→150→175→200%，原生AX選單顯示Zoom:200%；viewport override1440×900時DOM變為720×450、DPR2、visualViewport.scale1、scrollWidth720，證明瀏覽器縮放且無橫向溢出。保存[t4-browser200-light-normal.jpg](t4-browser200-light-normal.jpg)、[highlight](t4-browser200-light-highlights.jpg)、[dark search](t4-browser200-dark-search.jpg)。**縮放截圖工具只捕捉720×336可見區域，未把它當完整450高的視覺接受**；短viewport與實際keyboard Tab測試獨立提供其餘證據，200%完整底部操作、螢幕閱讀器仍列人工接受缺口。原生縮放已復原100%，後續以乾淨分頁驗證DPR/scale1，完成後reset viewport。
