# Reader notes reliability：文件階段檢驗紀錄

日期：2026-10-18。使用者要求 spec → 兩席檢驗 → plan → 兩席檢驗 → 實作前停止。每階段均為一席 Codex、一席 Gemini，無隱藏覆核席。顧問只讀，root 只修改本次文件。

文件：[spec](../superpowers/specs/2026-10-18-reader-notes-reliability-design.md)、[plan](../superpowers/plans/2026-10-18-reader-notes-reliability.md)。原碼固定基準 `6fd3fd0d9bc44a61aff9b252df613b27ca61fbfb`。

## Step 1：spec

| 席次 | 審查版本／結果 | 處置 |
| --- | --- | --- |
| Codex spec_gate | S1 CHANGES_REQUIRED；S2 針對性複核 PASS | 補執行時最新 state／generation、無 rerender 續送與 rollback 測試；20 秒 UI 等待涵蓋 lock／IDB／整段 sync，不能提早釋放實際互斥 |
| Gemini，requested model gemini-4-argon-high | S1 初查於 CLI print timeout 回傳部分 CHANGES_REQUIRED；同一席針對修訂條款最終明確 PASS | 補已知離線衝突結果、雲端已刪除／採用雲端、關閉／卸載界線、retry/recovery 按 operation 結算與保留草稿 |

Codex 的非阻塞用語建議已採用：「原實際工作結束後可原 ID 重試」，不要求先知道伺服器結果。Root 同時將無原生確認的驗收限定於本次筆記／離開路徑，沒有把畫線歷史、部分色彩復原或離線清單清除算成已修。

S3 納入所有阻塞處置及 A1–A12 補充條件。Codex 最後複核 S2 的原兩項阻塞已解除；Gemini 最後複核 S3 新增條款明確 PASS。未將最初截斷的 Gemini 輸出當完成審閱；同一 conversation 的針對性補查才是其完成判定。CLI 兩次 exit 0，最終 structured status SUCCESS 且無 timeout stderr；原始輸出留在本次 /private/tmp 任務資料夾，不含正式筆記或憑證。回傳未另提供可靠 returned-model 欄位，不把 requested model 當服務端模型證明。

**Gate：完成。** Spec 檢驗與處置完成後才建立 plan。這不是功能或真機驗收。

## Step 2：plan

| 席次 | 審查版本／結果 | 處置 |
| --- | --- | --- |
| Codex plan_gate | P1 CHANGES_REQUIRED；P2 針對性複核 PASS | ReaderRecovery 的 retryPending／choose 與 upgrade prepare／finish replay 全部納入同 reader execution gate；保留 prepared revision，明定 local gate → account Web Lock、不重入，增加 deferred recovery 期間並行峰值／envelope／timeout／關閉／deadlock 測試 |
| Gemini，requested model gemini-4-argon-high | 首次 print timeout 無答案，不計完成；同一席續查 P1＋P2 增補後最終明確 PASS | 無 Critical／Important；非阻塞提醒已採用，focused 指令補 upgrade.test.ts |

Gemini 續查沿用同一 conversation，未增加或替換席次。最終 CLI exit 0、structured status SUCCESS、非空最終結論且無 timeout stderr。沒有將模型對計畫的評價當作實際互斥／資料安全已驗證的證據。

**Gate：完成，無未解阻塞。** 兩席檢驗與處置完成後，root 只更新文件狀態、驗證指令與本紀錄，沒有開始 T1。

## 文件驗證與停止點

已檢查三份文件相對 links、R1–R6／A1–A12／T1–T5 編號、列出的 focused 測試檔、README／CI 指令及逐檔 whitespace diff。使用 git diff --no-index --check 檢查新增文件時接受正常的「有差異」exit 1，另要求 stdout/stderr 無 whitespace 錯誤；不是忽略錯誤。

狀態核對僅有這三份新增文件，tracked source diff 為空；文件保存在 docs/reader-notes-reliability-20261018 分支的專用 worktree，尚未 commit/push。停止在 T1 前。沒有安裝依賴、執行產品測試、改 source、PR、merge、release 或正式筆記增修刪。實體裝置與第一下操作根因仍待後續測試，文件 gate 不取代它們。

## Implementation authorization and visual amendment

