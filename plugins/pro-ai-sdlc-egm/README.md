# pro-ai-sdlc-egm

Experimental.
The AI-native SDLC loop with Google's Elephant-Goldfish Model (EGM) as its design step.
It started as a copy of `pro-ai-sdlc` and is where a different shape of the loop is tried without touching the loop other repos run.
Enable this plugin or `pro-ai-sdlc` in a repo, never both: they ship the same hooks and the same command names.
It needs `pro-egm` and `egm@egm` for the brainstorm, the section-by-section draft and the goldfish review; without them each step falls back to a plainer version and says so.
It is a Claude Code only plugin: its commands target Claude Code and make no promise for Codex.

## Three steps

| Step | Command | Who leads | Writes |
|---|---|---|---|
| Say what you want | `/intent` | product, or anyone with an idea or a bug | `intent/<ID>-<slug>/intent.md` |
| Agree the solution | `/design` | design and engineering, with product signing the goals | `docs/designs/<feature>.md` and `design-record.json` beside the intent |
| Build it | `/execute` | engineering, or the factory for small work | `plan.md` beside the intent, the code, the tests and an open PR; never a merge |

A person always creates an intent and a person always accepts it.
A brainstorm is a depth of `/intent` and `/intent` also reads a brief, a PRD or notes and asks only what they leave open.

A feature has one design file and it stays true as changes land.
The intent is the request for one change to it and names it in a `design:` line.
`/design` writes the file through EGM's draft for a new feature and proposes edits for a feature that already has one, then has fresh-context reviewers read it with the repo's `PRODUCT.md`, `DESIGN.md`, `ARCHITECTURE.md` and `SECURITY.md`.

`plan.md` is the builder's ticket.
`/execute` writes it from the approved design and nobody has to read it unless something goes wrong.

## Levels and approvals

A script sets the level of every intent and only ever raises it.

| Level | Which changes | Design | Who approves |
|---|---|---|---|
| 1 | low risk, no stop-list word, no new dependency, no brief and no design | none | nobody until deploy; the factory builds it |
| 2 | medium risk, or any intent with a brief or a design | reviewed and approved | product owner and engineer |
| 3 | high risk or a stop-list word such as auth, payment, export or personal data | reviewed and approved | product owner, engineer and lead; the engineer also approves the build ticket |

An approval is one line in `design-record.json`: the role, the person and the sha256 of the design file they approved.
An edit to the design voids its reviews and approvals without anyone clearing a field.
`execute-gate.py` refuses to build a change whose design is not reviewed and approved for the version on disk, or has an open row under `## Flagged concerns`.
The approver is `git config user.name` checked against the Roles block in `REVIEW.md`; that is routing, not authentication.

A level 1 build whose review leaves an Important finding open is not merged.
`/auto build` writes `Open review findings: <n>` in the pull request and the runner sends anything above zero to an engineer.

## What differs from pro-ai-sdlc

Keep this list current, so the experiment can be merged back or dropped as a known set of changes.

- `/spec` is gone and `/design` is new, with `scripts/design.py` and `templates/design.md`.
- `/plan` writes the build ticket from the design and stays inside it; `/execute` takes a change id and runs `/plan` itself.
- `/intent` picks a depth (brief, bug or brainstorm) and no longer reads `methods.py`; the intent template has `brief:` and `design:` lines.
- `factory.py level` reads a `brief:` or `design:` line as level 2.
- `execute-gate.py` runs `design.py check` when the intent names a design.
- `factory.py` stops a build whose pull request does not say `Open review findings: 0`; `/review` and `/auto build` write that line.
- `/review` and the `reviewer` agent compare the diff with the design file.
- The factory's level 1 brief still writes a short `spec.md` and `plan.md`, as in pro-ai-sdlc.

## Other commands

| Command | Writes |
|---|---|
| `/plan` | the build ticket without building, for reading it first |
| `/adr` | an ADR for a decision with no change behind it |
| `/review` | findings, a local finding ledger and, on a yes, one line in the agent file when a class of finding repeats |
| `/incident` | `incident.md` beside a new `intent.md`, with the raw evidence kept out of git |
| `/pr-babysit` | fixes on the PR branch, never a merge |
| `/auto brief\|build` | one unattended phase for the factory |

## Templates

The templates are plain files at stable paths, nothing is generated at runtime and each command reads its own:

