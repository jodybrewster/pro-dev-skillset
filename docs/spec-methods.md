# Spec methods compared

pro-dev-skillset ships five ways to go from an idea to reviewed code.

- `pro-pdd` is the default: plan-driven development, which is Claude Code as it is plus a written plan you approve before `pro-execution` builds it test first.
- `pro-ai-sdlc` is opt-in: a command-driven loop for changes that need a record, writing an intent, a spec and a plan under `intent/` and checking them against the repo's rules.
- `pro-egm`, `pro-speckit` and `pro-spdd` are opt-in plugins too: install one to try it and uninstall it to drop it.

When an opt-in method is installed, pro-ai-sdlc's commands offer it at the right stage and run it only on your yes ([ADR-0007](./decisions/0007-spec-method-plugins.md)).
A feature runs through one method's documents, never two at once.

## The workflows side by side

Each lane runs left to right: the command or skill you type, what it does and the file it leaves behind.
An orange diamond marks a point where you approve, hooks sit under the lane they belong to and the last band lists the hooks that run under every method.
The OpenSpec lane is a candidate for comparison and is not installed by any plugin here.

![The spec methods as lanes: pro-pdd, pro-ai-sdlc, pro-egm, pro-speckit, pro-spdd and OpenSpec, with commands, approval gates and hooks](./spec-workflows.svg)

## At a glance

