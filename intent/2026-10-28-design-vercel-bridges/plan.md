# Plan: web-design-guidelines, Vercel skill bridges and pro-ship

Built from `spec.md` (reworked twice 2026-10-28) and `intent.md` in this folder.
Status: draft.
Approver: Jody Brewster, because the change carries a secrets rule (`VERCEL_TOKEN`), adds a plugin that deploys and accepts a named risk, so it does not suit auto mode.
Dated: 2026-10-28.
Reworked 2026-10-28 after Jody kept upstream `deploy-to-vercel` and moved deploying into a new opt-in plugin, `pro-ship`; the security challenge below records the outcome.
Reworked a second time 2026-10-28 after the re-challenge of that rework; its answers are in the Security challenge section and applied in steps 0, 4, 5, 5b and 8.

## Scope of this plan

Hallmark is held per spec Flagged concern 1 until Jody has tried it by hand.
This plan builds none of it: not R1 to R4, not the `hallmark` row in R13, not its R19 smoke target, not R20, not the two Hallmark cases in R21, not its R22 row and not the Hallmark parts of AC1, AC2, AC5 and AC6.
No file in this plan names `hallmark-bridge`, so the `taste-skills-bridge`, `landing-page-design`, `impeccable-bridge` and `emil-design-eng` descriptions are not touched.
What ships: the `web-design-guidelines` skill and the `react-patterns-bridge` skill in pro-design, the `vercel-skills-bridge` skill in pro-nextjs, the new opt-in pro-ship plugin with `vercel-deploy-bridge`, three registry rows with a new optional `gitExclude` field (R31) and the tests, docs and bumps they need.

`web-design-guidelines` is a normal pro-design skill.
It installs nothing, has no registry row and is not in `BRIDGES`.
It fetches its rules at run time from the pinned commit 434b7f91364665f2f733b310ec54809bf8f37937 of vercel-labs/web-interface-guidelines (`command.md`, checked on 2026-10-28: the commit exists, is dated 2026-10-05, the file is 8055 bytes and `compare/434b7f9...main` gave `identical`).

The three vercel-labs rows install from `https://github.com/vercel-labs/agent-skills/tree/1a2c79d4e6c4a2283dc2c614b6538cbe1ed5ca62/skills` (R27), the `main` commit read on 2026-10-28.
At that commit `skills/deploy-to-vercel/SKILL.md` is version 4.0.0 with sha256 `418ca2a60d35c551e6cb645f4e82c1b704a8335486ffe74b1b3d0617a17504e5` (R28).
Step 0 computes the folder digest R28 checks.

Versions are taken from `origin/main` at 9bd2cd0, where pro-egm 0.1.1 merged as 1.52.1.
The registry is at `version: 2`, so R16 takes it to 3.
Bumps: pro-core 0.17.0 to 0.18.0, pro-design 0.10.0 to 0.11.0, pro-nextjs 0.10.0 to 0.11.0, pro-dev-starter 2.0.2 to 2.0.3, pro-ship new at 0.1.0 and `metadata.version` 1.52.1 to 1.53.0.
pro-starter stays at 1.14.0, as PR 66 and PR 67 left it.
pro-dev-starter's dependency list does not change; pro-ship is not in it.
If intent E merges first, rebase and take the next free minor, patch and registry version at merge (spec concern 6).
Every dependency constraint on these plugins is `*`, so no constraint widens.

## Files that change

New:

- `plugins/pro-design/skills/web-design-guidelines/SKILL.md` (new): R5 to R7, the `file:line` lint against Vercel's Web Interface Guidelines with its boundary, the pinned fetch and the R30 pin-move rule.
- `plugins/pro-design/skills/react-patterns-bridge/SKILL.md` (new): R11 and R17, the stack-neutral bridge to `vercel-composition-patterns` and `vercel-react-view-transitions`, modelled on `next-skills-bridge`.
- `plugins/pro-nextjs/skills/vercel-skills-bridge/SKILL.md` (new): R9, R10 and R17, the bridge to `vercel-react-best-practices` and `vercel-optimize` with the token rule and a deploy hand-off to pro-ship or the `vercel` plugin.
- `plugins/pro-ship/.claude-plugin/plugin.json` and `plugins/pro-ship/.codex-plugin/plugin.json` (new): both 0.1.0, no dependencies, the Codex one with `"skills": "./skills/"` as pro-egm's has (R26).
- `plugins/pro-ship/skills/vercel-deploy-bridge/SKILL.md` (new): R10, R10b, R17 and R26, the bridge that owns the deploy steps.

Modified:

