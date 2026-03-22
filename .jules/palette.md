## 2024-03-12 - Critical Accessibility in Blocking Modals
**Learning:** Icon-only buttons in blocking elements like legal update modals are critical to fix because users relying on screen readers may get trapped unable to navigate back to the main content (e.g. to accept terms) if they lack an accessible label.
**Action:** Always ensure any navigational button inside full-screen or document viewer dialogs has a clear `aria-label`.

## 2024-03-14 - Inclusive Icon-Only Button Labels
**Learning:** While `aria-label` provides accessibility for screen reader users, sighted users relying on a mouse (especially on desktop) need hover tooltips to understand icon-only actions (like in media galleries).
**Action:** Always include both `aria-label` and `title` (translated via `t()`) on icon-only interactive elements to support all user interaction modes.

## 2024-03-22 - Tappable Expanding Icon Buttons
**Learning:** For mobile layouts, icon-only buttons that toggle text visibility on tap (like the recipe time badge) lack context for both screen reader users (if missing `aria-label`) and keyboard users (if missing `focus-visible` styling).
**Action:** Always add `aria-expanded={isOpen}`, an appropriate `aria-label` (using the text that would be revealed), and `focus-visible:ring-2` to these types of expanding toggle buttons.
