## 2024-05-22 - Contact Form Submit Loading State
**Learning:** The "Send" button on the Contact Us form only changed text to "Sending..." without any visual indicator like a spinner, which felt sluggish. Adding `Loader2` improved perceived responsiveness.
**Action:** Always pair text-based loading states with a visual spinner for async actions > 500ms.

## 2024-05-22 - Loading State Accessibility
**Learning:** Replacing button text with a spinner removes the accessible name of the button, confusing screen reader users.
**Action:** Ensure buttons that switch to a loading state retain their `aria-label` or use `aria-labelledby` to point to a hidden label.
