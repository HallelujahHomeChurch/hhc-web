# 服事表 Spec

## 1. 背景與問題

教會成員目前沒有一個登入後可集中查看教會服事項目、聚會時間與負責人的服事表。管理者需要能建立並更新安排，讓會員查看同一份最新資料。

本功能為單一教會的登入後服務。使用者已確認第一階段優先提供全教會查看與管理；Email 通知及服事調動／認領／交換不納入本階段。

## 2. 目標與範圍

### 目標

- 所有具有效教會會籍的登入會員能查看全教會服事安排。
- 教會管理者可指派具全教會範圍的「服事表編輯者」權限。
- 編輯者可建立、修改及刪除聚會與其服事崗位／人員指派。
- 會員可在依日期分組的清單與月曆兩種檢視間切換；清單為預設檢視。
- 定義 hhc-web 前端與 hhc-web-api 後端之間所需的資料、API 與授權契約。

### 第一階段資料模型

- 一筆聚會安排包含：日期、開始時間、結束時間、聚會名稱。
- 每筆聚會可包含多個服事崗位；每個崗位包含崗位名稱及至少一位服事人員，可指派多人。
- 編輯者按日期逐筆建立聚會，不自動產生每週或每月重複資料。
- 服事人員以有效教會會員為指派對象；一般會員畫面顯示姓名，不顯示電子郵件或其他帳戶聯絡資訊。
- 使用教會所在地時區 `Asia/Taipei` 解讀與呈現日期時間；API 使用帶時區的 ISO 8601 日期時間。

### 不做

- Email 或其他通知的寄送、排程、提醒時間及通知歷史。使用者已決定通知另列後續階段。
- 服事調動請求、公開認領、交換、核准、取消或逾期處理。使用者已決定這些需求留待下一階段。
- 自動重複排班、週期模板、匯入／匯出、公開匿名檢視或跨教會排班。
- 修改通用登入、帳戶或組織會員資料管理流程。

## 3. 驗收條件

每條驗收都須同時提供可見行為與程式碼／API 證據；只隱藏前端控制項不算授權通過。

1. **會員查看範圍**：具有有效 ChurchMembership 且已登入的會員能進入服事表，並看到全教會所有日期範圍內的聚會；無登入或無有效會籍者不能讀取資料。
   UI 證據：服事表頁面及拒絕／登入導引狀態。程式碼證據：頁面存取 gate 與 hhc-web-api 每次讀取請求的會籍授權檢查。

2. **清單檢視**：首次進入顯示依日期、開始時間排序並按聚會分組的清單；每場聚會顯示日期、起訖時間、聚會名稱、崗位與每個崗位的服事人員。會員可在清單中瀏覽過去與未來日期。
   UI 證據：清單排序、分組、欄位及日期導覽。程式碼證據：清單元件、資料排序及日期範圍查詢。

3. **月曆檢視**：會員可切換月曆；月份切換後顯示該月相同的聚會資料，同日多場聚會均可進入查看。清單與月曆切換不改變資料或授權。
   UI 證據：清單／月曆切換與月份導覽。程式碼證據：兩種檢視共用同一個已授權的聚會資料來源。

4. **服事表編輯權限指派**：教會管理者可在帳戶角色管理機制中指派或撤銷全教會的服事表編輯權限；組織單位責任或一般會員身分不會自動給予此權限。
   UI 證據：被授權編輯者在服事表看見管理操作，未授權會員看不見。程式碼／API 證據：角色指派契約與服務端 `ministry.schedule.manage` 權限檢查。

5. **聚會與崗位維護**：編輯者可新增、修改及刪除聚會；可新增、修改及移除崗位，並將一位或多位有效會員指派至每個崗位。刪除聚會前顯示確認；刪除後一般會員的清單與月曆不再顯示該聚會。
   UI 證據：建立／編輯表單、會員選擇與刪除確認。程式碼／API 證據：輸入驗證、服務端授權與刪除後不再出現在讀取結果。

