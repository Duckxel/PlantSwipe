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

## 2025-02-28 - Keyboard Accessibility for Hover-Revealed Actions
**Learning:** Icon-only buttons within a container that reveals on hover (like `opacity-0 hover:opacity-100`) are invisible when focused by keyboard users. They receive focus but are visually hidden.
**Action:** Always ensure to add `group-focus-within:opacity-100` to the container/button and `focus-visible:ring-2` to the button itself so it becomes visible and accessible for keyboard navigation.

## 2026-03-26 - Accessible Color Picker Swatches
**Learning:** Color picker swatches often rely entirely on a background color for their visual appearance, lacking any text. For screen reader users, without an `aria-label` (even if `title` is provided for visual tooltips), these interactive buttons are 'empty' and inaccessible.
**Action:** Always provide an explicit `aria-label` alongside the `title` tooltip on interactive color swatches to ensure they are fully navigable and understandable via assistive technologies.

## 2026-03-25 - Add aria-label to task completion buttons
**Learning:** The "Complete" (checkmark) and "Complete All" buttons in `TasksSidebar.tsx` were icon-only without accessible labels. Screen reader users could not determine the purpose of these buttons, especially in a list of tasks where multiple identical-looking buttons appear.
**Action:** Add `aria-label` attributes (using `t()` translations) to individual task complete buttons and bulk "Complete All" buttons in task management UIs.

## 2026-03-30 - Add title attributes to chat panel icon buttons
**Learning:** The Close, Minimize/Maximize, Stop, and Send buttons in `AphyliaChatPanel.tsx` had `aria-label` but lacked `title` attributes. Sighted mouse users on desktop had no tooltip to explain icon-only buttons.
**Action:** Add explicit `title` attributes (mapped to existing `t()` translations) alongside `aria-label` on all icon-only buttons in chat/panel UIs to provide tooltip feedback for sighted users.

## 2024-05-19 - [Adding Keyboard Focus to Icon-Only Action Buttons in MessageBubble]
**Learning:** Icon-only action buttons (e.g., reaction popovers, edit controls, reply/more options buttons) in `MessageBubble.tsx` correctly included `aria-label` and `title` attributes for screen readers and tooltips. However, they lacked explicit focus indicators, which hindered keyboard accessibility for users navigating the chat interface. Adding `focus-visible` utility classes (e.g., `focus-visible:ring-2 focus-visible:ring-blue-500`) resolves this and aligns with existing accessibility requirements.
**Action:** Always ensure that interactive icon-only elements feature visible focus states for keyboard users in addition to `aria-label` and `title` attributes. Use Tailwind's `focus-visible` pseudo-class (like `focus-visible:ring-2 focus-visible:outline-none`) to provide clear visual feedback without affecting pointer interactions.

## 2026-04-05 - Keyboard Accessibility for Badge Icons
**Learning:** Interactive badge elements wrapped in `motion.div` lack keyboard accessibility because they don't receive focus and lack semantic roles, even when wrapped in a container with mouse events. This prevents keyboard users from viewing the tooltip and screen readers from reading the content.
**Action:** Refactor these elements to use native buttons (e.g., `motion.button`), add `onFocus`/`onBlur` event handlers to trigger the tooltip state, assign descriptive `aria-label` attributes, link to the tooltip with `aria-describedby`, and ensure visible focus states using `focus-visible:ring-2`.

## 2024-04-06 - Accessible Camera Overlay
**Learning:** Icon-only buttons rendered over dark backgrounds (like the Camera Capture view) need both screen reader labels and specific `focus-visible` offset styling (`focus-visible:ring-offset-2 focus-visible:ring-offset-black`) so the focus ring remains visible against the black canvas.
**Action:** Always include offset colors when adding focus rings to elements floating over dark modal backgrounds or camera views.

## 2024-04-08 - Accessible interactive elements on profile screens
**Learning:** Empty states buttons and expanding toggles (like "Show Less" or "Create Collection") must always include `aria-label` attributes to ensure screen reader compatibility, and explicit `focus-visible` utility classes (e.g., `focus-visible:ring-2`) to guarantee keyboard navigation support.
**Action:** Always verify that every interactive button, especially toggles or ones nested within empty state containers, has explicit focus styling and an aria-label if its visual text isn't fully self-explanatory or is missing.
## 2024-05-20 - Adding Keyboard Focus and Button Types to Action Buttons
**Learning:** Adding semantic `type="button"` and `focus-visible` utility classes to interactive components ensures they behave consistently, especially within complex UIs, preventing form submission issues and enabling proper keyboard navigation.
**Action:** Consistently set `type="button"` and `focus-visible` utility classes (e.g. `focus-visible:ring-2`) on custom buttons inside UIs.
## 2026-04-17 - Accessible Error Dismissal Buttons
**Learning:** Icon-only error dismissal buttons (`<X>`) across admin panels lacked `aria-label`/`title` for screen readers and tooltips, and didn't have keyboard focus indicators (`focus-visible:ring-2`). Even text-based "dismiss" buttons missed the focus indicators.
**Action:** Always add explicit `aria-label` and `title` to icon-only buttons. Add `focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:outline-none rounded-sm` to ensure keyboard users can navigate to and activate these error alert dismissals.
## 2024-04-23 - Icon-only search reset buttons
**Learning:** Icon-only 'clear search' or input reset buttons (e.g., `<X>` icons inside search bars) are a recurring pattern that frequently lack context for screen readers and lack visual focus indicators for keyboard users.
**Action:** Always add `aria-label` and `title` attributes (translated via `t()`), along with `focus-visible` utility classes (e.g., `focus-visible:ring-2`) to ensure proper accessibility for screen readers and keyboard navigation.
