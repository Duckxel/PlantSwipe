## 2024-05-22 - Contact Form Submit Loading State
**Learning:** The "Send" button on the Contact Us form only changed text to "Sending..." without any visual indicator like a spinner, which felt sluggish. Adding `Loader2` improved perceived responsiveness.
**Action:** Always pair text-based loading states with a visual spinner for async actions > 500ms.

## 2025-05-23 - Built-in Button Loading State
**Learning:** Manually adding spinners to buttons leads to inconsistent spacing and layout shifts, especially with icon-only buttons.
**Action:** Extend the base `Button` component to accept a `loading` prop that handles spinner placement, disables interaction, and intelligently replaces content for icon buttons.