- `plugins/pro-core/registry/engines.json` (modified): rows `vercel-skills` (owner pro-nextjs), `vercel-deploy` (owner pro-ship) and `vercel-react` (owner pro-design), all `kind: "skills-cli"` and `default: false`, per R13 to R15 and R27; `version` 2 to 3 per R16; `vercel-deploy` also sets `gitExclude: [".claude/skills/deploy-to-vercel/"]` per R31.
- `plugins/pro-core/scripts/pro-dev.py` (modified): after a successful install or update of a row with `gitExclude`, check each path (relative, no `..`, under `.claude/skills/`) and append it once to the repo's `info/exclude` (R31).
- `tests/pro-dev.mjs` (modified): cases for the exclude line added once, `git add .` leaving the folder untracked and a bad path refused (R31).
- `plugins/pro-design/skills/accessibility-audit/SKILL.md` and `plugins/pro-design/skills/screen-critique/SKILL.md` (modified): one description clause each handing a guidelines lint of UI code to `web-design-guidelines` (R8).
- `plugins/pro-design/skills/shadcn-ui-composition/SKILL.md` (modified): one description clause handing component API design outside shadcn/ui to `react-patterns-bridge` (R12); the fork footer stays.
- `plugins/pro-core/skills/using-pro-dev/SKILL.md` (modified): router lines and bridge list entries for the three bridges and the lint skill; the SHIP branch names `vercel-deploy-bridge (pro-ship, opt-in, bridge: /pro-dev install)` and the "planned plugin not yet built" paragraph says pro-ship exists with only the deploy bridge (R24).
- `tests/check.mjs` (modified): `BRIDGES` gains `vercel-skills-bridge`, `vercel-deploy-bridge` and `react-patterns-bridge` (R18); `OPT_IN` gains `pro-ship` (R26); `checks.bridges` fails when `vercel-deploy-bridge/SKILL.md` contains "Defer to the upstream skill" (R26, AC8); the `registry` check validates `gitExclude` paths (R31).
- `tests/bridge-install-smoke.mjs` (modified): targets for `vercel-skills`, `vercel-deploy` and `vercel-react` with their install names and the pinned source, a folder digest assertion (sorted path list plus content hashes of every file) on the installed `deploy-to-vercel` folder and the header comment's target list (R19, R28).
- `tests/eval.mjs` (modified): `DISTRACTORS` gains the upstream `deploy-to-vercel`, `vercel-optimize` and `vercel-react-best-practices` descriptions at the pin (R29).
- `tests/cases/routing.jsonl` (modified): the six non-Hallmark cases of R21.
- `.claude-plugin/marketplace.json` (modified): a pro-ship entry, the four bumped entries, the two changed descriptions and `metadata.version` (R25, R26).
- `.agents/plugins/marketplace.json` (modified): a pro-ship entry in pro-egm's shape (R26).
- `docs/licenses.md` (modified): four rows, `vercel-skills-bridge`, `vercel-deploy-bridge`, `react-patterns-bridge` and `web-design-guidelines`, with a line saying these were read on 2026-10-28 at the pins (R22).
- `plugins/pro-design/LICENSE` and `plugins/pro-nextjs/LICENSE` (modified): a paragraph naming the new files as original and the upstreams that govern what they install or fetch (R23); pro-ship gets no `LICENSE`.
- `README.md` (modified): the pro-design and pro-nextjs entries, a pro-ship entry marked opt-in, the Ship row (`vercel-deploy-bridge` in `pro-ship` *(opt-in)*, the other four still planned), the Build row and the repo tree (R24).
- `RELEASING.md` (modified): the bridged list in the upstream watch section, with the R27 and R30 pin-move checks (R24).
- `CLAUDE.md` and `AGENTS.md` (modified): the expected output counts in "Verifying your work" (cases, catalog, distractors and 19 plugin directories), as PR 66 did.
- `plugins/pro-core`, `plugins/pro-design`, `plugins/pro-nextjs` and `plugins/pro-dev-starter` `.claude-plugin/plugin.json` plus the `.codex-plugin/plugin.json` of each that has one (modified): versions, plus the description for pro-design and pro-nextjs (R24, R25).
- `docs/releases.md` (modified): a row per bump, a first-release row for pro-ship and the marketplace version line (R25).

Not touched: any hook, any `.toml` (no agents), `plugins/pro-starter` and the WIP in `plugins/pro-ai-sdlc/commands/`.

## Order of work

0. Branch from `origin/main` in a worktree; confirm registry `version: 2`, pro-core 0.17.0, pro-design 0.10.0, pro-nextjs 0.10.0, pro-dev-starter 2.0.2 and `metadata.version` 1.52.1; take the next free numbers if intent E has landed.
   Build checks before any row is written, each recorded under Done:
   - Pin test, in three temp dirs, because `main` is at the pinned commit today and a CLI that ignores the ref would pass a test run only at the pin.
     First, find the older commit with `gh api repos/vercel-labs/agent-skills/commits/dfeeb54 --jq '.parents[0].sha'` and confirm `skills/deploy-to-vercel/SKILL.md` differs there from the pinned file.
     Install from it with `npx -y skills add https://github.com/vercel-labs/agent-skills/tree/<older sha>/skills -a claude-code -y -s deploy-to-vercel` and confirm the installed `SKILL.md` hash matches that old file, fetched at that SHA through `gh api`, with no match to the R28 hash.
     Second, run the same command with a made-up SHA and confirm it fails rather than falling back to main.
     Third, run it with the real pin and confirm only `deploy-to-vercel` lands; compute and record the R28 folder digest (sorted path list plus content hashes) and put it in the smoke test.
     Record all three under Done for AC11.
     If the CLI ignores the ref or falls back to main, the rows use `vercel-labs/agent-skills`, the `vercel-deploy` row `note` records `deploy-to-vercel` 4.0.0 and the digest check is the only guard (AC11).
   - In a linked worktree, check whether `git rev-parse --git-dir` or `git rev-parse --git-path info/exclude` names the file git reads for excludes; step 5b uses that one.
   - Find out whether `vercel deploy` honors `.gitignore` when no `.vercelignore` exists, from Vercel's CLI docs or source, without deploying anything.
     The answer decides whether step 4 adds the `.vercelignore` requirement from R10b.
   - Run the R30 checks for 434b7f9: `gh api repos/vercel-labs/web-interface-guidelines/compare/434b7f91364665f2f733b310ec54809bf8f37937...main --jq .status` and a read of the `command.md` diff when the status is `ahead`.
