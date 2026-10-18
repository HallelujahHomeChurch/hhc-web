# 第二階段：閱讀體驗與 UI／UX 規格草案

日期：2026-10-18。版本 S2（2026-10-19）。狀態：已完成源碼可行性調查與 UI 方案，待兩位 Codex 實作就緒檢驗；本版本依使用者「照你建議繼續進行下去」授權接續第二階段，通過 spec／plan 檢驗後逐步實作，停在 merge 前。入口：[總覽與發現追蹤](2026-10-18-reader-improvement-roadmap.md)。

## 1. 目標與非目標

讓讀者能理解目前閱讀模式、快速找到筆記／畫線與正文、回到原位置，並保持現有閱讀外觀及第一階段資料可靠性。這些是後續方向，不假稱原五席已一致認可每個設計。

本階段處理 F05–F09 與其餘確認一致性。保留既有主題、字體、正文寬度、PDF 對照、右側搜尋、手機換章、直橫方向兩態 toggle、授權與離線契約；不新增後端搜尋、筆記匯出、書籤、任意 canvas 註記、重新排版發布內容或 PDF。第二階段實作需先整合第一階段的等效修正（PR #234），不能以舊互斥／草稿邏輯為起點。

## 2. 已知現況與待證據

現碼核對基準：`origin/main 1215fcc`；第一階段變更另見 PR #234。`WeeklyReader.tsx` 組合既有 viewport/toolbar/notes；`ReaderSearch.tsx` 明確提交、NFKC 摘要標記與原版頁碼，手機過濾隱藏的 production details；`NotesPanel.tsx` 列出非刪除筆記，`HighlightsPanel.tsx` 依原句 Unicode scalar ranges 顯示畫線並提供既有改色／清除。這些不列為新功能。

既有 `docs/superpowers/plans/2026-10-05-reader-shell.md` 與 `2026-10-12-bulletin-reader-interaction-optimization.md` 是歷史設計／驗收線索；不得按舊 unchecked checkbox 推論功能未實作。原資料／視覺證據見總覽與存檔第5席。

## 3. 功能需求

### P2-R1 紙本／易讀閱讀模式

保留紙本外觀，提供同一已授權文件的易讀呈現；模式是呈現偏好，與直／橫方向及 edition/locale 分開。切換前記住語意 anchor（sentence/component + source page fallback）；切換後原內容可達且不被固定工具列遮住。筆記／畫線引用相同原始 sentence IDs、Unicode scalar ranges，不能改 canonical text、documentId/revision 或授權。

切換遵循第一階段 dirty/operation gate：有草稿先確認；取消保持模式、草稿、焦點，確認才切一次。第一階段進行中寫入、登入／撤銷／離線也須保有原有界處理。無對應 anchor 時回退同來源頁／章首並清楚說明，不能回到無關章節。

待決定：各 renderer revision 在桌面／平板／手機能否提供兩模式；易讀內容取材／隱藏規則；字級、縮放、方向與模式偏好的作用域與預設。預設維持現行呈現，不自動遷移使用者。能力不支援時不展示可按但無效的切換；需要共用 renderer/producer 變更時另列契約與 repo 順序，禁止複製一份 canonical document 或 CSS 強行改壞紙本。此項未定前可分批交付其餘獨立需求，不能宣稱 R1 已完成。

### P2-R2 側欄分區與篩選出口

建議沿用同一 Drawer 以筆記／畫線／歷史三區分頁，預設保留使用者剛操作的類別；實際順序／標籤待低擬真方案與對照圖決定。進入單段筆記時顯示「目前段落」及「顯示全部」，清除只改顯示條件，不 mutate、清草稿或寫閱讀進度。

切頁與關閉遵守第一階段確認規則。重試／復原在目前面板內仍可達，僅一個可操作主入口，不置於 inert 背景，不新增第二個 Drawer。篩選條件綁定帳號、文件、revision；帳號／文件切換清除舊條件，不能帶出其他文件的筆記。

### P2-R3 筆記與畫線搜尋／篩選

只搜尋已合法載入的當前文件私人狀態：筆記正文／引用文字、有效畫線引用；歷史保持獨立，不混成有效標註。依文字及畫線既有三色篩選，空集合明確顯示空結果並可清除；單段與文字／顏色條件採交集並顯示所有啟用條件。

文字比對可沿用現有 NFKC，不改原始正文或 ranges；不因篩選重算或擴大畫線。query/結果不送 telemetry、不寫公開 URL、不新增持久私有全文索引。未載入／離線資料不完整時明示範圍；不能把未知當作零筆。同步、衝突或版本更新後重新計算可見結果，失效項目保留其既有重連／復原入口；jump 必須再次確認目標存在及 allowAction。

