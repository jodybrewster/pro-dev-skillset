---
intent: intent/2026-10-28-design-vercel-bridges/intent.md
intent-status: proposed
status: draft
created: 2026-10-28T10:30:00-0400
author: the maintainer
---

# Spec: Hallmark, web-design-guidelines and Vercel skill bridges

Built from `intent.md` in this folder (commit 1e6668d).
Status: draft.
Reworked a second time 2026-10-28 after the plan's re-challenge of the pro-ship rework: the pin test and the R28 hash cover more, R10b fails closed outside git, the Summary matches R26 and a new optional registry field, `gitExclude` (R31), keeps the project-scope `deploy-to-vercel` folder out of commits.
Reworked 2026-10-28: the maintainer kept Vercel's upstream `deploy-to-vercel` skill and moved deploying out of pro-nextjs into a new opt-in plugin, `pro-ship`; the plan's security challenge changes that apply when the skill stays are folded in as R10b and R26 to R30.
Policies and skills consulted: `CLAUDE.md`, `AGENTS.md`, `REVIEW.md`, `RELEASING.md`, `docs/decisions/0001` to `0006` (ADR-0006, the engine registry rule, is the one this spec follows), `docs/version-bump-law.md`, `docs/codex-parity.md`, `docs/licenses.md`, the umbrella intent `intent/2026-10-27-pro-dev-simplify/intent.md` (items 8 to 11; item 12 is dropped) and the finished spec `intent/2026-10-28-pro-dev-setup/spec.md` with its `plan.md` (the `-s` gotcha).
Code read to ground the design: `plugins/pro-core/registry/engines.json` (row shape, version 2 on main at 9bd2cd0), `plugins/pro-core/scripts/pro-dev.py` (`detected`, `engine_state`, `run_engine`), the pro-design skills `taste-skills-bridge`, `landing-page-design`, `impeccable-bridge`, `emil-design-eng`, `shadcn-ui-composition`, `accessibility-audit`, `screen-critique` and `interface-review`, `plugins/pro-nextjs/skills/next-skills-bridge/SKILL.md` (the model for a Vercel bridge), `plugins/pro-design/LICENSE`, `plugins/pro-nextjs/LICENSE`, `plugins/pro-core/skills/using-pro-dev/SKILL.md` (its SHIP branch already names a planned `pro-ship`), `tests/check.mjs` (`BRIDGES`, `PLANNED`, `OPT_IN`, `checks.bridges`, `checks.registry`), `tests/bridge-install-smoke.mjs`, `tests/eval.mjs` (`DISTRACTORS`), `tests/cases/routing.jsonl`, `.claude-plugin/marketplace.json`, `.agents/plugins/marketplace.json`, the pro-egm manifests (the model for a new opt-in plugin) and the pro-dev-starter and pro-starter manifests.
Upstream read on 2026-10-28 through `gh api`: `nutlope/hallmark` (LICENSE, README, `package.json`, `skills/hallmark/SKILL.md`), `vercel-labs/agent-skills` (repo license field, tree, README, the `SKILL.md` of all seven skills named here; `main` at 1a2c79d4e6c4a2283dc2c614b6538cbe1ed5ca62) and `vercel-labs/web-interface-guidelines` (LICENSE).
No `DESIGN.md`, `SECURITY.md` or compliance skill under `.claude/skills/` exists in this repo.

## Summary

A site with pro-design gains three bridges and a site with pro-nextjs gains one, each backed by a row in the pro-core engine registry, so `/pro-dev install` and `/pro-dev update` bring their engines in like every other bridge.
Deploying lives in a new opt-in plugin, `pro-ship`, which is not in pro-dev-starter and holds one bridge with its own row.
`hallmark-bridge` routes to Hallmark only when the person names it or picks it.
`web-design-guidelines` is pro-design's own skill for a code-level `file:line` lint against Vercel's Web Interface Guidelines, using rules fetched from one pinned commit; it needs no engine.
`vercel-skills-bridge` in pro-nextjs routes React and Next.js performance and Vercel cost tuning to two vercel-labs skills and covers token-based CLI work itself.
`vercel-deploy-bridge` in pro-ship owns the deploy steps and names the upstream `deploy-to-vercel` skill only to hand it the deploy result and to say its folder is not to be committed.
`react-patterns-bridge` in pro-design routes plain React composition and view transitions to two more.
Nothing upstream is copied in; the bridges are original routers with guardrails for Vercel tokens and deploys while the guidelines rules are fetched from one pinned commit.
The vercel-labs rows install from one pinned commit and a smoke test fails when any file in the installed `deploy-to-vercel` folder stops matching the reviewed hashes.
A new optional registry field, `gitExclude`, makes `/pro-dev` add the project-scope `deploy-to-vercel` folder to the repo's local `.git/info/exclude`, so `git add .` never stages it.
Four skills gain hand-off lines and two more gain a one-clause boundary, so the existing defaults still win the prompts they win today.

## Requirements

### Functional

