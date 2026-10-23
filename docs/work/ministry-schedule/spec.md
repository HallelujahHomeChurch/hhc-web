# 服事表 Spec

## 1. 背景與問題

台北家教會成員需要登入後查看該 Church 的聚會、服事崗位與服事者。管理者需要沿用平台既有的 Meeting／occurrence 管理名稱與場次時間，分別維護服事崗位及既有會員指派；並透過服事次數與會員提供的不可服事時段，協助安排較平均的服事。

部分崗位有服事前 checklist。服事者收到安排通知後，應能進入自己的 checklist 並獨立確認項目。現有網站 repo 沒有服事表領域頁面、API 或資料模型；本 Spec 定義 hhc-web 與 operations-api 的端到端新增契約，並說明內部 Email 通知邊界。

## 2. 目標與範圍

### 首版目標與範圍

- **會員查看**：首版僅適用於台北家教會。已登入且具台北家教會有效 ChurchMembership 者可查看該 Church 的服事；其他 Church 不參與本功能。會員可切換清單／月曆，預設清單。
- **聚會設定**：沿用 operations-api 的 Meeting 作為聚會名稱與定義；服事崗位關聯至既有 Meeting。
- **場次與指派**：沿用 operations-api 的 MeetingOccurrence 作為日期及起訖時間來源；Meeting 可採既有 once／weekly 模式。服事編輯者需逐 occurrence 指派一位或多位既有有效會員到相應崗位；每週 Meeting 產生新 occurrence 時，不自動複製前一週的服事指派。
- **管理權限**：台北家教會管理者可指派／撤銷台北家教會範圍的「服事表編輯者」權限。編輯者可新增、修改、取消／封存該 Church 的服事崗位、場次及指派。
- **管理篩選**：編輯者可依聚會及週次篩選場次，檢視每週崗位與服事者。
- **Checklist**：部分崗位可選擇 checklist 範本；編輯者可維護範本。指派會員到有範本的崗位時，每位會員建立自己的 checklist 實例；服事者只能完成自己的項目，編輯者可查看各服事者完成狀態。範本日後修改不變更既有 checklist。
- **Email 通知**：發布已排妥的場次時立即通知該場次的服事者；已發布場次的指派變更只通知受該次變更影響的人。已發布的 MeetingOccurrence 若改時間或取消，通知該場次所有受影響服事者。Email 連至登入後該服事者自己的 checklist（崗位有 checklist 時），否則連至場次資料。沒有自動定時提醒。
- **服事統計**：每位會員在一個崗位的一次指派算一次；只計已結束場次。編輯者可選日期範圍，查看台北家教會每位會員的次數及對應場次／崗位明細。同場次服務兩個崗位算兩次。
- **不可服事時段**：會員可提交、修改及撤回單次日期／起訖時間；僅服事表編輯者可查看。資料僅作排班參考，不會阻止或自動變更指派。
- **前後端契約**：本 Spec 涵蓋 hhc-web 前端、operations-api 資料及授權 API，以及 operations-api 到內部 notification-api 的通知責任邊界。

### 不做

- 服事調動請求、認領他人空缺、交換場次、核准或自動重新排班；留待後續階段。
- 自動複製或週期化服事指派、週期性不可服事規則、自動公平分派或依權重最佳化。Meeting／Occurrence 的建立與週期行為仍由既有 Operations Meeting 模型管理。
- Email 排程提醒、定期催辦、簡訊或其他新增通知通路。
- 未登入者、非台北家教會有效會員及其他 Church 查看服事表；將首版擴展到其他 Church。
- 另建或修改教會會員帳戶與通用組織會員管理流程。

## 3. 驗收條件

每項均須驗證可見的使用者行為及相應前端／後端程式碼或 API 證據；前端隱藏控制項不構成授權證據。

