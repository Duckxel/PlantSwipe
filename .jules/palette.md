## 2024-05-20 - Add accessibility and localization to ImageViewer
**Learning:** Found that icon-only action buttons in full-screen modals (like ImageViewer) lacked explicit translations for their tooltips (`title`) and screen reader text (`aria-label`). While adding these, it's crucial to use the `t()` translation function with a `defaultValue` fallback to maintain internationalization support in a multi-language app structure.
**Action:** Always wrap standard UI strings (like "Close", "Download", "Zoom in", "Next") in `t('common.key', { defaultValue: '...' })` for `aria-label` and `title` attributes on all specialized icon-only action buttons.

## 2024-03-11 - Add explicit labels to interactive popovers in messaging
**Learning:** Icon-only action buttons inside interactive components like message bubble menus (e.g., reaction popovers, edit controls, reply buttons) often lack text equivalents. Relying solely on the surrounding context or visual icons creates a barrier for screen reader users trying to interact with inline content.
**Action:** Ensure all icon-only buttons in interactive inline components (like message bubbles and contextual popovers) have explicit `aria-label`s, utilizing the `t()` translation function for localization, even if visual tooltips (`title`) are already present.