- R1. pro-design ships `skills/hallmark-bridge/SKILL.md`, a bridge to the upstream `hallmark` skill (install name `hallmark`, from `nutlope/hallmark`). (intent: "Hallmark ... in pro-design, optional")
- R2. `hallmark-bridge` routes only when the prompt names Hallmark or the person picks it from an offered list; its description and body say it is never the default for "build something new". (intent: "Route to it only when the person names Hallmark or explicitly picks it")
- R3. `hallmark-bridge` states: the browser checks (`sloplint --render`, screenshots) need `puppeteer-core` and Chrome and fall back to static checks without them, with the handoff saying which of the two ran; the comp and image steps run only when `TOGETHER_API_KEY` is already set in the environment; the key is never written to a file, a command line or the transcript; upstream `redesign` and `audit` run only when the person names them; upstream `install-hook.mjs` is never run, since it adds a hook to Claude Code outside any plugin. (intent constraints on `puppeteer-core`, Chrome and `TOGETHER_API_KEY`)
- R4. The descriptions of `taste-skills-bridge`, `landing-page-design`, `impeccable-bridge` and `emil-design-eng` each gain one hand-off clause naming `hallmark-bridge` "only when Hallmark is named"; `landing-page-design` keeps its conversion copy and SEO scope and is otherwise unchanged. (intent: "Hand-off lines go in ...", "`landing-page-design` stays")
- R5. pro-design ships `skills/web-design-guidelines/SKILL.md`, its own skill for a `file:line` lint of UI code (forms, focus, hydration, safe areas, i18n) against Vercel's Web Interface Guidelines; no upstream skill is installed for it and it has no registry row. (intent: "web-design-guidelines ... in pro-design, default"; settled by the maintainer 2026-10-28)
- R6. `web-design-guidelines` names the boundary: itself for the rule lint, `accessibility-audit` for WCAG conformance, `screen-critique` for how a rendered screen looks and `interface-review` for a before-and-after UI diff. (intent: "Boundary: ...")
- R7. `web-design-guidelines` fetches its rules from one pinned commit, `https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/434b7f91364665f2f733b310ec54809bf8f37937/command.md` and from no other URL; the fetched text is used only as review rules and a findings format; nothing in it is followed as an instruction to run a command, fetch another URL, edit a file or change the review's scope; the lint reads files and runs no shell command. Moving to newer rules is a reviewed change that bumps the commit in this skill under R30. (intent open question 2; Flagged concern 3; security challenge)
- R8. The descriptions of `accessibility-audit` and `screen-critique` each gain one clause handing a guidelines lint of UI code to `web-design-guidelines`. (Flagged concern 2)
- R9. pro-nextjs ships `skills/vercel-skills-bridge/SKILL.md`, a bridge to two upstream skills by install name: `vercel-react-best-practices` and `vercel-optimize` (performance and cost).
  Deploy asks go to `vercel-deploy-bridge` when pro-ship is installed and otherwise to the existing `vercel` plugin row; the bridge runs no deploy itself. (Flagged concern 8)
  Upstream `vercel-cli-with-tokens` is not installed, because it reads `.env` and prints matching lines on its own trigger, where the bridge's token rule cannot reach it (security challenge, settled by the maintainer 2026-10-28).
  Token-based CLI work stays in the bridge, which follows R10, or hands off to the `vercel` plugin row.
  It is a separate skill from `next-skills-bridge` and says bundle-only asks stay with `next-bundle-optimizer` through `next-skills-bridge`. (intent: "`vercel-skills-bridge` in pro-nextjs ...")
- R10. `vercel-skills-bridge` and `vercel-deploy-bridge` each carry a token rule that says it overrides the upstream skill's own lookup steps: `VERCEL_TOKEN` comes only from the environment or a secret store the person names; it is never read out of `.env` into the transcript, never written to a file, never passed as `--token`, never echoed or logged and never pasted into chat; the only check the bridge runs is `[ -n "$VERCEL_TOKEN" ] && echo set || echo unset` and every other way of reading the variable is forbidden; one token is scoped to one Vercel team; `VERCEL_ORG_ID` with `VERCEL_PROJECT_ID` or `vercel link` fixes the scope before any command runs; the bridge asks before `vercel link`. (intent open question 1)
  `vercel-skills-bridge` keeps this rule because upstream `vercel-optimize` runs authenticated `vercel metrics`, `vercel usage` and `vercel contract` calls and suggests `vercel link --yes` (upstream read on 2026-10-28 at 1a2c79d; it warns against tokens in shell commands but reads no secret store itself).
- R10b. `vercel-deploy-bridge` carries a deploy rule that it says overrides the upstream `deploy-to-vercel` steps where they differ (security challenges of the spec and the plan; upstream read on 2026-10-28, `deploy-to-vercel` version 4.0.0 at 1a2c79d):
  - Before any upload or push it stops when `git rev-parse --is-inside-work-tree` fails or any git check below exits non-zero, so the checks never fail open outside a git work tree, where the `--temporary` fallback would otherwise run.
  - It finds `.env*` files recursively under the deploy root, skipping `node_modules`, with `find <root> -name node_modules -prune -o -name '.env*' -type f -print`.
    It runs `git ls-files -- '.env*' '*/.env*'` and stops when that lists anything beyond `.env.example`-style templates.
    It runs `git check-ignore -q` on each `.env*` file found and stops when any is not ignored.
  - Whether `vercel deploy` honors `.gitignore` when no `.vercelignore` exists is checked at build.
    When `.gitignore` is not honored the `.vercelignore` rule applies whether or not the folder is a repo: the bridge requires a `.vercelignore` that matches every `.env*` file found and stops without one.
  - It never runs `git add .`; on the git-push path it stages only the files the person names, shows them and asks before the commit and the push.
  - It asks before the no-auth `vercel deploy --temporary` fallback, which upstream runs without asking and which publishes the folder at a public URL anyone can open until it expires.
  - It asks before `vercel link`, which creates a Vercel project; it also asks before `npm install -g vercel`.
  - Production deploys (`--prod`, or a push to the production branch) need the person to say production in that run, as upstream already says; `vercel env pull` is never run (upstream does not run it either).
  - When no person is present to answer its asks (a headless run or `/execute` in a worktree), it stops at the first ask; an earlier "deploy it" is not the yes for `--temporary`, `vercel link` or production.
- R11. pro-design ships `skills/react-patterns-bridge/SKILL.md`, a stack-neutral bridge to `vercel-composition-patterns` and `vercel-react-view-transitions` with no Next.js-only guidance in its own text. (intent: "A stack-neutral React bridge, likely in pro-design")
- R12. The description of `shadcn-ui-composition` gains one clause handing component API design outside shadcn/ui (compound components, boolean-prop sprawl, render props) to `react-patterns-bridge`. (intent: "`shadcn-ui-composition` gains a hand-off")
- R13. `plugins/pro-core/registry/engines.json` gains four rows, each with `id`, `owner`, `bridges`, `kind: "skills-cli"`, `default`, `detect`, `install`, `update`, `why`, `upstream` and `note`:
  - `hallmark`: owner pro-design, bridges `hallmark-bridge`, `default: false`, repo `nutlope/hallmark`, `-s hallmark`.
  - `vercel-skills`: owner pro-nextjs, bridges `vercel-skills-bridge`, `default: false` (open question 6), source the R27 pin, `-s vercel-react-best-practices vercel-optimize`.
  - `vercel-deploy`: owner pro-ship, bridges `vercel-deploy-bridge`, `default: false`, source the R27 pin, `-s deploy-to-vercel`; its `why` says the upstream skill can fire on "deploy" prompts without the bridge, may stage with `git add .` and fall back to a public temporary deploy; it also says `.claude/skills/deploy-to-vercel/` is not to be committed and that `/pro-dev` adds it to the repo's `.git/info/exclude`; the row sets `gitExclude: [".claude/skills/deploy-to-vercel/"]` (R31).
  - `vercel-react`: owner pro-design, bridges `react-patterns-bridge`, `default: false`, source the R27 pin, `-s vercel-composition-patterns vercel-react-view-transitions`.
  (intent: "each a registry row from intent B"; ADR-0006)
