# openspdd-ts

Node.js port of the [openspdd](https://github.com/gszhangwei/open-spdd) CLI.
Copies SPDD prompt templates into any supported AI editor — no npm install required.

## Requirements

Node 20+. No other dependencies.

## Usage

```sh
# Detect editor automatically and install core templates
node openspdd.mjs init

# Specify editor explicitly
node openspdd.mjs init --tool cursor

# Install all templates (core + optional)
node openspdd.mjs init --all --tool github-copilot

# Install a single template
node openspdd.mjs generate spdd-story --tool claude-code

# Install all templates to a custom directory
node openspdd.mjs generate --all --tool codex --output /path/to/project

# List available templates
node openspdd.mjs list
node openspdd.mjs list --optional

# Show what was detected
node openspdd.mjs pathcheck

# Remove installed templates
node openspdd.mjs uninstall --tool cursor --force

# Print version
node openspdd.mjs version
```

## Supported editors

| Tool ID          | Editor         | Config location             |
|------------------|----------------|-----------------------------|
| `cursor`         | Cursor         | `.cursor/commands/`         |
| `claude-code`    | Claude Code    | `.claude/commands/`         |
| `antigravity`    | Antigravity    | `.antigravity/commands/`    |
| `github-copilot` | GitHub Copilot | `.github/copilot-prompts/`  |
| `opencode`       | OpenCode       | `.opencode/commands/`       |
| `codex`          | Codex          | `.agents/skills/`           |

## Copilot marker convention

For GitHub Copilot, each template is merged into `.github/copilot-instructions.md`
using per-template markers:

```
<!-- spdd:begin:spdd-story -->
...template body...
<!-- spdd:end:spdd-story -->
```

Markers are idempotent — re-running `generate` replaces the existing section.
`uninstall` strips the markers and leaves the rest of the file intact.

## Manifest

Each install writes `.openspdd-manifest.json` in the target config directory.
`uninstall` reads this manifest to remove only what openspdd installed.
