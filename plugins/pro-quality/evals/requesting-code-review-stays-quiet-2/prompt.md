---
description: A request to describe a diff for release notes. This is not a review, so requesting-code-review should stay quiet.
expected_outcome: The reply summarises the change in plain words. It does not dispatch a reviewer.
max_turns: 12
allowed_tools: [Read, Glob, Grep, Skill]
---

Explain what this diff does in plain words so I can put it in the release notes.

```diff
--- a/src/export.js
+++ b/src/export.js
@@ -3,6 +3,10 @@ function exportCsv(rows) {
-  return rows.map((r) => r.join(',')).join('\n');
+  const header = 'id,name,email';
+  const body = rows.map((r) => r.map(quote).join(',')).join('\n');
+  return header + '\n' + body;
 }
+function quote(v) { return '"' + String(v).replace(/"/g, '""') + '"'; }
```
