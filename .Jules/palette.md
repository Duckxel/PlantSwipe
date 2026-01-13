## 2024-05-22 - Contact Form Submit Loading State
**Learning:** The "Send" button on the Contact Us form only changed text to "Sending..." without any visual indicator like a spinner, which felt sluggish. Adding `Loader2` improved perceived responsiveness.
**Action:** Always pair text-based loading states with a visual spinner for async actions > 500ms.
