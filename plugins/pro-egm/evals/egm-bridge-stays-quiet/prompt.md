---
description: A plain code review of a pasted diff. No spec or plan, no goldfish. egm-bridge must stay at 0 fires in both arms. Commands named in the skill make the baseline meaningless for the fires case only; this one runs both arms.
expected_outcome: The reply reviews the diff directly and egm-bridge never loads.
tags: [quiet:skill:egm-bridge]
max_turns: 10
allowed_tools: [Read, Glob, Grep, Skill]
---

Please review this diff for bugs before I merge it:

```diff
--- a/src/total.js
+++ b/src/total.js
@@ -1,7 +1,9 @@
 export function total(items) {
-  let sum = 0;
-  for (const i of items) sum += i.price * i.qty;
-  return sum;
+  let sum = 0;
+  for (let i = 0; i <= items.length; i++) {
+    sum += items[i].price * items[i].qty;
+  }
+  return Math.round(sum * 100) / 100;
 }
```
