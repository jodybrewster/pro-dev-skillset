# pro-spdd

Structured Prompt-Driven Development (SPDD) for Claude Code. Adapted from [gszhangwei/open-spdd](https://github.com/gszhangwei/open-spdd) (MIT).

SPDD treats prompts as first-class, version-controlled delivery artifacts. Instead of generating code from a vague instruction, you build a structured **REASONS Canvas** — a 7-part design document that captures requirements, entities, approach, structure, operations, norms, and safeguards. The canvas drives code generation and stays in sync with the codebase as it evolves.

---

## Workflow

### 1. Decompose requirements into stories (optional)

```
/spdd-story <business requirement or @file>
```

Breaks a feature into INVEST-compliant stories with acceptance criteria. Saves to `requirements/`. Skip this if you're working from an existing spec.

### 2. Analyze the codebase

```
/spdd-analysis @requirements/[story].md
```

Reads the story, scans relevant parts of the codebase, and produces an enriched context document — domain concepts, strategic direction, risks, gaps. Saves to `spdd/analysis/`.

### 3. Generate the REASONS Canvas

```
/spdd-reasons-canvas @spdd/analysis/[analysis].md
```

Builds the full structured prompt from the analysis. The canvas is the implementation contract — everything downstream reads from it. Saves to `spdd/prompt/`.

### 4. Generate code

```
/spdd-generate @spdd/prompt/[canvas].md
```

Reads the canvas and generates code step-by-step, following the Operations sequence. Validates against acceptance criteria before reporting done.

### 5. Keep canvas and code in sync

When requirements change **before** code is complete:
```
/spdd-prompt-update @spdd/prompt/[canvas].md <what changed>
```

When code changes **after** the canvas was written:
```
/spdd-sync @spdd/prompt/[canvas].md
```

---

## Optional commands

```
/spdd-api-test @spdd/prompt/[canvas].md       # cURL test script for the generated API
/spdd-code-review @spdd/prompt/[canvas].md    # Verify code matches canvas intent
/spdd-reverse @src/path                        # Reverse-engineer existing code into a canvas
```

---

## Artifact directories

```
requirements/        ← stories from /spdd-story
spdd/
  analysis/          ← enriched context from /spdd-analysis
  prompt/            ← REASONS Canvas from /spdd-reasons-canvas
```

---

## Installing templates into other editors

Claude Code users get all commands automatically. For **Cursor, GitHub Copilot, Codex, OpenCode, or Antigravity**, use the included CLI to copy the same templates into that editor's expected location.

From Claude Code:
```
/spdd-install-to cursor
/spdd-install-to github-copilot
/spdd-install-to codex
```

Or run directly (Node 20+, no npm install):
```bash
PLUGIN=/path/to/plugins/pro-spdd
node $PLUGIN/bin/openspdd.mjs generate --all --tool cursor
node $PLUGIN/bin/openspdd.mjs generate --all --tool github-copilot
node $PLUGIN/bin/openspdd.mjs generate --all --tool codex
```

Supported tool IDs: `cursor`, `claude-code`, `antigravity`, `github-copilot`, `opencode`, `codex`

See [`bin/README.md`](bin/README.md) for full CLI reference.

---

## The REASONS Canvas

Each canvas has seven sections:

| Section | What goes here |
|---|---|
| **R** equirements | Problem definition and definition of done |
| **E** ntities | Domain objects, relationships, Mermaid diagrams |
| **A** pproach | Architecture decisions, patterns, trade-offs |
| **S** tructure | Component hierarchy, dependencies, layers |
| **O** perations | Concrete, ordered implementation tasks |
| **N** orms | Coding standards, injection patterns, logging |
| **S** afeguards | Non-negotiable constraints: security, performance, invariants |

The canvas separates **design** (R–E–A–S) from **execution** (O) and **governance** (N–S). When reality diverges from intent, fix the canvas first, then regenerate.

---

## Attribution

Adapted from [gszhangwei/open-spdd](https://github.com/gszhangwei/open-spdd), MIT License. See [LICENSE](LICENSE).