- `templates/intent.md`
- `templates/design.md`
- `templates/spec.md` (the factory's level 1 brief only)
- `templates/plan.md`
- `templates/adr.md`
- `templates/incident.md`
- `templates/REVIEW.md`
- `references/definition-of-done.md`, the standing definition of done that every plan's `## Done` section cites

The interview rules for `/intent` live in `commands/intent.md`.
Another tool that wants the same fields reads these files from the installed plugin.

## Change ids

A repo that declares a shortcode in a tracked `intent/project.json` (`{"shortcode": "PDS"}`) gives every change an id such as `PDS-51` ([ADR-0026](../../docs/decisions/0026-change-ids.md)).
`/intent` and `/incident` allocate it, name the folder `intent/<ID>-<slug>/` and write `id:` first in the frontmatter; `/plan` copies it into the ticket.
Tools read the id from frontmatter and never from the folder name.
Every script that reads a folder accepts both forms.
Without the file the loop works as before with date folders.

- `scripts/ids.py next` fetches origin with a 10 second timeout and prints the highest id on every origin ref, every local branch and the working tree plus one; offline it allocates from the last fetch and says so.
- `scripts/ids.py backfill` prints the ids it would give intents that have none, in `created:` order; `--write` inserts each as the first frontmatter line.

An id is never reused: a dropped intent keeps its folder and its number.

## Building a plan

`/execute <path to plan.md>` runs on Opus, which builds the plan and dispatches subagents when a step benefits from one.
Two scripts hold the parts that must not depend on the model:

- `scripts/execute-gate.py` passes only a plan that is tracked, committed, `Status: approved` and not yet built, whose branch name is free locally and on origin.
- `scripts/copy-env.py` copies the main checkout's git-ignored `.env`, `.env.*`, `.dev.vars` and `.dev.vars.*` files into the worktree, outside `node_modules`.
  It prints relative paths only, never contents.
  A symlink is recreated as the same link.
  Every copy is removed if one would not be ignored in the worktree or fails.

The worktree is a sibling folder `../<repo>.<slug>` on a branch from `origin/<default branch>`; the session moves into it.
`/execute` also has a stop list: it pauses for a person before a step that touches auth, migrations, payments, deploys or secrets unless the plan's Risks names the category and the header names an approver.
The run stops on a failed gate, an unignored env file or a red baseline; otherwise it goes on to the pull request.

## Records

`/incident`, `/review` and the visual check in `/execute` write records in the shape of [docs/loop-records.md](../../docs/loop-records.md), through `scripts/evidence.py`.
Each lands under the excluded `.pro-dev/` and, when the repo has an ignored `.mieruka/evidence/`, there too.

- `scripts/incident.py` prepares the excluded evidence folder, refuses an `incident.md` that holds a credential and writes the incident record.
- `scripts/lessons.py` keeps the finding ledger and writes a review lesson when a class repeats on a second change.
- `scripts/visual.py` copies a screenshot and writes the visual check of a UI step against the plan's `Mock:`.

## Decisions

ADRs enter the loop at four points:

- `/intent` flags a likely decision under Open questions and writes no ADR.
- `/design` says when a design sets a rule other work must follow and suggests `/adr`.
- The Done section of `plan.md` accepts it: the person's sign-off moves the ADR to `accepted`.
- `/adr` records a decision with no change behind it, standalone and `accepted`.

The folder is `docs/adr/` if it exists, else `docs/decisions/` if it exists, else a new `docs/adr/`.
A `README.md` index table in that folder gets a row for each new ADR.

## Agents

Each declares its model in frontmatter by role.

| Agent | Model | Job |
|---|---|---|
| `researcher` | haiku | read-only exploration |
| `verifier` | sonnet | independent check after a build |
| `simplifier` | sonnet | trims what the diff added |
| `reviewer` | opus | adversarial gate against REVIEW.md |

## Hooks

All four ship in warn mode: a flagged call is logged and announced, then allowed.
They read `~/.claude/hooks/mode` and `~/.claude/hooks/mode.<hook>` (`warn` or `enforce`), set `CLAUDE_GUARD_DIR` to move that folder and log to `warn.log` in it.

- `protect-tests` blocks test-file edits while `.claude/fix-mode` (or the sample repo's `.claude/.fix-task`) exists or `SDLC_TASK_KIND=fix` is set.
- `plan-sync` is a Stop hook that flags code changed with no plan update (`plan.md`, `plan-<id>.md` or `plans/*.md`) and a `## Done` gone stale: when a plan's `## Done` holds `Done as of <sha>` and code changed after that sha, it names both shas. In enforce mode it blocks once and honours `stop_hook_active`. The stale check enforces only when its own mode file, `mode.stale-done`, says so.
- `production-gate` flags a push to the default branch, a production deploy, a publish, a PR merge and a release; in enforce mode it asks and `RELEASE_APPROVAL=1` in the starting environment lets it through.
- `change-id` flags a `git commit -m` on a branch named for a change id (`PDS-51/build`) whose subject does not start with that id (`PDS-51: `); in enforce mode it denies. A commit on any other branch, or one whose message comes from an editor, `-F`, `-C` or `--no-edit`, is not read. It enforces only when its own mode file, `mode.change-id`, says so ([ADR-0026](../../docs/decisions/0026-change-ids.md)).

A payload the hooks cannot parse is logged and allowed.

The hooks need `python3` on the PATH.
Without it a hook command errors, which Claude Code reports as a non-blocking hook error, so nothing is blocked.