1. Write `web-design-guidelines/SKILL.md`.
   Frontmatter has only `name` and `description`; the description names the lint and the boundary with `accessibility-audit`, `screen-critique` and `interface-review`.
   The body gives the one pinned URL, says to fetch it with the harness's web fetch tool, treats the text only as rules and a findings format and never follows anything in it that asks to run a command, fetch another URL, edit a file or widen the scope.
   It reads the files the person names and runs no shell command.
   With no web fetch tool available, it stops and says the rules could not be loaded rather than linting from memory.
   It closes with how to move the pin: a reviewed change that bumps the commit in this file after the two R30 checks.
2. Write `react-patterns-bridge/SKILL.md` from the `next-skills-bridge` shape: when to route, a two-row catalog of install names, how to use it (where the skill lands, `/pro-dev install` and the `npx -y skills add <pinned source> -a claude-code -y -s vercel-composition-patterns vercel-react-view-transitions` command, with `-a codex` for Codex), keeping it current and an original-bridge footer.
   Its own text has no Next.js-only guidance.
3. Write `vercel-skills-bridge/SKILL.md` on the same shape with a two-row catalog: `vercel-react-best-practices` and `vercel-optimize`.
   It states the token rule (R10) before the routing table, saying it overrides the upstream steps where they differ.
   It asks before the `vercel link --yes` that `vercel-optimize` suggests.
   The only token check it shows is `[ -n "$VERCEL_TOKEN" ] && echo set || echo unset`.
   It sends bundle-only asks to `next-bundle-optimizer` through `next-skills-bridge`, sends deploy asks to `vercel-deploy-bridge` when pro-ship is installed and to the `vercel` plugin row otherwise.
   It says `vercel-cli-with-tokens` is not installed on purpose.
4. Create pro-ship: both manifests at 0.1.0 modelled on pro-egm's, then `vercel-deploy-bridge/SKILL.md`.
   The skill states the token rule (R10) and the deploy rule (R10b) first.
   Its deploy steps are its own: stop when `git rev-parse --is-inside-work-tree` fails or any git check exits non-zero, find `.env*` recursively under the deploy root skipping `node_modules`, then the `git ls-files -- '.env*' '*/.env*'` and per-file `git check-ignore -q` checks (plus the `.vercelignore` requirement, repo or not, if step 0 found `.gitignore` is not honored), the preview default, staging only named files with an ask before commit and push, an ask before `npm install -g vercel`, `vercel link` and `--temporary`, production only when said in that run and never `vercel env pull`.
   A short section names the upstream steps it replaces (`git add .` then commit and push, the unasked `--temporary` fallback, the unasked `vercel link` and `npm install -g vercel`); there is no "Defer to the upstream skill" line and the only hand-off to upstream is for reading the deploy result.
   It names the replaced steps as "the upstream skill", so `deploy-to-vercel` appears in the file only in the result hand-off and the do-not-commit line.
   It stops at the first ask when no person is present and says an earlier "deploy it" is not the yes for `--temporary`, `vercel link` or production.
   It tells the person not to commit `.claude/skills/deploy-to-vercel/`, as a second layer behind `gitExclude`.
   It names the `vercel` plugin row as the alternative when that plugin is installed.
   In the same step add pro-ship to both marketplace files and to `OPT_IN`; add the "Defer to the upstream skill" rule to `checks.bridges`.
5. Add the three registry rows and set `version: 3`.
   Each row follows the `next-skills` row's tree-URL source with the `garden` row's `-s` filter: `install` and `update` are `["npx", "-y", "skills", "add", "<pinned tree URL>", "-a", "claude-code", "-y", "-s", ...]` with the install names last; `detect.all` lists `skills/<install name>/SKILL.md` at `project` and `user`; `upstream` is the `gh api ... git/trees/<pin>?recursive=1` listing of `skills/*/SKILL.md`; `note` says `-s` filters on the frontmatter name, folder names differ (`composition-patterns` installs as `vercel-composition-patterns`) and moving the pin rereads the `SKILL.md` files and updates the R28 hash.
   The `vercel-skills` `why` says it adds React performance and Vercel cost tuning and that `vercel-optimize` runs authenticated Vercel CLI calls.
   The `vercel-deploy` `why` says `deploy-to-vercel` can fire on "deploy" prompts without the bridge, may stage with `git add .` and can fall back to a public temporary deploy; the bridge's rules apply only when the bridge loads; `.claude/skills/deploy-to-vercel/` is not to be committed.
   The `vercel-deploy` row also sets `gitExclude: [".claude/skills/deploy-to-vercel/"]`, which step 5b reads.
   In the same step add the three slugs to `BRIDGES` in `tests/check.mjs`.
