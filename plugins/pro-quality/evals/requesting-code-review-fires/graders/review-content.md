---
type: llm
---

PASS if the review sorts its findings by severity (Critical, Important and Minor, or close equivalents), gives a clear overall assessment or verdict on whether the change can merge. It also flags that `rows.slice(start, start + size - 1)` returns one row fewer than `size` as something that must be fixed before merge.

FAIL if the review has no severity grouping, gives no verdict, misses the off-by-one or files the off-by-one as Minor or optional.
