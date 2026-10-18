# Reader notes visual evidence

Synthetic account, document and note data only. Baseline: `6fd3fd0d9bc44a61aff9b252df613b27ca61fbfb`; candidate: this branch. Actual reader components/styles were rendered in the existing isolated Vite fixture. Images are JPEG captures, correctly named here. Font readiness and visible paper were checked before capture.

Viewports: phone 390×844, tablet 768×1024, desktop 1440×900; light/dark. Short viewport: 390×480. These are browser viewport checks, not physical iOS, IME, keyboard or installed-PWA acceptance.

Both T5 Codex reviewers viewed the images. The final phone load-error images include the reviewed toolbar-overlap fix. Normal reading geometry remains unchanged within subpixel rounding (≤0.032px); a baseline phone/light/editor paper-height anomaly was visually assessed, not treated as a product regression. Draft/dialog, sending, unknown-result, conflict and load-error states were inspected. API errors and timing were synthetic; no production private-state mutation was performed.

## Normal, list and editor comparisons

| View | Baseline | Candidate |
| --- | --- | --- |
| phone-light-normal | [image](baseline-phone-light-normal.jpg) | [image](candidate-phone-light-normal.jpg) |
| phone-light-list | [image](baseline-phone-light-list.jpg) | [image](candidate-phone-light-list.jpg) |
| phone-light-editor | [image](baseline-phone-light-editor.jpg) | [image](candidate-phone-light-editor.jpg) |
| phone-dark-normal | [image](baseline-phone-dark-normal.jpg) | [image](candidate-phone-dark-normal.jpg) |
| phone-dark-list | [image](baseline-phone-dark-list.jpg) | [image](candidate-phone-dark-list.jpg) |
| phone-dark-editor | [image](baseline-phone-dark-editor.jpg) | [image](candidate-phone-dark-editor.jpg) |
| tablet-light-normal | [image](baseline-tablet-light-normal.jpg) | [image](candidate-tablet-light-normal.jpg) |
| tablet-light-list | [image](baseline-tablet-light-list.jpg) | [image](candidate-tablet-light-list.jpg) |
| tablet-light-editor | [image](baseline-tablet-light-editor.jpg) | [image](candidate-tablet-light-editor.jpg) |
| tablet-dark-normal | [image](baseline-tablet-dark-normal.jpg) | [image](candidate-tablet-dark-normal.jpg) |
| tablet-dark-list | [image](baseline-tablet-dark-list.jpg) | [image](candidate-tablet-dark-list.jpg) |
| tablet-dark-editor | [image](baseline-tablet-dark-editor.jpg) | [image](candidate-tablet-dark-editor.jpg) |
| desktop-light-normal | [image](baseline-desktop-light-normal.jpg) | [image](candidate-desktop-light-normal.jpg) |
| desktop-light-list | [image](baseline-desktop-light-list.jpg) | [image](candidate-desktop-light-list.jpg) |
| desktop-light-editor | [image](baseline-desktop-light-editor.jpg) | [image](candidate-desktop-light-editor.jpg) |
| desktop-dark-normal | [image](baseline-desktop-dark-normal.jpg) | [image](candidate-desktop-dark-normal.jpg) |
| desktop-dark-list | [image](baseline-desktop-dark-list.jpg) | [image](candidate-desktop-dark-list.jpg) |
| desktop-dark-editor | [image](baseline-desktop-dark-editor.jpg) | [image](candidate-desktop-dark-editor.jpg) |

## Additional candidate states

- [desktop-dark-conflict](candidate-desktop-dark-conflict.jpg)
- [desktop-dark-delete](candidate-desktop-dark-delete.jpg)
- [desktop-dark-discard](candidate-desktop-dark-discard.jpg)
- [desktop-dark-error](candidate-desktop-dark-error.jpg)
- [desktop-dark-loaderror](candidate-desktop-dark-loaderror.jpg)
- [desktop-dark-wait](candidate-desktop-dark-wait.jpg)
- [desktop-light-conflict](candidate-desktop-light-conflict.jpg)
- [desktop-light-delete](candidate-desktop-light-delete.jpg)
- [desktop-light-discard](candidate-desktop-light-discard.jpg)
- [desktop-light-error](candidate-desktop-light-error.jpg)
- [desktop-light-loaderror](candidate-desktop-light-loaderror.jpg)
- [desktop-light-wait](candidate-desktop-light-wait.jpg)
- [phone-dark-conflict](candidate-phone-dark-conflict.jpg)
- [phone-dark-delete](candidate-phone-dark-delete.jpg)
- [phone-dark-discard](candidate-phone-dark-discard.jpg)
- [phone-dark-error](candidate-phone-dark-error.jpg)
- [phone-dark-loaderror](candidate-phone-dark-loaderror.jpg)
- [phone-dark-wait](candidate-phone-dark-wait.jpg)
- [phone-light-conflict](candidate-phone-light-conflict.jpg)
- [phone-light-delete](candidate-phone-light-delete.jpg)
- [phone-light-discard](candidate-phone-light-discard.jpg)
- [phone-light-error](candidate-phone-light-error.jpg)
- [phone-light-loaderror](candidate-phone-light-loaderror.jpg)
- [phone-light-short-discard](candidate-phone-light-short-discard.jpg)
- [phone-light-short-editor](candidate-phone-light-short-editor.jpg)
- [phone-light-wait](candidate-phone-light-wait.jpg)

[Baseline metrics](baseline-metrics.json) · [Candidate metrics](candidate-metrics.json) · [Comparison](visual-metric-diff.json)
