# 服事表需求 Digest

## 來源

- 本對話前段的使用者確認：登入後全教會有效會員可讀；編輯權由教會管理者指派；會員可切換清單與月曆且預設清單；服事調動／認領／交換延後。[來源：使用者回答，見對話脈絡]
- 2026-10-20 管理者討論摘要與使用者後續收斂：管理會議與會員資料分開維護，再指派會員至場次崗位；崗位可帶 checklist 範本；要統計服事次數；會員可提交不可服事時段；管理者可依聚會及週次篩選。[來源：使用者提供的管理者討論摘要及本對話問答]
- Repo 檢索邊界與相關既有功能見 [`index.md`](index.md)。

## 已確認的行為與資料

- 首版服務範圍僅為台北家教會，其他 Church 不參與；僅已登入且具台北家教會有效 ChurchMembership 的會員可查看。服事表編輯者由台北家教會管理者指派，權限限該 Church，不從單位職務自動取得。[使用者已確認]
- 聚會／場次沿用既有 Meeting／MeetingOccurrence；可用 once 或 weekly Meeting。服事崗位、指派及 Checklist 關聯於既有 Meeting／Occurrence 識別。每個 occurrence 的服事指派逐場維護，新 occurrence 不自動複製前次指派。[使用者已確認；`docs/superpowers/specs/2026-09-15-hhc-unified-authorization-membership-and-entitlement-design.md:177-184,838-845`]
- 人員使用既有有效會員資料，不另建服事專用人員副本。指派把會員連到某場次的崗位；每個已發布崗位至少一位會員，可多人。[使用者已確認]
- 會員可在清單與月曆切換，預設清單；管理者能以聚會及週次篩選，檢視每週各崗位服事者。[使用者已確認]
- 編輯者可管理聚會定義、崗位、場次、指派及 checklist 範本；可新增、修改、刪除。會員只可維護自己的不可服事時段及完成自己的 checklist。[使用者已確認編輯權及 CRUD；本次整理其餘操作]
- 可選的 Checklist 範本掛在崗位上；指派會員到有範本的崗位後，每位會員自動取得獨立 checklist，完成狀態彼此分開，編輯者可查完成狀態。修改範本只影響之後新建的 checklist；已建 checklist 保留當時項目與完成狀態。[使用者已確認]
- 服事通知納入第一階段。場次發布或完成指派時立即寄 Email 給該場次被指派的服事者，附上其個人 checklist 連結（無 checklist 時連至場次資料）；發布後調整指派時，只通知該次異動涉及的人；已發布 MeetingOccurrence 改時間或取消時，通知所有受影響服事者。取消場次從會員排班隱藏且不計入統計；不自動寄定時提醒。[使用者已確認]
- 統計以「每位會員在一個崗位的一次指派」計一次；只統計已結束場次，管理者選日期範圍並可檢視人員次數與對應明細。同場兩個崗位算兩次。[使用者已確認建議口徑]
- 會員可提交單次日期／起訖時間的不可服事時段，可修改或撤回；只有服事表編輯者可看。它只供管理者參考，不阻止指派；重複週期不可服事規則不在第一階段。[使用者已確認]
- 調動請求、認領及互換流程留待後續階段。[使用者已確認]
- 已發布場次或崗位的「刪除」採取消／封存而非永久刪除；保留通知與服事歷史。取消場次從會員排班隱藏且不計數；封存崗位不可再指派。[使用者已確認]
- 時區一律採 `Asia/Taipei`，適用於 MeetingOccurrence 日期／時間、不可服事時段、週次篩選及通知時間。[使用者已確認]

## 可查證的平台事實與設計界線

- 此 repo 是網站前端，尚無服事領域 UI、資料模型、專屬 API 或 checklist／availability／統計端點；前端無法單獨完成端到端持久化與授權驗收。[`index.md`]
- 平台架構將 `Meeting`、`occurrence`、`Member`、`ChurchMembership` 的 source of truth 放在 `operations-api`；`hhc-web-api` 擁有網站內容工作流。新增服事能力應基於既有 Operations Meeting／Occurrence，而不是在 hhc-web-api 複製聚會與時間。[`docs/superpowers/specs/2026-09-15-hhc-unified-authorization-membership-and-entitlement-design.md:177-184`](../../superpowers/specs/2026-09-15-hhc-unified-authorization-membership-and-entitlement-design.md)
- 有效會員、Member 穩定識別、組織角色與通知責任可參考既有平台設計，但不可由 Organizations action flags 推導新服事權限。[`docs/superpowers/specs/2026-09-15-hhc-unified-authorization-membership-and-entitlement-design.md:492-624,878-965`](../../superpowers/specs/2026-09-15-hhc-unified-authorization-membership-and-entitlement-design.md)
- 服事 domain 決定通知觸發、收件人與資源連結；通知服務負責投遞。瀏覽器不得直接呼叫內部 `notification-api`。[`docs/superpowers/specs/2026-07-08-hhc-notification-api-design.md:33-57`](../../superpowers/specs/2026-07-08-hhc-notification-api-design.md); [`docs/api/internal-notification-api.md:15-33,35-47`](../../api/internal-notification-api.md)

## 設計待落實事項（由 Spec 定義，不是產品待答問題）

- 定義 Operations API 的服事崗位、Occurrence 指派、checklist 範本／實例、不可服事時段及統計讀取契約；operations-api 為本需求後端邊界，notification-api 僅負責投遞。
- 定義場次發布狀態、Email outbox／冪等、指派異動通知與 checklist 深連結，以避免存檔重試造成重複寄信。
- 定義管理者操作稽核、刪除關聯資料策略、會員狀態變更時的既有指派處理，以及符合 `Asia/Taipei` 的日期時間 API 格式。

## 未讀完與證據限制

- 沒有檢查 hhc-web-api、account-api 或 notification-api 的完整程式碼、schema、部署或 Network；不可宣稱 API 已存在或已上線。
- 參照 repo 文件僅限 digest 與索引列出的段落；既有 Organizations 與通知功能僅作模式參考，不是服事表契約。
