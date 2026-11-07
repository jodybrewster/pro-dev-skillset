# The software factory: a demo script

A fifteen-minute show of the factory on the `factory-demo` repo (https://github.com/jodybrewster/factory-demo): two small intents run with nobody at the keyboard, then a larger one stops for the people who own its gates.
The guide behind it is [factory.md](./factory.md).

## Before the audience arrives

Build a fresh demo with one command; it creates a private repo, the checkout, the roles, CI, a changelog, a `v1.0.0` tag, a protected main, protected release tags, two accepted intents and the local-scope plugins:

```bash
demo/factory/new-demo.sh factory-demo-2 [--owner <gh owner>] [--dir <parent dir>]
```

It refuses a name that exists on GitHub or on disk.
Then, in the new checkout:

```bash
export SDLC="$(ls -d ~/.claude/plugins/cache/pro-dev-skillset/pro-ai-sdlc/*/ | tail -1)"
export ANTHROPIC_API_KEY=...            # or map it from your own variable
cd ~/Projects/factory-demo-2
python3 "$SDLC/scripts/factory.py" roles --repo .
```

The roles print Sam Rivera as product owner, engineer and platform owner, Lee Chen as lead and Pat Okafor as policy owner, all fictional.
Main is protected (pull requests only, admins included) and CI runs `npm test` on every pull request.
Open mieruka on the demo project in a browser tab: Settings, Agents and models, People.

## Act 1: the levels are decided by a script

```bash
for d in intent/*/; do python3 "$SDLC/scripts/factory.py" level "$d" --repo .; done
```

Expected: the small intents print `level: 1 (meets every level 1 rule)`.
Point out that no model chose the level; it can only go up.

## Act 2: a small intent runs with nobody there

```bash
python3 "$SDLC/scripts/factory.py" run --next --repo . --max-cost-usd 10 --allow-broad-token
```

Expected lines, from the live runs:

```
factory: queued intent/2026-01-05-due-dates
factory: brief pr 6
factory: build pr 7
factory: merged af76ac8386da, deploy is yours, unread diff: 118 lines
```

That run took the oldest accepted level 1 intent with nobody touching it and cost $2.56 (https://github.com/jodybrewster/factory-demo/pull/7).

While it runs, show:

- `docker ps`: the session runs in a container on a fresh clone, not in your checkout.
- The brief pull request on GitHub: only `spec.md` and `plan.md`, `Approver: factory, level 1`, `Stop-list categories: none`.
- The build pull request: each step's tests and code in one commit, seen failing first in the session log, every commit carries `Factory-Run: build <folder>`, CI is green.
- `cat .pro-dev/factory/factory-<folder>.json`: status, summary, cost.

The point to make: the session proposed both pull requests; the runner on this machine checked them from its own fetch and did the merges.

## Act 3: the factory stops itself

Open https://github.com/jodybrewster/factory-demo/pull/3, the build for "list tasks sorted by title".
Its commits came from an earlier version of the session that did not tag them with the run's trailer, so the runner refused to merge it and stopped at level 2:

```
factory: stopped level 2 (commits without a Factory-Run: build 2026-11-03-sorted-by-title trailer: ...)
```

The pull request now waits for the engineer, as any level 2 change does.
Review it as Sam Rivera and merge it; that is the human path working.

## Act 4: a larger intent the factory will not touch

Write the larger intent yourself in a Claude Code session in the repo:

```
/intent Tasks get an optional due date and listTasks can filter to overdue tasks. Tests take today's date from an environment variable so they do not depend on the clock.
```

Expected: the report ends `level: 3 (stop-list words in Constraints: environment variable)`, or names `Proposed outcome` when the intent puts the test clock there.
Accept it through a pull request; the runner's `--next` never picks it up.

Then walk the gates:

1. `/spec`: it flags the environment variable; close the concern as Pat Okafor (policy owner) and accept as Sam Rivera (product owner).
2. `/plan`: `Approver:` names Sam Rivera and Lee Chen; set `Status: approved`.
3. `/execute`: it builds test first and pauses at any stop-list step the plan did not consent to.
4. `/review` and `/pr-babysit` until green.
5. Lee Chen merges with `--match-head-commit`; in mieruka, choosing Sam Rivera as "You are" shows the merge waiting for the lead.

## Act 5: mieruka

In mieruka, filter the Floor to `factory-demo`: the cards read `Level 1`; a merged level 1 card shows the run state.
Settings shows People with the five roles and the "Run the factory" toggle, off by default.

## Act 6: the eval

```bash
node tests/e2e-sdlc.mjs --dry
```

Expected: `dry: 3 scenarios, 31 steps, 35 checks, 0 problems, cap $30, nothing spent`.
The live run builds its own throwaway repo and deletes it afterwards; quote the cost before you start it.

## Clean up everything for a retest

A retest starts from nothing; leftovers give misleading results, above all on mieruka's board.
Run `demo/factory/remove-demo.sh <name> [--owner <gh owner>] [--dir <parent dir>] [--delete-image]`.
It follows steps 2 to 5 below, archives the repo instead of deleting it, prints the delete command for you to run and prints each validation.
It refuses unless the checkout's origin is the named repo and it kills no process.
The manual steps are the fallback.
Run these in order, then check each line under Validate.

1. Stop the factory loop (ctrl-c) and any mieruka dev server you started for the demo, by its own process id only:
   ```bash
   lsof -tiTCP:<port> -sTCP:LISTEN    # then kill that pid
   ```
2. Remove the demo's local-scope plugins:
   ```bash
   cd ~/Projects/<demo> && for p in pro-ai-sdlc pro-ship pro-quality pro-security; do claude plugin uninstall "$p@pro-dev-skillset" --scope local; done
   ```
3. Move the local checkout to the Trash (it holds the demo's `.pro-dev/` records and mieruka's `.mieruka/` cards):
   ```bash
   mv ~/Projects/<demo> ~/.Trash/<demo>-$(date +%F)
   ```
4. Delete the GitHub repo yourself; deletion is permanent, so the agent never runs it:
   ```bash
   gh auth refresh -h github.com -s delete_repo    # once, adds the scope
   gh repo delete jodybrewster/<demo> --yes
   ```
   To keep it for reference instead: `gh repo archive jodybrewster/<demo> -y`.
5. Remove the factory images (`docker images pro-dev-factory`, then `docker rmi pro-dev-factory:<tag>`); the next run builds the current one.
6. Pick a new demo name for the retest, so nothing on GitHub or on disk carries over.

Validate:

- `ls ~/Projects | grep <demo>` prints nothing.
- `gh repo view jodybrewster/<demo>` says the repo is not found (or archived, if you kept it).
- `python3 -c "import json,os; print([k for k,v in json.load(open(os.path.expanduser('~/.claude/plugins/installed_plugins.json')))['plugins'].items() for e in v if '<demo>' in e.get('projectPath','')])"` prints `[]`.
- `docker images pro-dev-factory` lists no image older than the plugin version you will test.
- mieruka shows no `<demo>` project.
