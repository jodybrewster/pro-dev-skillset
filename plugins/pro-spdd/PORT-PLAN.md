# Plan: TypeScript port of `openspdd` inside the `pro-spdd` plugin

> **Save copy to**: also save this file to `pro-dev-skillset/plugins/pro-spdd/PORT-PLAN.md` after exiting plan mode (user requested a second copy lives there so they can pick this up in a fresh context).

---

## Context

`open-spdd` (https://github.com/gszhangwei/open-spdd) is a Go CLI mentioned in the Martin Fowler article "Structured Prompt-Driven Development". It is **not** an LLM tool or canvas validator — it's a **cross-editor installer** that copies the same SPDD markdown prompts into whichever AI editor the user is in (Cursor, Claude Code, Copilot, Codex, etc.). The `pro-spdd` plugin already ships the same 9 prompt files at `pro-dev-skillset/plugins/pro-spdd/commands/`, but only Claude Code users get them — Cursor / Copilot / Codex users can't consume the plugin.

We want a faithful TypeScript port of `openspdd` so anyone, in any supported editor, can `node bin/openspdd.mjs install <tool>` and get the same prompts. The port lives **inside the `pro-spdd` plugin** so the binary and the prompts version together — no drift, no second package to maintain, no separate marketplace entry.

The full Go CLI is vendored at `plugins/pro-spdd/upstream/open-spdd/` (commit `328d4bc`) — it is the reference implementation to mirror.

---

## Architecture

**Single file, zero npm dependencies.** Plugin distribution is git-based (no `npm install` step), so the port must run on a bare Node 20+ install with only the standard library. ~300–400 LOC, doable in one focused pass.

```
pro-dev-skillset/plugins/pro-spdd/
├── .claude-plugin/plugin.json          (bump version → 0.2.0)
├── bin/                                 (NEW)
│   ├── openspdd.mjs                     (the CLI — entry point + all subcommands)
│   ├── README.md                        (usage doc for non-Claude editors)
│   └── package.json                     (declares `"type": "module"` + bin field)
├── commands/                            (unchanged — these are the templates)
│   ├── spdd-analysis.md                 ← templates read at runtime
│   ├── spdd-api-test.md                 ← from this directory using
│   ├── spdd-code-review.md              ← import.meta.url to resolve
│   ├── spdd-generate.md                 ← the plugin root
│   ├── spdd-prompt-update.md
│   ├── spdd-reasons-canvas.md
│   ├── spdd-reverse.md
│   ├── spdd-story.md
│   ├── spdd-sync.md
│   └── spdd-install-to.md               (NEW — slash command wraps the bin)
├── references/usage.md                  (UPDATE — document new bin + command)
└── upstream/open-spdd/                   (unchanged — Go reference)

pro-dev-skillset/.claude-plugin/marketplace.json   (bump pro-spdd version → 0.2.0)
```

**Why this layout.** `bin/` is conventional. Each template is a flat file we already maintain; reading them at runtime (rather than embedding) keeps the port purely declarative — when we edit a `.md` template, both Claude Code (via the plugin command system) and Cursor/Copilot users (via the bin) see the same file. The companion `commands/spdd-install-to.md` is what a Claude Code user invokes to push templates into a different editor.

---

## Subcommand contracts (faithful to Go parity)

All six subcommands from the Go CLI. Flags mirror Go where reasonable.

| Command | Behavior | Key flags |
|---|---|---|
| `openspdd init [--tool <id>]` | Interactive picker (or `--tool`), creates the target tool's commands directory, copies the 5 core templates by default. Mirrors `cmd/init.go`. | `--tool`, `--all`, `--force` |
| `openspdd generate <name\|--all> [--tool <id>] [--force] [--output <dir>] [--allow-implicit]` | Copies one or more templates into the tool's commands directory using that tool's strategy. Mirrors `cmd/generate.go`. | `--tool`, `--all`, `--force`, `--output`, `--allow-implicit` |
| `openspdd list [--category <name>] [--quiet] [--optional] [--all]` | Lists templates available for the detected/specified tool, grouped by category. Mirrors `cmd/list.go`. | `--category`, `--quiet`, `--optional`, `--all`, `--tool` |
| `openspdd uninstall [--tool <id>] [--all] [--force]` | Removes templates installed by openspdd. Tracks via a small `.openspdd-manifest.json` written into the target dir on install, so we don't blindly delete the entire commands directory (this is **safer** than the Go version, which currently has more aggressive deletion logic in `cmd/uninstall.go`). | `--tool`, `--all`, `--force` |
| `openspdd pathcheck` | Reports which tool was detected in cwd and the resolved output paths. Mirrors `cmd/pathcheck.go`. | none |
| `openspdd version` | Prints the bundled plugin version (read from `../.claude-plugin/plugin.json`). | none |

`--tool` accepts: `claude-code`, `cursor`, `antigravity`, `github-copilot`, `opencode`, `codex`. Auto-detection if omitted (first signature match wins, ordering per Go).

---

## Editor detection map (lifted verbatim from Go `internal/detector/types.go`)

Detection order: Cursor → Claude Code → Antigravity → GitHub Copilot → OpenCode → Codex. First match wins.

| Tool ID | Signature files / dirs (any one match) |
|---|---|
| `cursor` | `.cursor`, `.cursorrules` |
| `claude-code` | `.claude`, `CLAUDE.md` |
| `antigravity` | `.antigravity` |
| `github-copilot` | `.github/copilot-instructions.md`, `.github/copilot-prompts` |
| `opencode` | `.opencode`, `opencode.json` |
| `codex` | `.codex`, `.codex/config.toml` |

---

## Output strategies (three implementations)

Each strategy is a pure function `(template, opts) → { writes: { path, content }[], merges?: { path, marker, content } }`.

1. **`flatMarkdown`** — used by Claude Code, Cursor, Antigravity, OpenCode. One file per template at `<root>/<configDir>/commands/<template-id>.md`. The file content is the template's body with front-matter rewritten so `name:` matches the editor's slash-command convention.
2. **`copilotInstructions`** — used by GitHub Copilot. Writes individual prompt files to `.github/copilot-prompts/<id>.md` **and** merges marker-wrapped content into `.github/copilot-instructions.md`. The merge uses `<!-- spdd:begin:<id> -->` / `<!-- spdd:end:<id> -->` markers so uninstall can find and remove its sections cleanly. Mirrors `internal/templates/copilot_strategy.go`.
3. **`codexSkills`** — used by Codex. Writes `.agents/skills/<id>/SKILL.md` plus `.agents/skills/<id>/agents/openai.yaml`. The yaml shape is in `internal/templates/codex_strategy.go` — quote it verbatim. Mirrors `internal/templates/codex_strategy.go`.

OpenCode also normalizes filenames per `OpenCodeTemplateAdapter` — port that adapter inline.

---

## Implementation steps (the actual build order)

1. **Skeleton**: `bin/openspdd.mjs` — module shebang, simple argv parser (no commander dep; hand-rolled `parseArgs` from `node:util` is enough), subcommand dispatch, `version`, `list` (read-only, no detector needed first).
2. **Template loader**: read `../commands/*.md`, parse front-matter (YAML frontmatter — single 30-line parser, regex-based; the only YAML we need is `name`, `id`, `category`; no full YAML lib).
3. **Categorization**: map each template id to "core" / "optional" per the Go classification (in `internal/templates/data/core/` vs `internal/templates/data/optional/`). Hardcode this — list comes from the Go embedded paths.
4. **Detector**: implement `detectTool(cwd)` using the signature map above. Returns `null` if nothing detected.
5. **Strategy: flatMarkdown**: simplest. Get this working end-to-end for Claude Code first; verify by running `openspdd generate spdd-story --tool claude-code` in a scratch dir and inspecting `.claude/commands/spdd-story.md`.
6. **Strategy: copilotInstructions**: implement marker-merge. Critical: the merge must be **idempotent** — running generate twice doesn't produce duplicates. Use the markers to detect existing sections and replace.
7. **Strategy: codexSkills**: extract the openai.yaml template from the Go strategy file (`internal/templates/codex_strategy.go`). It's a small fixed template with the template id and category interpolated.
8. **Install manifest**: write `.openspdd-manifest.json` in the target commands directory listing what we installed. `uninstall` reads this and removes only what we put there.
9. **`init`**: thin wrapper over `generate --all` for the chosen tool, with a friendly intro message and a 3-line summary at the end.
10. **`pathcheck`**: detect, print the tool and the would-be output paths. No writes.
11. **`uninstall`**: read manifest, prompt-confirm (skippable with `--force`), delete files, remove copilot marker sections.
12. **`spdd-install-to.md` command file**: small markdown command in `plugins/pro-spdd/commands/` that allowlists `Bash(node *bin/openspdd.mjs*)` and shells out: `node ${CLAUDE_PLUGIN_ROOT}/bin/openspdd.mjs install --tool $1 $2`. (`$CLAUDE_PLUGIN_ROOT` is the standard env var the runtime sets.)
13. **README + usage doc**: short `bin/README.md` (how to invoke without Claude Code) plus an update to `references/usage.md` (how to invoke via the new slash command).
14. **Plugin metadata bump**: `plugin.json` → `0.2.0`, `marketplace.json` entry → `0.2.0`.

---

## Critical files modified

- **NEW** `plugins/pro-spdd/bin/openspdd.mjs` (~350 LOC, the whole CLI)
- **NEW** `plugins/pro-spdd/bin/package.json` (just `{"type": "module"}`)
- **NEW** `plugins/pro-spdd/bin/README.md` (one screen of usage)
- **NEW** `plugins/pro-spdd/commands/spdd-install-to.md` (slash command wrapper)
- **EDIT** `plugins/pro-spdd/.claude-plugin/plugin.json` — version bump to 0.2.0
- **EDIT** `.claude-plugin/marketplace.json` — pro-spdd entry version bump
- **EDIT** `plugins/pro-spdd/references/usage.md` — document the new path

Files **NOT** touched: the 9 `commands/spdd-*.md` templates (their content is the contract), the `skills/` directory (Claude-specific), the `upstream/` Go reference.

---

## Decisions worth being explicit about

1. **Zero npm dependencies.** Use `node:util` `parseArgs` for argv, `node:fs/promises` for I/O, `node:path`, `node:readline/promises` for the init picker. Argument: keeps the install path "git clone + node ./bin/openspdd.mjs" with no `npm install` step. The Go binary's `charm/huh` TUI degrades to a plain numbered prompt; that's an acceptable cost for the zero-dep guarantee.
2. **Templates read at runtime, not embedded.** Path: `bin/openspdd.mjs` resolves `../commands/` relative to `import.meta.url`. Means a single edit to a `.md` file propagates everywhere with no rebuild.
3. **Install manifest for safe uninstall.** Mirrors the Go `cmd/uninstall.go` but is more conservative — we only delete files we wrote, not the whole commands dir. The manifest is a tiny JSON sidecar at `<configDir>/.openspdd-manifest.json`.
4. **Copilot marker convention**: `<!-- spdd:begin:<id> -->` / `<!-- spdd:end:<id> -->` — choose this even though Go uses different markers, because these are clearer and roundtrip-safe through other markdown tools. Document the convention in `bin/README.md`.
5. **`spdd-install-to` is the only new command.** Don't add per-tool wrappers like `/spdd-install-cursor`, `/spdd-install-copilot` — one flexible command beats six redundant ones.

---

## Verification (end-to-end test plan)

Run in a scratch directory at `/tmp/openspdd-test/` so it doesn't pollute the repo.

```bash
cd /tmp && rm -rf openspdd-test && mkdir openspdd-test && cd openspdd-test
PLUGIN=/Users/jodybrewster/Projects/pro-dev-skillset/plugins/pro-spdd

# 1. version
node $PLUGIN/bin/openspdd.mjs version
# expect: "openspdd-ts v0.2.0 (from pro-spdd plugin)"

# 2. list with no tool detected
node $PLUGIN/bin/openspdd.mjs list
# expect: warning that no tool was detected, then the full 9-template list grouped by category

# 3. pathcheck in empty dir
node $PLUGIN/bin/openspdd.mjs pathcheck
# expect: "No tool detected"

# 4. install to claude-code (no signature yet → explicit --tool required)
node $PLUGIN/bin/openspdd.mjs generate --all --tool claude-code
ls .claude/commands/
# expect: 9 .md files + .openspdd-manifest.json

# 5. detection now works
node $PLUGIN/bin/openspdd.mjs pathcheck
# expect: "Detected: claude-code" with the .claude/commands path

# 6. idempotent generate (no --force)
node $PLUGIN/bin/openspdd.mjs generate spdd-story --tool claude-code
# expect: skip with "already exists, pass --force to overwrite"

# 7. install for copilot — separate dir
cd /tmp && rm -rf openspdd-test-copilot && mkdir openspdd-test-copilot && cd openspdd-test-copilot
mkdir -p .github && touch .github/copilot-instructions.md
node $PLUGIN/bin/openspdd.mjs generate --all --tool github-copilot
# expect: 9 files under .github/copilot-prompts/ AND .github/copilot-instructions.md
#         now contains 9 marker-wrapped sections

# 8. uninstall copilot
node $PLUGIN/bin/openspdd.mjs uninstall --tool github-copilot --force
# expect: prompt files removed, marker sections stripped from copilot-instructions.md,
#         the rest of copilot-instructions.md untouched

# 9. install for codex
cd /tmp && rm -rf openspdd-test-codex && mkdir openspdd-test-codex && cd openspdd-test-codex
mkdir -p .codex && touch .codex/config.toml
node $PLUGIN/bin/openspdd.mjs generate --all --tool codex
ls .agents/skills/
# expect: 9 directories, each with SKILL.md + agents/openai.yaml

# 10. claude-code slash command path (smoke test via plugin)
# In Claude Code session inside mieruka-test:
# /spdd-install-to cursor
# expect: writes 9 files to .cursor/commands/
```

Each step has a single observable outcome — if any one fails, that's the regression to fix before continuing.

Optional smoke test the implementation against the **Go reference**: run `cd plugins/pro-spdd/upstream/open-spdd && go run ./cmd/openspdd generate --all --tool claude-code --output /tmp/go-output` and `node plugins/pro-spdd/bin/openspdd.mjs generate --all --tool claude-code --output /tmp/ts-output`, then `diff -r /tmp/go-output /tmp/ts-output` should yield identical trees.

---

## Out of scope (deliberately)

- Republishing `openspdd-ts` to npm. The bin is consumed via git clone or via the pro-spdd plugin's slash command. If npm-publishing matters later, that's a separate decision (location stays the same — just adds a `bin` field to the package.json and a release pipeline).
- A TUI as polished as `charm/huh`. A plain numbered prompt for `init` is enough; we can revisit with `@inquirer/prompts` once the zero-deps version is shipped and the trade-off is real.
- The Antigravity tool's "agents" mode. Go has a stub for it; we mirror the same stub and move on.
- Anything mieruka-side. This port has no contact with mieruka — it's strictly within the pro-spdd plugin.
