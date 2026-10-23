# 服事表需求 Scout 索引

本索引只記錄 repo 中可定位的程式與文件證據，供需求收斂使用。此 repo 是網站前端；未找到服事排班／服事項目領域的實作或專屬 API 文件。表格「行數範圍」以目前工作樹為準；檔案大小為 bytes。

## 最相關來源

| 路徑 | 行數範圍 | 用途 | 檔案大小 |
| --- | --- | --- | ---: |
| `src/features/organizations/OrganizationUnitPage.tsx` | 19-259 | 現有登入後小家／組織單位目錄頁；顯示單位與會員、負責人標記，並按 API 回傳的 action flags 顯示管理、責任委派與通知操作。 | 24069 |
| `src/features/organizations/api.ts` | 1-206 | Operations API 前端 adapter 與型別：組織目錄、會員、responsibility 以及管理動作；沒有服務排班或服事指派端點。 | 13661 |
| `src/features/organizations/OrganizationsGate.tsx` | 1-21 | 現有組織頁的存取 gate：denied 導回 locale 首頁，loading/unavailable 狀態處理後才提供 API clients。 | 1315 |
| `src/components/layout/AccountControl.tsx` | 123-126, 203-248 | 共用登入身分與 Organizations access projection；導航可見性目前依 church membership、responsibility 或 small-group membership 推導。 | — |
| `src/features/organizations/OrganizationRootsPage.tsx` | 14-42 | 顯示可管理／可查看的根組織單位並進入單位頁。 | 2576 |
| `src/features/organizations/OrganizationNotificationDialog.tsx` | 13-93 | 現有單位通知 UI：主旨／本文、預覽對象、送出、歷史與通路狀態。 | 6780 |
| `src/features/organizations/notifications-api.ts` | 1-121 | 現有 unit notification API adapter；預覽、立即提交、查詢歷史等前端路徑與 response validation。 | 5765 |
| `docs/superpowers/specs/2026-09-19-admin-membership-and-organization-management-decision-record.md` | 32-49, 87-117, 146-160, 329-387 | 近期組織／會員決策紀錄與域邊界；不是服事表需求規格。 | 24964 |
| `docs/superpowers/specs/2026-09-15-hhc-unified-authorization-membership-and-entitlement-design.md` | 492-624, 780-807, 878-965 | OrgUnit、Membership、scoped role 與通知 audience 的平台設計依據。 | 60088 |
| `docs/superpowers/specs/2026-07-08-hhc-notification-api-design.md` | 5-65, 87-126, 536-559 | 通知服務責任邊界：通知服務負責投遞機制，業務域負責收件者與通知時機。 | 16843 |

## 共用 UI、路由及指令

| 路徑 | 行數範圍 | 用途 | 檔案大小 |
| --- | --- | --- | ---: |
| `AGENTS.md` | 1-21 | Repo 工作規則，包含 production branch、PR／CI／release 邊界及此版本 Next.js 文件要求。 | 1530 |
| `src/app/[locale]/organizations/layout.tsx` | 1-18 | 組織頁 route layout 與 metadata；實際頁面殼由 `OrganizationsShell` 提供。 | 916 |
| `src/features/organizations/OrganizationsShell.tsx` | 17-42 | 組織功能共用頁首、頁尾、搜尋狀態、gate 與 route 內容殼。 | 2991 |
| `src/features/organizations/OrganizationUnitPage.tsx` | 147-229 | 頁面列表表格、分頁、管理 action buttons、編輯單位與責任委派 dialog。 | 24069 |
| `src/features/organizations/OrganizationUnitPage.tsx` | 4, 166-186 | 引用共用套件 `@hallelujahhomechurch/ui` 的 `Button`、`DataTableFrame`、`Dialog`、`Switch`，用於組織列表與互動。 | 24069 |
| `src/components/ui/Button.tsx` | 1-39 | Repo 本地 Button 基礎元件（組織頁另引用共用套件版本）。 | 1611 |
| `src/features/organizations/organizations.css` | 1-146 | 組織頁專用表格、頁面與 dialog 樣式。 | 12356 |
| `src/i18n/locales/zh-Hant.json` | 211-240, 723-727 | 現有導覽及 organizations 文案。 | 39115 |

## API、授權與通知文件

