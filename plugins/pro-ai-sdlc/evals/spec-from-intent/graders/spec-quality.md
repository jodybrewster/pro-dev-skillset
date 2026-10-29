---
type: llm
focus:
  source: file
  path: intent/2026-01-05-due-dates/spec.md
---

The file is a spec written from an intent that asks for four things: an optional ISO 8601 due date on a task, a TypeError on a malformed due date, a query for tasks that are overdue as of a given day (a task due that day is not overdue) and the due date shown in the task listing.

PASS only if all of these hold:
- The requirements are numbered statements (R1, R2 and so on) that a command, a grep, a test or a file check can verify, not vague goals.
- Each requirement traces to something the intent says.
- Nothing the intent asks for is dropped: the due date field, the rejection of a malformed date, the overdue query with the due-today rule and the listing change are all covered.
- It does not add requirements the intent rules out (recurring tasks, reminders, time zones).

FAIL if the file is missing or empty, if requirements are untestable prose, if any of the four asks is missing, or if it builds in something the intent put out of scope.
