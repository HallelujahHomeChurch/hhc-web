# 整合邊界 Digest

## 目的

整理服事表需求可能涉及的通知服務責任邊界，以及既有單位通知 API/email 通路作為先例可確認的部分。此 digest 只記錄 repo 證據，不決定服事表的通知產品行為或服務 owner。

## 關鍵事實

- 平台通知設計將訊息模板、rendering、provider adapter、queue/status lifecycle、idempotency、retry/backoff、suppression/bounce 與通知稽核列為 `notification-api` 責任；收件者選擇、同意、業務時機、資格、訊息目的及 domain resource id 由呼叫端業務 domain 負責。[`docs/superpowers/specs/2026-07-08-hhc-notification-api-design.md:35-57`](../../superpowers/specs/2026-07-08-hhc-notification-api-design.md)
- Service catalog 將 `notification-api` 定位為內部通知命令投遞服務，將網站 backend 歸於 `hhc-web-api`；一般 background job 屬 owner service 的執行型態，排程與工作紀錄須由 owner 負責。[`docs/superpowers/specs/2026-07-08-hhc-service-catalog-and-ownership-design.md:51-76,97-100`](../../superpowers/specs/2026-07-08-hhc-service-catalog-and-ownership-design.md)
- Service catalog 的通知邊界再次記載：呼叫 domain 決定 recipient eligibility、consent、message purpose、domain timing 與 resource id；`notification-api` 執行投遞能力。[`docs/superpowers/specs/2026-07-08-hhc-service-catalog-and-ownership-design.md:220-239`](../../superpowers/specs/2026-07-08-hhc-service-catalog-and-ownership-design.md)
- Repo 的 Scout 搜尋結論是尚未找到服事表頁面、領域資料模型或專屬 API；現有 unit notification adapter 也沒有服事排程或提醒時點契約。[`docs/work/ministry-schedule/index.md:3,38,54-61`](index.md)
- Scout 結論亦記錄服事 email 提醒的觸發事件、收件者、時間及投遞後政策尚無領域契約；通知時間尚未定案。[`docs/work/ministry-schedule/index.md:59`](index.md)

## 既有慣例

- 現有單位通知 UI 先收集主旨與本文，要求預覽 audience 後才能送出；預覽呈現 audience account、email recipient、web push device 數，送出後可查歷史與通路狀態。[`src/features/organizations/OrganizationNotificationDialog.tsx:16-29,42-52,71-88`](../../../src/features/organizations/OrganizationNotificationDialog.tsx)
- 單位通知 API 先例包含 `POST /api/engagement/unit-notifications/preview`、帶 `Idempotency-Key` 的 `POST /api/engagement/unit-notifications`、依 `orgUnitId/page/limit` 查詢的 GET，以及依 notification id 取得單筆的 GET；這些均是 unit notification 契約，不是服事排班 API。[`src/features/organizations/notifications-api.ts:60-80`](../../../src/features/organizations/notifications-api.ts)
- 既有單位通知 response 要求各通知包含兩個 sibling channels：`email` 與 `web_push`；channel 有 campaign id、status、recipient count，並可帶 `recipient_unavailable`、`content_unavailable`、`delivery_failed` 等 failure reason。[`src/features/organizations/notifications-api.ts:9-15,17-25,108-116`](../../../src/features/organizations/notifications-api.ts)
- 現有通知歷史 UI 將 `draft/scheduled/queued/paused` 顯示為 queued，將 `processing/running/sending` 顯示為 processing，`completed` 顯示為完成，其餘顯示為失敗；歷史依 channel 顯示狀態、recipient count 與 failure reasons。[`src/features/organizations/OrganizationNotificationDialog.tsx:54-59,84-88`](../../../src/features/organizations/OrganizationNotificationDialog.tsx)
- 通知 API 設計文件列出 V1 channel 為 `email`，並將 `web_push` 列為未來 channel；較新的授權設計提及 Email/Web Push commands，而目前 unit notification 前端契約也要求 email 與 web_push 兩個 channel。這些證據描述不同文件時點／範圍，無法單獨確認全平台目前實際啟用的 channel 狀態。[`docs/superpowers/specs/2026-07-08-hhc-notification-api-design.md:87-107`](../../superpowers/specs/2026-07-08-hhc-notification-api-design.md); [`docs/superpowers/specs/2026-09-15-hhc-unified-authorization-membership-and-entitlement-design.md:780-785`](../../superpowers/specs/2026-09-15-hhc-unified-authorization-membership-and-entitlement-design.md); [`src/features/organizations/notifications-api.ts:108-116`](../../../src/features/organizations/notifications-api.ts)

## 介面與型別

