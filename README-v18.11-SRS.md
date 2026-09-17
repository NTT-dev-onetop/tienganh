# English Notebook v18.11 — SRS + Speech

## Included
- Vocabulary SRS (SM-2 simplified) stored at `users/{uid}/english_notes/{docId}.srs`.
- New vocabulary starts with easiness 2.5, interval 0, due today, reps 0, lapses 0.
- Review page shows personal vocabulary whose `dueDate <= today`.
- Four review feedback buttons: Quên (0), Khó (3), Được (4), Dễ (5).
- SRS result is written back to the existing vocabulary note; no new collection is used.
- Browser speech via Web Speech API on personal vocabulary, textbook vocabulary, and review cards.
- Existing grammar, mistake, and textbook review flows remain available when explicitly opened.

## Firestore
No new collection and no rules change. The only data addition is the requested nested `srs` object on vocabulary notes.

## Compatibility
Older vocabulary notes without `srs` are treated as due today and receive SRS data after the first review.

## Browser TTS note
Pronunciation uses the browser/device `speechSynthesis` voice (`en-US`, rate 0.9). Voice quality depends on the device/browser and is not a paid Google TTS service.
