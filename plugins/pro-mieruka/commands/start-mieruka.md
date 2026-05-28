---
description: Start the mieruka dev server in the current project — opens the UI at http://127.0.0.1:7777.
argument-hint: "[-p PORT]"
allowed-tools:
  - "Bash(npx mieruka dev*)"
  - "Bash(ls .mieruka*)"
---

Start the mieruka visual design companion for this project.

1. **Check for install.** Run `ls .mieruka` — if `.mieruka/` does not exist, tell the user to run `/init-mieruka` first. Stop here.

2. **Start the server.** Run `npx mieruka dev` in the background, passing `-p PORT` if provided in `$ARGUMENTS`.

3. **Tell the user:**
   - Mieruka is running at http://127.0.0.1:7777 (or the custom port)
   - The MCP server is available at `/mcp` on the same host
   - Stop it with `lsof -ti:7777 | xargs kill`
