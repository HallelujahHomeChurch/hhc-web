# 週報閱讀器介面調查（2026-10-17）

分支：`fix/bulletin-reader-light-typography-20261017`，由當時最新 Web `origin/main` `17d3d3c` 建立獨立 worktree。本輪只處理閱讀呈現，不重新轉換／修改已發布週報，亦不合併發布此分支。

| 問題 | 正式頁面證據／原因 | 分支處理 |
| --- | --- | --- |
| Light 文字調整四個圖示看不到 | ReaderTypography 未指定 variant，預設 primary；閱讀器覆寫背景為 rgb(255,253,249)，但圖示仍為 rgb(255,248,244) | 四個控制使用既有 ghost variant，圖示改用主題文字色；保留 disabled、ARIA、尺寸上下限 |
| 章節／講員目錄相連 | 390px 實測章節 bottom=276、講員 top=276，margin=0 | 相鄰 reader-sections 增加 .75rem（預設12px），展開／收合沿用原流程 |
| 標楷／一般／重點是否同大 | 1743 信息回應預設18px：body384個spans為18px、scripture120個spans為18px及3個spans為15.4286px、emphasis156個spans為18px。這是DOM span數，不是段落數。粗體字重700，其他400；字面視覺大小亦依字型不同 | 原先基準相同，但3個 scripture spans 帶有0.857143em來源比例；依追加需求，電子書現在忽略全部來源字級比例，經文固定比所在文字層級大1px；紙本模式保留比例 |
| 信息回應框內標題縮一級 | 18px正文時，框內 h2 為1.333em，約23.994px | 僅 .hhc-ebook-body-heading h2 改為既有h3級1.167em，約21.006px；保留h2語意、講員、封面及固定紙本renderer |

範圍：Web ReaderTypography與reader.css。依賴版本不變；不需BE或Platform新release，不修改Frozen V10 artifact。窄螢幕的標題字級隨閱讀字級16–28px同比縮放，約18.672–32.676px。

驗證：原正式頁面只讀量測；暫時載入分支CSS並將四個控制套用ghost class，量得12px間隔、21.006px標題，淺色圖示rgb(55,45,43)／底rgb(255,253,249)，深色圖示rgb(243,236,231)／底rgb(40,35,33)，截圖視覺檢查通過；最後reload清除暫時CSS及DOM變更。這是可逆的瀏覽器預覽，不當作分支已部署或完整本機登入流程驗收。既有ReaderTypography與SectionNavigator針對測試通過。

未驗：實體手機／PWA。最終測試與CI結果見PR。


追加電子書規則：閱讀器現有設定單位是CSS px，依18→19的指定例子固定加1px，而非改用CSS pt。所有電子書文字片段覆寫來源inline font-size為inherit；scripture另設calc(1em + 1px)，因此一般／重點18時經文19、20時21、28時29。封面經文與信息中的scripture共用同一規則；標題維持自己的語意層級。規則限.reader-document[data-mobile]內的.hhc-bulletin-ebook，不修改來源資料、紙本renderer或Frozen V10。

沿用scripts/bulletin-refactor-browser-fixture.mjs新增mountTypography(locale)：以真實BulletinEbook與BulletinDocumentRenderer呈現合成資料，刻意帶0.857143em與1.42857em的來源比例，透過真實ReaderTypography按鈕測繁簡兩版18→28→16，24個狀態全部通過：電子書一般／經文／重點永遠為[n,n+1,n]，上限與下限按鈕正確停用；每次PDF模式仍為[16,16,26.6667]px，來源JSON完全未變。390px淺深色截圖已檢查。這是本機真實元件的合成資料驗證，不是正式會員流程或實體裝置驗收。

追加規則本機驗證：8個Node檢查與148檔／1,222項Vitest通過（--maxWorkers=2）；lint無錯誤、保留1個既有LegalRequiredNavigation警告；production build、static budget、release-policy、diff check通過。PR保持草稿，未合併發布。
