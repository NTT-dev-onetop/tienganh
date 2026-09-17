# English Notebook v18.8 — Security Hardening Patch

Applied without changing the existing Firestore collection names.

## Included
- Prevent teacher accounts from editing `config/admins` or `config/teachers`.
- Prevent a new account from self-selecting an arbitrary privileged role; role bootstrap is tied to the configured email lists.
- Prevent students from changing their own role/email or progress/security fields.
- Prevent roster mapping takeover through `users_by_roster` updates.
- Fixed admin realtime/export submission queries so legacy `passed` values are handled consistently.
- Invalidate role caches immediately after admin/teacher list changes.
- Fixed Family Bank reveal fallback for reduced-motion/observer edge cases.
- Removed mobile hero `nowrap` overflow risk.

## Important limitation
This patch does NOT claim to make scoring server-authoritative. The current app still calculates Daily Set score in the browser. A student who can inspect the client can still manipulate the submitted score within the Firestore field validation.

For a true production-grade grading boundary, the next phase must move Daily Set scoring/bonus/streak writes to a trusted backend callable function (and ideally keep answer keys out of student-readable documents). That is intentionally not silently introduced here because it changes deployment architecture and needs a controlled migration/test pass.