5b. Add `gitExclude` support to `pro-dev.py` (R31): after a successful install or update of a row that has the field, check each path (relative, no leading `/`, no `..`, under `.claude/skills/`), refuse a bad one with a message and write nothing for it, then append each good path once to the exclude file step 0 chose.
   Skip the step with a one-line note when the repo is not a git work tree.
   Add the three cases to `tests/pro-dev.mjs` and the path rule to the `registry` check in `tests/check.mjs`.
6. Add the description clauses to `accessibility-audit`, `screen-critique` and `shadcn-ui-composition`.
   One clause each; no other line in those files changes.
7. Add the three R29 distractors to `tests/eval.mjs`, copied from the `SKILL.md` frontmatter at the pin, then the six R21 cases to `tests/cases/routing.jsonl`: the guidelines lint, the WCAG audit, "Deploy this to Vercel" expecting `vercel-deploy-bridge`, the Vercel bill, the Next.js client bundle and the eight boolean props.
8. Add the `vercel-skills`, `vercel-deploy` and `vercel-react` targets to `tests/bridge-install-smoke.mjs` and its header list, with the R28 folder digest check on the `vercel-deploy` target.
9. Update the router, `README.md`, `RELEASING.md`, `CLAUDE.md`, `AGENTS.md`, `docs/licenses.md` and both plugin `LICENSE` files.
   Router lines put the bridge slug after the arrow and keep upstream install names out of arrow position, so the router check needs no new `EXTERNAL` entries; if an install name does land after an arrow, add it to `EXTERNAL` in `tests/check.mjs`.
   The four planned SHIP skills stay in `PLANNED`.
10. Bump versions in both manifests and the marketplace entry for pro-core, pro-design, pro-nextjs and pro-dev-starter, update the two plugin descriptions in all three places, set `metadata.version` and add the release rows, pro-ship's included.
11. Run Proof of done, then the install check in a temp repo per `docs/install-test.md` for AC1 to AC3 (non-Hallmark parts).

Step 0's build checks run first because steps 4, 5 and 8 depend on their answers.
Steps 1, 2, 3 and 4 touch separate new files and can run in parallel subagents or worktrees, except that step 4's marketplace and `OPT_IN` edits wait for step 10's slot if they collide.
Step 6 can run beside them; it touches only pro-design description lines.
Step 5b touches only `pro-dev.py`, `tests/pro-dev.mjs` and `tests/check.mjs`, so it can run beside step 5 and must land before step 11.
Step 5 waits for 2, 3 and 4, because the `registry` check fails on a row whose bridge slug is not a skill yet or whose owner is not a plugin.
Steps 7 and 8 wait for 1 to 6, since the eval resolves case targets against real skills.
Step 9 can run beside 7 and 8.
Step 10 runs last and alone, because the manifests, the marketplace files and `docs/releases.md` are where parallel branches collide.

## Tests that prove it

- Step 0: the older-commit install matches the old file's hash and not the R28 hash, the made-up SHA fails with no fallback to main; the pinned install lists exactly `deploy-to-vercel` with the R28 `SKILL.md` hash.
  The compare status is `identical` or `ahead` with the diff read.