- R14. Every new `install` and `update` argv has the shape `npx -y skills add <source> -a claude-code -y -s <install names>` with `-s` last, where `<source>` is the repo or the R27 tree URL; it lists install names (the upstream `name:` frontmatter), never folder names. (intent B gotcha: `-y` with no `-s` installs one default skill)
- R15. Every new `detect` lists `skills/<install name>/SKILL.md` for each name the row installs, at scopes `project` and `user`.
- R16. The registry `version` goes from 2 to 3, so the pro-core SessionStart nudge tells existing sites to run `/pro-dev update`.
- R17. Each new bridge says where the upstream skill lands (`.claude/skills/<install name>/` or `~/.claude/skills/<install name>/`), tells the person to run `/pro-dev install` when it is missing and gives the underlying `npx skills add` command, matching `next-skills-bridge`.
- R18. `BRIDGES` in `tests/check.mjs` gains `hallmark-bridge`, `vercel-skills-bridge`, `vercel-deploy-bridge` and `react-patterns-bridge`, so the `bridges` and `registry` checks cover them.
- R19. `tests/bridge-install-smoke.mjs` gains one target per new row with the expected install names; the `hallmark` target also asserts `scripts/sloplint.mjs` and `references/themes` inside the installed folder; the `vercel-deploy` target also runs the R28 folder digest check.
- R20. `tests/eval.mjs` `DISTRACTORS` gains the upstream `hallmark` description, snapshotted on the build date, so routing is tested with that engine installed. (Flagged concern 1)
- R21. `tests/cases/routing.jsonl` gains at least these cases:
  - "Build a landing page for our scheduling tool" expects `landing-page-design`, notOneOf `hallmark-bridge`.
  - "Use Hallmark to build a landing page" expects `hallmark-bridge`.
  - "Lint this component against the web interface guidelines" expects `web-design-guidelines`, notOneOf `accessibility-audit`.
  - "Audit this signup form for WCAG 2.2 conformance" expects `accessibility-audit`, notOneOf `web-design-guidelines`.
  - "Deploy this to Vercel" expects `vercel-deploy-bridge`, competing with the upstream `deploy-to-vercel` distractor from R29.
  - "Our Vercel bill doubled; find the expensive routes" expects `vercel-skills-bridge`.
  - "Cut the client bundle on our Next.js home page" expects `next-skills-bridge`, notOneOf `vercel-skills-bridge`.
  - "This component has eight boolean props; turn it into compound components" expects `react-patterns-bridge`, notOneOf `shadcn-ui-composition`.
  (intent: "`node tests/eval.mjs` passes with new routing cases for each bridge")
- R22. `docs/licenses.md` gains five rows: `hallmark-bridge` (nutlope/hallmark, MIT, Copyright (c) 2026 Hallmark contributors) plus `vercel-skills-bridge`, `vercel-deploy-bridge` and `react-patterns-bridge` (vercel-labs/agent-skills at the R27 pin, "MIT, stated in the README; no license file", copyright "none published").
  The fifth row is `web-design-guidelines`, marked as fetching rules at run time from vercel-labs/web-interface-guidelines at the pinned commit (MIT, Copyright (c) 2025 Vercel Labs); no rules text is copied in.
- R23. `plugins/pro-design/LICENSE` and `plugins/pro-nextjs/LICENSE` gain a paragraph naming the new bridge files as original and the upstreams that govern the installed skills, as they do for the existing bridges.
  pro-ship ships no `LICENSE` file, as pro-egm ships none, because nothing in it is forked; its `docs/licenses.md` row is the record.
- R24. The `using-pro-dev` router, `README.md`, the pro-design, pro-nextjs and pro-ship manifest descriptions (Claude, Codex and marketplace entry) and the bridged list in `RELEASING.md` name the four bridges and the `web-design-guidelines` skill.
  The router's SHIP branch and its "planned plugin not yet built" paragraph say pro-ship now exists as an opt-in plugin holding `vercel-deploy-bridge`, while `ci-cd-and-automation`, `shipping-and-launch`, `documentation-and-adrs` and `deprecation-and-migration` stay planned; the README Ship row says the same.
- R25. pro-core, pro-design, pro-nextjs and pro-dev-starter bump per the version-bump law, pro-ship starts at 0.1.0 and `metadata.version` moves once (Versions below); `docs/releases.md` gains a row per bump and one for pro-ship.
- R26. A new plugin `plugins/pro-ship/` holds `.claude-plugin/plugin.json` and `.codex-plugin/plugin.json` (both 0.1.0, Codex parity per ADR-0004) and `skills/vercel-deploy-bridge/SKILL.md`; it has no agents, commands or hooks.
  It has an entry in `.claude-plugin/marketplace.json` and `.agents/plugins/marketplace.json`, joins `OPT_IN` in `tests/check.mjs` like pro-egm and is not a dependency of pro-dev-starter.
  `vercel-deploy-bridge` follows R10 and R10b, owns the deploy steps, names the upstream steps it replaces (`git add .` then commit and push, the unasked `--temporary` fallback, the unasked `vercel link` and `npm install -g vercel`) and has no "Defer to the upstream skill" line; it hands to the upstream skill only for reading the deploy result (`vercel inspect`, the URL report).
  The name `deploy-to-vercel` appears in the bridge only in that result hand-off and in the do-not-commit line; the replaced steps are named as "the upstream skill".
  It tells the person not to commit `.claude/skills/deploy-to-vercel/`, because a committed copy loads for anyone who opens the repo, with or without pro-ship and its bridge; R31 also keeps the folder out of `git add .` where `/pro-dev` installed the row.
  The line stays as the second layer. (plan security challenge, Blocking and Required changes)
