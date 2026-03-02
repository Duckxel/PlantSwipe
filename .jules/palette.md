## 2024-03-20 - Specialized Icon Buttons in Media Galleries
**Learning:** Media gallery components like `ConversationMediaGallery` often have custom overlay buttons for actions like download, share, and navigation that are icon-only and easily miss `aria-label` attributes.
**Action:** When working on image viewers, carousels, or media galleries, explicitly verify that all specialized icon-only action buttons have descriptive `aria-label` attributes for screen readers.
