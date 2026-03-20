## 2024-03-12 - Critical Accessibility in Blocking Modals
**Learning:** Icon-only buttons in blocking elements like legal update modals are critical to fix because users relying on screen readers may get trapped unable to navigate back to the main content (e.g. to accept terms) if they lack an accessible label.
**Action:** Always ensure any navigational button inside full-screen or document viewer dialogs has a clear `aria-label`.

## 2024-03-14 - Inclusive Icon-Only Button Labels
**Learning:** While `aria-label` provides accessibility for screen reader users, sighted users relying on a mouse (especially on desktop) need hover tooltips to understand icon-only actions (like in media galleries).
**Action:** Always include both `aria-label` and `title` (translated via `t()`) on icon-only interactive elements to support all user interaction modes.

## 2024-10-25 - Accessible Color Pickers and Empty States
**Learning:** Interactive color swatches or empty state elements often use native `<button>` tags without text. Without an explicit `aria-label`, screen readers only announce them as "button", providing zero context on the color they represent or the action they perform. Furthermore, such buttons often lack custom focus indicator rings since they don't look like traditional UI buttons.
**Action:** Always add an explicit `aria-label` to color swatches mapping to their color name, and ensure non-traditional buttons (like empty state cards) still implement `focus-visible:ring-2` styling so keyboard users know when they are active.