6. **資料驗證**：聚會名稱、日期、開始時間及結束時間必填；開始時間須早於結束時間。崗位名稱必填且至少指派一位服事人員；指派的會員必須屬於該教會且會籍有效。
   UI 證據：欄位錯誤訊息與無效提交被阻止。程式碼／API 證據：前端 schema 與 hhc-web-api 服務端重複驗證，拒絕無效 member ID、日期或時間。

7. **服務端授權**：未授權會員直接呼叫任何建立、修改或刪除 API 均收到拒絕回應，資料不變；隱藏或手動呼叫前端操作不能繞過權限。
   UI 證據：一般會員無編輯入口。API 證據：401／403 行為及拒絕請求後資料未變的整合測試。

8. **API 契約**：前端清單與月曆以日期範圍取得授權後的聚會；成功回應包含聚會與崗位、人員的穩定 ID 及顯示姓名。建立、完整更新與刪除都有明確成功／錯誤回應；更新需使用版本條件避免覆寫過期資料，建立與重試採冪等鍵。
   UI 證據：載入、空狀態、錯誤與重試可見。程式碼／API 證據：OpenAPI schema、前端型別／adapter 及契約測試一致。

9. **階段邊界**：本階段不出現 Email 通知、排班提醒、調動、認領或交換流程；不會因其未實作而阻擋查看與管理。
   UI 證據：第一階段頁面不提供上述入口。程式碼證據：本次 route／API 沒有相應操作。

## 4. 設計決定

| 決定 | 理由 | 捨棄方案 |
| --- | --- | --- |
| 資料存取限有效教會會員；每位有效會員可看全教會服事。 | 符合使用者確認的 A，且不把組織單位限制帶入全教會排班。 | 任何登入帳號均可查看；每個單位只能查看本單位。 |
| 由教會管理者指派獨立的全教會 `ministry.schedule.manage` 權限。 | 使用者確認由管理者指派編輯權；平台設計區分 staff permission 與組織責任。 | 僅因是小家／單位負責人就自動取得編輯權；只由系統管理者編輯。 |
| 一場聚會為一筆資料，含多個崗位與各崗位會員名單；逐日建立，不產生重複班表。 | 依使用者提供的欄位與確認的最小資料結構，先支援可直接檢視與編輯的排班。 | 先建立重複模板，再展開每週／每月例外。 |
| 同時提供清單與月曆，以切換控制；預設清單。 | 使用者選擇兩種檢視與切換，並確認不要預設月曆；清單優先呈現同日多場及多人資料。 | 只做清單或只做月曆。 |
| 第一階段包含聚會、崗位、人員指派的新增／修改／刪除。刪除採軟刪除並保留稽核紀錄；從會員讀取結果隱藏。 | 使用者確認編輯者可新增、修改、刪除；保留稽核資訊能追溯管理操作。 | 永久刪除資料且無稽核紀錄。 |
| hhc-web-api 擁有服事表資料與授權判定；notification-api 僅在後續通知階段收到已決定的通知命令。 | Service catalog 將網站後端資料歸 hhc-web-api，通知服務不決定收件人或業務時機。 | 前端直接存取資料庫或讓 notification-api 管理排班。 |
| 前端使用新增的 schedule API；以下 endpoint 為本 spec 的新契約。 | 目前 hhc-web repo 沒有服事表 API，需提供可供兩種檢視與管理操作使用的一致介面。 | 將 Organizations API 或單位通知 API 誤當作服事表契約。 |

### 新增 API 契約

