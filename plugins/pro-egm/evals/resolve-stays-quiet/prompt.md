---
description: A nearby request that is not an Elephant-Goldfish step (resolve in an ordinary sense). egm-bridge must stay at 0 fires in both arms.
expected_outcome: The reply handles the request directly and egm-bridge never loads.
tags: [quiet:skill:egm-bridge]
max_turns: 10
allowed_tools: [Read, Glob, Grep, Skill]
---

Resolve this git merge conflict in src/greet.js for me.

```
<<<<<<< HEAD
export const greet = (n) => `Hello, ${n}!`;
=======
export const greet = (n) => `Hi ${n}`;
>>>>>>> feature/casual-greeting
```