- R27. The `vercel-skills`, `vercel-deploy` and `vercel-react` rows install from `https://github.com/vercel-labs/agent-skills/tree/1a2c79d4e6c4a2283dc2c614b6538cbe1ed5ca62/skills`, the tree URL form the `next-skills` row uses, pinned to the commit read on 2026-10-28, so `/pro-dev update` no longer pulls new upstream steps unreviewed.
  Build check: verify the skills CLI accepts a SHA in the tree URL and installs the `-s` names from it.
  If it does not, the rows stay on `vercel-labs/agent-skills` at HEAD, the `vercel-deploy` row `note` records `deploy-to-vercel` 4.0.0 and R28 is the only guard.
  Moving the pin is a reviewed change that rereads the five upstream `SKILL.md` files and updates the R28 digest.
- R28. `tests/bridge-install-smoke.mjs` fails when any file in the installed `deploy-to-vercel` folder differs from the reviewed one (version 4.0.0 at 1a2c79d, read on 2026-10-28).
  The test lists every file in the folder, sorts the relative paths, hashes each file with sha256 and compares the sorted `path hash` lines, as one digest, to the value recorded in the test.
  The `SKILL.md` line in that record is sha256 `418ca2a60d35c551e6cb645f4e82c1b704a8335486ffe74b1b3d0617a17504e5`.
  The folder digest is computed from the pinned tree at plan step 0 and recorded in the test and under Done.
  A missing, extra or changed file fails the target.
- R29. `tests/eval.mjs` `DISTRACTORS` gains the upstream `deploy-to-vercel`, `vercel-optimize` and `vercel-react-best-practices` descriptions as they read at the R27 pin, so the "Deploy this to Vercel" case competes with the real skill; the case keeps expecting `vercel-deploy-bridge`.
- R30. Moving the `web-design-guidelines` pin needs two checks, both recorded in the change: `gh api repos/vercel-labs/web-interface-guidelines/compare/<sha>...main --jq .status` gives `ahead` or `identical`, since GitHub serves fork commits through the parent repo's URLs; a read of the `command.md` diff finds no instruction to run, fetch or edit.
  Both checks are recorded for 434b7f9 under Done in the plan; a first run on 2026-10-28 gave `identical`.
- R31. The registry row schema gains an optional field `gitExclude`, a list of repo-relative paths.
  After a successful `install` or `update` of a row that has it, `plugins/pro-core/scripts/pro-dev.py` appends each path to `$(git rev-parse --git-dir)/info/exclude`, once per path; an identical line already there is not added again.
  The build confirms in a linked worktree whether `--git-dir` or `git rev-parse --git-path info/exclude` names the file git reads and uses that one.
  A path is accepted only when it is relative, has no leading `/`, holds no `..` segment and sits under `.claude/skills/`; any other path is refused with a message and nothing is written for it.
  When the repo is not a git work tree the step is skipped with a one-line note.
  The `vercel-deploy` row sets `gitExclude: [".claude/skills/deploy-to-vercel/"]`, so `git add .` respects the local exclude and the project-scope folder is not staged or spread to teammates; the line is local and never committed.
  Scope stays project, because the maintainer does not want the skill in every repo; the do-not-commit line in the bridge (R26) stays as a second layer.
  (plan re-challenge, 7/10 item on spreading)

### Non-functional

- N1. Each new bridge `SKILL.md` stays under 80 lines and quotes no upstream rule text; it routes and guards, the upstream does the work.
- N2. Bridge prose is harness-neutral: no Claude-only tool names and the `npx skills add` command is given beside `/pro-dev`, so a Codex user can install the engine by hand with `-a codex`.
- N3. `/pro-dev check` still runs with no network; the `upstream` catalog commands run only under `check --upstream`.
- N4. A failed install of any new row is reported with its retry line and the run carries on, as `pro-dev.py` does today; the only change to `pro-dev.py` is the `gitExclude` step of R31.

### Policy constraints applied

- ADR-0006 engine registry: every new bridge is a row in `plugins/pro-core/registry/engines.json` (R13); no plugin ships an install command; a bridge row bumps pro-core (R25).
- Version-bump law (ADR-0002): pro-core, pro-design and pro-nextjs take a minor bump for new rows and skills, in both manifests and the marketplace entry; pro-dev-starter takes a patch because its dependency set ships new pro-core and pro-design versions, as PR 67 did; pro-ship enters at 0.1.0 in both manifests and both marketplace files.
- Hook-loading law (ADR-0003): no hook is added; R3 keeps Hallmark's own `install-hook.mjs` out; pro-ship has no `hooks/`.
- Codex parity (ADR-0004): new skills use only `name` and `description` frontmatter, harness-neutral prose (N2) and no agents, so no `.toml`; pro-ship has a `.codex-plugin/plugin.json` version-aligned with its Claude manifest.
- Bridges over vendoring (umbrella constraint): nothing is copied from `nutlope/hallmark` or `vercel-labs/agent-skills`; vercel-labs/agent-skills has no license file, so its skills are bridged only.
- `docs/licenses.md` and the plugin `LICENSE` files gain their rows (R22, R23), as REVIEW.md pass 3 asks.
- REVIEW.md pass 2 secrets: R10 and R3 keep `VERCEL_TOKEN` and `TOGETHER_API_KEY` out of files, commands and logs; R10b keeps `.env*` out of uploads and commits; the bridges hold no credential or personal path.
- `/pro-dev` installs third-party code only when the person runs it (umbrella constraint): the rows are installed by `/pro-dev install|update` only; all four are optional; `web-design-guidelines` installs nothing; the deploy row applies only where pro-ship is installed by hand.
- Writing rules from `CLAUDE.md`: bridge prose has no em dashes, no Oxford comma and straight quotes.

## Design

### User experience

