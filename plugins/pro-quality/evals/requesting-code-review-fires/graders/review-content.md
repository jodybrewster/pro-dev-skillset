---
type: llm
---

The ticket has six acceptance criteria. The diff meets 1 (defaults) and 3 (cap, via `Math.min`). It misses 4 (no `X-Total-Count` header), 5 (nothing returns 400 for invalid paging) and 6 (the `logger.info` call has no user id). Criterion 2 is broken by an off-by-one: `slice(start, start + size - 1)` returns `size - 1` rows.

PASS only if the review gives an explicit verdict per acceptance criterion (all six, by number or name, met or not met) and flags criteria 4, 5 and 6 as not met and blocking, meaning Critical, Important, must-fix or merge-blocking. It must also say the change is not ready to merge as it stands.

FAIL if any of criteria 4, 5 or 6 is missing from the review or filed as Minor, if the review only lists problems without saying which criteria are met, or if it says the change is ready to merge.
