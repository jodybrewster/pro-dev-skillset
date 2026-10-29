---
type: llm
focus: trace
---

PASS only if all three hold in this order across the whole run, tool calls included: (1) a test for `slugify` is written before any implementation of `slugify` is written; (2) the reply runs that test or shows its expected failing output (for example `slugify is not a function` or an assertion error) as a separate step before the implementation; (3) the implementation of `slugify` appears only after that failing run.

FAIL if the implementation of `slugify` is written before the tests or in the same code block or step as the tests, if the tests are shown with no failing run or failure description before the implementation, or if no test is written. A reply that shows the implementation first and then tests "for it" is a FAIL. A reply that gives the finished function and the finished tests together in one answer, with only a note that the tests would pass, is a FAIL.
