---
description: Stop the mieruka dev server.
argument-hint: "[-p PORT]"
allowed-tools:
  - "Bash(lsof -ti:*)"
  - "Bash(kill *)"
---

Stop the mieruka dev server.

1. **Determine port.** Default is 7777. If `$ARGUMENTS` includes `-p PORT`, use that port instead.

2. **Kill the process.** Run `lsof -ti:<port> | xargs kill` — if nothing is running on that port, tell the user mieruka wasn't running.
