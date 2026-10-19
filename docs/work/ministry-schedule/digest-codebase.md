# Codebase Digest：服事表需求

## 目的

整理登入後組織功能可供服事表需求收斂參照的既有前端模式：路由頁殼、存取 gate、列表資料載入、伺服器回傳的 action flags、操作 API adapter、帳號存取投影、多語系與樣式邊界。這些是現有 Organizations 功能的實作事實，不代表服事表應沿用相同產品授權規則。

## 關鍵事實

- Organizations route 位於 locale segment 下；layout 驗證 locale、產生不索引的頁面 metadata，並以 `getSiteLayout(locale)` 載入網站 layout 後包入 `OrganizationsShell`。`src/app/[locale]/organizations/layout.tsx:9-17`
- 共用 shell 提供 `SiteHeader`、`SiteFooter`、頁面內容殼與 `OrganizationsGate`；根目錄時另顯示 `AboutHero`。`src/features/organizations/OrganizationsShell.tsx:31-40`
- Gate 使用 `useOrganizationsAccess()` 的狀態分流：`denied` 導回當前 locale 首頁、`loading` 顯示 skeleton、`unavailable` 顯示錯誤與重試；通過後才提供 `OrganizationClientsProvider`。`src/features/organizations/OrganizationsGate.tsx:11-20`
- Organizations access projection 由 Operations access snapshot 計算：需有 `churchMembership`，且至少有一項 responsibility 或 small-group membership，才標記為 Organizations `allowed`。該投影用於目前 Organizations 導航／頁面存取，不是服事表的授權契約。`src/components/layout/AccountControl.tsx:209-211`, `src/components/layout/AccountControl.tsx:237-245`
- 根目錄頁呼叫 `listManagedRoots`，處理載入、403、一般錯誤、重試、空清單及根單位連結。`src/features/organizations/OrganizationRootsPage.tsx:17-40`
- 組織單位頁透過 `unitId` 載入單位資料及成員清單；成員查詢使用搜尋、頁碼，載入以 `AbortController` 取消。單位為 archived 時不載入成員。`src/features/organizations/OrganizationUnitPage.tsx:19-25`, `src/features/organizations/OrganizationUnitPage.tsx:57-81`
- 列表以 `DataTableFrame` 包住 HTML table，列出子單位及成員；成員具名稱／email、responsibility 標記與分頁。名稱是否連至管理頁、行動欄是否顯示，依 `manageMembers || manageEntitlements` 決定。`src/features/organizations/OrganizationUnitPage.tsx:141-145`, `src/features/organizations/OrganizationUnitPage.tsx:165-186`
- Header 操作與 dialog 依 `folder.actions` 欄位決定是否出現，包括 `editUnit`、`manageMembers`、`createChild`、`sendNotifications`；dialog 開啟後也會依相同 action flag 檢查可用性。`src/features/organizations/OrganizationUnitPage.tsx:127-145`, `src/features/organizations/OrganizationUnitPage.tsx:157-162`, `src/features/organizations/OrganizationUnitPage.tsx:188-229`
- API adapter 使用 Operations client 的 schema 型別，涵蓋 access、組織單位、成員、responsibility、entitlement 等操作；其介面沒有服事表、排班或服事指派操作。`src/features/organizations/api.ts:11-44`
- Adapter 對管理端點做 response validation；組織資料含 `actions` boolean 欄位，驗證清單也明列可管理動作。驗證此回應形狀不代表後端授權規則可由前端取代。`src/features/organizations/api.ts:171-187`

## 既有慣例

- 路由 layout 先驗證 locale 並載入全站 layout，再由 feature shell 組合 header、gate、main 與 footer。`src/app/[locale]/organizations/layout.tsx:9-17`, `src/features/organizations/OrganizationsShell.tsx:17-40`
- Shell 以 locale 選取 `organizationCopy`、`organizationMessages`，並將 locale 傳入 gate/provider；組織內連結經 `organizationHref(locale, ...)` 建立。`src/features/organizations/OrganizationsShell.tsx:31-37`, `src/features/organizations/OrganizationsGate.tsx:11-20`, `src/features/organizations/OrganizationUnitPage.tsx:151-154`
- zh-Hant locale 的導覽現有 `organizations` 文案為「小家」，hero title 也是「小家」；這是既有組織功能名稱，不是服事表名稱決定。`src/i18n/locales/zh-Hant.json:219-240`, `src/i18n/locales/zh-Hant.json:723-726`
- 組織頁引用 `@hallelujahhomechurch/ui` 的 `Button`、`DataTableFrame`、`Dialog`、`Switch`，並以 feature-local `organizations.css` 管理表格、header、dialog、響應式版面與設計 token。`src/features/organizations/OrganizationUnitPage.tsx:4-15`, `src/features/organizations/organizations.css:1-18`, `src/features/organizations/organizations.css:35-65`, `src/features/organizations/organizations.css:78-104`, `src/features/organizations/organizations.css:119-140`
- 目錄頁使用 skeleton、錯誤訊息、空狀態及重試；單位頁表格支援分頁及 loading 標記。`src/features/organizations/OrganizationRootsPage.tsx:20-40`, `src/features/organizations/OrganizationUnitPage.tsx:139-140`, `src/features/organizations/OrganizationUnitPage.tsx:166-183`
- 目前 Operations request 透過 API adapter 封裝，管理變更帶 Idempotency-Key；版本化更新使用 `If-Match`。這些是既有 Operations API 慣例。`src/features/organizations/api.ts:105-121`, `src/features/organizations/api.ts:137-165`, `src/features/organizations/api.ts:169-190`

