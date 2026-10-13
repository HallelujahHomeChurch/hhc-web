# Independent Task 9 pre-code review

Date: 2026-10-13. Read task9-design-gate.md and actual WeeklyReader state/ref/effect implementation, restoration/navigation call paths, progress callback types and source diff against origin/main. No implementation change made.

What this decision does: Retain existing position ownership inside ReaderDocument. The proposed extraction would move the same closure behind callbacks for selection, chrome, dirty notes, geometry and progress, without consolidating duplicate policy or creating an independent responsibility.

Verdict: approve retaining the original code. Critical 0; Important 0 after the documentation correction below. No useReaderPosition hook or mirror tests required.

The table accounts for local/cloud restoration, account/document/revision storage binding, manual navigation precedence, font readiness, rAF source/anchor scrolling, mobile 250 ms progress, desktop 150 ms progress, hidden-tab flush, notes action guards, gesture capture, viewport resize, search, exit recovery, and manual versus restoration focus. These responsibilities use the same viewport/paper refs from multiple owners; moving them would introduce coordination rather than reduce it.

Initial contract finding: the first proposal typed value as MemberOnlineDocument while actual ReaderDocument receives OnlineBulletinAccess and all position calls use value.document. Disposition: RESOLVED after rereading the corrected import and `value: OnlineBulletinAccess`, with prose now identifying value.document as MemberOnlineDocument. The exact candidate types now express the dependencies being rejected, not a new runtime interface.

Confirmed WeeklyReader.tsx has no diff against origin/main. Keeping it unchanged preserves effect declaration order and binding/restoration policy directly; this is not a claim of equivalence for an unimplemented hook. Existing final-candidate focused tests still need a valid receipt. Physical keyboard/rotation and live progress remain separate acceptance gates.

Not checked: no runtime tests, device tests, live backend or production operations by this reviewer.
Risk: review approval concerns the no-extraction decision only; it does not complete candidate CI/browser/device acceptance.
