---
description: A request to write tests for a working function. This belongs to test writing, so systematic-debugging should stay quiet.
expected_outcome: The reply writes tests for the function. It does not run a root-cause investigation.
max_turns: 12
allowed_tools: [Read, Glob, Grep, Skill]
---

Please write unit tests for this function. It works fine today and I just want coverage on it.

```js
// src/clamp.js
function clamp(value, min, max) {
  if (min > max) throw new RangeError('min must not exceed max');
  return Math.min(Math.max(value, min), max);
}
module.exports = { clamp };
```

We use jest.
