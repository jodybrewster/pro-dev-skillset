---
description: Install mieruka into the current project — runs mieruka init, scaffolds .mieruka/, and registers the MCP server with Claude Code.
argument-hint: "[--serper-key KEY] [--mcp-path PATH] [--no-playwright-install] [--no-mcp-register]"
allowed-tools:
  - "Bash(npx mieruka*)"
  - "Bash(node *)"
  - "Bash(ls *)"
  - "Bash(cat .mieruka/config.json)"
  - "Bash(claude mcp*)"
---

Install mieruka into the current project.

1. **Check for existing install.** Run `ls .mieruka` — if `.mieruka/` exists, report it's already installed and tell the user to run `node ~/Projects/mieruka/mieruka/bin/mieruka.mjs dev` to start. Stop here.

2. **Check Node version.** Run `node --version` — if below v20, tell the user to upgrade and stop.

3. **Resolve the mieruka binary.** mieruka is not yet published to npm. Check if it's available locally:
   - Try `node ~/Projects/mieruka/mieruka/bin/mieruka.mjs --version` — if it prints a version, use this as the runner (set `MIERUKA_BIN="node ~/Projects/mieruka/mieruka/bin/mieruka.mjs"`)
   - Otherwise, tell the user mieruka isn't installed and to clone it from its repo, run `npm install && npm run build`, then re-run this command

4. **Build the init command.** Parse `$ARGUMENTS` for supported flags:
   - `--serper-key KEY` — Serper.dev API key (get one free at https://serper.dev)
   - `--mcp-path PATH` — path to design-inspiration MCP's built `dist/index.js`
   - `--no-playwright-install` — skip `playwright install chromium`
   - `--no-mcp-register` — skip the `claude mcp add` step

   If no flags are provided, run interactively (the wizard will prompt).

5. **Run init.** Execute: `$MIERUKA_BIN init [flags from step 4]`

   The wizard will:
   - Ask for the design-inspiration MCP (local path or git URL — it clones, installs, and builds)
   - Ask for your Serper.dev API key (stored at `.mieruka/config.json` with mode 0600)
   - Scaffold `.mieruka/` (SQLite DB + config), write a starter `DESIGN.md`, append `.mieruka/` to `.gitignore`
   - Register the MCP server via `claude mcp add --transport http --scope project mieruka http://127.0.0.1:7777/mcp`

6. **Confirm success.** Tell the user:
   - Run `$MIERUKA_BIN dev` to open the UI at http://127.0.0.1:7777
   - The MCP server is now registered — Claude Code can call `mieruka.read_design`, `mieruka.write_design`, `mieruka.update_section`, etc.
   - Port 7777 can be overridden with `-p PORT`; re-register the MCP URL if you do
