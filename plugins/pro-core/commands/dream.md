---
description: "Consolidate this project's Claude Code auto-memory: scan recent session transcripts for corrections, decisions, preferences, and patterns, merge them into the memory files, and rebuild a lean MEMORY.md index. Usage: /dream [dry-run|status]"
argument-hint: "[dry-run|status]"
---

Run memory consolidation for the current project using the `dream` skill.

Parse the first token of `$ARGUMENTS` (case-insensitive, leading `--` allowed):

| Token | Mode |
|---|---|
| *(empty)* | CONSOLIDATE (previews first when the skill requires it) |
| `dry-run`, `dry`, `preview` | DRY RUN |
| `status`, `when`, `check` | STATUS |
| anything else | Treat as a scope hint for CONSOLIDATE (a topic, or a memory file to focus on). |

## STATUS

Run `python3 "${CLAUDE_PLUGIN_ROOT}/scripts/dream-timer.py" --status` and report in three lines or fewer: when the last consolidation ran, whether one is due (the interval is 24h, tracked per project), and which memory directory it applies to.
Do not read transcripts and do not write anything in this mode.
Point at `/dream` as the next step only when one is actually due.

## DRY RUN

Invoke the `dream` skill and follow it up to the point of writing.
Report what it would change and nothing more: the transcripts scanned, the findings extracted grouped by kind (correction, decision, preference, pattern), which memory file each finding would land in, which findings duplicate memory that already exists, and the projected `MEMORY.md` line count.
Write no files, create no memory entries, and do not stamp the consolidation timestamp.
End with `/dream` to apply.

## CONSOLIDATE

Invoke the `dream` skill as an apply request: scan this project's session transcripts, extract findings, merge them into the memory files instead of appending duplicates, and rebuild `MEMORY.md` as a lean index under 200 lines.
An apply request does not always write on the first pass.
The skill's "Dry run first" rule decides that, and it holds here: the first consolidation for a project, and any plan that would delete or archive something, get the preview and a confirmation step before anything lands.
Defer to the rule as the skill states it rather than repeating or narrowing it in this file.
Honor a scope hint from `$ARGUMENTS` by narrowing what gets merged, never by skipping the index rebuild.
Report a short summary: findings merged by kind, files touched, and the `MEMORY.md` line count before and after.

## Rules

- The skill owns the procedure and its safety rails, including what may be deleted, merged, or archived, and what must be preserved on rewrite.
  This command selects the mode and reports the outcome, so do not re-derive, tighten, or relax those steps here.
- Report real numbers you observed.
  If a step produced nothing, say so plainly rather than claiming a consolidation that did not happen.
