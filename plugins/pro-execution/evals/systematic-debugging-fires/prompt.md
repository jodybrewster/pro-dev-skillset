---
description: A failing test with a stack trace pasted inline. The skill should fire and the reply should find the root cause before proposing a fix.
expected_outcome: The reply reads the error, traces where the bad value comes from, states a root cause and only then proposes a fix.
max_turns: 12
allowed_tools: [Read, Glob, Grep, Skill]
---

This test started failing on main and I do not know why. Can you sort it out?

```
FAIL tests/invoice.test.js
  formats the invoice total
    TypeError: Cannot read properties of undefined (reading 'toFixed')
      at formatTotal (src/invoice.js:14:22)
      at renderInvoice (src/invoice.js:31:10)
      at Object.<anonymous> (tests/invoice.test.js:9:18)
```

```js
// src/invoice.js
function lineTotal(line) { return line.unitPrice * line.quantity; }
function formatTotal(invoice) {
  const sum = invoice.lines.map(lineTotal).reduce((a, b) => a + b, 0);
  return (sum - invoice.discount.amount).toFixed(2);
}
```

The only thing I changed this week was making `discount` optional in the order importer.
