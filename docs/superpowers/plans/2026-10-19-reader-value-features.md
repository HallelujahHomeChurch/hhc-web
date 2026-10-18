# 第三階段閱讀加值功能實作計畫

2026-10-19。依[S2規格](../specs/2026-10-18-reader-value-features-design.md)與[逐步紀錄](../../reviews/2026-10-19-reader-value-features-gates.md)。使用者批准跨裝置書籤及僅個人筆記／來源匯出；每一步兩位獨立Codex只讀檢驗，Critical/Important先處置，才進下一步。root實作，不merge、不publish、不部署、不寫正式資料。

## 基底、範圍與保護

- Web獨立worktree reader-value-features-20261019，疊在PR236的8974b886；PR234/235/236保留。第二階段正常正文、筆記側欄、明暗／三尺寸與五語圖在docs/reviews/reader-experience-20261018，作immutable baseline；不改既有renderer或標準閱讀工具列。新功能只加筆記列表內入口／書籤Tab。
- API獨立worktree reader-value-api-20261019由fresh b072123建立，SDK reader-value-sdk-20261019由fresh044232c建立。實作前確認各repo AGENTS/README/CI與實際caller；Gateway既有exact state/mutations route只讀確認。
- 現有executor/exclusive、UUID fingerprint、CAS、account/epoch/instance、publication/DSR fence、offline receipt與舊note/highlight/progress行為保留；不建立新同步queue。

## T1 API與SDK契約（兩席：資料安全／相容與回歸）

1. API新增Bookmark model、四種strict mutation、result/current state欄位；clone、Unicode名稱與scalar+canonical fragment頁碼驗證；100active、CAS、冪等、刪除tombstone與revision一次失效。
2. additive migration104或fresh main下一號；parent FK cascade。沿原transaction讀寫、terminal dedup、完整state loading；DSR count/cascade/fence同時更新。既有privacy caller只按真正能力擴充，無固定匯出不新增服務。
3. producer OpenAPI→SDK OpenAPI→generate/types/export；bookmarks optional以辨識舊producer，新producer永遠[]。SDK沿現有methods，不造新route。同步consumer型別用真實packed candidate，版本不假設已發佈。
4. critical tests：跨account/document、strict payload／CAS／duplicate UUID payload drift、兩次rename或delete、active limit、同句跨頁錯誤offset、fixed-slot、revision多次／重綁、DSR並行；舊notes/highlight/progress回歸。SDK generated／package contract與原client methods驗證。
5. 先跑targeted，再跑各repo必要完整tests/lint/build/generated/package/packed與適用integration；保存命令與結果。兩席讀real callers與測試，PASS後才進T2。

## T2 個人筆記匯出（兩席：快照／下載與UI）

1. 先追列表→WeeklyReader→usePrivateReader→offline-store／sync／return-state。加唯讀snapshot到既有exclusive，成功load provenance、pending／loadError／paused／conflict阻擋。IDB同transaction取得及重驗owner epoch／pointer／instance／revision、state/confirmed/full queue；只接受sent===false且沒有任何復原／結果標記，匯出不flush或發mutation。
2. 最小純Markdown builder：200notes／8MiB、逐段UTF8上限、動態fence、no quote、受控檔名與HTTPS來源。原始scalar→source fragment；不確定位置標待確認。freeze note IDs/versions及binding/queue fingerprint，產生後與下載前重驗；async後檢live generation與實際userActivation，不支援或失效明示拒絕。
3. house dialog與notes Tab次要入口，全量／當前篩選數，草稿排除與私人檔案說明，兩階段準備／下載，bounded URL lifecycle／取消焦點。五語字串，不改正常正文。
4. targeted tests涵蓋安全文字、Unicode／資源上限、篩選／零筆、durable未送出／unknown阻擋、IDB和account/receipt/generation漂移、activation／Blob失敗及URL釋放、無queue／draft副作用。完整Web tests/lint/type/build與靜態perf/release policy；兩席PASS後才進T3。

## T3 書籤consumer候選（兩席：同步／互動與資料保護）

1. 先提交T2並保留可獨立正常registry CI的匯出分支。由其確定head另建隔離bookmark consumer worktree；只在此使用local packed SDK candidate。保存pack checksum與producer/SDK exact head，不將file／tarball／未發佈版本寫入正式package.json或lock。
2. 擴充既有foreground/exclusive send內online-only分支，阻擋offline／unknown／pending queue／舊producer。return-state validAction與Recovery支援新kind與同ID retry；未知不清草稿，conflict明示雲端／草稿，reanchor需新操作新ID。
3. ack後以IDB transaction只合併bookmarks至state/confirmed，重驗owner epoch／pointer／instance／revision，保留另一tab queue與所有其他私人資料；cache失敗保持已知server ack並顯示離線副本未更新，不新ID重送。
4. ReaderNotesList加書籤Tab，controlled draft跨Tab保留；exact sentence/scalar/page才建立與跳轉，失效明確重綁，hidden target須明確切paper。house dirty/delete decision與root operation gate；長名稱、100筆、offline readonly、能力缺失與錯誤狀態。五語、44px／keyboard／焦點與現有notes/recovery並存。
5. critical tests覆蓋四操作、同ID retry／timeout／晚回應、CAS resolution／deleted、revision／hidden target、跨tab queue/cache failure、account drift／離線、controlled draft與dirty close、舊producer相容。packed環境完整type/tests/build及package assertions，區分registry未發佈gate。兩席PASS後才進T4。

## T4 視覺與完整交付（兩席：實看視覺／交付完整性）

1. 本機fixture preview使用真實candidate元件與明示假資料，無正式筆記讀寫。三尺寸desktop/tablet/phone、明暗，正常正文baseline/candidate配對；匯出對話／書籤列表／空／長名稱／離線／衝突／dirty及五語長標籤、短viewport／200%驗證。圖片記尺寸、模式、fixture及source head，兩席實際看圖；問題修完再窄複核。
2. API、SDK、匯出Web各自focused PR、獨立CI，保留stacked base及相容順序。每個PR exact head綠CI、OPEN／mergedAt null／autoMerge null。書籤consumer保存reviewable commit/diff與packed證據；若能在不提交未發佈依賴下開draft，清楚標blocked，不能假稱標準registry CI或ready。
3. 最終兩席讀回實際PR／CI／heads、gates與scope；不把local packed、圖片、合成測試當真帳號跨裝置、iOS/Android IME/Files／safe area/旋轉／螢幕閱讀器／installedPWA或真實PDF接受。這些與SDK發佈後consumer精確pin+registry CI列獨立gate。

## 停止點

所有能在merge前完成的實作、檢驗與CI完成後停。producer→SDK已發佈→consumer exact registry pin是merge後序列；不為解除依賴merge/tag/publish。保留所有未合併worktree與分支，明確交付可review成果、CI與實機／發佈缺口，不執行release或cleanup。
