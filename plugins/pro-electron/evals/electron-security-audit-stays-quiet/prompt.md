---
description: A generic web XSS review of a pasted snippet with no desktop shell. electron-security-audit must stay at 0 fires in both arms.
expected_outcome: The reply reviews the snippet for XSS directly and electron-security-audit never loads.
tags: [quiet:skill:electron-security-audit]
max_turns: 10
allowed_tools: [Read, Glob, Grep, Skill]
---

Is this Express route open to XSS? How would I fix it?

```js
app.get('/search', (req, res) => {
  res.send(`<h1>Results for ${req.query.q}</h1>`);
});
```
