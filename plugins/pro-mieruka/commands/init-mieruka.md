---
description: Install mieruka into the current project — runs npx mieruka init, scaffolds .mieruka/, and registers the MCP server with Claude Code.
argument-hint: "[--serper-key KEY] [--mcp-path PATH] [--no-playwright-install] [--no-mcp-register]"
allowed-tools:
  - "Bash(npx mieruka*)"
  - "Bash(node --version)"
  - "Bash(ls .mieruka*)"
  - "Bash(cat .mieruka/config.json)"
  - "Bash(claude mcp*)"
---

Install mieruka into the current project.

1. **Check for existing install.** Run `ls .mieruka` — if `.mieruka/` exists, report it's already installed and tell the user to run `npx mieruka dev` to start. Stop here.

2. **Check Node version.** Run `node --version` — if below v20, tell the user to upgrade and stop.

3. **Build the init command.** Parse `$ARGUMENTS` for supported flags:
   - `--serper-key KEY` — Serper.dev API key (get one free at https://serper.dev)
   - `--mcp-path PATH` — path to design-inspiration MCP's built `dist/index.js`
   - `--no-playwright-install` — skip `playwright install chromium`
   - `--no-mcp-register` — skip the `claude mcp add` step

   If no flags are provided, run interactively (the wizard will prompt).

4. **Run init.** Execute: `npx mieruka init [flags from step 3]`

   The wizard will:
   - Ask for the design-inspiration MCP (local path or git URL — it clones, installs, and builds)
   - Ask for your Serper.dev API key (stored at `.mieruka/config.json` with mode 0600)
   - Scaffold `.mieruka/` (SQLite DB + config), write a starter `DESIGN.md`, append `.mieruka/` to `.gitignore`
   - Register the MCP server via `claude mcp add --transport http --scope project mieruka http://127.0.0.1:7777/mcp`

5. **Confirm success.** Tell the user:
   - Run `npx mieruka dev` to open the UI at http://127.0.0.1:7777
   - The MCP server is now registered — Claude Code can call `mieruka.read_design`, `mieruka.write_design`, `mieruka.update_section`, etc.
   - Port 7777 can be overridden with `-p PORT`; re-register the MCP URL if you do
