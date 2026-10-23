# Ministry Schedule Domain Decision Record

## Status

Confirmed during the Ministry Schedule requirements review on 2026-10-23.
This record captures product and ownership decisions before implementation;
it does not authorize implementation or deployment.

## Decisions

### Reuse Operations Meeting And Occurrence

- The Ministry Schedule reuses the existing `Meeting` as the source for the
  gathering name and the existing `MeetingOccurrence` as the source for its
  date and time.
- Ministry positions, member assignments, checklist templates and individual
  checklist progress attach to the existing Meeting/Occurrence identities.
- The Ministry Schedule does not create duplicate meeting names or occurrence
  dates/times. It supports existing once/weekly Meetings and their
  MeetingOccurrences. Ministry assignments are maintained separately for each
  occurrence; a new weekly occurrence does not copy the previous occurrence's
  assignments.
- This follows the platform ownership decision that `operations-api` owns
  `Meeting`, occurrence, `Member`, and `ChurchMembership`.
- The Ministry Schedule editor permission remains separate from ordinary
  organization responsibility and from Meeting editor permission, as already
  confirmed for the feature.

### Existing Confirmed Scope

- The first release serves Taipei Home Church only. The scheduling managers
  belong to Taipei Home Church; other Church nodes do not participate.
- Only active members with a Taipei Home Church `ChurchMembership` may view its
  published schedule. Ministry Schedule editor access is scoped to Taipei Home
  Church and is assigned separately from ordinary organizational roles.
- All meeting times, unavailable ranges, week filters, and notification times
  use the `Asia/Taipei` timezone.
- Editors manage ministry positions, assignments, checklist templates, and
  session publication. Members complete their own checklist instances and may
  submit one-off unavailable time ranges for editor reference.
- Email is sent on publication and to members affected by changes to a
  published assignment. It is not periodically scheduled.
- When a published `MeetingOccurrence` is rescheduled or cancelled, notify all
  affected assigned servants; a cancelled occurrence is hidden from member
  schedules and excluded from service counts.
- Deleting a published occurrence or position means cancel/archive while
  retaining history, notification evidence, and audit identity. Cancelled
  occurrences are hidden and excluded from counts; archived positions cannot
  receive new assignments.
- A service count is one member's assignment to one position in one completed
  occurrence; the editor may select a date range and inspect the supporting
  assignments.
- Transfers, claims, and swaps remain outside the first phase.

## Platform References

- `docs/superpowers/specs/2026-09-15-hhc-unified-authorization-membership-and-entitlement-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-service-catalog-and-ownership-design.md`
- `docs/work/ministry-schedule/spec.md`
