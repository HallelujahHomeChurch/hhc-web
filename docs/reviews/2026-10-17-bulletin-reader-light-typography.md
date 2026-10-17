# 週報閱讀器介面調查（2026-10-17）

分支：`fix/bulletin-reader-light-typography-20261017`，由當時最新 Web `origin/main` `17d3d3c` 建立獨立 worktree。本輪只處理閱讀呈現，不重新轉換／修改已發布週報，亦不合併發布此分支。

| 問題 | 正式頁面證據／原因 | 分支處理 |
| --- | --- | --- |
| Light 文字調整四個圖示看不到 | ReaderTypography 未指定 variant，預設 primary；閱讀器覆寫背景為 rgb(255,253,249)，但圖示仍為 rgb(255,248,244) | 四個控制使用既有 ghost variant，圖示改用主題文字色；保留 disabled、ARIA、尺寸上下限 |
| 章節／講員目錄相連 | 390px 實測章節 bottom=276、講員 top=276，margin=0 | 相鄰 reader-sections 增加 .75rem（預設12px），展開／收合沿用原流程 |
| 標楷／一般／重點是否同大 | 1743 信息回應預設18px：body384個spans為18px、scripture120個spans為18px及3個spans為15.4286px、emphasis156個spans為18px。這是DOM span數，不是段落數。粗體字重700，其他400；字面視覺大小亦依字型不同 | 不變更字級／內容規則。基準相同，但3個 scripture spans 明示0.857143em原稿比例，所以並非全部等大；BulletinEbook使用span.fontSize/block.style.fontSize |
| 信息回應框內標題縮一級 | 18px正文時，框內 h2 為1.333em，約23.994px | 僅 .hhc-ebook-body-heading h2 改為既有h3級1.167em，約21.006px；保留h2語意、講員、封面及固定紙本renderer |

範圍：Web ReaderTypography與reader.css。依賴版本不變；不需BE或Platform新release，不修改Frozen V10 artifact。窄螢幕的標題字級隨閱讀字級16–28px同比縮放，約18.672–32.676px。

驗證：原正式頁面只讀量測；暫時載入分支CSS並將四個控制套用ghost class，量得12px間隔、21.006px標題，淺色圖示rgb(55,45,43)／底rgb(255,253,249)，深色圖示rgb(243,236,231)／底rgb(40,35,33)，截圖視覺檢查通過；最後reload清除暫時CSS及DOM變更。這是可逆的瀏覽器預覽，不當作分支已部署或完整本機登入流程驗收。既有ReaderTypography與SectionNavigator針對測試通過。

未驗：實體手機／PWA、收件人實收；未擅自將原稿縮小經文統一放大。完整測試／lint／build結果於完成後補充。