1. **查看資格與 Church 範圍**：台北家教會有效 ChurchMembership 會員登入後可查看台北家教會內全部已發布場次；其他 Church 不參與本功能，且其會員不能讀取台北家教會資料。未登入者被導向登入，非有效會員讀取遭拒。一般會員不能藉猜測識別碼讀取其他人的 checklist 或不可服事資料。
   UI 證據：登入導引、拒絕、載入、空與錯誤狀態。程式碼／API 證據：前端 gate 與 operations-api 每次讀取的會籍及資源授權檢查。

2. **聚會設定與會員來源**：聚會名稱沿用既有 Meeting 管理；台北家教會範圍的服事編輯者可維護該 Church Meeting 關聯的服事崗位，不會另建聚會名稱主檔。人員選擇器只從台北家教會的既有有效會員目錄選人，不建立複製的服事人員資料。
   UI 證據：既有聚會選取器、崗位管理表單與會員選擇器。程式碼／API 證據：穩定 meeting、position、member 識別及服務端會員有效性驗證。

3. **場次建立與指派**：日期及時間由既有 MeetingOccurrence 提供；once 與 weekly Meeting 均可沿用。服事編輯者需將一位或多位會員逐一指派到各 occurrence 的服事崗位；每個要發布的崗位至少有一位有效會員。新 occurrence 不會自動沿用前一 occurrence 的服事指派。
   UI 證據：既有場次選取、崗位指派、有效時間顯示及驗證。程式碼／API 證據：occurrence 與 meeting/position/member 的關聯，以及建立新 occurrence 時不複製先前 assignments。

4. **發布與操作權限**：編輯者可先保存未發布場次，僅台北家教會的編輯者可見且不寄通知；完成指派後明確發布，發布後才對台北家教會會員可見並觸發首封 Email。未獲台北家教會服事編輯權者直接呼叫管理 API 建立、修改、刪除或發布均被拒絕且資料不變。
   UI 證據：草稿／發布狀態與操作入口。程式碼／API 證據：Account 管理者指派的全教會 `ministry.schedule.manage` 權限、服務端授權與發布狀態轉換。

5. **清單與月曆檢視**：會員首次進入顯示依日期、開始時間排序並按聚會分組的清單；可切換月曆及日期／月份，檢視相同的已發布資料，同日多場皆可查看。
   UI 證據：清單／月曆切換、日期導覽及同日多場。程式碼證據：兩檢視共用同一已授權資料來源與日期範圍。

6. **依聚會與週次篩選**：編輯者可選取聚會及週次，結果僅包含所選聚會於該週的場次及各崗位會員；可清除篩選並回復完整範圍。
   UI 證據：聚會選單、週次導覽、篩選結果與空狀態。程式碼／API 證據：`meetingId` 及日期區間參數在服務端查詢；不以只在前端過濾的全量資料取代授權查詢。

7. **Checklist 範本與個人實例**：編輯者可在崗位新增、排序、修改及移除 checklist 項目；會員被指派到有範本的崗位時取得個人實例，能逐項完成／取消完成。沒有範本的崗位不建立 checklist。每人狀態獨立；管理者能按場次／崗位查看每位指派會員的進度。範本變更不改寫已建立實例。
   UI 證據：範本編輯、會員個人 checklist、管理者完成狀態。程式碼／API 證據：範本版本快照、assignment 對應的獨立 checklist instance 及只允許本人更新完成狀態的授權。

8. **Email 通知**：首次發布完成指派的場次後，系統立即向該場次所有指派會員寄 Email；若該崗位設有 checklist，每封只含該收件者自己的登入後 checklist 連結，否則連至場次資料。已發布場次新增、移除或更改指派時，僅通知該次受影響會員。已發布的 MeetingOccurrence 改時間或取消時，通知該場次所有受影響服事者；取消場次自會員排班隱藏且不計入統計。不在未變更時寄週期提醒；重試發布或重送 API 不造成重複通知。
   UI 證據：發布結果及通知失敗狀態可辨識。程式碼／API 證據：operations-api 以冪等通知命令呼叫內部 notification-api；瀏覽器不直接呼叫 `/priv/notifications/*`；收件者、發布事件及 checklist 資源由服事領域決定。

