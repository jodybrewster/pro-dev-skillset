# pro-spdd Usage

## Claude Code slash commands

Use the canonical OpenSPDD command flow:

```text
/spdd-story <business requirement>
/spdd-analysis @requirements/[User-story-N]...
/spdd-reasons-canvas @spdd/analysis/...
/spdd-generate @spdd/prompt/...
```

When requirements change before or during implementation:

```text
/spdd-prompt-update @spdd/prompt/... <changed requirement>
```

When implementation changes first and the prompt needs to be brought back in sync:

```text
/spdd-sync @spdd/prompt/...
```

Optional workflows:

```text
/spdd-api-test @spdd/prompt/...        # Generate API test script
/spdd-code-review @spdd/prompt/...     # Review code against REASONS Canvas
/spdd-reverse @src/or/feature/path      # Codify existing implementation into REASONS Canvas
```

## Installing templates into other editors (openspdd-ts CLI)

The `bin/openspdd.mjs` CLI installs the same SPDD templates into Cursor, GitHub
Copilot, OpenCode, Codex, and Antigravity — no npm install required (Node 20+).

From within a Claude Code session:

```text
/spdd-install-to cursor
/spdd-install-to github-copilot --force
```

Or invoke the CLI directly (e.g. from a terminal in any project):

```bash
PLUGIN=/path/to/pro-dev-skillset/plugins/pro-spdd

# Show detected editor and config paths
node $PLUGIN/bin/openspdd.mjs pathcheck

# Install core templates (auto-detect editor)
node $PLUGIN/bin/openspdd.mjs init

# Install all templates to a specific editor
node $PLUGIN/bin/openspdd.mjs generate --all --tool cursor

# Install a single template
node $PLUGIN/bin/openspdd.mjs generate spdd-story --tool github-copilot

# List available templates
node $PLUGIN/bin/openspdd.mjs list

# Remove installed templates
node $PLUGIN/bin/openspdd.mjs uninstall --tool cursor --force
```

Supported tool IDs: `cursor`, `claude-code`, `antigravity`, `github-copilot`, `opencode`, `codex`

## Default artifact directories

```text
requirements/
spdd/
  analysis/
  prompt/
scripts/
```