| 路徑 | 行數範圍 | 用途 | 檔案大小 |
| --- | --- | --- | ---: |
| `src/features/organizations/api.ts` | 26-45, 73-165, 170-186 | 現有 Operations client interface、`/api/operations/*` 管理端點與部分回應驗證。 | 13661 |
| `src/features/organizations/notifications-api.ts` | 1-121 | 現有 `/api/engagement/unit-notifications` 前端契約（preview、submit、list、get）；未包含服事表的排程或提醒時點。 | 5765 |
| `docs/api/public-api.md` | 1-224 | Web API 文件索引／公開 API；本次搜尋未找到服事或排班契約。 | 8486 |
| `docs/api/admin-api.md` | 1-313 | Admin API 範圍文件；本次搜尋未找到服事排班契約。 | 13882 |
| `docs/superpowers/specs/2026-07-08-hhc-notification-api-design.md` | 33-65, 87-126, 536-559 | notification-api 僅負責核准訊息投遞；業務域決定收件者、同意、資格與時間。 | 16843 |
| `docs/superpowers/specs/2026-07-08-hhc-service-catalog-and-ownership-design.md` | 51-76, 97-125, 220-240 | 服務 owner 與通知／background job 邊界；現文件沒有服事表的 owner 決議。 | 22408 |
| `docs/superpowers/specs/2026-09-15-hhc-unified-authorization-membership-and-entitlement-design.md` | 552-623, 780-807 | scoped `OrgRoleAssignment` 與 membership/communication consent 分界；現有職分不等於服事表編輯權。 | 60088 |
| `docs/superpowers/specs/2026-09-15-hhc-unified-authorization-membership-and-entitlement-design.md` | 177-184, 838-845 | 平台已定義 `operations-api` 為 Meeting／Occurrence／Member 資料 owner，且 MeetingOccurrence 使用穩定識別。 | 60088 |

## 可確認的 repo 事實

- 現有 `/[locale]/organizations` 是登入後組織目錄／管理功能，並非服事表。其導覽存取投影及頁面 gate 可作為登入存取相關參照，但目前授權條件代表 Organizations 功能，不能直接視為新功能的產品規則。
- 現有 Organizations API 管理 unit、member、organization responsibility、entitlement；在該 adapter 中未見 ministry/schedule/assignment 類型端點。
- 組織頁有依 API `actions` flags 顯示編輯、責任委派與通知功能的既有做法；頁面本身並未定義新的服事編輯角色。
- 現有單位通知功能可立即預覽／送出並查看紀錄，且含 email 與 web push channel；這不等於服事提醒通知，也不提供待定的提醒時間決策。
- 平台通知設計明定 calling domain owns recipient selection and business timing；通知 API 不負責排程業務規則。
- Repo 搜尋到的 Admin 組織決策文件包含組織「負責人」及 OrgRoleAssignment 設計，但沒有服事項目、服事班表、認領／交換或服事提醒的需求契約。

## 未找到／尚未形成契約

- 未找到服事表頁面、服事項目／日期／班次／指派資料模型、專屬 API 或畫面參照。
- 未找到「所有教會的人」在資料範圍上代表單一教會、所有教會據點、或登入會員資格的正式定義。
- 未找到服事編輯權限對應的既有 permission/role/action code。既有 OrgRoleAssignment 不能在沒有決策的情況下代替該契約。
- Repo 仍沒有服事 Email 的 API／投遞契約；目前使用者已確認首版於場次發布／指派完成時立即寄給服事者，已發布指派異動只通知受影響人，不寄自動提醒。完整契約由 `spec.md` 定義，不能由既有 unit notification adapter 推定。
- 調動、公開認領、互換等已由使用者描述為需求較模糊且留待下一階段；目前階段排除，不將其寫成驗收條件。
- repo 中 `docs/superpowers/specs/2026-07-08-hhc-web-api-design.md` 及搜尋提到的 PostgreSQL/API 通用設計可能涉及後端契約，但這次沒有把大量通用平台文件全部納入索引；若 spec 進入資料模型/API 設計再按已收斂的範圍定位。

## 搜尋範圍與未讀完範圍

- 搜尋 `src/features`、`src/app`、`src/components/layout`、`src/components/ui`、`src/lib`、`docs/api`、`docs/superpowers/specs` 及 `docs/plans` 中 `ministry`、`服事`、`schedule`、`roster`、`responsibility`、`organization`、`notification` 等關鍵詞。
- 相似程式主要讀取 Organizations 頁面／API／通知 dialog；通知服務設計、Service catalog、近期組織決策與授權設計讀取了與責任邊界直接相關章節。其餘文件僅關鍵字搜尋，未逐份閱讀。
- 沒有檢查後端、其他 repository、部署環境或實際 Network/API 回應；文件內容是設計依據，不能單獨證明線上服務已實作。

