---
type: llm
focus:
  source: file
  path: intent/2026-01-05-due-dates/plan.md
---

The file is a plan written from a spec with requirements R1 to R5 (due date stored, malformed date rejected, overdue query, listing shows the date, overdue input validated) and acceptance criteria AC1 and AC2.

PASS only if both hold:
- Every step in the order of work cites the R statements it satisfies (for example "R1", "R2").
- The plan names the tests that prove the work, by file or test name, tied to the requirements.

FAIL if the file is missing or empty, if any step cites no requirement, or if the plan names no tests.
