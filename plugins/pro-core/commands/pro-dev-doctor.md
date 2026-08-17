---
description: "Health check for an installed pro-dev-skillset. Verifies the expected plugin set is present, runs strict plugin validation on what's installed, and does a routing smoke check (the using-pro-dev router resolves). Run this in a target repo after installing the marketplace. Usage: /pro-dev-doctor"
argument-hint: ""
allowed-tools:
  - "Bash(claude plugin list*)"
  - "Bash(claude plugin validate*)"
  - "Bash(ls ~/.claude/plugins*)"
  - "Bash(ls .claude/plugins*)"
  - "Bash(ls ~/.claude/skills*)"
  - "Bash(ls .claude/skills*)"
  - "Bash(python3 *dream-timer.py*)"
  - "Bash(ls ~/.claude/projects*)"
  - "Bash(wc -l*)"
  - "Bash(cat ~/.claude/plugins*)"
  - "Bash(cat .claude/plugins*)"
---

Verify that the `pro-dev-skillset` marketplace is correctly installed and coherent in the current environment. This is the install-time counterpart to the repo's `tests/check.mjs` — it can't assume Node or a checkout of the marketplace, so it works from what Claude Code has installed.

Run the steps below and report a short pass/fail summary at the end. Do not modify anything — this is read-only.

## 1. Installed plugin inventory

- Run `claude plugin list` and capture which `pro-*` plugins from this marketplace are installed and at what version.
- The **default stack** that should be present: `pro-core`, `pro-pdd`, `pro-execution`, `pro-quality`, `pro-nextjs`, `pro-design`, `pro-data`, `pro-testing`, `pro-research`, and `pro-starter`. Opt-in plugins (`pro-spdd`, `pro-gstack`) are present only if the user chose them — note them, don't fail on absence.
- Report each as installed (with version) or missing.

## 2. Strict validation

- For each installed `pro-*` plugin, run `claude plugin validate` against its installed path (under `~/.claude/plugins/` or the project `.claude/plugins/`). Report any that fail strict validation.

## 3. Router smoke check

- Confirm `pro-core` exposes the `using-pro-dev` skill (it's the cross-lifecycle router). If `pro-core` is installed, the skill should be discoverable.
- Sanity-route three prompts mentally against the installed skill descriptions and report what each should resolve to:
  - "where do I start / what's the workflow" → **using-pro-dev**
  - "is my change working in the browser" → **agent-browser** (pro-testing), *not* a committed-suite skill
  - "harden this endpoint against injection" → **no pro-testing skill fires** (Security is a planned phase)
- These mirror the repo's routing evals (`tests/cases/routing.jsonl`). If a prompt would resolve to the wrong skill, flag it.

## 4. Bridge engines and project-local skills

- `lavish` → `lavish-axi` requires the upstream skill to be materialized in the project. Check `.claude/skills/lavish/SKILL.md`; if it is missing, mark the install **needs attention** and point the user at `/lavish-engine install` or `npx skills add kunchenguid/lavish-axi --agent claude-code --skill lavish` from the project root. A user-scope copy at `~/.claude/skills/lavish/SKILL.md` is useful but does not satisfy this project-local check.
- `impeccable-bridge` → `impeccable` (manage with `/design-engine`) and `qa-suite` → `qa-skills` (manage with `/qa-engine`) route to engines installed *outside* this marketplace. Report whether each engine is present if its plugin is installed.
- Mieruka ships its own plugin (`/init-mieruka` from the mieruka npm package). Report it separately if the project uses it.

## 5. Memory consolidation

- Run `python3 "${CLAUDE_PLUGIN_ROOT}/scripts/dream-timer.py" --status` from the project root.
  It prints the resolved auto-memory directory, the interval, the last consolidation timestamp, whether one is due and why, and whether a pending flag is waiting for the next session start.
  `PRO_DEV_DREAM_DISABLED` and `PRO_DEV_DREAM_INTERVAL_HOURS` are already reflected there, so take the interval and the `due:` verdict from that output rather than inferring them.
- If the `memory:` line reports none, this project has no auto-memory directory yet.
  Report that as informational, not a failure - the `dream` skill and both its hooks are deliberate no-ops until Claude Code writes memory for this project.
- When the directory exists, count its memory files (`ls`) and measure the index with `wc -l` on its `MEMORY.md`.
  The skill's target is under 200 lines, so report the count and flag anything above it as **needs attention** with `/dream dry-run` as the next step.
- Confirm both `dream` hooks are actually registered.
  Read the installed `pro-core/hooks/hooks.json` (under `~/.claude/plugins/` or the project `.claude/plugins/`) and check that `Stop` runs `scripts/dream-flag.py` and `SessionStart` runs `scripts/dream-nudge.py`.
  Claude Code loads exactly one hook file per plugin, `hooks/hooks.json`, and silently ignores hook configs in any other file - a missing entry there means the hook never fires, with nothing anywhere reporting it.
  Report a missing entry as **needs attention** and note that `/dream` still works by hand.

## Summary

Print a compact report: default-stack coverage (n/10), whether `.claude/skills/lavish/SKILL.md` exists, any validation failures, any routing mismatches, and a one-line verdict (`healthy` / `needs attention`). Point the user at `claude plugin update` to refresh stale plugins and at the relevant `/...-engine` command for any missing bridge engine.

Add one memory line from step 5: whether this project has auto-memory, the `MEMORY.md` line count against the 200-line target, whether consolidation is due, and whether both `dream` hooks are registered.
Recommend `/dream dry-run` when consolidation is due or the index is over budget, since consolidation rewrites memory files.
