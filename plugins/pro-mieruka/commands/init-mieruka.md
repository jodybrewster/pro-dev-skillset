---
description: Install mieruka into the current project — runs npx mieruka init, scaffolds .mieruka/, and registers the MCP server with Claude Code.
argument-hint: "[--serper-key KEY] [--mcp-path PATH] [--no-playwright-install] [--no-mcp-register]"
allowed-tools:
  - "Bash(npx mieruka init*)"
  - "Bash(ls .mieruka*)"
---

Install mieruka into the current project.

1. **Check for existing install.** Run `ls .mieruka` — if `.mieruka/` exists, report it's already installed and tell the user to run `/start-mieruka`. Stop here.

2. **Build the init command.** Pass any flags from `$ARGUMENTS` directly to `npx mieruka init`:
   - `--serper-key KEY` — Serper.dev API key (get one free at https://serper.dev)
   - `--mcp-path PATH` — path to design-inspiration MCP's built `dist/index.js`
   - `--no-playwright-install` — skip `playwright install chromium`
   - `--no-mcp-register` — skip the `claude mcp add` step

3. **Run:** `npx mieruka init [flags]`

   The wizard will ask for the design-inspiration MCP path and your Serper.dev API key if not passed as flags. It scaffolds `.mieruka/` (SQLite DB + config) and appends `.mieruka/` to `.gitignore`.

4. **Confirm.** Tell the user to run `/start-mieruka` to open the UI at http://127.0.0.1:7777.