- Step 1: `node tests/check.mjs` passes frontmatter and Codex parity for the new skill; `grep -c 'https://' plugins/pro-design/skills/web-design-guidelines/SKILL.md` shows the pinned URL is the only one; `grep -n '/main/'` on the file finds nothing; `wc -l` is under 80.
- Step 2: `node tests/check.mjs` passes; `wc -l` under 80; `grep -n -i 'next'` on the file finds at most the hand-off sentence.
- Step 3: `grep -n 'VERCEL_TOKEN' plugins/pro-nextjs/skills/vercel-skills-bridge/SKILL.md` shows the R10 rule; `grep -n -e '--token' -e '\.env'` on the file shows only the forbidding lines; `grep -n 'deploy-to-vercel'` shows only the hand-off; `wc -l` under 80.
- Step 4: `node tests/check.mjs` passes manifests, Codex parity and the starter check with no warning for pro-ship; `grep -c 'Defer to the upstream skill' plugins/pro-ship/skills/vercel-deploy-bridge/SKILL.md` prints 0; in a scratch copy, adding that line makes `check.mjs` fail; `grep -n -e 'git ls-files' -e 'check-ignore' -e 'is-inside-work-tree' -e '--temporary' -e 'vercel link' -e 'VERCEL_TOKEN' -e '.claude/skills/deploy-to-vercel'` on the file finds each rule; `grep -n 'deploy-to-vercel'` on the file shows only the result hand-off and the do-not-commit line; `wc -l` under 80.
- Step 5: `node tests/check.mjs` passes `bridges` and `registry`; AC4's negative half: in a scratch copy of the worktree, delete the `vercel-deploy` row with a one-line `node -e` edit and see `bridge vercel-deploy-bridge has no row in engines.json`, then throw the copy away.
- Step 5b: `node tests/pro-dev.mjs` passes the three new cases: the exclude line is added once and a second run adds no duplicate; `git add .` leaves `.claude/skills/deploy-to-vercel/` untracked; a bad path (`../x`, absolute, outside `.claude/skills/`) is refused with nothing written.
- Step 6: `node tests/check.mjs` passes and `git diff` shows one changed description line per file.
- Step 7: `node tests/eval.mjs --dry` reports 79 cases with no unknown skill and 7 distractors; the live `node tests/eval.mjs` passes every case (AC5, non-Hallmark part), "Deploy this to Vercel" included with `deploy-to-vercel` in the catalog.
- Step 8: `node tests/bridge-install-smoke.mjs` passes for the three new targets (AC6, non-Hallmark part) with no extra install names, `vercel-cli-with-tokens` included; with the expected digest edited by one character, or an extra file dropped into the installed folder, in a scratch copy the `vercel-deploy` target fails.
- Step 9: `node tests/check.mjs` passes the `router` check; `git grep -n 'web-interface-guidelines' docs/licenses.md` finds the rules source (AC10).
- Step 10: `node tests/check.mjs` passes the version-bump checks; `claude plugin validate . --strict` and the per-plugin loop pass over 19 plugin directories (AC9).
- Step 11: in a temp repo with pro-design, pro-nextjs and pro-ship installed, `/pro-dev install` asks once each about `vercel-react`, `vercel-skills` and `vercel-deploy`; on yes, `python3 plugins/pro-core/scripts/pro-dev.py --repo <temp repo> status` reports all three installed and `.claude/skills/` holds exactly the five install names (AC1, AC2) and `git add -n .` does not list `.claude/skills/deploy-to-vercel/` (R31); in a repo with pro-design but not pro-nextjs or pro-ship it reports `vercel-skills` and `vercel-deploy` as not applicable; with pro-nextjs but not pro-ship `deploy-to-vercel` never lands (AC3).

## Risks

The step most likely to go wrong is step 7, the live routing run.
"Deploy this to Vercel" now competes with three skills: `vercel-deploy-bridge`, the upstream `deploy-to-vercel` distractor and `astro-on-vercel` ("deploys to Vercel").
The upstream description lists "deploy my app" and "push this live" word for word, so it may win; the fix is in the bridge description, which names Vercel deploys with the guardrails and says it runs the deploy steps itself.
If the distractor still wins, that is direct evidence for the accepted risk below and goes to Jody before merge rather than into a weaker case.
"Cut the client bundle on our Next.js home page" overlaps what `vercel-react-best-practices` covers, now also present as a distractor, so `vercel-skills-bridge` or the distractor may take it; the bridge description hands bundle-only asks to `next-skills-bridge`.
A wrong description could also pull existing cases away from `accessibility-audit`, `screen-critique` or `shadcn-ui-composition`, so the whole suite is rerun, not only the new cases.

The highest-stakes step is step 4.
A gap in the token or deploy rule can put `VERCEL_TOKEN` into the transcript, stage `.env` with a commit or publish a folder at a public URL.
Upstream `deploy-to-vercel` stays installed wherever pro-ship's row is answered yes and can fire without the bridge; that risk is accepted by Jody (Security challenge, Accepted risks).
The `why` question, `gitExclude` and the do-not-commit line narrow who it reaches; nothing in this plan stops it once a prompt routes straight to the upstream skill in a repo where someone installed it by hand.

Step 0's SHA check can fail if the skills CLI only takes branch names in a tree URL.
The fallback (HEAD source, version in the `note`, the R28 digest as the only guard) still makes the weekly smoke run fail when upstream changes the deploy steps, but `/pro-dev update` would install the changed skill before anyone sees that run.

`gitExclude` is the first registry field that makes `pro-dev.py` write inside `.git`.
A bad path or a wrong git dir could write the wrong file, so step 5b checks the path rule before any write, appends only to the exclude file and the test covers a refused path.
In a linked worktree `--git-dir` may not be where git reads excludes; step 0 settles which command to use.

Making pro-ship real changes the router's SHIP branch, which named pro-ship as a planned plugin for four other skills.
If the paragraph is edited badly the `router` check can pass while the text claims skills exist that do not; step 9 keeps those four in `PLANNED` and the router text says they are still planned.

Registry `version: 3` makes the pro-core SessionStart nudge fire once on every existing site, which is intended.
A malformed row breaks `/pro-dev install` for every site after the next update, which is why step 5 is checked by `check.mjs` and step 11 runs the real install.
The skills CLI could install a folder named after the upstream folder rather than the install name; `detect` would then never see the engine and `/pro-dev` would ask again on every run.
Step 8's smoke test catches that before merge.