- `GET /api/ministries/schedules?from={date}&to={date}`：需登入及有效教會會籍；回傳指定日期範圍內所有聚會及崗位／會員摘要。
- `GET /api/ministries/schedules/{scheduleId}`：同讀取授權，回傳單筆聚會完整資料。
- `POST /api/ministries/schedules`：需 `ministry.schedule.manage`；新增聚會及其崗位，使用 `Idempotency-Key`。
- `PUT /api/ministries/schedules/{scheduleId}`：需 `ministry.schedule.manage`；以 `If-Match` 版本條件完整更新聚會、崗位與人員名單。
- `DELETE /api/ministries/schedules/{scheduleId}`：需 `ministry.schedule.manage`；以 `If-Match` 軟刪除聚會及其崗位，不再回傳給會員。
- 聚會資料至少包含 `id`、`meetingName`、`startsAt`、`endsAt`、`version`、`positions`；每個 position 至少包含 `id`、`name`、一個以上的 `memberIds` 及回應用 `members[{id, displayName}]`。
- 讀取與變更錯誤沿用平台 API envelope；未登入回 401、無會籍／無權限回 403、版本衝突回 409、資料驗證錯誤回 400。不得用 404 混淆授權拒絕。
- hhc-web-api 需發布 OpenAPI 契約；前端 adapter 依 schema 驗證 response。此 repo 只有 hhc-web 前端，後端 API 工作需在 hhc-web-api 專案另行落地。

## 5. 檔案落點與邊界

### 本 repo：hhc-web

- 新增 locale route：`src/app/[locale]/ministry-schedule/`，包含頁面與必要 layout/metadata。
- 新增 feature module：`src/features/ministry-schedule/`，負責 gate、資料 adapter、清單、月曆、編輯表單及型別／驗證。
- 新增 feature-local styles 與 `src/i18n/locales/zh-Hant.json`、`src/i18n/locales/en.json` 的「服事表／Service Schedule」導覽與介面文案。
- 依 account session 讀取會員狀態與管理權限摘要；不得在前端自行推導服務端權限。
- 不修改既有 Organizations feature 的角色語意或 notification adapter。

### 外部 API 專案：hhc-web-api

- 新增 schedule schema、OpenAPI、持久化模型、日期範圍讀取、聚會 CRUD、`ministry.schedule.manage` 授權檢查與稽核紀錄。
- 會員指派以穩定 `member_id` 儲存，指派時及讀取時確認其 ChurchMembership 有效；使用既有 service-to-service 邊界取得會員資料，不跨服務直接讀取資料庫。
- 此 repo 未掛載 hhc-web-api；以上為跨 repo 需求邊界，不代表本次已檢查或修改後端檔案。

## 6. 參考來源

Coder 可讀以下工作摘要與 repo 來源；使用者決策以本 spec 為準，既有 Organizations 行為只作 UI/API 模式參考。

- `docs/work/ministry-schedule/inputs.md`
- `docs/work/ministry-schedule/index.md`
- `docs/work/ministry-schedule/digest-codebase.md`
- `docs/work/ministry-schedule/digest-api.md`
- `docs/work/ministry-schedule/digest-requirements.md`
- `docs/work/ministry-schedule/digest-integration.md`
- `src/features/organizations/OrganizationsShell.tsx`
- `src/features/organizations/OrganizationsGate.tsx`
- `src/features/organizations/OrganizationUnitPage.tsx`
- `src/features/organizations/api.ts`
- `src/components/layout/AccountControl.tsx`
- `src/features/organizations/OrganizationNotificationDialog.tsx`
- `src/features/organizations/notifications-api.ts`
- `docs/superpowers/specs/2026-09-15-hhc-unified-authorization-membership-and-entitlement-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-notification-api-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-service-catalog-and-ownership-design.md`
- `AGENTS.md`

## 7. 複雜度

**高**：涉及登入後會員範圍、全教會 staff permission、日期範圍查詢、兩種檢視、可編輯關聯資料，以及 hhc-web／hhc-web-api 的新端到端契約。後端專案不在目前 repo，不能只靠前端 mock 完成實際資料保存與授權驗收。

## 8. 開放問題

無。未來通知及服事調動流程明確列為後續階段；本階段 API 路徑、資料形狀、錯誤與授權要求由本 spec 定義為新契約。

## 9. 進度清單

- [x] 登記需求來源並完成 repo scout 索引。
- [x] 整理 codebase、API、requirements 與 integration digests。
- [x] 透過需求訪談確認第一階段資料、權限、檢視與範圍。
- [x] 撰寫本 spec 草案。
- [ ] 使用者確認 spec。
