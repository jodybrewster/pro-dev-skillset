---
description: A diagnosis question about a diff that already broke something. This belongs to debugging, so test-driven-development should stay quiet.
expected_outcome: The reply reads the diff and names what likely broke. It does not start a red-green-refactor cycle.
max_turns: 12
allowed_tools: [Read, Glob, Grep, Skill]
---

Our checkout total went wrong after this change landed yesterday. What broke in this diff?

```diff
--- a/src/cart.js
+++ b/src/cart.js
@@ -8,7 +8,7 @@ function total(items, taxRate) {
-  const subtotal = items.reduce((sum, i) => sum + i.price * i.qty, 0);
-  return subtotal * (1 + taxRate);
+  const subtotal = items.reduce((sum, i) => sum + i.price, 0);
+  return Math.round(subtotal * (1 + taxRate));
 }
```