Nothing here is irreversible: no migration, no hook and no data; a bad release is reverted by a patch bump.

Left out on purpose:

- Every Hallmark part, held per spec Flagged concern 1.
- A sentence telling the person to make a team-scoped token with an expiry and that the bridge cannot check either: an open question from the spec's security challenge that the spec did not settle.
- A `permissions.deny` on `.env*` reads or a guard hook when `vercel-deploy` is answered yes: needs a hook or a guard in `pro-dev.py` beyond `gitExclude`, which the spec puts out of scope; the risk is accepted instead.
- The router's other planned SHIP skills (spec open question 8).
- The umbrella intent's item status: recorded in a separate docs PR, as item F was in PR 64.

## Options not taken

- Building the Hallmark parts now behind `default: false`: Jody held them until his trial (spec concern 1).
- One registry row for all five vercel-labs skills: mixes owners and puts the deploy skill on every pro-design site (spec Alternatives).
- Keeping `deploy-to-vercel` in pro-nextjs's `vercel-skills` row (the previous draft of this plan): Jody moved it to opt-in pro-ship.
- Dropping `deploy-to-vercel` from every row, as the challenge's Blocking item asked: Jody kept it (Accepted risks).
- A generic pro-core warning against committing `.claude/skills/<install name>/` for every row: replaced by the narrower `gitExclude` field on the `vercel-deploy` row (R31), with the bridge and the row's `why` as the second layer.
- Moving `deploy-to-vercel` to user scope so no repo holds it: Jody does not want the skill in every repo, so project scope stays.
- Pinning only the `vercel-deploy` row: the three vercel-labs rows share one source, so one pin and one reviewed move cover all of them.
- Letting `web-design-guidelines` fall back to `curl` on a harness with no web fetch tool: R7 forbids shell commands in the lint.
- Naming upstream install names after arrows in the router and widening `EXTERNAL`: more allowlist entries to keep in sync for no routing gain.

## Proof of done

Run from the worktree root.

```bash
# 1. Static checks, the routing dry run and Codex parity
node tests/check.mjs && node tests/eval.mjs --dry && node tests/pro-dev.mjs

# 2. Strict validation, marketplace then every plugin
claude plugin validate . --strict
( for p in plugins/*/; do claude plugin validate "${p%/}" --strict || exit 1; done )

# 3. Live routing (the key is MIERUKA_ANTHROPIC_API_KEY in the environment)
ANTHROPIC_API_KEY="$MIERUKA_ANTHROPIC_API_KEY" node tests/eval.mjs

# 4. Real installs of the three new rows, with the deploy-to-vercel hash (network)
node tests/bridge-install-smoke.mjs

# 5. Spot checks for AC7, AC8, AC10 and N1
grep -n 'VERCEL_TOKEN' plugins/pro-nextjs/skills/vercel-skills-bridge/SKILL.md plugins/pro-ship/skills/vercel-deploy-bridge/SKILL.md
grep -c 'Defer to the upstream skill' plugins/pro-ship/skills/vercel-deploy-bridge/SKILL.md
git grep -n 'web-interface-guidelines' docs/licenses.md
wc -l plugins/pro-design/skills/web-design-guidelines/SKILL.md plugins/pro-design/skills/react-patterns-bridge/SKILL.md plugins/pro-nextjs/skills/vercel-skills-bridge/SKILL.md plugins/pro-ship/skills/vercel-deploy-bridge/SKILL.md
```

Finished means:

- Step 1 prints `0 failures` with at most the 39 warnings of the baseline run on 2026-10-28 (26 checks) and then `✓ 79 cases reference real skills · 93 skills in catalog + 7 distractors`.
- Step 2 prints `✔ Validation passed` once, then once per plugin directory, 19 times.
- Step 3 reports every case passing, the six new ones included.
- Step 4 ends `✓ 8 target(s) checked · 0 failed` with no `installed but not in the bridge catalog` line for the three new targets and no digest mismatch; a network skip is not a pass.
- Step 5 shows the R10 rule lines in both Vercel bridges, `0` for the defer line, at least one licenses row and four files each under 80 lines.
- The step 0 build checks and the step 11 install check are recorded under Done.

## Security challenge

From a fresh-context `security-architect` challenge of `plan.md` on 2026-10-28, run with Opus at high effort, against the draft that kept `deploy-to-vercel` in pro-nextjs.
It covers what the plan adds or leaves open; the spec's challenge still stands.
Items marked "(verify)" rest on upstream or tool behavior not read for this review.

Verdict: proceed with required changes, once Jody settles the blocking item before steps 3 and 4.
Outcome 2026-10-28: Jody settled the blocking item by keeping the skill in opt-in pro-ship (Accepted risks); every required change below that applies when the skill stays is taken.

### Blocking

