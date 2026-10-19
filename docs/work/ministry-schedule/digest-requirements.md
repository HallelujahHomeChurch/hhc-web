# 需求摘要：服事表

## 目的

整理使用者目前提供的服事表需求，以及 repository 中與登入會員範圍、授權、通知直接相關的平台設計依據，供 planner 收斂需求時使用。此摘要保留未決事項，不代替使用者作產品決定。

## 關鍵事實

- 使用者希望新增「服事表」功能；所有有效教會會員登入後都能查看整間教會的服事。[使用者提供：本對話需求起點回覆及後續明確回答]
- 使用者確認編輯者是由教會管理者指派「教會層級編輯權限」的人；可新增、編輯及刪除服事。[使用者提供：後續明確回答]
- 使用者確認第一階段呈現列表及日曆兩種檢視，使用者可切換，預設為列表。[使用者提供：後續明確回答]
- 使用者確認每筆服事事件是一場有日期的聚會，包含開始時間、結束時間、聚會名稱及多個服事崗位；每個崗位可指派一人或多人。[使用者提供：後續明確回答]
- 日期逐筆建立，不支援重複／週期排程。[使用者提供：後續明確回答]
- 使用者要求本次規格涵蓋端到端 API、資料與授權契約；具體技術設計尚待以 repo 與相關技術依據收斂。[使用者提供：後續明確回答]
- Email 通知延至後續階段；本階段不納入通知驗收。[使用者提供：後續明確回答]
- 調動服事、由其他人認領及交換服事均明確列為第二階段。[使用者提供：本對話需求起點回覆及後續明確回答]
- Scout 索引記錄 repo 內未找到服事排班／服事項目領域實作或專屬 API 文件，且此 repo 為網站前端。[`docs/work/ministry-schedule/index.md:1-3`]
- 索引列出的 Organizations 頁、adapter 與現有通知 UI 是可參照的現存功能，但索引明確指出它們不是服事表，也沒有定義新功能的產品授權規則或提醒時點。[`docs/work/ministry-schedule/index.md:9-18`, `45-52`]

## 既有慣例

- 平台組織／會員設計中，`OrgUnit` 表示組織範圍；`Member` 是穩定的人員識別，領域關聯使用 `member_id`。[`docs/superpowers/specs/2026-09-15-hhc-unified-authorization-membership-and-entitlement-design.md:492-496`]
- 平台模型允許每位 Member 有一個有效 ChurchMembership，並可有多個教會內的 family、small-group、fellowship 關係；這可作為使用者已選「有效教會會員可看全教會服事」後的模型參照，但不自行決定如何將成員資格接到服事表授權。[`docs/superpowers/specs/2026-09-15-hhc-unified-authorization-membership-and-entitlement-design.md:529-550`]
- `OrgRoleAssignment` 是有範圍且可撤銷的角色指派；文件明確說明會員關係本身不授予管理動作，pastor 責任本身也不授予管理動作。[`docs/superpowers/specs/2026-09-15-hhc-unified-authorization-membership-and-entitlement-design.md:552-615`]
- AccessSnapshot／前端角色摘要只供呈現與導覽；資料列表與變更仍由後端授權，前端不能自行計算權威範圍或以隱藏控制項代替授權。[`docs/superpowers/specs/2026-09-15-hhc-unified-authorization-membership-and-entitlement-design.md:878-928`, `955-964`]
- 平台通知設計將收件者選擇、同意、業務時機、資格與訊息目的交由呼叫通知服務的業務領域；`notification-api` 負責模板、投遞、重試與投遞狀態等通知機制。[`docs/superpowers/specs/2026-07-08-hhc-notification-api-design.md:33-57`]

## 介面與型別

- 已確認的領域資料形狀為「有日期的聚會」包含開始／結束時間、聚會名稱及多個服事崗位，每個崗位指派一人或多人；日期各自建立且不支援重複排程。這些是使用者提供的需求欄位，不代表 API schema 已決定。[使用者提供：後續明確回答]
- 已確認檢視方式為列表與日曆切換，列表為預設檢視。[使用者提供：後續明確回答]
- 已確認查看身分為有效教會會員；編輯身分為教會管理者指派的教會層級編輯權限。[使用者提供：後續明確回答]
- 使用者要求規格涵蓋端到端 API、資料及授權契約，但具體 endpoint、request/response、資料持久化與權限代碼尚未決定。[使用者提供：後續明確回答；`docs/work/ministry-schedule/index.md:10`, `37-40`, `54-58`]
- 平台文件可參考 `OrgUnit`、`Member`、`OrgMembership`、`OrgRoleAssignment`、`AccessSnapshot` 等既有概念；它們不是已確認的服事表介面或權限契約。[`docs/superpowers/specs/2026-09-15-hhc-unified-authorization-membership-and-entitlement-design.md:492-550`, `552-615`, `878-928`]
- 目前沒有服事表 API、request/response、狀態列舉或前端元件契約；索引也未找到相關專屬端點。[`docs/work/ministry-schedule/index.md:10`, `37-40`, `54-58`]

## 矛盾

- 無。後續回答已將原先寬泛的「教會的人／有權限的人」明確收斂為有效教會會員查看、教會管理者指派之教會層級編輯者管理。[使用者提供：本對話需求起點回覆及後續明確回答]

## 未知與待問

- 端到端契約要落在哪個現有 service、API route 與資料 owner；Scout 索引未找到服事專屬契約。這屬待以技術資料查證／設計，不可由既有 Organization 或 notification 邊界自行推定。[使用者提供：後續明確回答；`docs/work/ministry-schedule/index.md:37-43`, `56-61`]
- 「教會層級編輯權限」在現有授權系統中的 permission code、指派流程及後端拒絕條件尚未定義。既有平台設計要求角色／權限在後端授權，不能僅以 UI 隱藏操作實現。[使用者提供：後續明確回答；`docs/superpowers/specs/2026-09-15-hhc-unified-authorization-membership-and-entitlement-design.md:596-615`, `923-928`]
- 刪除聚會或崗位時，既有指派的資料保留／刪除策略、稽核需求與時間時區處理尚未確認；不從「可刪除」推定具體資料生命週期。[使用者提供：後續明確回答]
- 列表／日曆需要呈現的日期區間、排序、篩選、日曆粒度與空狀態尚未確認；已決定的僅是可切換及預設列表。[使用者提供：後續明確回答]
- Email 通知不在本階段；通知觸發、收件者、時間及投遞規則留待後續階段決定。[使用者提供：後續明確回答]
- 調動請求、認領及互換均屬第二階段；其流程細節不屬本階段待解問題。[使用者提供：後續明確回答]

## 未讀完

- 本摘要依 planner 指定讀取 Scout 索引，以及索引引用的授權／會員與通知平台設計相關章節；未逐頁閱讀索引列出的 Organizations UI/API 檔案，也未逐份閱讀其他規格文件。
- Scout 索引記錄的搜尋涵蓋 `src/features`、`src/app`、`src/components/layout`、`src/components/ui`、`src/lib`、`docs/api`、`docs/superpowers/specs` 與 `docs/plans` 中相關關鍵字；其中多數文件僅關鍵字搜尋，未逐份閱讀。[`docs/work/ministry-schedule/index.md:63-67`]
- 未檢查後端 repository、部署環境或實際 Network/API 回應；目前能確認的是此 repo 的索引結果與已讀平台設計文件，不代表線上服務狀態。[`docs/work/ministry-schedule/index.md:65-67`]