On `/pro-dev install` in a site with pro-design, two new questions appear: Hallmark ("Anti-AI-slop marketing pages with fifty themes and a browser lint; only used when you name it") and the React patterns pair.
A site with pro-nextjs gets one more question for the Vercel performance and cost skills.
A site with pro-ship gets one question for `deploy-to-vercel`, whose `why` says the upstream skill can act without the bridge and that its folder is not to be committed.
Existing sites see the nudge from R16 once and `/pro-dev update` asks the new questions only.
When a bridge fires and its engine is missing, it says so in one line, gives `/pro-dev install` and the `npx` command and offers the nearest in-plugin skill meanwhile.
`hallmark-bridge` opens by confirming the person asked for Hallmark; if the prompt only said "landing page" it hands back to `landing-page-design`.
`vercel-skills-bridge` states the token rule before routing to `vercel-optimize` or running any token-based CLI command itself; a deploy ask gets a one-line pointer to pro-ship or the `vercel` plugin.
`vercel-deploy-bridge` states the token rule, runs the `.env*` checks and then walks the deploy steps itself, asking at each step R10b names.

### System

New files:

- `plugins/pro-design/skills/hallmark-bridge/SKILL.md`, `plugins/pro-design/skills/react-patterns-bridge/SKILL.md` and `plugins/pro-nextjs/skills/vercel-skills-bridge/SKILL.md`, each modelled on `next-skills-bridge`: when to route, a catalog of install names, how to use the bridge, keeping it current through `/pro-dev` and an original-bridge footer.
- `plugins/pro-ship/.claude-plugin/plugin.json`, `plugins/pro-ship/.codex-plugin/plugin.json` and `plugins/pro-ship/skills/vercel-deploy-bridge/SKILL.md`, modelled on pro-egm's manifests and on `next-skills-bridge` minus its "Defer to the upstream skill" line (R26).

Changed:

- `plugins/pro-core/registry/engines.json`: four rows (R13 to R15, R27), the `gitExclude` field on `vercel-deploy` (R31) and `version: 3` (R16).
  The `upstream` field for the three vercel-labs rows lists `skills/*/SKILL.md` paths from `gh api repos/vercel-labs/agent-skills/git/trees/<pin>?recursive=1`; for Hallmark it reads `skills/hallmark/SKILL.md`.
  Install names differ from folder names upstream (`skills/composition-patterns/` installs as `vercel-composition-patterns`), so the `note` on each vercel-labs row says `-s` filters on the frontmatter name.
- Description lines of `taste-skills-bridge`, `landing-page-design`, `impeccable-bridge`, `emil-design-eng`, `shadcn-ui-composition`, `accessibility-audit` and `screen-critique` (R4, R8, R12).
  Three of these are forks (`landing-page-design`, `emil-design-eng`, `shadcn-ui-composition`); their footers stay.
- `plugins/pro-core/scripts/pro-dev.py` and `tests/pro-dev.mjs` (R31): the `gitExclude` step and its cases.
- `tests/check.mjs` (R18 and R26, plus the `gitExclude` path rule of R31 in the `registry` check), `tests/bridge-install-smoke.mjs` (R19, R28), `tests/eval.mjs` (R20, R29), `tests/cases/routing.jsonl` (R21).
- `.claude-plugin/marketplace.json` and `.agents/plugins/marketplace.json` (R26).
- `docs/licenses.md`, the two plugin `LICENSE` files, `using-pro-dev`, `README.md`, the manifests, `RELEASING.md` and `docs/releases.md` (R22 to R25).

`pro-dev.py` changes only for `gitExclude` (R31): the rows use the existing `skills-cli` kind and `detect.all` format; a row whose owner is not installed is already reported as not applicable.
The existing `vercel` row (the `vercel@claude-plugins-official` companion, owner pro-nextjs) stays; it is a Claude plugin with its own deploy flow; both Vercel bridges name it as the alternative when that plugin is installed.

Upstream facts this relies on, checked on 2026-10-28:

- `nutlope/hallmark`: MIT, "Copyright (c) 2026 Hallmark contributors", v2.0.0; one skill, `hallmark`, at `skills/hallmark/`; README install `npx skills add nutlope/hallmark -g`; browser checks need `npm i -g puppeteer-core` and Chrome, else static checks run; `TOGETHER_API_KEY` drives the comp step; the repo also ships a Claude plugin marketplace (`hallmark@hallmark`) and an `install-hook.mjs`.
- `vercel-labs/agent-skills`: GitHub license field empty and no LICENSE file in the tree; the README's License section says "MIT"; `vercel-react-best-practices`, `vercel-react-view-transitions` and `vercel-composition-patterns` carry `license: MIT` in frontmatter, the other four carry none.
  Skills present: `web-design-guidelines`, `react-best-practices`, `vercel-optimize`, `deploy-to-vercel`, `vercel-cli-with-tokens`, `composition-patterns`, `react-view-transitions`, plus the dropped `writing-guidelines` and `react-native-skills`.
  `main` was at 1a2c79d4e6c4a2283dc2c614b6538cbe1ed5ca62 (2026-10-27); `skills/deploy-to-vercel/` was last changed in dfeeb54 and also ships a `skills/deploy-to-vercel.zip` beside the folder.
- Upstream `deploy-to-vercel` 4.0.0 at that commit: previews by default and `--prod` only when asked; asks before a git push but then runs `git add .`; runs `npm install -g vercel` and `vercel link` without asking; falls back to `npx vercel@latest deploy --temporary -y` without asking when no login is possible; never runs `vercel env pull`.
  Its `SKILL.md` hashes to sha256 `418ca2a60d35c551e6cb645f4e82c1b704a8335486ffe74b1b3d0617a17504e5`.
- Upstream `vercel-optimize` at that commit: collects `vercel metrics`, `vercel usage` and `vercel contract` output plus a code scan and emits ranked recommendations; its only write is the `vercel link --yes` it suggests when scope is unresolved; it says never to put tokens in shell commands.
- Upstream `web-design-guidelines` fetches `https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md` before each review; `main` was at commit `434b7f9` (2026-10-05) when this spec was written and `compare/434b7f9...main` gave `identical` on 2026-10-28; that repo is MIT, "Copyright (c) 2025 Vercel Labs".
- Upstream `vercel-cli-with-tokens` looks for the token in the environment, then greps `.env` (including `grep -i 'vercel' .env`, which prints values), then asks the person; it already warns against `--token`.