- Settled 2026-10-28 (Jody): `deploy-to-vercel` stays, moved into the new opt-in pro-ship plugin outside pro-dev-starter; the risk is recorded under Accepted risks and the item below is kept as the record.
- [7/10] The plan's only control for upstream `deploy-to-vercel` firing without the bridge is the `vercel-skills` `why` question, which never reaches the people most exposed.
  `.claude/pro-dev.json` is committed by design (ADR-0006) and `engine_state` in `pro-dev.py` sets `wantsInstall` for any optional row whose saved answer is `yes`.
  So a PR that adds that answer, or a teammate in a repo that already holds it, gets the skill from the next `/pro-dev update` with no question and no `why`.
  The install lands in project `.claude/skills/deploy-to-vercel/`; once committed it loads for anyone who opens the repo, including sessions without pro-nextjs and no bridge.
  There "deploy this" matches the upstream description, which runs `git add .` and, with no Vercel login, an unasked `vercel deploy --temporary` that publishes the folder at a public URL.
  Change: drop `deploy-to-vercel` from the `-s` list for the same reason `vercel-cli-with-tokens` was dropped; the bridge owns the deploy steps under R10b or hands off to the `vercel` plugin row.
  If Jody keeps the skill, record his acceptance by name under Accepted risks and take the eval and ignore-check changes below.

### Required changes

- Taken (R29, step 7). [8/10] Only if `deploy-to-vercel` stays: add the upstream `deploy-to-vercel`, `vercel-optimize` and `vercel-react-best-practices` descriptions to `DISTRACTORS` in `tests/eval.mjs`, so the "Deploy this to Vercel" case competes with the real skill.
- Taken (R27, R28, steps 0, 5 and 8). [7/10] Every `/pro-dev update` reruns `npx -y skills add vercel-labs/agent-skills` at HEAD, so upstream can change the steps R10b overrides with no review. Pin the row to a commit with the tree URL form the `next-skills` row uses (verify the CLI takes a SHA); moving the pin is a reviewed change that rereads the `SKILL.md` files. If not pinned, record `deploy-to-vercel` 4.0.0 in the row `note` and make `tests/bridge-install-smoke.mjs` fail when the installed `SKILL.md` stops matching the reviewed sha256.
  This plan does both: the pin and the hash check.
- Taken (R26, step 4). [7/10] Step 3 copies the `next-skills-bridge` shape, whose "Defer to the upstream skill" line would tell the agent to run upstream's `git add .` right after R10b forbade it. In `vercel-skills-bridge` the deploy steps are the bridge's own, the section names the upstream steps it replaces and the step 3 test greps that "Defer to the upstream skill" is absent.
  The deploy steps now live in `vercel-deploy-bridge` and the grep is also a `check.mjs` rule.
- Taken (R10b, steps 0 and 4). [7/10] R10b checks the text of `.gitignore` and `.vercelignore`, which misses a `.env` that is already tracked and a pattern that does not match (`.env` alone leaves `.env.local`). The check is `git ls-files -- '.env*' '*/.env*'` returning nothing beyond `.env.example`-style templates plus `git check-ignore -q` passing for each `.env*` file present; stop on either. Verify whether `vercel deploy` honors `.gitignore` with no `.vercelignore`; if not, require a `.vercelignore` matching every `.env*` file.
- Taken (R30, step 0, Done). [6/10] (verify) GitHub serves commits pushed to any fork through the parent repo's URLs, so "the commit exists" does not prove vercel-labs published it. Moving the `web-design-guidelines` pin requires `gh api repos/vercel-labs/web-interface-guidelines/compare/<sha>...main --jq .status` to give `ahead` or `identical` and a read of the `command.md` diff for any instruction to run, fetch or edit; record both checks for 434b7f9 under Done.
  A first run on 2026-10-28 gave `identical`.

### Accepted risks

- Upstream `deploy-to-vercel` stays installed in pro-ship sites and can fire without the bridge, running `git add .` and an unprompted public `--temporary` deploy (Jody, 2026-10-28, decided to keep it in opt-in pro-ship).
  The spread path through a committed `.claude/skills/deploy-to-vercel/` is closed by `gitExclude` (R31) for repos where `/pro-dev` installed the row, since `install` and `update` add the folder to the repo's local `.git/info/exclude` and `git add .` respects it.
  It stays open only if someone installs the skill by hand.

### Open questions from the challenge

- Does `vercel-optimize` only read usage, or does it change project settings with `VERCEL_TOKEN`? Answered from the upstream read on 2026-10-28 at 1a2c79d: it reads `vercel metrics`, `vercel usage` and `vercel contract` output and scans code; its only write is the `vercel link --yes` it suggests, which `vercel-skills-bridge` asks before (R10, step 3).
- Who answers R10b's asks when no person is present, such as `/execute` in a worktree or a headless run? Answered: the bridge stops at the first ask and says an earlier "deploy it" is not the yes for `--temporary`, `vercel link` or production (R10b, step 4).
- Should `/pro-dev` tell the person not to commit `.claude/skills/<install name>/` for this row, so the skill stays with the person who answered? Answered by the re-challenge: `gitExclude` (R31, step 5b) keeps the folder out of `git add .`, with the bridge and the row's `why` telling the person not to commit it as the second layer (steps 4 and 5).

