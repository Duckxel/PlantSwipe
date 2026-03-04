## 2025-03-09 - [Missing ARIA Labels on Sheet/Modal Actions]
**Learning:** Dismiss, close, and decline actions in mobile sheets and galleries often use icon-only `<Button>` components (`X`, `ArrowLeft`) but frequently omit `aria-label` or `title` props because tooltips aren't visible on mobile. This makes them inaccessible to screen readers.
**Action:** Always ensure that any icon-only button used for dismissing modals or rejecting actions explicitly includes an `aria-label` attribute, regardless of whether a visual `title` tooltip is used.
