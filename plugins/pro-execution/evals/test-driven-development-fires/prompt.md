---
description: A feature request with the current file pasted inline and no mention of tests. The skill should fire and the reply should put a failing test, run and shown failing, ahead of any implementation.
expected_outcome: The reply writes the slugify tests first, runs them or shows the expected failure (slugify is not defined or not a function). Only then does it give the implementation.
max_turns: 12
allowed_tools: [Read, Glob, Grep, Write, Edit, Bash, Skill]
---

Our utils module needs a `slugify(title)` function next to `truncate`. It should lowercase the title, replace runs of non-alphanumeric characters with a single hyphen and trim hyphens from both ends. Here is the file today:

```js
// src/utils.js
function truncate(str, max) {
  return str.length > max ? str.slice(0, max - 1) + '...' : str;
}
module.exports = { truncate };
```

Show me the change.