## 管理者訪談新增需求：相關來源

以下只列可供比對的既有模式；組織人員管理與單位通知都不是服事表領域契約。`size` 為總行數。

| path | lines | why | size |
| --- | --- | --- | ---: |
| `src/features/organizations/OrganizationUnitPage.tsx` | 35-81, 130-183, 188-229 | 成員搜尋、列表分頁、依 action flags 管理與指派 | 244 |
| `src/features/organizations/api.ts` | 27-45, 72-96, 137-165, 171-187 | 成員查詢、責任指派與回應 action schema | 179 |
| `src/features/organizations/OrganizationMemberPage.tsx` | 18-91 | 已選會員的資料與組織責任呈現 | 91 |
| `src/features/organizations/OrganizationNotificationDialog.tsx` | 13-29, 42-90 | 通知預覽、送出與狀態歷史 UI | 87 |
| `src/features/organizations/notifications-api.ts` | 1-25, 51-105 | unit 通知 preview、submit、history API adapter | 105 |
| `docs/api/internal-notification-api.md` | 17-47, 75-105 | 內部通知 send、status、template preview 契約 | 81 |
| `docs/superpowers/specs/2026-07-08-hhc-notification-api-design.md` | 5-65, 87-126, 536-559 | 通知服務與 calling domain 時機／收件者責任 | 424 |
| `docs/superpowers/specs/2026-07-08-hhc-web-api-design.md` | 137-145, 203-221, 289-301 | 網站後端 adapter、outbox 與通知決策邊界 | 358 |
| `docs/superpowers/specs/2026-07-08-hhc-account-admin-identity-rbac-lifecycle-design.md` | 141-183, 255-280 | Account API 擁有權限角色指派 | 364 |
| `docs/superpowers/specs/2026-07-08-hhc-service-catalog-and-ownership-design.md` | 51-76, 97-125, 220-240 | 網站資料、通知及背景工作的服務 owner 範圍 | 278 |
| `src/features/organizations/organizations.css` | 35-65, 78-104, 119-140 | 組織列表、表單與窄螢幕樣式參照 | 139 |
| `AGENTS.md` | 1-21 | repo、分支、PR 及 Next.js 工作規則 | 21 |

### 搜尋過但沒找到

- 服事崗位 checklist、可編輯 checklist template、個人 checklist 完成紀錄：搜尋 `checklist`、`check list`、`checklist template`、`task template`；搜尋結果只有 runbook／平台 rollout checklist，非服事功能。產品行為已由使用者確認並記於 `spec.md`。
- 服事人員可用／不可用時間、排班偏好或 availability API：搜尋 `availability`、`unavailable time`、`cannot serve`、`cannot attend`、`blackout`、`time off`；結果沒有服事或組織人員可用時段功能。
- 服事次數統計、平均負擔、公平輪值、按人員平衡指派：搜尋 `service count`、`assignment count`、`workload`、`fairness`、`load balancing`、`roster`；未找到服事領域資料或統計端點。統計口徑已由使用者確認並記於 `spec.md`。
- 聚會／崗位／服事指派資料模型與 assign API：搜尋 `meeting`、`gathering`、`service position`、`schedule`、`assignment`、`roster`、`服事`；Organizations API 只有組織會員及責任管理，沒有服事指派契約。
- 依聚會或週次查看服事人員的篩選功能：搜尋 `filter`、`week`、`meeting`、`gathering`；Organizations 頁面有單位／會員搜尋與分頁，但沒有聚會／週次篩選。
- 服事通知後的 checklist 入口或 checklist 通知接續 API：搜尋 `notification`、`checklist`、`service`、`assignment`；找到的通知功能是單位通知，沒有服事 checklist 觸發或完成狀態。使用者已確認首版行為，新的端到端契約列於 `spec.md`。

### 搜尋範圍與限制

- 搜尋 `src/features`、`src/app`、`src/components`、`src/lib`、`docs/api` 及 `docs/superpowers/specs`，使用上述英文關鍵字與「服事／排班」。
- 已檢查 root `AGENTS.md`；本次命中的 Organizations UI 使用既有共用 UI 套件與 feature-local CSS。沒有找到其他 instructions 檔案或服事功能 demo route。
- 未讀 hhc-web-api、account-api 或 notification-api 的其他 repository；未檢查資料庫、部署或 Network。搜尋結果不能證明外部服務不存在對應實作。
