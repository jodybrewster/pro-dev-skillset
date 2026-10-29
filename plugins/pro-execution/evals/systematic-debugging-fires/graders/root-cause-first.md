---
type: llm
---

PASS if the reply reads the stack trace and the code, names a specific root cause (for example that `invoice.discount` can now be undefined because the importer made it optional so `invoice.discount.amount` throws) and shows that reasoning before it proposes any code change. A reply that states a hypothesis and says how to confirm it also passes.

FAIL if the reply jumps straight to a patch (such as adding an optional chain) without explaining the cause, or if it lists several unrelated guesses and fixes with no investigation.
