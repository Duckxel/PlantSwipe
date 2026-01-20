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

## 2025-05-25 - Redundant Icon Margins in Buttons
**Learning:** The shared `Button` component enforces `gap-2`, making manual margins (like `mr-2`) on icons redundant and potentially causing double spacing.
**Action:** Remove manual spacing classes from icons when using the `Button` component to rely on its internal layout logic.
