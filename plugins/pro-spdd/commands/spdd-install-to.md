---
description: Install SPDD prompt templates into another AI editor's config directory. Wraps bin/openspdd.mjs.
argument-hint: "<tool-id> [--force]"
allowed-tools:
  - "Bash(node *bin/openspdd.mjs*)"
---

Install SPDD templates into the specified AI editor using the bundled `openspdd.mjs` CLI.

**Supported tool IDs:** `cursor`, `claude-code`, `antigravity`, `github-copilot`, `opencode`, `codex`

**Steps:**

1. Parse `$ARGUMENTS`:
   - First token = **tool ID** (required)
   - `--force` = overwrite existing files

2. Locate the CLI. The binary is at `bin/openspdd.mjs` inside the pro-spdd plugin directory. If `$CLAUDE_PLUGIN_ROOT` is set, use `$CLAUDE_PLUGIN_ROOT/bin/openspdd.mjs`. Otherwise resolve it relative to this command file's location (two directories up from `commands/`).

3. Run:
   ```bash
   node "<plugin-root>/bin/openspdd.mjs" generate --all --tool <tool-id> [--force]
   ```

4. Report which files were written and where. If no files were written (all already exist), suggest `--force`.
