# Source register — ministry-schedule

| 類別 | 位置 |
| --- | --- |
| 既有規畫或舊 spec | 本版 `docs/work/ministry-schedule/spec.md`；2026-10-20 使用者提供的管理者訪談摘要及後續問答（聚會與會員分開維護／指派、Checklist、Email、統計、不可服事時段、聚會與週次篩選）；相關平台決策見 `docs/superpowers/specs/2026-09-19-admin-membership-and-organization-management-decision-record.md` |
| SA / SD 文件 | `docs/superpowers/specs/2026-09-15-hhc-unified-authorization-membership-and-entitlement-design.md`；`docs/superpowers/specs/2026-07-08-hhc-notification-api-design.md`；`docs/superpowers/specs/2026-07-08-hhc-service-catalog-and-ownership-design.md` |
| API 文件 | `docs/api/public-api.md`、`docs/api/admin-api.md`；參照 adapter `src/features/organizations/api.ts`、`src/features/organizations/notifications-api.ts`；尚無服事表專屬 API 契約 |
| 畫面截圖 | 沒有 |
| 串接服務與權限說明 | `docs/superpowers/specs/2026-09-15-hhc-unified-authorization-membership-and-entitlement-design.md`、`docs/superpowers/specs/2026-07-08-hhc-notification-api-design.md`；現有通知 UI/API：`src/features/organizations/OrganizationNotificationDialog.tsx`、`src/features/organizations/notifications-api.ts` |
| 參照的既有組件 | `src/features/organizations/OrganizationsShell.tsx`、`src/features/organizations/OrganizationsGate.tsx`、`src/features/organizations/OrganizationUnitPage.tsx`、`src/features/organizations/api.ts` |
| 本輪收斂 | 使用者確認首版排班管理範圍為台北家教會，其他 Church 不參與；所有服事日期／時間採 `Asia/Taipei`。決策記錄：`docs/superpowers/specs/2026-10-23-ministry-schedule-domain-decision-record.md` |
