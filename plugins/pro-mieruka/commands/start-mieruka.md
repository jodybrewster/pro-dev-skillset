---
description: Start the mieruka dev server in the current project — opens the UI at http://127.0.0.1:7777.
argument-hint: "[-p PORT]"
allowed-tools:
  - "Bash(node *)"
  - "Bash(ls .mieruka*)"
---

Start the mieruka visual design companion for this project.

1. **Check for install.** Run `ls .mieruka` — if `.mieruka/` does not exist, tell the user to run `/init-mieruka` first. Stop here.

2. **Resolve the mieruka binary.** Try `node ~/Projects/mieruka/mieruka/bin/mieruka.mjs --version` — if it prints a version, use `node ~/Projects/mieruka/mieruka/bin/mieruka.mjs` as the runner. Otherwise tell the user the local mieruka build is missing.

3. **Parse port.** If `$ARGUMENTS` includes `-p PORT`, pass `-p PORT` to the dev command.

4. **Start the server.** Run `$MIERUKA_BIN dev [-p PORT]` in the background. Tell the user:
   - Mieruka is running at http://127.0.0.1:7777 (or the custom port)
   - The MCP server is available at the same host at `/mcp`
   - Stop it with Ctrl-C in the terminal where it's running
