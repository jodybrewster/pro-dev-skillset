---
description: A request for advice on structuring tests. No completion claim is involved, so verification-before-completion should stay quiet.
expected_outcome: The reply gives advice on test structure. No verification gate applies.
max_turns: 12
allowed_tools: [Read, Glob, Grep, Skill]
---

How should I structure the tests for this module? I have not written any yet and want a sensible layout before I start. We use jest.

```js
// src/cart.js
function addItem(cart, item) { /* returns a new cart with the item added */ }
function removeItem(cart, sku) { /* returns a new cart without the sku */ }
function total(cart, taxRate) { /* sums price * qty and applies tax */ }
module.exports = { addItem, removeItem, total };
```