## 介面與型別

- `OperationsApiClient` 提供 `getMyAccess`、`listManagedRoots`、`getManagedUnit`、`listManagedMembers`、member/responsibility/entitlement 等功能；無 ministry/schedule API method。`src/features/organizations/api.ts:27-44`
- `ManagedUnitFolder`、`ManagedMemberPage` 等型別取自 `@hallelujahhomechurch/operations-client` schema；`OperationsAccess` 擴充 `AccessSnapshot`。`src/features/organizations/api.ts:11-25`
- `ManagedActions` 取自 client schema；資料回應 validator 要求單位回應包含 `editUnit`、`createChild`、`archive`、`restore`、`manageMembers`、`manageResponsibilities`、`manageEntitlements`、`sendNotifications` 等 boolean 欄位。`src/features/organizations/api.ts:17-20`, `src/features/organizations/api.ts:171-184`
- 組織目錄端點包括 `/api/operations/me/access`、`/api/operations/manage/roots`、`/api/operations/manage/org-units/{unitId}`、`/members` 等。`src/features/organizations/api.ts:72-96`
- `useOrganizationsAccess` 暴露 `status` 與 `retry`；gate 使用狀態值 `denied`、`loading`、`unavailable`，其餘狀態進入 provider。`src/components/layout/AccountControl.tsx:123-126`, `src/features/organizations/OrganizationsGate.tsx:11-20`

## 矛盾

- 本 digest 所讀程式碼未見相互矛盾的 Organizations shell、頁面、gate 或 API adapter 行為。Organizations 的既有 access projection 及 action flags 僅證明當前組織功能契約，不能推出服事表應由哪些角色或會員存取／編輯。`src/components/layout/AccountControl.tsx:237-245`, `src/features/organizations/OrganizationUnitPage.tsx:157-162`

## 未知與待問

- 未知服事表是否採用現有 Organizations route shell、gate、table、共用 UI 套件及 CSS；程式碼只能指出可參考模式，不能代替需求決定。
- 未知服事表的資料範圍是否與目前 Organizations access projection 相同；目前投影只表示特定教會會員且具 responsibility 或 small-group membership 的使用者可進入 Organizations。`src/components/layout/AccountControl.tsx:209-211`, `src/components/layout/AccountControl.tsx:241-245`
- 未知服事表編輯權限的角色、scope 或 action flags；現有 Organizations `ManagedActions` 是組織管理動作，不是服事編輯權限。`src/features/organizations/api.ts:17-25`, `src/features/organizations/api.ts:171-184`
- 未知服事表 API、資料模型、錯誤契約、後端驗權與通知契約；現有 adapter 不含服事表端點。`src/features/organizations/api.ts:27-44`
- 此摘要僅涵蓋指定 Organizations 前端來源；不據此判定任何後端授權或實際部署行為。

## 未讀完

- 依 planner 限定，只讀 `index.md` 中指明的 Organizations 前端程式來源；未讀 API／授權／通知設計文件、通知 dialog/API、其他頁面、後端、Network 回應或部署設定。原始索引與指定來源清單見 `docs/work/ministry-schedule/index.md`。
- `OrganizationUnitPage.tsx` 已讀索引指定範圍 19-259；`api.ts` 1-206；`OrganizationsGate.tsx` 1-21；`AccountControl.tsx` 123-126、203-260；`OrganizationRootsPage.tsx` 14-42；`OrganizationsShell.tsx` 17-42；locale organizations layout 1-18；`organizations.css` 1-146；`zh-Hant.json` 211-240、723-727。未讀清單外的檔案或其餘行段。
