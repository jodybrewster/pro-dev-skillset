---
description: "Set up or verify the full pro-dev stack in one step. Confirms the default-stack plugins are installed, then installs the external engines the bridges route to — impeccable (behind ui-ux-pro-max) and qa-skills (behind qa-suite) — and points you at Mieruka. The umbrella over /design-engine and /qa-engine. Usage: /pro-starter [check|install|engines|update]"
argument-hint: "[check|install|engines|update]"
allowed-tools:
  - "Bash(claude plugin list*)"
  - "Bash(claude plugin install*)"
  - "Bash(claude plugin update*)"
  - "Bash(npx impeccable skills*)"
  - "Bash(npx skills add petrkindlmann/qa-skills*)"
  - "Bash(npx skills list*)"
  - "Bash(ls ~/.claude/skills*)"
  - "Bash(ls .claude/skills*)"
---

One-step setup for the whole pro-dev stack. `pro-starter` itself is a meta-plugin
that pulls in the default marketplace plugins (core, execution, quality, design,
data, testing, nextjs marker, mieruka). This command finishes the job by
installing the **external engines** that the bridge skills route to — engines
that are *not* vendored and install on demand by design (see the marketplace's
bridge pattern). It's the umbrella over [`/design-engine`](impeccable) and
[`/qa-engine`](qa-skills); it does not reimplement them, it drives them.

Parse the action from `$ARGUMENTS` (default `check`).

## The bridges this sets up

| Bridge skill | Engine | Per-engine command |
|---|---|---|
| `ui-ux-pro-max` (pro-design) | `impeccable` | `/design-engine` |
| `qa-suite` (pro-testing) | `qa-skills` (petrkindlmann/qa-skills) | `/qa-engine` |
| `pro-mieruka` | Mieruka app | `/init-mieruka` (project-scoped) |

`ui-ux-pro-max` and `qa-suite` ship with the stack already (they're skills in
pro-design / pro-testing). What's missing after a plain `pro-starter` install is
the engines below them — that's what `install`/`engines` add.

## 1. `check` (default)

Report, without changing anything:
- **Stack coverage** — run `claude plugin list` and confirm the default stack
  (`pro-core`, `pro-execution`, `pro-quality`, `pro-design`, `pro-data`,
  `pro-testing`) is installed and enabled. (`/pro-dev-doctor` does the deeper
  version-and-routing check.)
- **impeccable** — `npx impeccable skills check`, and look for
  `~/.claude/skills/impeccable/SKILL.md` (user) / `.claude/skills/impeccable/SKILL.md` (project).
- **qa-skills** — look for the curated subset (`qa-do`, `qa-start`,
  `playwright-automation`, …) under `~/.claude/skills/` and `.claude/skills/`.
- Print a compact `installed / missing` summary and tell the user that
  `install` will fill the gaps.

## 2. `install`

The full "give me everything" path. In order:
1. **Stack** — for any default-stack plugin not already enabled, run
   `claude plugin install <plugin>@pro-dev-skillset --scope project`. (Usually a
   no-op, since this command only exists once `pro-starter` is installed.)
2. **impeccable** — run `npx impeccable skills install` (the harness build;
   fall back to `npx skills add pbakaus/impeccable` only if unavailable — never
   downgrade a newer harness build).
3. **qa-skills** — run `npx skills add petrkindlmann/qa-skills` with the curated
   testing-core subset that `/qa-engine` uses.
4. **Mieruka** — do **not** auto-install; it scaffolds into the *target project*.
   Tell the user to run `/init-mieruka` in the project that needs live
   client-facing progress.
5. Re-run the `check` report so the user sees what landed and where.

Default engine scope is **project** unless the user asks for global (`-g` /
user scope). Network is required for the `npx` steps.

## 3. `engines`

Same as `install` but **skips step 1** (the plugin stack) — just installs the
external engines. Use this when the stack is already in place and you only want
to light up the bridges.

## 4. `update`

- `claude plugin update` the marketplace plugins (refreshes the bridge skills).
- Re-run the impeccable and qa-skills installs to pull their latest builds.
- Report new versions.

## Note

This command manages the **engines**, not the marketplace plugins' own updates
beyond `update` above. Keep using `/design-engine` and `/qa-engine` for
fine-grained control of a single engine; `/pro-starter` is the batch front door.
