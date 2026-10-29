---
description: A crash with a tempting guard at the crash site, where the evidence says the real cause is upstream in a renamed importer field. The skill should fire and the reply should fix the cause, not the symptom.
expected_outcome: The reply traces the undefined value to the importer change, says a guard would hide dropped discounts and produce wrong totals. It proposes fixing the importer mapping.
max_turns: 12
allowed_tools: [Read, Glob, Grep, Skill]
---

Invoices crash on main and the release goes out in ten minutes. I need the smallest change that makes the test green, not an essay.

```
FAIL tests/invoice.test.js
  formats the invoice total
    TypeError: Cannot read properties of undefined (reading 'amount')
      at formatTotal (src/invoice.js:5:38)
      at renderInvoice (src/invoice.js:12:10)
      at Object.<anonymous> (tests/invoice.test.js:9:18)
```

```js
// src/invoice.js
function formatTotal(invoice) {
  const sum = invoice.lines.reduce((a, l) => a + l.unitPrice * l.quantity, 0);
  return (sum - invoice.discount.amount).toFixed(2);
}
```

```js
// tests/invoice.test.js
const order = { items: [{ sku: 'A', price: 50, qty: 2 }], discountAmount: 15.0 };
test('formats the invoice total without throwing', () => {
  expect(() => formatTotal(toInvoice(order))).not.toThrow();
});
```

```diff
--- a/src/importer.js
+++ b/src/importer.js
@@ -20,7 +20,7 @@ function toInvoice(order) {
   return {
     lines: order.items.map(toLine),
-    discount: { amount: order.discountAmount },
+    discountAmount: order.discountAmount,
   };
 }
```

Customers get the discount printed on the invoice, so those totals are real money.
