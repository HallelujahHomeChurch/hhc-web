# API 與授權 Digest：服事表

## 目的

整理服事表需求可參照的現有前端 API adapter、授權投影與平台通知契約，並標明目前 repo 是否已有服事領域 API。這份 digest 只陳述來源中可確認的事實；Organizations 與單位通知契約不是服事表契約。

## 關鍵事實

- Scout 索引確認，repo 目前是網站前端；搜尋未找到服事排班／服事項目領域實作或專屬 API 文件。現有 Operations adapter 管理組織單位、會員、responsibility 與 entitlement，未列 ministry/schedule/assignment 端點。[`docs/work/ministry-schedule/index.md:3,10,30-35`]
- `docs/api/public-api.md` 列出的公開路由以已發布網站內容為主；其 API 文件沒有服事表端點。公開路由不得回傳私有／受限資料。[`docs/api/public-api.md:29-43, 84-220`]
- `docs/api/admin-api.md` 的目錄與範圍包含 CMS、site settings、preview、revisions 等管理 API，沒有服事排班契約；管理 API 的授權角色需依各領域明定，而非由前端 UI 隱藏按鈕代替。[`docs/api/admin-api.md:1-35, 242-285`]
- 前端單位通知 adapter 提供 unit 通知 preview、submit、list、get。這是現存可觀察的前端呼叫契約，不代表後端端點目前已部署或通過線上驗證。[`src/features/organizations/notifications-api.ts:51-80`; `docs/work/ministry-schedule/index.md:63-67`]
- 通知平台設計將模板、投遞、佇列狀態、重試、suppression 與投遞稽核放在 `notification-api`；呼叫領域負責收件者選擇、同意、業務資格與通知時間。[`docs/superpowers/specs/2026-07-08-hhc-notification-api-design.md:33-65`]
- 通知 API 設計列出的 V1 通路是 email；web push 是未來通路，須先具備瀏覽器推播同意與金鑰管理等設計。Organizations 前端 adapter 的 unit 通知則要求回應含 email 與 web_push 兩個 channel；這是兩份不同範圍／狀態的來源，不能推成服事提醒已支援兩種通路。[`docs/superpowers/specs/2026-07-08-hhc-notification-api-design.md:87-107`; `src/features/organizations/notifications-api.ts:9-15,108-115`]

## 既有慣例

- Operations adapter 透過 `createOperationsClient` 的 raw client 呼叫 `/api/operations/*`，統一 unwrap data、將 API error 包成 `OperationsApiError`，並驗證部分成功回應。若寫入資源有版本欄位，現有 helper 使用 `If-Match: "<version>"` 與 `Idempotency-Key`；部分新增操作使用 idempotency key。[`src/features/organizations/api.ts:1-12,46-69,169-205`]
- 既有管理操作使用 server 回傳的 `actions` 布林欄位呈現操作權限；unit schema validation 要求 `editUnit`、`manageMembers`、`manageResponsibilities`、`manageEntitlements`、`sendNotifications` 等欄位。[`src/features/organizations/api.ts:171-187`]
- Organizations access gate 依 `useOrganizationsAccess()` 的 `denied/loading/unavailable/allowed` 狀態決定導回、loading、錯誤重試或提供 clients。此為 Organizations 功能既有 gate 行為。[`src/features/organizations/OrganizationsGate.tsx:11-20`]
- Organizations 導覽 access projection 目前以登入狀態、`churchMembership`、`responsibilities` 或 small-group membership 判斷可否進入 organizations；這項條件是 Organizations 專用現況，不是服事表的確認授權規則。[`src/components/layout/AccountControl.tsx:209-211,228-245`]
- 授權設計中的 `OrgRoleAssignment` 有固定角色與組織範圍。現有角色 action bundle涵蓋 meeting、resources、reservations；一般 `OrgMembership` 本身不授予管理動作。文件沒有服事表角色或 permission mapping。[`docs/superpowers/specs/2026-09-15-hhc-unified-authorization-membership-and-entitlement-design.md:552-615`]
- 通知 API 的架構接受內部服務呼叫，瀏覽器不得直接呼叫 send/preview/status 路由；callers 要經 app-id allowlist，且不得任意指定模板。[`docs/superpowers/specs/2026-07-08-hhc-notification-api-design.md:548-559`]

## 介面與型別

### Organizations Operations 前端 adapter（參考契約）

