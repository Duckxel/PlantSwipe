## 2024-03-20 - Specialized Icon Buttons in Media Galleries
**Learning:** Media gallery components like `ConversationMediaGallery` often have custom overlay buttons for actions like download, share, and navigation that are icon-only and easily miss `aria-label` attributes.
**Action:** When working on image viewers, carousels, or media galleries, explicitly verify that all specialized icon-only action buttons have descriptive `aria-label` attributes for screen readers.

## 2024-06-13 - Missing ARIA Labels on Navigation/Close Buttons in Mobile Galleries
**Learning:** Even standard header buttons (like Back or Close) in full-screen modal components can occasionally lack basic `aria-label`s, breaking screen reader navigation.
**Action:** Always verify `aria-label` attributes on Back (`ArrowLeft`) and Close (`X`) buttons in new or modified full-screen components, especially those built for mobile views.