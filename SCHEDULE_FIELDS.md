# Daily Set – Schedule & Timer

Fields on `sets/{setId}`:

- `startAt`: ISO date-time string, e.g. `2026-09-14T01:00:00.000Z`
- `endAt`: ISO date-time string, e.g. `2026-09-14T03:00:00.000Z`
- `durationMinutes`: number, e.g. `45`

The student UI:
1. Blocks opening before `startAt`.
2. Blocks opening/submission at or after `endAt`.
3. Starts the countdown when the student starts the set.
4. Performs a final schedule check before creating/updating the submission.

Existing collections and field names are preserved.