9. **服事次數統計**：編輯者指定日期區間後，可查看各會員於已結束且已發布場次的崗位指派次數及明細；一個會員的一個崗位指派計一次，同場多崗位分別計數，未來、草稿及已取消場次不計。
   UI 證據：日期區間、會員次數、明細及零次結果。程式碼／API 證據：服務端依已完成場次／指派紀錄聚合，與前端顯示的明細可相互核對。

10. **不可服事時段**：會員可新增、修改及撤回自己的單次起訖時段；會員不可讀取其他人的時段。編輯者可查看全體提交資料以作參考；存在重疊時段不會阻止指派，也不會自動取消既有指派。
    UI 證據：會員本人填寫與編輯頁、管理者排班參考視圖。程式碼／API 證據：本人／編輯者的資源授權及 advisory-only 驗證。

11. **新增、刪除與驗證**：服事崗位、場次及指派可按權限新增／修改／取消或封存；日期與起訖時間、名稱必填且開始時間早於結束時間；指派會員必須是有效會籍。已發布場次或崗位取消／封存前須確認並保留歷史與稽核紀錄；取消場次不再顯示且不計服事次數，封存崗位不供新指派使用。
    UI 證據：刪除確認、欄位驗證及結果提示。程式碼／API 證據：服務端重複驗證、授權及稽核紀錄。

12. **API 契約與一致性**：operations-api 發布 OpenAPI，涵蓋 Meeting／Occurrence 服事崗位、日期範圍場次、指派與發布、個人 checklist、不可服事時段、統計及相應授權／錯誤。前端 adapter 依契約驗證 response；建立／發布具冪等鍵，更新具版本條件，衝突回傳可辨識錯誤，權限拒絕不可混淆成成功或空資料。
    UI 證據：載入、空、錯誤、重試與衝突處理。程式碼／API 證據：OpenAPI、型別／schema validation、服務端契約與整合測試。

## 4. 設計決定