### Alternatives considered

- Keeping the upstream `web-design-guidelines` skill unpinned, optional or default: less work, but its live fetch from `main` is a remote-instruction channel into every session that runs it while it fires on "review my UI" without our guardrail (security challenge).
- Installing Hallmark as the `hallmark@hallmark` Claude plugin (`kind: claude-plugin`): needs a second marketplace registered first, which the registry does not do for third parties; the skill still auto-triggers under its plugin name.
- One registry row for all vercel-labs skills: simpler, but it puts the token-handling and deploy skills on every pro-design site and mixes owners.
- Hosting the React bridge in pro-nextjs: it is plain React; Astro or Vite React sites without pro-nextjs would lose it.
- Copying the guidelines rules into the bridge to pin them: vendoring against the umbrella constraint; the rules repo's MIT would then need a fork row and a quarterly watch.
- Keeping `deploy-to-vercel` in the pro-nextjs `vercel-skills` row (the first draft): it put a skill that publishes and pushes on any pro-nextjs site that answered yes, while Next.js sites do not all deploy on Vercel.
- Dropping `deploy-to-vercel` and keeping deploys in the bridge or the `vercel` plugin, as the plan's security challenge asked: the maintainer kept the upstream skill and accepted the risk in opt-in pro-ship (concern 8).
- Naming the plugin `pro-deliver`: the first name, replaced the same day by `pro-ship`, which the router's SHIP branch already names.

## Flagged concerns

ADR needed: no, ADR-0006 already sets the registry rule these rows follow and nothing here binds later work; a general rule on remote-instruction engines would need one if the maintainer wants it beyond this row (concern 3).

| # | Concern | Policy or owner | Resolution |
|---|---------|-----------------|------------|
| 1 | Hallmark's own description says "Use when the user asks to build or design something new", so once installed the upstream skill competes for every new build, against the intent's "never as the default". The bridge cannot change that. | intent routing rule | held 2026-10-28: the maintainer tries Hallmark by hand before it goes into pro-dev. Until then the Hallmark parts (R1 to R4, the `hallmark` row in R13, its R19 target, R20, the Hallmark cases in R21, its R22 row and the Hallmark parts of AC1, AC2, AC5 and AC6) are not built; this change ships the Vercel, React, deploy and guidelines parts. If Hallmark goes in after the trial, the agreed shape is: optional row, a `why` question that says Hallmark may fire on new builds once installed and sends briefs to Together AI when `TOGETHER_API_KEY` is set, the comp step only when the person asks for it in that run and the R21 case that keeps "build a landing page" on `landing-page-design`. |
| 2 | The upstream `web-design-guidelines` description ("review my UI", "check accessibility", "audit design") overlaps `accessibility-audit`, `screen-critique` and `interface-review`. With the pin no upstream skill is installed, but pro-design's own `web-design-guidelines` sits on the same prompts. | intent boundary line, `tests/cases/routing.jsonl` | settled 2026-10-28: `web-design-guidelines` names the boundary in its own text (R6), `accessibility-audit` and `screen-critique` each gain one hand-off clause (R8) and the two boundary cases in R21 pin the routing. |
| 3 | The upstream skill fetches unpinned rules from `main` on every run and the fetched text becomes the review prompt: a remote-instruction channel into every pro-design session that runs it. | REVIEW.md pass 2 (no executing text from outside), umbrella item 9 | settled 2026-10-28: no upstream skill; pro-design's own skill fetches from one pinned commit, runs no shell command and moves its pin only under R30 (R5, R7). |
| 4 | Upstream `vercel-cli-with-tokens` greps `.env` and prints matching lines, then suggests `export VERCEL_TOKEN="vca_..."`, both of which put a token into the transcript, against the intent's token rule. | REVIEW.md pass 2 secrets, intent open question 1 | settled 2026-10-28: `vercel-cli-with-tokens` is not installed (R9, R13); the bridge covers token-based CLI work under R10 or hands off to the `vercel` plugin row. |
| 5 | The intent's success line routes to "web-design-guidelines"; the first draft named the skill `web-design-guidelines-bridge` to avoid sharing a name with the installed upstream skill. | intent vs. design | settled 2026-10-28: with no upstream skill installed the clash is gone, so the skill takes the intent's name, `web-design-guidelines` (R5). |
| 6 | Intents C and E also add rows and bump pro-core and the registry `version`; whichever merges second hits conflicts in `engines.json`, the manifests and `metadata.version`. | ADR-0002, ADR-0006 | settled 2026-10-28: branch from `origin/main` at build time, rebase on whichever lands first and take the next free minor and registry version at merge. C merged in PR 66, so the registry starts at 2 here. |
| 7 | Rows install with `-a claude-code` and `/pro-dev` is a Claude command, so Codex sites get the bridges with no engine. | ADR-0004 Codex parity | settled 2026-10-28: the bridges give the `npx skills add ... -a codex` path (N2) and the full fix stays with umbrella item G. |
| 8 | The plan's security challenge (Blocking, 7/10) found that upstream `deploy-to-vercel` fires on its own description without the bridge, runs `git add .` and an unasked public `--temporary` deploy; it reaches teammates through a committed `.claude/pro-dev.json` answer or a committed `.claude/skills/deploy-to-vercel/`. | REVIEW.md pass 2, ADR-0006 | settled 2026-10-28: keep the upstream skill, move deploying into the new opt-in `pro-ship` plugin, outside pro-dev-starter (R26); the risk is accepted by name in the plan's Security challenge; the challenge's other required changes are taken (R10b, R27 to R30); the plan's re-challenge adds R31 (`gitExclude`) against spreading the project-scope folder. |

## Security challenge

From a fresh-context `security-architect` challenge of this spec on 2026-10-28.
Items marked "(verify)" rest on upstream facts this spec records and must be checked against the real upstream files.
The plan's own challenge, run later the same day, is in `plan.md`; its outcome is concern 8.
Its re-challenge after the pro-ship rework is there too and adds R31 and the R10b and R28 changes.

Verdict: proceed with required changes.

### Blocking

