---
description: A finished change pasted as a diff with a request for review before merge. The skill should fire and the reply should use its review structure.
expected_outcome: The reply reviews the diff with strengths, issues sorted into Critical, Important and Minor and an assessment. It treats the off-by-one as a must-fix.
max_turns: 12
allowed_tools: [Read, Glob, Grep, Agent, Skill]
---

I finished the paging work for the orders endpoint and want it code reviewed before I merge to main. The requirement was that each page returns exactly `size` rows.

```diff
diff --git a/src/orders.js b/src/orders.js
--- a/src/orders.js
+++ b/src/orders.js
@@ -12,3 +12,15 @@ function listOrders(db) {
   return db.query('SELECT * FROM orders ORDER BY created_at DESC');
 }
-module.exports = { listOrders };
+function pageOrders(db, page, size) {
+  const rows = db.query('SELECT * FROM orders ORDER BY created_at DESC');
+  const start = (page - 1) * size;
+  return rows.slice(start, start + size - 1);
+}
+
+app.get('/orders', (req, res) => {
+  const page = Number(req.query.page) || 1;
+  const size = Number(req.query.size) || 20;
+  res.json(pageOrders(db, page, size));
+});
+
+module.exports = { listOrders, pageOrders };
```
