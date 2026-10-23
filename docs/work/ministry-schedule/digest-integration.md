# 服事表整合邊界 Digest

## 目的與來源

整理首版 Email 通知所需的服務責任與 repo 先例，不把既有單位通知 API 契約外推到服事表。來源包括 [`index.md`](index.md)、通知服務與 service catalog 設計、內部通知 API 文件，以及本對話已確認的管理者需求。

## Repo 可確認的事實

- Service catalog 將網站資料與業務操作歸網站後端；`notification-api` 提供內部通知投遞能力，通知觸發、收件人資格、訊息目的與領域資源識別由呼叫端 domain 決定。[`docs/superpowers/specs/2026-07-08-hhc-service-catalog-and-ownership-design.md:51-76,97-100,220-239`](../../superpowers/specs/2026-07-08-hhc-service-catalog-and-ownership-design.md)
- 內部通知 API 提供 `POST /priv/notifications/send`、狀態查詢及模板預覽；只供內部服務透過 Dapr service invocation、mTLS 及 app-id allowlist 呼叫，瀏覽器不得直接呼叫。[`docs/api/internal-notification-api.md:15-33,35-97`](../../api/internal-notification-api.md)
- unit notification adapter/dialog 有 audience preview、立即提交及歷史狀態 UI 的模式，但其 audience、email/web push channels 與端點只屬於組織單位通知，不是服事通知契約。[`src/features/organizations/notifications-api.ts:1-121`](../../../src/features/organizations/notifications-api.ts); [`src/features/organizations/OrganizationNotificationDialog.tsx:13-93`](../../../src/features/organizations/OrganizationNotificationDialog.tsx)
- Scout 未找到服事專屬通知、checklist 或投遞狀態整合。[`index.md`]

## 使用者已確認的服事通知產品行為

- Email 通知屬首版。
- 編輯者發布一場已完成指派的場次時立即通知該場次所有指派會員；若該崗位設有 checklist，信件提供該會員個人 checklist 的登入後連結，否則連至場次資料。
- 已發布場次的指派發生新增或調整時，只通知受該次異動影響的會員；不寄自動定時提醒。
- 已發布 MeetingOccurrence 改時間或取消時，通知該場次所有受影響服事者；取消場次從會員排班隱藏且不計入服事統計。
- Checklist 與崗位關聯；每位被指派會員有獨立清單。Checklist 範本修改只影響新建的 checklist 實例。

以上是產品流程決定，不代表既有 API 已實作或通知服務具備該模板、深連結及重送政策。

## Spec 應定義的新契約

- hhc-web 呼叫 operations-api 的 Operations API；不在 browser 直接呼叫 `/priv/notifications/*`。
- operations-api 擁有既有 Meeting／Occurrence 及新增服事指派／checklist 的存取授權、發布狀態及通知觸發決定；內部通知服務只負責傳送。
- 場次發布與指派變更需具冪等行為，通知命令不得因 API 重試重複送出；通知失敗須可被管理者辨識並重試或交由既有投遞 retry 機制處理，具體狀態與 retry 操作由 API 契約定義。
- 個人 checklist 路由必須要求登入並驗證該會員是該指派對象；編輯者可查看完成狀態，但不能以猜測 ID 讀取別人的 checklist 項目。
- Email 收件人由服事 domain 依被指派會員的可用帳戶 Email 選取，並依平台通知 eligibility / consent 規則處理；通知內容不暴露其他服事者的 checklist 個人連結。
- operations-api 需發布 OpenAPI 與錯誤／狀態契約；實際與 notification-api 串接需在後端專案落地並驗證。

## 未知與未讀完範圍

- 未檢查 operations-api、notification-api、account-api 後端 source、schema、部署及實際投遞；無法確認 API、Email template、delivery status 或會員 Email eligibility 現況。
- 通知模板 ID、checklist 深連結的正式 URL、失敗狀態呈現細節及後端重送入口是待 coder 依實際服務契約定義的技術細節；不改變已確認的收件人、觸發與時間。
- 未讀通知設計及 service catalog 的其他章節；引用僅代表指定段落可見的邊界。