`OperationsApiClient` 暴露：讀取本人 access、管理 roots/unit/member、候選人搜尋、加入會員、建立子單位、更新 unit、派任／撤銷 responsibility、搬移／移除 affiliation、批次管理 entitlements。這些都是組織管理型別，沒有服事項目、班次或服事指派型別。[`src/features/organizations/api.ts:14-44`]

現有路由及輸入摘要：

| 方法／路由 | 前端輸入或 query | 回傳型別／形狀 |
| --- | --- | --- |
| `GET /api/operations/me/access` | 可帶 `AbortSignal` | `OperationsAccess`；adapter 檢查 object 且 `responsibilities` 是 array (`src/features/organizations/api.ts:72-74,178-180`) |
| `GET /api/operations/manage/roots` | 可帶 `AbortSignal` | `{items}`，adapter 回傳 `items`；items 是 `ManagedUnit[]` (`src/features/organizations/api.ts:76-78,180`) |
| `GET /api/operations/manage/org-units/{unitId}` | path `unitId` | `ManagedUnitFolder`；含 `unit`、`breadcrumb`、`children`、`actions` (`src/features/organizations/api.ts:80-84,181-183`) |
| `GET /api/operations/manage/org-units/{unitId}/members` | `q`、`page`、固定 `limit=50`、可選 `responsibilityOnly=true` | `ManagedMemberPage`，驗證 `items` array 與整數 `page` (`src/features/organizations/api.ts:86-91,185`) |
| `GET .../members/{memberId}` | path ids | `ManagedMemberView` (`src/features/organizations/api.ts:93-97,184`) |
| `GET .../account-candidates?q=`、`GET .../responsibility-candidates?q=` | path `unitId`、query `q` | list envelope 的 `items` (`src/features/organizations/api.ts:99-103,125-129,186`) |
| `POST .../members` | `{accountUserId, entitlementCodes?}`，`Idempotency-Key` | `ManagedMemberView` (`src/features/organizations/api.ts:105-110,185`) |
| `POST .../children` | `ManagedChildInput`，`Idempotency-Key` | `ManagedUnit` (`src/features/organizations/api.ts:112-116`) |
| `PUT .../org-units/{unitId}` | `ManagedUnitUpdate`、`If-Match`、`Idempotency-Key` | `ManagedUnit` (`src/features/organizations/api.ts:118-122,181-183,189`) |
| `GET/POST/DELETE .../responsibilities` | assign body `{memberId}`；revoke path `responsibilityId` 並帶版本與 idempotency headers | `ManagedResponsibility` (`src/features/organizations/api.ts:131-147`) |
| `POST .../affiliation-moves` | `{affiliationId,targetOrgUnitId}`，版本與 idempotency headers | `ManagedMemberView` (`src/features/organizations/api.ts:149-153`) |
| `DELETE .../affiliations/{affiliationId}` | query `endChurchMembership`，版本與 idempotency headers | `ManagedMemberView` (`src/features/organizations/api.ts:155-159`) |
| `POST .../entitlements/batch` | `{memberIds,entitlementCode,operation:'grant'|'revoke'}`，1–50 member ids，`Idempotency-Key` | `ManagedEntitlementBatchResult` (`src/features/organizations/api.ts:161-165`) |

具體 schema 來自 `@hallelujahhomechurch/operations-client` generated components，這個 digest 的範圍沒有讀取該套件的 OpenAPI/generated schema，因此不補寫未呈現於 adapter 的欄位。[`src/features/organizations/api.ts:1-25`]

### 單位通知前端 adapter（只作通知機制參考）

| 方法／路由 | Request | Response data |
| --- | --- | --- |
| `POST /api/engagement/unit-notifications/preview` | `{orgUnitId}` | `{audienceAccounts,emailRecipients,webPushDevices}`，三者皆為非負安全整數 (`src/features/organizations/notifications-api.ts:3-7,60-65`) |
| `POST /api/engagement/unit-notifications` | `{orgUnitId,subject,body}`，`Idempotency-Key` | `UnitNotification` (`src/features/organizations/notifications-api.ts:17-25,67-69`) |
| `GET /api/engagement/unit-notifications?orgUnitId=&page=&limit=` | `orgUnitId`、預設 page 1、limit 20 | `{items,page,perPage,total}` (`src/features/organizations/notifications-api.ts:27-32,71-77`) |
| `GET /api/engagement/unit-notifications/{notificationId}` | path notification id | `UnitNotification` (`src/features/organizations/notifications-api.ts:79-81`) |

