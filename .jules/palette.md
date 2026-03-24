## 2024-03-12 - Critical Accessibility in Blocking Modals
**Learning:** Icon-only buttons in blocking elements like legal update modals are critical to fix because users relying on screen readers may get trapped unable to navigate back to the main content (e.g. to accept terms) if they lack an accessible label.
**Action:** Always ensure any navigational button inside full-screen or document viewer dialogs has a clear `aria-label`.

## 2024-03-14 - Inclusive Icon-Only Button Labels
**Learning:** While `aria-label` provides accessibility for screen reader users, sighted users relying on a mouse (especially on desktop) need hover tooltips to understand icon-only actions (like in media galleries).
**Action:** Always include both `aria-label` and `title` (translated via `t()`) on icon-only interactive elements to support all user interaction modes.

## 2024-03-22 - Tappable Expanding Icon Buttons
**Learning:** For mobile layouts, icon-only buttons that toggle text visibility on tap (like the recipe time badge) lack context for both screen reader users (if missing `aria-label`) and keyboard users (if missing `focus-visible` styling).
**Action:** Always add `aria-expanded={isOpen}`, an appropriate `aria-label` (using the text that would be revealed), and `focus-visible:ring-2` to these types of expanding toggle buttons.

## 2024-03-22 - Add ARIA labels to AphyliaChatPanel remove buttons
**Learning:** Icon-only remove buttons within nested UI components (like Context Chips and Image Attachments in `AphyliaChatPanel.tsx`) are often overlooked for accessibility. The `aria-label` attribute combined with a tooltip (`title`) is essential to prevent screen reader users from getting trapped or not understanding the button's purpose.
**Action:** When creating new interactive elements like badges, chips, or preview cards, systematically verify that their remove/dismiss buttons have valid ARIA labels and tooltip text, using the `t()` translation function.

## 2024-03-24 - Add Title to Icon-only Buttons for Sighted Mouse Users
**Learning:** In deeply nested or complex interactive components like `AphyliaChatPanel.tsx`, developers often add `aria-label` for screen readers on icon-only buttons (like Minimize, Maximize, Close, Stop, Send) but forget the native `title` attribute. Sighted mouse users rely on the native hover tooltip (`title`) to understand what an obscure icon does.
**Action:** When auditing or building icon-only buttons, always ensure that both `aria-label` and `title` attributes are present and bound to the same translated string (`t()`), so that both screen reader and sighted mouse users receive proper context.