### P2-R4 搜尋章節脈絡

保留現有明確送出、摘要標記、原版頁碼與結果導航。補上 canonical component 對應章節名稱；缺名稱以既有頁碼為 fallback，不捏造章節。手機保留現行可見內容過濾，以簡短提示說明搜尋範圍；不導向目前模式中看不到的內容。是否允許切換到另一模式查隱藏內容，留待 R1 決定。

IME 組字中的 Enter 不提交，完成後正常 Enter／按鈕各只提交一次。點結果後關閉面板並定位一次；仍沿用既有重新驗證與導航意圖取消規則。返回搜尋保留該 binding 的已提交字詞／結果與列表捲動，帳號／文件變更清除，禁止新增不受控的全域記憶體快取。

### P2-R5 焦點、瀏覽器縮放與裝置可達性

鍵盤能操作頁籤、搜尋、篩選、確認與復原；Tab 不進入隱藏／inert 背景，Escape 依單一頂層決策規則，關閉回原觸發項，導航到可聚焦目標且保持可見。既有控制項維持至少44px觸控範圍，不以縮字或常駐橫幅塞入新工具。

瀏覽器200%縮放及390×480短 viewport 為最低驗收案例，外殼不橫向溢出、主要控制項可捲動到達；紙本既有縮放／平移可保留，但不能讓整站縮放失去操作。尊重 reduced motion。實體 iPhone/iPad/Android 輸入法、鍵盤、safe area、旋轉需獨立紀錄；不能用 viewport 成功代表實機。

### P2-R6 剩餘原生確認一致性

先列出畫線歷史清除、部分色彩復原與離線清單刪除的真實 caller、資料影響及取消結果，再復用站內 AlertDialog。不是把所有瀏覽器 unload/system dialog 全面換掉；不能承諾攔截 OS 關閉。刪除／清除不改既有 API、CAS、離線與復原語意。取消零 mutation；確認一次操作，失敗保留資料並可恢復焦點。

## 4. 視覺與契約護欄

先用固定合成文件／筆記保存 baseline：390×844、768×1024、1440×900，明暗模式；閱讀、目錄／搜尋、筆記／畫線／歷史各狀態。V1 正常閱讀不增加常駐工具列、橫幅或正文佔位；V2 延用既有 tokens/字體/配色/間距，設計變更集中在面板與必要模式控制；V3 正文與原 PDF 對照、選取 ranges、跳轉位置與字型 ready 必須分開驗證；V4 長標籤、五種 UI locale、空／錯誤／復原／長列表及短 viewport 都須比較；V5 兩位 Codex 實際看 baseline/candidate，Critical/Important 未解不得進下一步。

紙本模式下正常正文邊界、行距、換行不應因側欄查找變動；易讀模式的預期換行差異另有核准圖，不用它掩蓋紙本退步。恢復資料仍綁定 account/edition/document/revision；撤銷、登出、到期、版本切換與 late response 不能讓舊私人資料回流。不得記錄 query/筆記/憑證或新增服務。

## 5. 驗收對應

| ID | 主要案例與必要證據 |
| --- | --- |
| P2-A1 ↔ R1 | 每種受支援 renderer/裝置的雙向切換、同句定位、原版頁碼、畫線 ranges；dirty取消不切、確認只一次；不支援不誤導；離線與revision變更 |
| P2-A2 ↔ R2 | 單段→顯示全部、跨分頁草稿確認、復原入口仍可按、焦點返回、帳號／文件切換清條件；空與長列表 |
| P2-A3 ↔ R3 | 繁簡中/日韓/拉丁/emoji/全形比對、複合篩選、顏色、未完整載入、sync更新、失效anchor；查找前後原資料不變 |
| P2-A4 ↔ R4 | 有／無章節名、source page fallback、手機隱藏內容提示、IME Enter、回搜尋位置、重驗證與切帳號取消、一次導航 |
| P2-A5 ↔ R5 | 鍵盤／螢幕閱讀器、200%瀏覽器縮放、44px、短 viewport／soft keyboard／safe area／旋轉；模擬與真機分開 |
| P2-A6 ↔ R6 | 每個確認caller的取消、確認、失敗、CAS衝突、卸載、雙決策防護；不以OS卸載全面攔截為接受條件 |
| P2-A7 共通 | 五語、light/dark、正文對照圖與量測、原PDF correspondence、畫線offset/重連/離線/授權/草稿回歸；兩席審圖及完整repo CI |

## 6. 實作前阻塞與後續流程

