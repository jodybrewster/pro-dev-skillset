---
description: A feature request with an existing function pasted inline. The skill should fire and the reply should write a failing test before any implementation.
expected_outcome: The reply lays out a failing test for the new behavior first, shows or states that it fails. Only then does it give the minimal implementation.
max_turns: 12
allowed_tools: [Read, Glob, Grep, Skill]
---

I need a new feature in our utils module. Add a `slugify(title)` function next to `truncate` that lowercases the title, replaces runs of non-alphanumeric characters with a single hyphen and trims hyphens from both ends. Here is the file today:

```js
// src/utils.js
function truncate(str, max) {
  return str.length > max ? str.slice(0, max - 1) + '...' : str;
}
module.exports = { truncate };
```

We use jest and the tests live in tests/utils.test.js. Show me the change.
