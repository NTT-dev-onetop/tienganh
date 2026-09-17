# English Notebook v18.9 — UI/UX Upgrade

## Implemented
- Fixed hero copy: `↯ Ôn phần yếu` and `Học xong ghi lại. / Quên đâu, vá đó.`
- Hero primary/secondary hierarchy and live note/mistake meta.
- Empty states for personal vocab/grammar/mistakes now include direct CTAs.
- Vocabulary initial loading skeleton.
- Vocabulary save now uses optimistic UI with `✓ Đã lưu` feedback and rollback on failure.
- Note deletion now uses a 5-second Undo window before Firestore deletion.
- Toast supports an accessible Undo action button.
- Profile modal autofocuses the name field and restores focus to the trigger.
- Reading selection toolbar auto-positions above the selection when it would collide with the viewport bottom.
- Daily Set question transition and mobile wrong-answer haptic feedback.
- Admin student progress table supports clickable sorting and streak filters.
- Mobile bottom navigation reduced to a single lightweight glass layer; decorative pseudo-elements/noise/refraction effects are disabled.

## Intentionally unchanged
- Firebase collections and document schema.
- Firestore rules/security architecture from v18.8.
- Primary color and font.
- Desktop sidebar/layout.
- Daily scoring architecture/server-authoritative scoring.
