# Web #209 production release acceptance

PR #209 merged as bd98ef18c786a3428366e686851c52916189dcf8. Production Release 38428099079 passed. Ready revision 0000205 is Healthy/Running and its immutable image matches ACR main-bd98ef1. Resources, Single revision mode and existing reader/video feature values match prior configuration. Single mode traffic field is null, not explicit weighted-traffic evidence.

Public HTML returns 200; known anonymous protected endpoints remain 401 private,no-store. Authenticated new-build online discovery shows 10 links, keyboard tab switching works, reload diagnostics record no uncaught errors/unhandled rejection and no HTTP >=400 resources. Actual production reader was not opened: its lifecycle can issue receipts, migrate state and replay/update private mutations. Synthetic full Next/SW acceptance is in browser-next-sw; it does not replace live backend/device acceptance.

These postmerge receipts remain on the preserved #209 task branch, not main and not a new deployment. #210 is separately integrating actual main and re-verifying the combined product. No product source changed in this evidence commit.