| 決定 | 理由 | 捨棄方案 |
| --- | --- | --- |
| 首版只支援台北家教會；僅其有效 ChurchMembership 會員可查看，編輯權也限於台北家教會。其他 Church 不參與。 | 使用者確認排班管理者屬於台北家教會，其他 Church 不參與首版。 | 同時支援平台所有 Church 或跨 Church 共用一張班表。 |
| 所有服事日期／時間、不可服事時段、週次篩選與通知顯示均採 `Asia/Taipei`。 | 使用者確認時間一律依 Taipei 時區。 | 各 Church 個別設定時區或使用執行環境本機時區。 |
| 聚會名稱與 occurrence 沿用 operations-api 的 Meeting／MeetingOccurrence；服事崗位與指派附加於既有 Meeting／Occurrence 識別。 | 使用者確認沿用既有模型；平台架構已把 Meeting、occurrence 與會員資料歸 operations-api，避免在 hhc-web-api 重建聚會日程。 | 服事表另外建立 Meeting／Occurrence 主檔並產生兩套名稱與時間資料。 |
| 沿用 Meeting 的 once／weekly occurrence；每一 occurrence 的服事指派分開建立，不把前次指派當成週期模板。 | 使用者確認使用既有 weekly Meeting，同時逐 occurrence assign；保留不自動複製服事安排的原意。 | 服事功能建立第二套週期聚會；weekly occurrence 自動複製服事指派。 |
| 人員引用既有有效會員；每場次的崗位指派到會員。 | 避免建立另一份人員清冊並沿用穩定會員識別。 | 服事表內另建人員帳戶。 |
| 草稿與發布分開；發布時使場次對會員可見並寄出首次通知。 | 管理者需先排好人員；通知時機已確認為發布／指派完成後立即寄。 | 每次欄位 autosave 即對會員顯示並送信。 |
| Checklist 掛在崗位；每位會員各有實例與完成狀態，實例保留建立時範本快照。 | 符合管理者流程並讓多人可各自確認；範本變更不覆蓋已開始的工作。 | 同崗位所有人共用一份完成狀態；修改範本即改寫已指派清單。 |
| 一個崗位指派是一次服事統計；只算已結束場次，可選區間並查看明細。 | 使用者已接受此口徑，能用相同計數方式比較負擔。 | 每場次不論崗位數都只算一次；把未來排班混入已服事總數；無明細總數。 |
| 不可服事時段採單次時間範圍、僅編輯者可見且只作參考。 | 使用者確認此最小首版；不把意願回報當成硬性排班限制。 | 週期規則、自動拒絕衝突指派、公開所有會員的不可用時間。 |
| Email 僅由 operations-api 依服事領域事件呼叫內部通知服務；不自動寄定期提醒。 | 平台文件將 business timing／recipient selection 留給 domain，投遞交由 notification-api。 | 瀏覽器直接呼叫內部通知 API；定時通知。 |
| 已發布 MeetingOccurrence 的時間異動或取消，通知所有已指派服事者；取消的 occurrence 不顯示於會員排班，也不計服事次數。 | 使用者確認既有 MeetingOccurrence 改時間／取消是會影響服事者的排班事件。 | 只通知指派異動；要求管理者另行聯絡。 |
| 刪除已發布場次或崗位採取消／封存並保留稽核與歷史資料；取消場次隱藏且不計數，封存崗位不可新指派。 | 使用者確認需保留已寄通知與已完成服事的紀錄。 | 永久刪除已發布及歷史資料。 |
| 會員可切換清單與月曆，預設清單；管理頁另有聚會／週次篩選。 | 延續使用者先前決定並加入管理者訪談新增的週檢視需求。 | 只做一種檢視或月曆預設。 |
| 服事調動、認領、交換留待後續階段。 | 使用者明確說明該流程需求仍模糊。 | 在首版建立未收斂的跨會員改班流程。 |

## 5. 檔案落點與邊界

### 本 repo：hhc-web

- 新增 route `src/app/[locale]/ministry-schedule/` 及 `src/features/ministry-schedule/`。包含會員檢視、管理頁面、權限 gate、API adapter、前端型別／驗證、Checklist、不可服事表單與統計視圖。
- 新增/更新 `src/i18n/locales/zh-Hant.json` 與 `src/i18n/locales/en.json` 的導覽、操作及錯誤文案。
- 使用既有 session 取得會員與角色摘要；前端只控制顯示及路由體驗，不自行作為授權權威。operations-api 僅允許台北家教會範圍的服事資料及權限。
- 服事編輯、會員個人 checklist、不可服事資料均呼叫 operations-api；前端不得呼叫內部 notification-api。
- 可參照 Organizations 的頁面殼、表格、會員選擇與通知狀態呈現，但不得沿用其授權語意或 unit notification API 作為服事契約。

### 外部 repo：operations-api

- 擁有既有 Meeting、MeetingOccurrence 與 Member/ChurchMembership；新增服事崗位、Occurrence 指派、Checklist template／個人實例、不可服事時段、統計查詢、發布狀態及服事授權。
- 提供 OpenAPI 與 hhc-web 前端所需 Operations API 路由；會員識別引用既有 `member_id`，服務端驗證會籍有效與獨立服事編輯權限。
- 發布場次及已發布指派變更由 operations-api 建立冪等通知命令，再以內部服務授權呼叫 notification-api；通知服務不決定誰該收到信或何時觸發。
- 記錄管理者資料異動、發布及通知命令狀態。已發布場次取消／封存及崗位封存均保留穩定識別、稽核與歷史關聯；取消場次不計數，封存崗位保留既有完成指派的統計歷史且不可再用於新指派。

