## 2024-05-22 - Contact Form Submit Loading State
**Learning:** The "Send" button on the Contact Us form only changed text to "Sending..." without any visual indicator like a spinner, which felt sluggish. Adding `Loader2` improved perceived responsiveness.
**Action:** Always pair text-based loading states with a visual spinner for async actions > 500ms.

## 2024-05-23 - Swipe Keyboard Navigation
**Learning:** The keyboard navigation for the swipe interface was inverted (Left Arrow triggered "Next", Right Arrow triggered "Back"). This clashed with standard desktop patterns and the visual layout of the buttons.
**Action:** Ensure keyboard shortcuts map to the visual direction of the UI controls (Left Key = Left Button/Back, Right Key = Right Button/Next).
