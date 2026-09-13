# English Notebook v18.7 — QA Fixed

## Progress / Streak architecture
- `submissions` is the canonical source for Daily Set completion.
- Student streak is derived from passed submission dates, so reload cannot reset it to 0.
- `users` keeps denormalized progress fields for fast profile reads.
- Teacher/Admin progress uses realtime listeners on both `users` and `submissions`, then derives streak/bonus/set-pass from submissions.
- Firestore rules allow students to update only safe profile/progress fields while preserving role/email integrity.

## Deploy
Deploy the web files and Firestore rules together. The app uses the Firebase project configured in `firebase-config.js`.


## Security note
- `security.js` only obfuscates answer indexes and produces a client-side signature. It is **not** a secret or a server-side anti-cheat mechanism.
- Firestore rules are shipped in this repository. Student accounts cannot self-promote to `admin`/`teacher`; admin membership is controlled by `config/admins`.
- True answer secrecy / authoritative scoring requires a trusted backend such as Cloud Functions.