- O2-1：fresh origin/main 與 PR #234 整合狀態、每個既有功能／caller盤點；歷史plan與現碼差異。
- O2-2：R1 雙模式 renderer 可行性、內容範圍／偏好、anchor fallback 與跨 repo owner；未解就明列拆批，不假定純 CSS 可做。
- O2-3：R2 分區與R3搜尋具體低擬真布局、控制項密度、五語及小螢幕；選定並保存比較圖。
- O2-4：第一階段實機first-save/IME問題的事件證據，與本階段鍵盤/縮放測試裝置取得方式；無裝置就明列未驗收。
- O2-5：每個 R6 destructive caller 的實際語意與取消流程。

先解實作阻塞並修訂 spec → 兩位 Codex 檢驗 → implementation plan → 兩位 Codex 檢驗 → 依使用者授權實作且每步兩席 → PR/CI → merge前停止。這次僅保存規格，不開始上述調查或實作。


## 7. S2 調查結論與定案（取代前文相同事項的待決定描述）

本節明確定案；未列為解除的真機／真實文件接受仍維持未驗收。可行性與每步檢驗記於 [第二階段 gate](../../reviews/2026-10-19-reader-experience-gates.md)。已在獨立feature worktree整合 PR #234（`5d6e027`）與文件PR #235（`29cb626`），不merge main或改動原PR。來源 UI1.0.76、renderer registry v1–v10、BulletinEbook／PaperViewport；已安裝版本可使用同canonical document與sentence/scalar契約，不需backend／SDK／共用UI變更，未知renderer仍拒絕，snapshot版本仍走原驗證。

### D1 模式與裝置分離

- `mobile`只代表實體viewport外殼與輸入（工具列、Drawer、觸控選句）；`reflow`代表正文呈現（Ebook／Paper、章節、搜尋隱藏範圍、來源頁／anchor、字級或zoom/direction）。全部caller逐一分類，不能用全域字串取代把兩者再次混成一個flag。
- 未選偏好時沿用現行responsive預設：手機易讀、平板與桌面紙本；手動選後獨立於寬度，使用sessionStorage `${storageKey}:mode`保存 `paper|easy`，binding包含account/document/revision，沿用既有position前綴清除規則。失敗降為本次記憶體偏好，不保存正文或query；舊偏好無新欄位仍正常。
- 易讀沿用showDetails=false，保留現行隱藏production details政策。紙本原內容完整不變；文字選取輸入仍依裝置（觸控句選／桌面range），RangeHighlights幾何依mode。紙本zoom/direction只對紙本，易讀字級/行距沿用現有偏好。紙本手勢僅其適用模式啟用，手機瀏覽器原生pinch與縮放權不得截斷。
- 控制項放在既有目錄panel最上方的「閱讀模式」兩態控制；易讀於同panel顯示既有字級/行距控制，手機紙本於同panel提供既有紙本zoom／方向控制。原正常工具列不新增按鈕；手機既有字級按鈕仍開設定panel，內容依模式顯示。桌面zoom/direction只在紙本顯示。清楚區分mode與方向，支援全部四種裝置/模式組合。
- 切換前捕捉實際可見sentence、fragment scalar offset、來源頁與component（DOM可取得時）；經既有closeNotes/decision gate後再驗binding/allowAction/是否仍為原mode，使用者取消保留原mode與草稿。多次啟動只接受當下有效決策，不在晚到回應後跳頁。
- 目標定位優先相同sentence+offset在來源頁的fragment；不存在／被易讀政策隱藏時改同來源頁第一個可見fragment；來源頁沒有可見內容時回原component所屬章首。fallback顯示一次局部提示，不能直接宣告成功或無條件回封面。mode變更只改本地呈現，不生成私人mutation；之後真實閱讀捲動仍按既有progress契約。

### D2 單一筆記面板

- 標題與唯一同步／復原入口 → 使用既有UI Tabs的「筆記／畫線／舊版標註」 → 當頁篩選 → 結果；使用者從筆記圖示預設進筆記頁，單段入口也是筆記並顯示「目前段落／顯示全部」。只有列表態展示分頁；editor/reanchor/delete-conflict/Recovery沿用原面板內容與草稿保護，不由tab繞過dirty gate。
- 筆記搜尋比對text+quote；畫線搜尋比對原始有效ranges組成的quote，加全部/黃/紅/藍條件。顏色與字詞為交集。歷史保持原restore/discard流程，不納入有效畫線搜尋。切往其他類別清除單段**note ID**條件；不得把note ID當sentence ID。
- query/顏色/清除條件僅更新顯示state，不呼叫closeNotes/cleanupNotes，也不增加draft generation；不為純filter建立mutation或progress。同步資料更新即重新計算；沒有合法state先顯示載入／局部錯誤，不當零筆。每頁顯示可理解的結果數、空結果與清除入口；失效anchor資料保留既有復原／重連入口。
- 不增加全域cache；query留本binding mounted component記憶體，帳號／revision卸載清除。Tabs使用現有React Aria封裝的鍵盤行為；長五語標籤換行、控制項44px，面板可整體捲動，不把全部搜尋/filters固定造成結果零高度。

