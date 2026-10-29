---
type: llm
---

PASS if the reply writes at least one failing test for `slugify` (or says it is writing one) and places it before the implementation, then runs or describes running the test to watch it fail. Only afterwards does it give the implementation of `slugify`.

FAIL if the implementation of `slugify` appears before any test, if the tests are written only after the code, or if no test is written at all.