User authorized implementation through PR and green CI, stop before merge. S4/P3 visual amendment independently reviewed by Codex visual_spec_gate and Gemini (official agy, gemini-4-argon-high requested), both PASS. Adopted nonblocking PR/release heading clarification. Synthetic screenshot capture requires Page.bringToFront; native CUA fallback stalled and is no longer used. Official stream-json supports text blocks only; Gemini image capability verified using official view_file on one explicitly scoped synthetic test PNG, no other tools/files permitted. No private production screenshots sent. T0 baseline acquisition completed as recorded below.

## T0：合成視覺基準

18 張 baseline：390×844／768×1024／1440×900，light/dark，各 normal/list/editor。均使用合成帳號、文件、筆記；等待字型 ready 與正文可見後截圖。Codex t0_baseline、Gemini（official agy，requested gemini-4-argon-high）均實際看圖。初查指出部分載入中截圖，重拍後同席針對性複核均 PASS。這是瀏覽器 viewport 證據，不是實體 iOS/iPad/Android 驗收。完整圖與量測目前保留於本機任務暫存資料夾，尚非 PR 發布附件。

## T1：失敗重現

原 source 未修改前建立 background progress→first foreground、lost ack→explicit same-envelope retry、無 rerender rollback、cloud-deleted conflict 四項失敗測試；原有十項通過。Codex t1_tests PASS；Gemini 初查要求更強 payload／不自動重試／最終 outcome／submission guard 斷言，補齊後同席最終 SUCCESS PASS。Cloud-deleted editor 測試預期至 T4 才通過，未以跳過測試冒充綠燈。

## T2：共用執行互斥（檢驗中）

原 API deadline race 不代表底層 transport 已結束，因此新增按 caller signal 的實際 operation 追蹤，gate 等真正工作 settle 才釋放；UI 仍有 20 秒上限。保留原 pending envelope，最多一筆前景意圖與最新未送進度，Recovery prepare/retry/choose/finish 共用 gate。已知離線 note_conflict 保留 durable queue 並回傳衝突。

Codex t2_gate 指出三項 Important：deadline wrapper 提早放 gate、load fallback 覆寫新 state、finish replay 未發布最終 state。三項已修；同席複核確認前兩項與 offline finish 修正，指出 direct Apply 不應重發舊 prepared state，root 已依明確修法移除 direct 分支發布。新增對應回歸；94 tests pass（API／hook／real IDB／Recovery／upgrade）。Gemini 首次實際請求由 subprocess timeout 結束，無答案；同席唯一一次重試 exit 0、payload.status=SUCCESS，但 response 空白且 stderr 明確 print timeout after 2m0s with turn in progress，因此亦不計完成。conversation d8cb502f-ca79-47b2-b851-ee7f5ff31017，requested model gemini-4-argon-high；無可確認 returned model。已停止追加請求與等待，CLI 仍報 turn in progress，不能聲稱服務端工作已取消。依每步兩席檢驗及 skill 每席5分鐘／暫時錯誤最多重試一次的界線，T2 gate 尚未通過，停在 T3 前。需要使用者允許額外檢驗輪次，或等待 Gemini 可完成檢驗後再續；不自行換 provider、不將空 SUCCESS 視為 PASS。

目前原碼／文件保留在 fix/reader-notes-reliability-20261018 專用 worktree，未 commit/push/PR/merge/release。94 項相關測試、scoped ESLint、tsc、diff check 通過；另加 direct Apply 不重發舊 prepared snapshot 的窄回歸後，Recovery 12/12 單獨驗證通過（與前述94項有重疊，不相加冒稱106項）。完整 suite／build／CI／candidate screenshots／真機均尚未執行，T1 cloud-deleted editor 失敗測試仍待 T4 完成。


## T2 Gemini 額外輪次（使用者已允許）

使用者回覆「允許」後，僅重開缺席的 Gemini 檢驗，不增加第三席。縮小為共用 hook、API deadline、Recovery 必要段落與 upgrade finish 的公開原碼；不傳正式筆記、憑證或額外私人資料。首次 CLI 187.7 秒，exit 0、status SUCCESS，但 response 空白且 stderr 為 print timeout after 3m0s with turn in progress，故仍不計完成。conversation e31a6453-db08-4049-8857-f035bd387003；requested gemini-4-argon-high，無可靠 returned-model。沿用同一 conversation、相同資料範圍與同一席，於剩餘時限做一次60秒續查；續查64.1秒 exit 0、status SUCCESS 但 response 空白、stderr 明確 print timeout after 1m0s with turn in progress，未完成檢驗。CLI 回報 input_tokens 26004、thinking_tokens 16798，顯示有推理活動但無最終答案，不能當 PASS 或斷言未連線。第一次續查前，本機拒絕與 high 模型不相容的 effort 參數，未產生模型 turn；移除參數後才實際續查。官方 agy models 唯讀確認 high／medium／low 均列於可用模型，未變更帳號、方案或模型。

