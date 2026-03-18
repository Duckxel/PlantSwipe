## 2024-05-24 - Form Label Association for Accessibility
**Learning:** Found that custom form components like `<Input>` and `<textarea>` in `GardenJournalSection.tsx` were missing `id` attributes, and their associated `<label>`s lacked `htmlFor`. This prevents screen readers from correctly announcing the field's purpose.
**Action:** Always ensure that every form input, text area, or custom input component has a unique `id` and is explicitly linked to a descriptive `<label>` using the `htmlFor` attribute.