### 建議的 HTTP 資源契約

實際路徑與 schema 沿用 operations-api 現有 Meeting／Occurrence API 慣例，OpenAPI 必須覆蓋下列行為，不可省略資料或授權責任：

- 服事崗位設定：依既有 Meeting 列出／新增／更新／刪除服事崗位與可選 checklist template；不另建聚會名稱主檔；僅 `ministry.schedule.manage` 可變更服事資料。
- 聚會場次：依 `from`、`to`、選用 `meetingId` 查詢既有 once／weekly MeetingOccurrence 並附上服事指派；Meeting 的建立及 occurrence 週期行為沿用既有 Operations API。
- 服事發布：儲存／更新 occurrence 的服事指派；依發布狀態使會員可讀；會員讀取只包含已發布有效服事安排。
- 指派：將有效 `memberId` 指派到特定 `occurrenceId` 與 `positionId`；更新已發布場次時產生只送給異動相關會員的通知事件。
- Checklist：依 assignment 取得個人 checklist；本人更新項目完成狀態；編輯者維護崗位範本並可讀取該場次各人的完成摘要。
- 不可服事時段：會員讀取／新增／更新／撤回自己的單次時段；編輯者可讀取全體以供管理參考。
- 統計：依 `from`、`to` 讀取已結束場次的會員計次與 assignment 明細；限編輯者。
- 錯誤至少區分 `401` 未登入、`403` 會籍／角色不足、`400` 驗證錯誤、`404` 不存在、`409` 版本衝突；錯誤 envelope 沿用 operations-api 現有標準。所有變更需服務端授權，建立／發布需冪等，更新需版本條件。

## 6. 參考來源

以下為 coder 可讀來源；本 Spec 的使用者確認優先。其他 Organizations／通知功能只可參考程式模式，不可當作服事授權或 API 合約。

- `docs/work/ministry-schedule/inputs.md`
- `docs/work/ministry-schedule/index.md`
- `docs/work/ministry-schedule/digest-codebase.md`
- `docs/work/ministry-schedule/digest-api.md`
- `docs/work/ministry-schedule/digest-requirements.md`
- `docs/work/ministry-schedule/digest-integration.md`
- `docs/superpowers/specs/2026-10-23-ministry-schedule-domain-decision-record.md`
- `src/features/organizations/OrganizationsShell.tsx`
- `src/features/organizations/OrganizationsGate.tsx`
- `src/features/organizations/OrganizationUnitPage.tsx`
- `src/features/organizations/OrganizationMemberPage.tsx`
- `src/features/organizations/api.ts`
- `src/features/organizations/OrganizationNotificationDialog.tsx`
- `src/features/organizations/notifications-api.ts`
- `src/components/layout/AccountControl.tsx`
- `docs/api/internal-notification-api.md`
- `docs/superpowers/specs/2026-09-15-hhc-unified-authorization-membership-and-entitlement-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-notification-api-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-service-catalog-and-ownership-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-account-admin-identity-rbac-lifecycle-design.md`
- `AGENTS.md`

## 7. 複雜度

**高**：在既有 Meeting／Occurrence 與會員資料上新增服事崗位、指派、兩套授權、個人 checklist 狀態、Email outbox／冪等、統計、不可服事回報與多種管理檢視。operations-api 及 notification-api 不在本 repo，端到端驗收必須包含跨服務契約與授權證據。

## 8. 開放問題

目前沒有尚待產品決策確認的問題。操作流程與 API／資料契約仍需由實作方依本 Spec 落實並在 OpenAPI 中定義。

## 9. 進度清單

- [x] 登記需求來源並完成 repo scout 索引。
- [x] 整理 codebase、API、requirements 與 integration digests。
- [x] 透過訪談確認首版範圍、資料關係、Checklist、通知、統計及不可服事時段規則。
- [x] 依管理者訪談更新服事表端到端 Spec。
- [ ] 使用者確認 Spec。