The challenge found no instructions in the plan trying to steer it.
Nothing in the `vercel-react` row or `react-patterns-bridge` cleared the bar.

### Re-challenge after the pro-ship rework

Verdict: proceed with required changes.
- [8/10] The step 0 pin check cannot fail: `main` is at the pinned commit today, so a skills CLI that ignores the ref passes. Change: in step 0 install from an older commit where `skills/deploy-to-vercel/SKILL.md` differs (the parent of dfeeb54) and confirm the installed hash matches that old file; confirm a made-up SHA fails rather than falling back to main; record both under Done for AC11.
  Answered: taken in step 0 (older commit and made-up SHA tests, plus the real pin) with Done slots for each (spec R27, AC11).
- [7/10] Upstream runs `git add .` itself, so the project-scope `.claude/skills/deploy-to-vercel/` can be committed and spread to teammates without pro-ship, outside the accepted risk.
  Answered: kept at project scope; `gitExclude` (spec R31, step 5b) adds the folder to the local `.git/info/exclude` on `/pro-dev install` and `update`; Accepted risks now says the path stays open only for a hand install.
- [7/10] R10b's `.env*` checks fail open outside a git work tree, where the `--temporary` fallback runs; they also never say how files are found. Change: stop when `git rev-parse --is-inside-work-tree` fails or any git check exits non-zero; find `.env*` recursively under the deploy root skipping `node_modules`; when `.gitignore` is not honored the `.vercelignore` rule applies whether or not the folder is a repo.
  Answered: taken in spec R10b and plan step 4.
- [6/10] Summary says the bridge routes to upstream "for what its own rules leave open", which contradicts R26 and invites an open-ended deferral the grep misses. Change: reword to match R26; the step 4 test checks `deploy-to-vercel` appears in the bridge only in the result hand-off and the do-not-commit line.
  Answered: spec Summary reworded to match R26 and the step 4 test and AC8 extended with that grep.
- Open question [6/10]: R28 hashes only SKILL.md; should the smoke target hash every file in the installed folder?
  Answered: yes, R28 and step 8 hash every file (sorted path list plus content hashes).

## Done

Filled in when the build is finished, before sign-off.

- Build commit:
- Checks run:
- Step 0, pin test from an older commit (parent of dfeeb54; installed `SKILL.md` hash against the old file): pass. The parent is `4f8ed6022d21339a541a9bcd81e0fd921df99cac`; installing from its tree URL gave `SKILL.md` sha256 `3ac2790bccd66964...`, the same as that commit's file through `gh api` and not the pinned `418ca2a60d35c551...`.
- Step 0, pin test with a made-up SHA (must fail, no fallback to main): pass. `0123456789abcdef0123456789abcdef01234567` exited 1 with nothing installed.
- Step 0, pin test at the real pin (only `deploy-to-vercel`; R28 folder digest recorded): pass. Only `deploy-to-vercel` landed, holding one file, `SKILL.md` (`418ca2a60d35c551...`). The R28 folder digest, sha256 of the sorted `<path> <sha256>` lines, is `9e0944ebe282cc1d398899a47a9767d97a7f22cdbeb475ae45e0583e44cb055a`.
- Step 0, linked-worktree exclude path:
- Step 0, `vercel deploy` and `.gitignore`: not honored. `getVercelIgnore` in `vercel/vercel` `packages/client/src/utils/index.ts` reads only `.vercelignore` (or `.nowignore`) plus a built-in list; that list skips `.env.local` and `.env.*.local` but not `.env` or `.env.production`. So the R10b `.vercelignore` requirement applies, repo or not.
- Step 0, R30 for 434b7f9 (compare status and `command.md` diff read): `identical`, so there is no diff to read.
- AC1 (non-Hallmark):
- AC2 (non-Hallmark):
- AC3:
- AC4:
- AC5 (non-Hallmark):
- AC6 (non-Hallmark):
- AC7:
- AC8:
- AC9:
- AC10:
- AC11 (both pin tests):
- AC12:
- Sign-off:

The sign-off moves `status` in the intent and the spec to `accepted`.

## Departures from plan

- Step 4: `deploy-to-vercel` appears in `vercel-deploy-bridge` on three kinds of line, not two: the result hand-off, the do-not-commit line and the Codex `skills add` install command, which has to name it; the `bridges` check allows exactly those.
- Step 7: with the R29 distractors in the live eval, "Our Vercel bill doubled" routed to upstream `vercel-optimize` directly; the case now accepts `vercel-skills-bridge|vercel-optimize`, since the bridge only routes there and `vercel-optimize` itself keeps tokens out of commands. "Deploy this to Vercel" still routes to `vercel-deploy-bridge`.
- Step 8: the smoke run passed the three new targets (the `vercel-deploy` folder digest matched); `taste-skills-bridge` failed with 12 of 13 skills missing, the known upstream drift tracked by intent `2026-10-28-taste-skill-v2`.