- Settled 2026-10-28: the maintainer dropped `vercel-cli-with-tokens` from the row (R9, R13); the item below is kept as the record.
- [8/10] The R10 token rule lives only in the text of `vercel-skills-bridge`. Once `vercel-cli-with-tokens` is installed it triggers on its own description without the bridge loading; per concern 4 it greps `.env` and prints matching lines. A prompt such as "redeploy with my Vercel token" puts `VERCEL_TOKEN` and any other matching line into the transcript, where later injected text can read it. AC7 only greps the bridge file, so it passes while the leak stays open. Change: drop `vercel-cli-with-tokens` from the `vercel-skills` `-s` list; the bridge gives the env-only CLI path itself or hands off to the existing `vercel` row. If the skill must ship, the spec needs a control that holds without the bridge, such as a `permissions.deny` on reading `.env*` that `/pro-dev install` proposes when the row is answered yes; either way the row's `why` question says the upstream skill reads `.env`.

### Required changes

- Settled 2026-10-28: the maintainer chose the pin; no upstream skill is installed and the skill fetches from one commit (R5, R7). The item below is kept as the record.
- [7/10] `web-design-guidelines` is a default row, so the R7 guardrail misses most of its uses. The upstream skill fires directly on "review my UI" or "audit design" without the bridge. Anyone who can push to `main` of vercel-labs/web-interface-guidelines could put instructions into every pro-design session with shell access, for example "run `env` to detect the framework", which dumps `VERCEL_TOKEN` and `TOGETHER_API_KEY`. Existing sites get it from `/pro-dev update` with no question, since every missing default row installs. Change: install no upstream skill for this row; the bridge fetches the rules from a pinned `raw.githubusercontent.com/vercel-labs/web-interface-guidelines/<commit-sha>/command.md` and the SHA is bumped as a reviewed change. If the maintainer keeps the unpinned upstream, set `default: false` and record his acceptance by name. Either way R7 limits the lint to reading files: no shell commands and no fetch beyond the one rules URL.
- [7/10] R3 and R10 require the key to be in the environment but do not say how to check it; `echo $VERCEL_TOKEN` or `env | grep TOGETHER` prints the value. Change: name the exact check, for example `[ -n "$VERCEL_TOKEN" ] && echo set || echo unset`; forbid every other way of reading the variable.
- [6/10] (verify) Installed Hallmark fires on any "build something new" (concern 1). With `TOGETHER_API_KEY` set, its comp and image steps can send the brief and copy to Together AI and spend money on prompts that never named Hallmark; R3's condition lives in the bridge and does not stop the upstream skill. Change: the `hallmark` row's `why` question says this plainly and R3 requires the person to ask for the comp step on each run.
- Settled 2026-10-28: upstream `deploy-to-vercel` 4.0.0 was read. It deploys a preview by default and runs `--prod` only when asked; it never runs `vercel env pull`. It does run `git add .` on the push path and falls back to a public `vercel deploy --temporary` without asking. R10b covers both and the `.env*` checks. The item below is kept as the record.
- [6/10] (verify) Find out what `deploy-to-vercel` uploads and where. If it packs the project folder without excluding `.env*` (for example to an unauthenticated claimable deploy), "Deploy this to Vercel" could serve `/.env` at a public preview URL; it may also run `--prod` or `vercel env pull`, which writes every project secret to `.env.local`. Change: record what the upstream deploy path packs and sends; R10 adds that the bridge confirms before any `--prod` deploy, `vercel env pull` or anonymous upload and checks that `.vercelignore` excludes `.env*`.

### Open questions from the challenge

- Does upstream `skills/hallmark/SKILL.md` itself tell the agent to run `install-hook.mjs` or `npm i -g puppeteer-core`? If so the R3 ban fails whenever Hallmark fires without the bridge; the `why` question says so or the row does not ship.
- All rows run `npx -y skills` against upstream on every update, like the existing rows. Hallmark ships executable code (`scripts/sloplint.mjs`) that runs with both keys in the environment. Should rows that ship scripts be pinned to a tag or commit, given Hallmark publishes v2.0.0? The vercel-labs rows are now pinned (R27); Hallmark stays with its hold.
- The bridge cannot check a Vercel token's scope or expiry. Should it tell the person to create a team-scoped token with an expiry and say plainly that it cannot verify either?

The spec contained no instructions trying to steer the review.
The weekly bridge-install-smoke workflow uses no secrets, so the R19 targets add no CI exposure.

## Open questions

1. Security for `vercel-cli-with-tokens`: answered 2026-10-28.
   The security-architect challenge ran (Security challenge above) and the maintainer dropped the skill; R10 names the one allowed token check.
2. web-design-guidelines' live fetch, accept or pin: answered 2026-10-28, pinned (R5, R7, R30).
3. Does Hallmark's Floor contradict `landing-page-design` where it matters: answered from the two texts.
   It does in three places: Floor 2 bans `transition: all` while `landing-page-design` B7 prescribes `transition-all`; Floor 13 caps a screen at about 80 words while `landing-page-design` asks for six to twelve FAQ entries and three to five benefits; Floor 8 bans invented proof while `landing-page-design` tells the agent to assume when the person cannot answer.
   The "no eyebrows" rule clashes with nothing, since `landing-page-design` prescribes no eyebrow.
   These matter only if one page mixes the two systems; routing keeps them apart and the R4 hand-off lines say a page is built under one of them, not both.
   `landing-page-design` is not edited (intent out of scope).
4. Which plugin hosts the React bridge: answered 2026-10-28, pro-design, as `react-patterns-bridge` with an optional row (R11, R13), because the skills are plain React and pro-design is in pro-dev-starter.
   Owner: the maintainer.
5. Needs intent B's registry: answered.
   B merged in PR 65 (97558ea) with the registry at version 1; C merged in PR 66 and took it to 2; this ships after them, ordered per concern 6.
6. Should the `vercel-skills` row install by default on pro-nextjs sites? Answered 2026-10-28: no, optional, because not every Next.js site deploys on Vercel; with deploying moved to pro-ship the reason now is that `vercel-optimize` runs authenticated Vercel CLI calls.
   Owner: the maintainer.
