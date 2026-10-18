# 第二階段閱讀體驗：逐步檢驗紀錄

日期：2026-10-19。使用者授權接續調查、spec、plan、逐步實作、PR與CI，停在merge前。每步兩位Codex；顧問只讀，root寫入。沒有Gemini新請求。

基底：fresh origin/main 1215fcc建立feat/reader-experience-20261018；FF整合PR234的5d6e027，再merge文件PR235的29cb626，整合HEAD9c2b414。未改原PR、未merge main。所有產品碼仍為第一階段既有內容，spec gate完成後才寫plan／改產品碼。

## F0 可行性與UI方向（兩席完成）

Codex phase2_renderer_audit：CHANGES_REQUIRED，明確確認UI1.0.76與v1–v10同canonical雙模式可用，需拆裝置/mode並處理source page/scalar/fallback；S2採納響應式預設、binding scoped偏好與完整四組合。
Codex phase2_ux_audit：CHANGES_REQUIRED，要求具體側欄分區、noteFilter出口與generation不變；指出ReaderSearch已常駐保留state，不另造cache；移除攔截瀏覽器縮放捷徑；列三個native confirm真實caller與async決策guard。S2逐項定案，並針對removeOfflineSave補原子expected identity/pending要求。

兩席完成後root補S2與18張[靜態UI提案](reader-experience-20261018/README.md)。畫面是概念，不能代替真實產品candidate或真機。

## S2 Spec 實作就緒檢驗

Codex p2_spec_visual：PASS，實際看18張提案與三裝置各一張現況；無Critical/Important。
Codex p2_spec_data：一項Important為same-revision重下載及全revision queue/return刪除競態；S2補save instance與完整queue fingerprint，同席唯一窄複核確認主體解除，要求return清理只清匹配快照且不得稱跨storage原子。Root已按其精確修法補交易前/提交前/完成後的本tab檢查、提交前abort與提交後保留新return，並核對文字，無未處置Important。

原兩席模型派遣在平台切換時未產生報告（其中一席回unsupported-model）；不計PASS。恢復後的本輪兩席正常完成，未改用Gemini或額外覆核席。S2實作就緒gate完成，可寫plan；真機接受缺口仍保留。


## P1 Plan

p2_plan_logic PASS；p2_plan_ux初查要求補目錄／已提交搜尋基準及三類列表fixture，P1補齊後同席唯一窄複核PASS。產品碼尚未變更。

## T0 Baseline

整合HEAD9c2b414，合成fixture固定帳號／文件／筆記，加入有效yellow畫線與red歷史。三裝置各light/dark normal/list/editor/contents/submitted-search共30張；font ready、visible paper與可用notes等待後保存。量測見baseline-metrics.json。歷史資料是fixture decorator，只在預覽，不寫正式資料。p2_plan_logic與p2_plan_ux在T0新任務中各實看13張，皆PASS，沒有loading冒充。T0完成後才改產品碼。


## T1 模式／裝置分離

兩席p2_t1_data、p2_t1_visual獨立看產品碼與candidate；資料席看10張、視覺席看18張candidate+6張baseline。初查Important：viewport外句子／留白fallback、手機paper缺聚焦選句語意。root修上下界與source component，renderer僅暴露鍵盤語意、既有hook單一selection owner；新增blank/offscreen與Enter/Space各只一次回歸。另在審查中修live mode/request與scalar source page。兩席各唯一窄複核PASS。6檔172 tests pass；型別與scoped lint通過（僅npmrc設定提示）。無真機接受宣稱。

## T2 側欄與搜尋

保留原單一feedback與Recovery；使用house Tabs，歷史restore草稿存列表受控state，不依賴house TabPanel卸載保留。filter不呼叫closeNotes、不改generation。兩席p2_t2_logic與p2_t2_visual完成；視覺席實看24張candidate及6張baseline。共同Important：新列表noteCount覆蓋原editor字數鍵。root改noteResultCount，五語保留原字數語意，補五語Unicode字數回歸；兩席各唯一窄複核PASS。5檔135 tests及4檔32窄回歸通過。型別與scoped lint通過。T2 gate完成後才進T3。


## T3 確認視窗與離線刪除

p2_t3_data初查PASS；p2_t3_visual實看18張confirm與3張baseline/T2，唯一Important為OfflineContentPage portal未套44px。root加既有局部overlay標記，六張離線圖重拍，三裝置明暗所有取消/移除/關閉皆至少44×44px，見metrics。另加listing generation檢查避免owner通知後舊列表回填。兩席各唯一窄複核PASS。11檔236 tests及最終OfflineContentPage 8 tests、tsc/scoped lint通過。零window.confirm caller。保留sessionStorage非IDB原子、其他tab未入列memory不可見的限制。T3 gate完成後進T4。

## T4 最終整合

p2_t4_logic PASS，追完mode/progress、Tabs/IME與offline原caller；p2_t4_visual PASS，實看40張含20張五語短viewport、三裝置T1/baseline、T2搜尋、T3三種確認及T4空/錯誤/200%。沒有未處置Critical/Important。

完整本機驗證：173檔1384 tests、8個Node checks與frozen-template通過；TypeScript/build通過；static budgets 4 fonts／hero140091 bytes／CSS194565 bytes；release-policy exit0；lint僅既有LegalRequiredNavigation警告。fallback文案改nearby避免chapter fallback誤稱同頁後，2檔26 tests窄回歸通過。零依賴變更，沒有私有API／server schema變更。

200%原生快捷鍵與DOM量測已確認，截圖工具僅捕捉720×336，未認定完整底部操作接受；五語短畫面全部已重拍為390×600，Tabs44–67px。真機IME／keyboard／safe area／旋轉、螢幕閱讀器、真帳號／installed PWA／真實v1–v10 PDF仍未接受。

此提交checkpoint準備進入stacked PR/CI；CI與OPEN/unmerged以PR最新head checks讀回為準，不從本機通過推定CI或部署接受。使用者停止邊界為merge前，worktree因未合併保留。
