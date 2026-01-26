## 2024-05-22 - Contact Form Submit Loading State
**Learning:** The "Send" button on the Contact Us form only changed text to "Sending..." without any visual indicator like a spinner, which felt sluggish. Adding `Loader2` improved perceived responsiveness.
**Action:** Always pair text-based loading states with a visual spinner for async actions > 500ms.

## 2024-05-23 - Swipe Keyboard Navigation
**Learning:** The keyboard navigation for the swipe interface was inverted (Left Arrow triggered "Next", Right Arrow triggered "Back"). This clashed with standard desktop patterns and the visual layout of the buttons.
**Action:** Ensure keyboard shortcuts map to the visual direction of the UI controls (Left Key = Left Button/Back, Right Key = Right Button/Next).

## 2025-05-23 - Built-in Button Loading State
**Learning:** Manually adding spinners to buttons leads to inconsistent spacing and layout shifts, especially with icon-only buttons.
**Action:** Extend the base `Button` component to accept a `loading` prop that handles spinner placement, disables interaction, and intelligently replaces content for icon buttons.

## 2025-05-24 - Mobile-Specific Accessibility Gaps
**Learning:** The mobile layout in `SwipePage` used raw `<button>` elements instead of the accessible `Button` component used in desktop, resulting in missing ARIA labels on icon-only buttons.
**Action:** When implementing separate mobile/desktop layouts, verify that accessibility attributes (aria-label, title) are synchronized or that shared components are used.

## 2025-05-24 - Complex UI Sections & Hidden Buttons
**Learning:** Complex, custom UI sections (like the Journal timelapse viewer) often use raw `<button>` elements or `Button` components in `size="icon"` mode without `aria-label`, as they are visually obvious but invisible to screen readers.
**Action:** Systematically audit complex interactive sections (modals, viewers, editors) for icon-only buttons and ensure every interactive element has an accessible name.

## 2025-05-24 - Invisible Focusable Elements
**Learning:** The "Remove Photo" button in the journal upload section was only visible on hover (`opacity-0`), making it invisible to keyboard users even when focused.
**Action:** Always ensure interactive elements that are hidden by default become fully visible on focus (`focus:opacity-100`) to support keyboard navigation.