本額外輪次已結束，仍停 T2，沒有開工 T3；不自行追加第三次請求或視為視覺／功能檢驗通過。CLI 仍顯示 turn in progress，沒有支援的取消工具，已停止發送與等待，不能聲稱服務端 turn 已取消。進一步續查需放寬時限或新輪次授權。所有產品改動與暫存證據保留，未 commit/push/PR/merge/release。


## 使用者更新：改用 Codex

使用者明確決定「不用 gemini，改回 codex」。停止 Gemini 請求；T2 原缺席席次由獨立 Codex t2_replacement 補驗，原 Codex 第一席結果仍保留。之後各步使用兩位獨立 Codex，不增加隱藏席次，完成檢驗後才下一步。合成視覺圖仍須兩席實際看圖；最終停在 merge 前。


## T2 結案與 T3 檢驗

T2 補席 Codex t2_replacement 獨立只讀 PASS；原第一席的 direct Apply 殘留已依明確建議移除並以不重發舊 prepared snapshot 的回歸通過。T2 無未處置 Important，完成後才開始 T3。

T3 兩席均為 Codex。t3_ux_gate 指出 Recovery 本地 timeout 仍呼叫 onFailure，runtime ReaderActionError 過濾後同席窄複核 PASS。t3_data_gate 指出 retry reanchor 衝突不應直接換 cloud note，以及純 conflict 安裝不應增加 draft generation；已保留 local baseline／完整 initialConflict（含 durable）、generation 僅追蹤 draft／基底／view，Recovery 明確回傳 previous mutation 並在 replacement 時轉移 matching identity。同席複核確認 generation 與 identity 已解除，另指出 note_conflict 無 note 時 key 不變，root 依明確修法增加 conflict/editing key，並補無 cloud note 仍 blocked、只提供 durable Recovery 的回歸通過。

已加入真實掛載 Recovery＋hook 共用 mutate 計數器，retry／progress 在途峰值1；20秒本地 deadline 不走 onFailure、不釋放實際工作 gate，pending保留。Save／Delete 的第一次啟動會等背景進度，舊note retry不清較新draft，相關測試通過。面板復原使用 inline 內容；復原時原 editor hidden/inert 保持掛載，外層 retry/status 隱藏，避免兩個確認入口或雙Drawer。T3最後整合測試進行中，未開始T4。


## T4 completed — two Codex seats

T3 integration and T4 proceeded sequentially. Codex t4_navigation_gate and t4_draft_gate both completed their narrow followup PASS. Important findings were resolved: prevent two simultaneous exit/discard decisions; await every navigation caller; recheck current sending state after a discard decision; retain a new draft created during an awaited tab-exit flush. Manual merge creates an immediately dirty controlled draft using the cloud CAS baseline; adopting cloud bypasses a second discard prompt. Cloud-deleted conflicts retain text and cannot silently create a new note. Added regression checks cover these paths; the focused reader checks passed. No physical iOS acceptance is inferred.

## T5 completed — two Codex seats

Codex t5_visual_gate and t5_access_gate independently reviewed source, relevant test evidence and actual synthetic screenshots. Initial Important findings: mobile load-error feedback overlapped the top 52px toolbar; failed cloud loading could await an unbounded fallback read. Root fixed the feedback flow spacing, publishes the local error before reading fallback, and bounds/interrupts fallback while retaining account/document/state fencing. A never-settling storage regression was added. The same two seats each completed their sole narrow followup PASS; no original blocker remains. Latest focused run: 3 files, 142 tests passed.

T5 distinguishes unsupported/loading/init-error/available/saved offline controls, offers local retry, and adds five-locale parity. Final images comprise 18 baseline and 44 candidate captures (18 matched, 24 special, 2 short-viewport); both seats viewed baseline/candidate images and the updated phone load errors. [Reviewable images and metrics](reader-notes-reliability/README.md) are included in this branch. Synthetic data only. True physical iOS/Android, IME/soft keyboard, assistive technology and installed-PWA acceptance remain unverified; merge/release/production note writes remain unauthorized in this task.

Full repository checks and PR CI are tracked in the final delivery entry below. Historical statements above describe their original checkpoint, not the final task state.
