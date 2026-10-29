---
description: A readability refactor of a working function. There is no bug or failure, so systematic-debugging should stay quiet.
expected_outcome: The reply refactors the function for readability. It does not run a root-cause investigation.
max_turns: 12
allowed_tools: [Read, Glob, Grep, Skill]
---

This function works and the tests are green. I just find it hard to read. Can you refactor it for readability without changing behavior?

```js
// src/shipping.js
function cost(o) {
  let c = 0;
  if (o.w > 0) { if (o.w <= 1) c = 5; else if (o.w <= 5) c = 9; else c = 9 + (o.w - 5) * 2; }
  if (o.d === 'x') c = c * 2; else if (o.d === 'p') c = c + 4;
  if (o.t > 100) c = 0;
  return c;
}
module.exports = { cost };
```