- Unit notification preview 回應型別為 `audienceAccounts`、`emailRecipients`、`webPushDevices` 三個非負安全整數。[`src/features/organizations/notifications-api.ts:3-7,60-64`](../../../src/features/organizations/notifications-api.ts)
- Unit notification channel 型別包含 `campaignId`、`channel: 'email' | 'web_push'`、`status`、`recipientCount` 與可選 failure reasons；通知記錄包含 `id`、`orgUnitId`、`subject`、`body`、`audienceAccountCount`、`createdAt` 及 channels。[`src/features/organizations/notifications-api.ts:9-25`](../../../src/features/organizations/notifications-api.ts)
- 通知送出 endpoint 要求 `orgUnitId`、`subject`、`body`，並附 `Idempotency-Key`；API adapter 使用 same-origin credentials、no-store，並將 bearer access token 放入 Authorization header（若有）。[`src/features/organizations/notifications-api.ts:67-69,83-97`](../../../src/features/organizations/notifications-api.ts)
- 上述型別與路徑只證明前端 adapter 預期的 unit notification contract；Scout 未定位服事表專屬 API 契約或後端實作證據。[`docs/work/ministry-schedule/index.md:3,38-40,67`](index.md)

## 矛盾

- 通路範圍有時間／文件層級差異：通知 API 設計文件將 V1 限為 email、將 web push 列為 future；目前 unit notification adapter 卻要求 email 與 web push 兩種 sibling channels，較新授權設計也提及 Email/Web Push commands。現有來源沒有說明通用通知 API 的正式 channel 狀態是否已更新，因此不把單位通知實作外推成服事通知契約。[`docs/superpowers/specs/2026-07-08-hhc-notification-api-design.md:89-107`](../../../superpowers/specs/2026-07-08-hhc-notification-api-design.md); [`src/features/organizations/notifications-api.ts:108-116`](../../../src/features/organizations/notifications-api.ts); [`docs/superpowers/specs/2026-09-15-hhc-unified-authorization-membership-and-entitlement-design.md:780-785`](../../../superpowers/specs/2026-09-15-hhc-unified-authorization-membership-and-entitlement-design.md)

## 未知與待問

- 服事 email 的收件者如何選出、以哪個身份／會籍資料為準，尚未決定；也未確認服事通知是否會套用既有 communication consent／eligibility 規則。[`docs/superpowers/specs/2026-07-08-hhc-notification-api-design.md:49-57`](../../superpowers/specs/2026-07-08-hhc-notification-api-design.md); [`docs/superpowers/specs/2026-09-15-hhc-unified-authorization-membership-and-entitlement-design.md:780-785`](../../superpowers/specs/2026-09-15-hhc-unified-authorization-membership-and-entitlement-design.md)
- Email 觸發事件與通知時間尚未定案；是否有排程提醒、建立／編輯／指派時即時通知、取消或變更後通知，以及提醒提前量，均沒有服事領域契約。[`docs/work/ministry-schedule/index.md:59`](index.md)
- 服事提醒的投遞狀態、重試／取消規則、重複命令處理、退信及 suppression 行為未形成服事契約。通用通知設計列出部分投遞能力，但沒有定義服事 domain 如何使用這些能力。[`docs/superpowers/specs/2026-07-08-hhc-notification-api-design.md:35-57`](../../superpowers/specs/2026-07-08-hhc-notification-api-design.md); [`docs/work/ministry-schedule/index.md:59`](index.md)
- 服事 domain 的服務 owner、排程工作由誰執行，以及和既有 `hhc-web-api`／`notification-api` 的呼叫介面都未決定；目前 service catalog 只提供通用 ownership 邊界。[`docs/superpowers/specs/2026-07-08-hhc-service-catalog-and-ownership-design.md:51-76,97-100,220-239`](../../superpowers/specs/2026-07-08-hhc-service-catalog-and-ownership-design.md)
- 本 digest 不推定既有 unit notification 的 audience 計數或 email/web push 通路就是服事 reminder 的收件者與通路政策；其可重用範圍仍待產品／技術決策。[`src/features/organizations/notifications-api.ts:3-15,60-68`](../../../src/features/organizations/notifications-api.ts)

## 未讀完

- 僅閱讀 Scout index 指定的通知責任設計、Service catalog 對應段落、授權設計的 notification audience 段落，以及 unit notification API adapter 和 dialog 中與預覽、通道、投遞狀態相關的內容。
- 未閱讀 `docs/superpowers/specs/2026-07-08-hhc-web-api-design.md`、後端 repository、provider adapter/worker 原始碼、資料庫 schema、部署環境或實際 Network/API 回應；無法由此 digest 確認線上服務現況或完整投遞流程。[`docs/work/ministry-schedule/index.md:61,67`](index.md)
