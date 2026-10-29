---
description: A request to explain pasted code. Nothing is being built, so test-driven-development should stay quiet.
expected_outcome: The reply explains what the function does. It does not start a red-green-refactor cycle.
max_turns: 12
allowed_tools: [Read, Glob, Grep, Skill]
---

Can you explain what this function does? I inherited it and want to understand it before I touch anything.

```js
// src/retry.js
async function withRetry(fn, attempts = 3, delayMs = 200) {
  let lastError;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn(i);
    } catch (err) {
      lastError = err;
      await new Promise((r) => setTimeout(r, delayMs * 2 ** i));
    }
  }
  throw lastError;
}
module.exports = { withRetry };
```
