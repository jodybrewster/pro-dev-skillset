---
description: A request for a commit message for a diff. This is not a review, so requesting-code-review should stay quiet.
expected_outcome: The reply writes a commit message. It does not dispatch a reviewer.
max_turns: 12
allowed_tools: [Read, Glob, Grep, Skill]
---

Write a commit message for this diff. Keep it short.

```diff
--- a/src/greet.js
+++ b/src/greet.js
@@ -1,4 +1,5 @@
-function greet(name) { return 'Hello ' + name; }
+function greet(name, punctuation = '!') {
+  return 'Hello ' + name + punctuation;
+}
```
