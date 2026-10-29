---
type: llm
focus:
  source: file
  path: intent/2026-01-05-due-dates/plan.md
---

The file is a plan written from a spec with requirements R1 to R5 (due date stored, malformed date rejected, overdue query, listing shows the date, overdue input validated) and acceptance criteria AC1 and AC2.

PASS only if all of these hold:
- Every requirement R1 to R5 is cited somewhere in the plan, in the files that change, the order of work or the tests, so none is dropped.
- The plan names the tests that prove the work, by file or test name, and ties each test to the requirement or acceptance criterion it proves.
- The order of work is a sequence of concrete steps a builder could follow.

FAIL if the file is missing or empty, if any of R1 to R5 is never cited, if the plan names no tests or if its tests are not tied to requirements.
