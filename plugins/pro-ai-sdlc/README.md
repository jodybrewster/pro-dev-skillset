# pro-ai-sdlc

The AI-native SDLC as one plugin, stack-agnostic.
The playbook is the guide and this plugin is where it is encoded.
The whole loop works from Claude Code alone in any repo that has the plugin installed; mieruka is only a UI over it and reads the plugin's templates and rules.

Reference architecture: `ai-sdlc-kit-sample-repo`, a checkout kept beside this one if present, the kit installed into a repo.
`/sdlc-init` writes toward that shape, with one departure: `intent/<date>-<slug>/{intent,spec,plan}.md` live in one folder instead of flat `specs/` and `plans/`.

## The loop

| Stage | Command | Writes |
|---|---|---|
| Intent | `/intent` | `intent/<date>-<slug>/intent.md` |
| Spec | `/spec` | `spec.md` beside the intent |
| Plan | `/plan` | `plan.md` beside the spec |
| Decision | `/adr` | an ADR for a decision with no change behind it |
| Review | `/review` | findings, nothing on disk |
| PR | `/pr-babysit` | fixes on the PR branch, never a merge |
| Setup | `/sdlc-init` | the agent file block, `intent/`, `REVIEW.md`; commits nothing |

## Templates

The templates are plain files at stable paths, nothing is generated at runtime, and each command reads its own:

- `templates/intent.md`
- `templates/spec.md`
- `templates/plan.md`
- `templates/adr.md`
- `templates/REVIEW.md`

The interview rules for `/intent` live in `commands/intent.md`.
Another tool that wants the same fields reads these files from the installed plugin.

## Decisions

ADRs enter the loop at four points:

- `/intent` flags a likely decision under Open questions and writes no ADR.
- `/spec` answers `ADR needed:` in Flagged concerns and, on yes, drafts the ADR as `proposed` in the same commit as the spec.
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

All three ship in warn mode: a flagged call is logged and announced, then allowed.
They read `~/.claude/hooks/mode` and `~/.claude/hooks/mode.<hook>` (`warn` or `enforce`), set `CLAUDE_GUARD_DIR` to move that folder, and log to `warn.log` in it.

- `protect-tests` blocks test-file edits while `.claude/fix-mode` (or the sample repo's `.claude/.fix-task`) exists or `SDLC_TASK_KIND=fix` is set.
- `plan-sync` is a Stop hook that flags code changed with no plan.md update; in enforce mode it blocks once and honours `stop_hook_active`.
- `production-gate` flags a push to the default branch, a production deploy, a publish, a PR merge and a release; in enforce mode it asks, and `RELEASE_APPROVAL=1` in the starting environment lets it through.

A payload the hooks cannot parse is logged and allowed.

The hooks need `python3` on the PATH.
Without it a hook command errors, which Claude Code reports as a non-blocking hook error, so nothing is blocked.
