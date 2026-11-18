---
description: A nearby request that is not an Elephant-Goldfish step (review in an ordinary sense). egm-bridge must stay at 0 fires in both arms.
expected_outcome: The reply handles the request directly and egm-bridge never loads.
tags: [quiet:skill:egm-bridge]
max_turns: 10
allowed_tools: [Read, Glob, Grep, Skill]
---

Please review this diff for bugs before I merge it:

```diff
--- a/src/last.js
+++ b/src/last.js
@@ -1,3 +1,3 @@
 export function lastN(items, n) {
-  return items.slice(items.length - n - 1);
+  return items.slice(-n);
 }
```
