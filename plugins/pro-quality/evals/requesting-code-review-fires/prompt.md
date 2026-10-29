---
description: A ticket with six acceptance criteria and a diff that meets some, silently misses others and has an off-by-one. The skill should fire and the review should check each criterion against the diff.
expected_outcome: The review walks the six acceptance criteria against the diff, flags the missing X-Total-Count header and the missing 400 validation as blocking and treats the off-by-one as a must-fix.
max_turns: 12
allowed_tools: [Read, Glob, Grep, Agent, Skill]
---

I finished ticket ORD-142 and want it reviewed before I merge to main.

```
ORD-142: Page the orders endpoint
Acceptance criteria:
1. GET /orders accepts `page` (default 1) and `size` (default 20).
2. A page returns exactly `size` rows, newest first.
3. `size` is capped at 100; a larger value is treated as 100.
4. The response carries an `X-Total-Count` header with the total number of orders.
5. A `page` or `size` that is not a positive integer returns 400 with `{ "error": "invalid paging" }`.
6. Each request writes one audit log line that includes the requesting user id.
```

```diff
diff --git a/src/orders.js b/src/orders.js
--- a/src/orders.js
+++ b/src/orders.js
@@ -12,3 +12,16 @@ function listOrders(db) {
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
+  const size = Math.min(Number(req.query.size) || 20, 100);
+  const rows = pageOrders(db, page, size);
+  logger.info('orders paged', { page, size, count: rows.length });
+  res.json(rows);
+});
+
+module.exports = { listOrders, pageOrders };
```