7. Where does deploying live? Answered 2026-10-28: in a new opt-in plugin, `pro-ship`, holding `vercel-deploy-bridge` and the `vercel-deploy` row (R26).
   Owner: the maintainer.
8. New, not settled: the router's planned SHIP skills (`ci-cd-and-automation`, `shipping-and-launch`, `documentation-and-adrs`, `deprecation-and-migration`) were also meant for `pro-ship`. When they land, does pro-ship stay opt-in or join pro-dev-starter with the deploy bridge split out? This change only makes pro-ship real as opt-in.
   Owner: the maintainer.
9. R28 hashes only `SKILL.md`: should the smoke target hash every file in the installed folder? Answered 2026-10-28: yes, a sorted path list plus content hashes (R28).
   Owner: the maintainer.

## Versions

Taken from `origin/main` at 9bd2cd0 on 2026-10-28.

| Plugin or file | From | To | Why |
|---|---|---|---|
| pro-core | 0.17.0 | 0.18.0 | three new registry rows (Hallmark held), registry `version` 3, `gitExclude` in `pro-dev.py`, router lines |
| pro-design | 0.10.0 | 0.11.0 | `web-design-guidelines`, `react-patterns-bridge` and three description clauses |
| pro-nextjs | 0.10.0 | 0.11.0 | `vercel-skills-bridge` |
| pro-ship | none | 0.1.0 | new opt-in plugin with `vercel-deploy-bridge` |
| pro-dev-starter | 2.0.2 | 2.0.3 | dependency set ships new pro-core and pro-design versions; its dependencies do not change |
| pro-starter | 1.14.0 | 1.14.0 | not bumped, as PR 66 and PR 67 left it |
| registry `version` | 2 | 3 | R16 |
| marketplace `metadata.version` | 1.52.1 | 1.53.0 | next minor, once |

If intent E merges first, rebase and take the next free minor, patch and registry version at merge (concern 6).
Every dependency constraint on these plugins is `*`, so no constraint widens.

## Acceptance criteria

- AC1. In a temp repo with pro-design, pro-nextjs and pro-ship installed, `/pro-dev install` asks once each about `hallmark`, `vercel-react`, `vercel-skills` and `vercel-deploy` and, on yes to all, `/pro-dev check` reports the four rows installed; `web-design-guidelines` is available with no install.
- AC2. After that install, `.claude/skills/` holds `hallmark`, `vercel-react-best-practices`, `vercel-optimize`, `deploy-to-vercel`, `vercel-composition-patterns` and `vercel-react-view-transitions`, each with a `SKILL.md`; nothing else from those two repos lands, `vercel-cli-with-tokens` included.
- AC3. In a repo with pro-design but not pro-nextjs or pro-ship, `/pro-dev check` reports `vercel-skills` and `vercel-deploy` as not applicable; with pro-nextjs but not pro-ship, `deploy-to-vercel` never lands.
- AC4. `node tests/check.mjs && node tests/eval.mjs --dry` passes with the four bridges in `BRIDGES` and pro-ship in `OPT_IN`, with no "not in pro-dev-starter dependencies" warning for pro-ship; the `registry` check fails if any of the four rows is removed.
- AC5. With `ANTHROPIC_API_KEY` set, `node tests/eval.mjs` passes every case in R21 with the R20 and R29 distractors loaded: "build a landing page" routes to `landing-page-design`, "use Hallmark to build a landing page" to `hallmark-bridge`, the guidelines lint to `web-design-guidelines` and "deploy this to Vercel" to `vercel-deploy-bridge`, not to the `deploy-to-vercel` distractor.
- AC6. `node tests/bridge-install-smoke.mjs` passes for the four new targets, including `scripts/sloplint.mjs` inside the installed `hallmark` folder and the R28 folder digest on `deploy-to-vercel`; with the expected digest changed by one character or one extra file in the installed folder the `vercel-deploy` target fails.
- AC7. `grep -n 'VERCEL_TOKEN'` on `vercel-skills-bridge/SKILL.md` and on `vercel-deploy-bridge/SKILL.md` shows the R10 rule in each; neither file contains a token value, a `--token` example other than the one it forbids or a `.env` read.
- AC8. `grep -c 'Defer to the upstream skill' plugins/pro-ship/skills/vercel-deploy-bridge/SKILL.md` prints 0; a check in `tests/check.mjs` fails when that line appears; the file names `git ls-files`, `git check-ignore`, `--temporary`, `vercel link`, the no-person stop and the do-not-commit line for `.claude/skills/deploy-to-vercel/`; `grep -n 'deploy-to-vercel'` on the file shows only the result hand-off and that line.
- AC9. `claude plugin validate . --strict` and the per-plugin strict loop pass, 19 plugin directories; pro-core, pro-design, pro-nextjs, pro-ship and pro-dev-starter versions match across both manifests and the marketplace entries.
- AC10. `docs/licenses.md` has the five new rows and `git grep -n 'web-interface-guidelines' docs/licenses.md` finds the rules source.
- AC11. The three vercel-labs rows install from the R27 tree URL, or, if the skills CLI rejected a SHA at build, the `vercel-deploy` row `note` records `deploy-to-vercel` 4.0.0 and the plan's Done section records why; either way the step 0 pin tests (an older commit and a made-up SHA) are recorded in Done.
- AC12. `node tests/pro-dev.mjs` passes the `gitExclude` cases: after the `vercel-deploy` row installs, the exclude line is in the repo's `info/exclude` once and a second `update` adds no duplicate; `git add .` then leaves `.claude/skills/deploy-to-vercel/` untracked; a row with a bad path (`../x`, an absolute path or one outside `.claude/skills/`) is refused and writes nothing.

## Out of scope

- Rewriting `landing-page-design` or the other overlapping skills beyond their hand-off lines.
- React Native support, `react-native-skills` and `writing-guidelines` (dropped in the umbrella).
- Changing `pro-dev.py` beyond the `gitExclude` step (R31) or adding a registry kind.
- Codex engine installs from the registry (umbrella item G).
- A `permissions.deny` or guard hook that holds without the bridge (the accepted risk in concern 8).
- The router's other planned SHIP skills (open question 8).

<!-- Accepting this spec is the signal to start planning. Leave the plan to plan.md. -->