| | pro-pdd (default) | pro-ai-sdlc | pro-egm | pro-speckit | pro-spdd |
|---|---|---|---|---|---|
| What it is | Plain Claude Code with a plan step: talk it through, approve a written plan, build it test first | A fuller loop for changes that need a record: intent, spec, plan, build, review | Google's design-first lifecycle: brainstorm, design doc, staged goldfish review, drift report; its review loop also plugs into pro-ai-sdlc | GitHub's spec-driven toolkit with its own loop | Structured Prompt-Driven Development with its own loop |
| Upstream | Forked from [obra/superpowers](https://github.com/obra/superpowers) and [agent-skills](https://github.com/addyosmani/agent-skills), MIT | This repo, heavily inspired by Anthropic's [AI-native SDLC playbook](https://claude.com/resources/articles/the-ai-native-sdlc-playbook) (PDF on that page) | [google/elephant-goldfish-model](https://github.com/google/elephant-goldfish-model), Apache-2.0 | [github/spec-kit](https://github.com/github/spec-kit), MIT | [gszhangwei/open-spdd](https://github.com/gszhangwei/open-spdd), MIT |
| How it ships | Built in (forked skills); lavish is a bridge | Built in | Bridge: Google's `egm@egm` plugin, installed as Google ships it | Bridge: spec-kit's `specify` CLI, pinned to a reviewed release | Adapted into this repo |
| Comes with the starter | Yes | No | No | No | No |
| Best for | The simplest path: most everyday work, ideas still being explored, quick features | Changes that should be checked against the repo's rules and signed off | Exploring a topic and weighing options before any change exists; a design doc read cold before anyone builds; a second opinion on a spec or plan | Teams already on spec-kit, or a project that wants a constitution and task lists | Client or team-facing work that needs a written story and a structured prompt |
| Documents it writes | A design doc under `docs/superpowers/specs/` and a plan under `docs/plans/` | `intent/<id>-<slug>/intent.md` (or `intent/<date>-<slug>/` with no shortcode), `spec.md`, `plan.md` | `concepts_brief.md`, a design doc under `docs/designs/` that replaces spec.md and plan.md for that work, README contracts; review and drift reports left untracked | `.specify/memory/constitution.md` once; `specs/<NNN>-<feature>/spec.md`, `plan.md`, `tasks.md` per feature | `spdd/analysis/`, `spdd/prompt/`, `spdd/review/` |
| Who drives it | The skills trigger when you describe the work; `/adhd` and `/lavish` run on demand | You run each command; Claude asks before anything it commits | You run each `/pro-egm:*` command; `/intent` offers the brainstorm and `/spec` and `/plan` offer the goldfish review; you accept or contest each finding | You type every `/speckit-*` command; the model cannot start them | You run each `/spdd-*` command |
| Policy checks | None built in; the brainstorm asks for your approval of the design before any code | `/spec` checks `REVIEW.md`, `CLAUDE.md` and ADRs; a security challenge before risky plans | Your own goldfish can check policy (starter policy, scope, architect, security and sponsor reviewers are included) | spec-kit's constitution | REASONS Canvas safeguards and its code review |
| Builds the code | `subagent-driven-development` and `test-driven-development` (pro-execution) | `/execute`, in its own worktree, then the PR | No | `/speckit-implement` | `/spdd-generate` |
| Extra install | `lavish-axi` for plan review, through `/pro-pdd:install` | None | `egm@egm` | `uv` and the `specify` CLI | None |
| Cost | Low; `/adhd` runs several branches in parallel | Low | Several reviewer subagents on the session model per review; the brainstorm's options research adds up to three web research subagents | Low; one CLI install per machine | Low |
| Codex | Skills load in Codex | Skills load; the slash commands are Claude Code only | EGM ships for Codex: pick its skills in the skill picker and follow the bridge's running rules by hand | `specify init --integration codex` by hand | Skills load; the slash commands are Claude Code only |

## Which to pick

- Start with pro-pdd: it is the simplest, close to plain Claude Code.
  Describe what you want, approve the plan and let it build.
- Move to pro-ai-sdlc when a change should be checked against the repo's rules and signed off.
  Install it with `claude plugin install pro-ai-sdlc@pro-dev-skillset` when a change needs a record.
  It keeps the intent, spec and plan together under `intent/` and gates risky plans with a security challenge.
- Add pro-egm when a topic needs discovery and options before it is a change, or a design needs to be read cold before anyone builds it.
  Its brainstorm sits in front of `/intent`; for work that goes through EGM its design doc replaces `spec.md` and `plan.md`. Its review loop can still sharpen the documents pro-ai-sdlc writes.
- Try pro-speckit when you want spec-kit's constitution, its clarify and analyze steps or its task lists, or when a project already uses spec-kit.
- Use pro-spdd when the work is for a client or another team and needs a story with acceptance criteria and a prompt that stays in sync with the code.

## pro-pdd: plan-driven development

The simplest way to work: Claude Code as it is, plus a plan you approve before it builds.
The skills trigger from what you say rather than from a command.

1. Describe the idea.
   `interview-me` asks one question at a time until the real need is clear; `idea-refine` turns a rough concept into a few directions; `/adhd` runs a wider parallel brainstorm on demand.
2. `brainstorming` proposes a design and waits for your approval before any code, then writes the design doc under `docs/superpowers/specs/`.
3. `writing-plans` turns the design into a step-by-step, test-first plan under `docs/plans/`.
   For a substantial plan, `lavish` renders it as an HTML page you can annotate in the browser before you approve it.
4. `subagent-driven-development` builds the approved plan task by task with subagents; `test-driven-development` writes the failing test before each change and `using-git-worktrees` keeps the work isolated.
5. Open the PR with `/gh` or your usual flow; `/review` and `/pr-babysit` from pro-ai-sdlc work here too.

## pro-ai-sdlc: the full record

pro-ai-sdlc is heavily inspired by Anthropic's [AI-native SDLC playbook](https://claude.com/resources/articles/the-ai-native-sdlc-playbook) by Louis Claxton; the page links the PDF.
Its intent, spec, plan, review and sign-off steps follow the playbook's stages.

Each step writes one file in `intent/<id>-<slug>/` (or `intent/<date>-<slug>/` in a repo with no shortcode) and commits it.

1. `/intent <idea or bug>` brainstorms the idea with you until it is concrete, then writes `intent.md`: the problem, the outcome and what is out of scope.
2. `/spec` writes `spec.md`: testable requirements traced to the intent, checked against `REVIEW.md`, `CLAUDE.md` and the repo's ADRs.
   It lists every conflict under Flagged concerns for you to settle one at a time; a change that sets a rule drafts an ADR beside it.
3. `/plan` writes `plan.md`: the files touched, the order of work, the tests behind each step, the risks and the commands that prove it is done.
   A plan that touches security surface gets a `## Security challenge` from a fresh reviewer before you approve it.
4. `/execute` builds the approved plan in its own worktree and opens the PR.
5. `/review` reviews the diff against `REVIEW.md` and the intent, spec and plan; `/pr-babysit` loops on CI and review threads until the PR waits only on your approval.
6. After the merge, the plan's Done section records the live check and your sign-off, which moves the intent, the spec and any ADR to accepted.

`/adr <decision>` records a decision that has no change behind it.

## pro-egm: the Elephant-Goldfish lifecycle

Google's Elephant-Goldfish Model splits design work between the elephant (the session that interviews you and designs) and the goldfish (fresh reviewers that see only the document and the files it points to).
pro-egm has one command per EGM skill and reads each skill from the installed `egm@egm` plugin at run time.

| Step | Command | Leaves |
|---|---|---|
| Map an existing codebase | `/pro-egm:bootstrap <dir>` | README contracts beside the code |
| Explore a topic before it is a change | `/pro-egm:brainstorm <topic>` | `concepts_brief.md` with options, dated sources and an assumptions table |
| Design doc from the brief | `/pro-egm:draft` | `docs/designs/<feature>.md` |
| Staged review, stages 5 to 9 | `/pro-egm:review <doc>` | stage reports (untracked) |
| Work through findings | `/pro-egm:resolve <doc>` | `goldfish_review_report.md` (untracked), approved edits |
| Review one spec, plan or brief | `/pro-egm:goldfish <file>` | `goldfish_review_report.md` (untracked), approved edits |
| Designs against the code | `/pro-egm:drift` | `<date>_DRIFT_REPORT.md` (untracked) |
| A small change | `/pro-egm:lite <task>` | `egm_lite_checklist.md` (untracked), the change |

The brainstorm adds to EGM's own interview: it reads what you supplied and reports before asking, covers business, functional and non-functional topics one open question at a time, turns unanswered questions into assumptions, researches patch, buy, open source and build options with a source and date for every claim and offers a second review by architect, security and compliance and sponsor goldfish.
It ends by recommending `/pro-egm:draft` for work that goes through EGM or `/intent` for work that stays in the pro-ai-sdlc lane.
No code is written before the design doc is approved.

To use the review loop inside pro-ai-sdlc:

1. Install `pro-egm@pro-dev-skillset`, then run `/pro-egm:install` (or `/pro-dev install` on a starter site), which installs `egm@egm` after showing what it carries.
2. `/spec` and `/plan` now offer "run a goldfish review" before they commit.
   On yes, the reviewers check the draft, you accept or contest each finding and the fixes land in the draft.
   Open Blocker and Major findings move into the spec's Flagged concerns or the plan's Risks.
3. Run `/pro-egm:goldfish <file>` on any spec, plan or design doc outside the loop.
4. `/pro-egm:goldfish init` copies the starter goldfish into `.egm/`: policy and scope reviewers for specs and plans, architect, security and compliance and sponsor reviewers for a brief.
   Edit them or add your own, then list them per stage in `.egm/goldfish.json`.
   Custom goldfish run read-only.
   A goldfish file that changed since your last run asks for your yes first.

## pro-speckit: GitHub spec-kit

spec-kit keeps its own spec, plan and tasks under `specs/<NNN>-<feature>/`.
It needs [`uv`](https://docs.astral.sh/uv/) installed.

1. Install `pro-speckit@pro-dev-skillset` at project scope, then run `/pro-speckit:install`.
   It installs the `specify` CLI pinned to a reviewed release and sets up this repo; it refuses a repo with uncommitted changes.
2. Type spec-kit's own commands in order: `/speckit-constitution` once per repo, then `/speckit-specify`, `/speckit-plan`, `/speckit-tasks` and `/speckit-implement` per feature.
   They run only when you type them.
3. `/pro-dev check` tells you if any file spec-kit put in the repo changed.
4. `/pro-speckit:install update` moves to the next reviewed release; `/pro-speckit:remove` takes spec-kit back out.

When you start an intent with pro-speckit installed, `/intent` reminds you that `/speckit-specify` is there for that feature.
[ADR-0008](./decisions/0008-spec-kit-uv-tool.md) records how the CLI is pinned and checked.

## pro-spdd: open-SPDD

open-SPDD turns a requirement into a structured prompt (the REASONS Canvas) and keeps it in sync with the code.

1. Install `pro-spdd@pro-dev-skillset`.
2. `/spdd-story` breaks the requirement into stories, `/spdd-analysis` adds business and code context and `/spdd-reasons-canvas` writes the structured prompt.
3. `/spdd-generate` writes the code from that prompt; `/spdd-code-review` and `/spdd-api-test` check it.
4. `/spdd-sync` updates the prompt after code changes, `/spdd-prompt-update` changes the requirements and `/spdd-reverse` writes a prompt for existing code.

`/intent` offers `/spdd-story` when pro-spdd is installed.