### D3 正文搜尋與瀏覽器縮放

章節脈絡優先canonical component可辨識標題（body section），其餘用現有chapter labels；無資料就只顯示原版頁碼。不改NFKC摘錄及原始文字。隱藏提示依易讀mode而非裝置。ReaderSearch目前在hidden aside常駐，沿用以保留query/submitted與結果scroll；補composition ref與submit guard，IME Enter組字不提交，不另設globalcache。沿用既有useReaderSearchNavigation與取消／重驗證。

移除攔截Ctrl/Cmd +/-的紙本zoom捷徑，讓瀏覽器200%縮放正常；紙本既有按鈕／手勢仍可用。新增面板不得破壞Escape／焦點回觸發項或讓inert背景可操作。

### D4 三個剩餘確認caller

1. HighlightHistory→discardHighlightHistory：共用reader頂層單一決策入口，確認前凍結history ID/revision，決策後重驗目標仍存在與可操作；取消零mutation，保留原pending防重送及失敗alert。歷史內正在編輯restore範圍時，切分頁不可丟掉該內容；採保持掛載的tab內容或明確攔截並站內確認，不默默重置。
2. ReaderRecovery partialConflict→resolveHighlightMigrationConflict：同一reader decision入口；顯示選色會覆蓋完整目標的警告。決策後重驗prepared/conflict ID/currentRevision與binding，再進原run/exclusive/epoch流程；取消或卸載不送出，非partial維持原無額外確認流程。呼叫端保存當時選色，不取後來可變state。
3. OfflineContentPage→removeOfflineSave：獨立頁面用自己的AlertDialog，沿用remove函式的刪除範圍；原removeOfflineSave的IDB transaction目前沒有caller expected identity檢查，因此需加optional expected條件，在同一readwrite transaction重驗owner epoch、pointer document/revision、每次save instance與完整pending快照，不以UI先查替代原子比對。對話期間記住精確selector/document與owner。每次commitOfflineSave/commitOfflineUpgrade均產生新的本地save instance ID（optional additive欄位，舊儲存無ID時先在原子讀取預覽中補ID，不改IDB version或server schema），相同revision/epoch重新下載也必須換ID。預覽與刪除共用精確binding的移除快照：owner、pointer、save instance，刪除實際涵蓋所有revision的private queue完整envelope/result/resolution fingerprint，以及本分頁account/document的return-state（pending與草稿）。queue或return即使仍為非空但內容改變，也視為漂移；return-state僅於本分頁在IDB交易前／提交前及完成後同步重驗，清理只清仍匹配的快照；不屬IDB跨storage原子保護，不能宣稱兩個storage原子提交。提交前失效就abort該transaction；提交後發現新return則保留新return、不清掉新草稿。sessionStorage只可保護本分頁，其他分頁尚未入IDB的記憶體/return不可見，不承諾全域掃描。確認後重新查owner、pending及save identity（revision/epoch/instance），有漂移先取消並要求重新決策，不以舊快照刪除新下載；有待同步用較強警告。帳號切換、卸載、重複點擊失效舊決策。失敗不移除UI項目，不改持久化刪除語意。

### D5 UI 方案與證據範圍

[提案畫面與說明](../../reviews/reader-experience-20261018/README.md) 使用第一階段正常閱讀基準作背景，疊加**靜態低擬真方案**，供位置／密度／配色檢查。它不是產品功能或無障礙／操作驗證，原prototype按鈕不作成功證據。真實candidate與baseline仍須於實作各步兩席看圖，並重做模式四組合與五語/短viewport/200%縮放。實體手機IME、soft keyboard、safe area與真實v1–v10文件/PDF對照列未驗收，不因本次單repo可行就宣稱已完成。

O2-1、O2-2（單repo方案與偏好）、O2-3（低擬真布局）、O2-5（三caller語意）在此已有明確方案，實作就緒gate需確認方案可測與無資料風險。O2-4沒有真機證據，保留正式接受缺口，不拿桌面模擬代替，也不因無裝置杜撰pointerdown修法。S2經雙席檢驗後才寫實作plan；仍每步兩Codex，最終PR綠CI停merge前。
