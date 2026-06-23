---
description: "Render a plan, comparison, diagram, table, code diff, report, or other complex response as a Lavish review artifact. Usage: /lavish <what to render>"
argument-hint: "<what the artifact should show>"
allowed-tools:
  - "Bash(test -f .claude/skills/lavish/SKILL.md*)"
  - "Bash(mkdir -p .lavish*)"
  - "Bash(npx -y lavish-axi*)"
  - "Bash(npx skills add kunchenguid/lavish-axi*)"
---

Use Lavish as the review surface for `$ARGUMENTS`.

First verify the project-local upstream skill exists at `.claude/skills/lavish/SKILL.md`. If it is missing, install it from the project root with:

```bash
npx skills add kunchenguid/lavish-axi --agent claude-code --skill lavish
```

Then follow `.claude/skills/lavish/SKILL.md` exactly:

1. Read every relevant Lavish playbook before writing HTML, starting with `npx -y lavish-axi playbook plan` for plans.
2. Create the artifact under `.lavish/` unless the user specified another location.
3. Open or resume the review session with `npx -y lavish-axi <html-file>`.
4. Poll for feedback with `npx -y lavish-axi poll <html-file>` and fix any reported layout warnings before asking the user to review.
5. End the session with `npx -y lavish-axi end <html-file>` when review is finished.

Lavish is the default review surface for substantive implementation plans, milestone plans, client-facing plans, decision matrices, diagrams, dense tables, code diffs, and reports. Keep short answers in plain text.