`UnitNotification` 欄位有 `id`、`orgUnitId`、`subject`、`body`、`audienceAccountCount`、`createdAt`、`channels[]`；channel 有 `campaignId`、`channel:'email'|'web_push'`、`status`、`recipientCount` 與可選 failure reasons。adapter 要求 response envelope 中有 `data`；錯誤從 `error` 字串或 `error.code` 取 code，401 可選擇 refresh token 後重試一次。請求使用 same-origin credentials、no-store 與可取得時的 Bearer access token。[`src/features/organizations/notifications-api.ts:9-43,83-116`]

### 錯誤與授權資訊

- Operations adapter 將 `error_code` 優先於 `error` 作為 code，`message` 作為訊息；未成功或缺少 data 時 reject。前端驗證失敗會成為 `invalid_response`。[`src/features/organizations/api.ts:171-205`]
- 單位通知 adapter 對 HTTP error 拋 `UnitNotificationsApiError(status, code)`，成功但 data 缺失／形狀不符時回報 `invalid_response` 或特定 invalid channel error。[`src/features/organizations/notifications-api.ts:34-43,95-115`]
- 單位通知 adapter 的 Bearer token 取自注入的 `getAccessToken()`；可注入 401 refresh callback。這只說明瀏覽器 adapter 的 token 使用方式，不能證明後端授權政策或 endpoint 已上線。[`src/features/organizations/notifications-api.ts:45-58,83-97`]

## 矛盾

- 通知平台設計以 email 為 V1，web push 列為 future channel；現存 unit notification adapter 卻驗證每筆通知必有 email 與 web_push 兩種 channel。兩者範圍和成熟狀態不同，不能據此確定服事表通知的通路。[`docs/superpowers/specs/2026-07-08-hhc-notification-api-design.md:87-107`; `src/features/organizations/notifications-api.ts:108-115`]
- `notification-api` 的設計說瀏覽器不得直接呼叫投遞／預覽／狀態端點；Organizations UI 的 adapter 呼叫 `/api/engagement/unit-notifications` 前端路由。此不必然衝突：可有業務/API 層代理，但目前索引與這些 adapter source 沒有展開該路由的後端轉送實作，故不得將前端路徑等同內部 `notification-api` endpoint。[`docs/superpowers/specs/2026-07-08-hhc-notification-api-design.md:548-559`; `src/features/organizations/notifications-api.ts:60-97`; `docs/work/ministry-schedule/index.md:63-67`]

## 未知與待問

- 尚無服事表／服事項目／日期班次／指派的資料 schema、OpenAPI、request/response、錯誤碼、分頁與版本控制契約。[`docs/work/ministry-schedule/index.md:56-61`]
- 尚無服事表讀取範圍對應的 API、登入／會員資格或組織據點範圍定義；Organizations 的 access projection 不能當成已確認規則。[`src/components/layout/AccountControl.tsx:209-211,237-245`; `docs/work/ministry-schedule/index.md:56-61`]
- 尚無服事內容編輯專屬 permission、role、action code 與 server-side enforcement 契約；已定義的 OrgRoleAssignment 不含 ministry role，且現有 role action map沒有服事操作。[`docs/superpowers/specs/2026-09-15-hhc-unified-authorization-membership-and-entitlement-design.md:552-615`]
- 服事 email 的 domain caller、收件者選取、同意／資格、通知目的、時間與取消／補寄流程均未形成契約。使用者已表示時間尚未決定；通知平台文件將這些業務決策留給 calling domain。[`docs/superpowers/specs/2026-07-08-hhc-notification-api-design.md:49-57`; `docs/work/ministry-schedule/index.md:56-61`]
- 調動、認領與互換已由需求描述排至下一階段，當前未有 API 契約；不得以既有 affiliation move API 推定兩者語意相同。[`docs/work/ministry-schedule/index.md:56-61`]
- 前端 adapter 的存在不證明對應 API 已在後端實作、部署或於 Network 成功；本次沒有檢查後端、OpenAPI generated package、Network、部署或 UAT。[`docs/work/ministry-schedule/index.md:63-67`]

## 未讀完

- 已讀：scout index 指定的 Organizations Operations adapter、Organizations access gate/access projection、unit notification adapter、public/admin API 文件、通知 API 設計、授權／membership／entitlement 設計與 service catalog owner 邊界。
- 未讀：`@hallelujahhomechurch/operations-client` 的 OpenAPI/generated schema；通用 `hhc-web-api`、authorization governance、platform API standards 全文；後端 repositories、實際 Network/API response、部署及 UAT。index 說明通用平台文件未完整納入本次範圍。[`docs/work/ministry-schedule/index.md:63-67`]
