# The software factory: a step-by-step guide

The factory runs small changes from an accepted intent to a merged pull request with nobody at the keyboard.
It sends larger ones to the people who own each gate.
It is the pro-ai-sdlc loop plus three things: an escalation level on every intent, a role map in `REVIEW.md` and a runner that works in a container.
Each step below ends with a validation: what to run and what you should see.

Sources: [ADR-0024](./decisions/0024-escalation-levels.md), the intent, spec, plan and security challenge in `intent/2026-11-03-software-factory/`, the AI-native SDLC playbook (https://claude.com/resources/articles/the-ai-native-sdlc-playbook) and the agent-skills baseline in `../agent-skills`.

## The idea in one picture

```
intent.md (accepted by a role)
   |
   |  factory.py level: a script, never a model; only ever raised
   v
level 1 ----> factory.py run (host)
   |            container session 1: /pro-ai-sdlc:auto brief  -> brief PR (spec.md + plan.md)
   |            host: check the brief PR, merge it
   |            container session 2: /pro-ai-sdlc:auto build  -> build PR (/execute, /review)
   |            host: CI green, risk-classify low, tests untouched, no policy files -> merge
   |            record: "merged, deploy is yours"
   |
level 2 ----> the normal loop: /spec, /plan (engineer approves), /execute, merge by the engineer
level 3 ----> level 2 plus the policy owner on flagged concerns and the lead on the plan and the merge
```

The session proposes and the runner decides.
A session can only push a branch and open a pull request; the runner on your machine checks the pull request from its own fetch and does every merge.
Anything unexpected raises the level and stops the run with the reason in the record.
Deploy is always a person's step.

## The levels

| Level | Which changes | Path | People |
|---|---|---|---|
| 1 Auto | risk low, source an idea or an incident, the author is a product owner or engineer, no stop-list word, no new dependency | brief PR and build PR, both merged by the runner | none until deploy |
| 2 Engineer | risk medium, a new dependency, an author outside the role map, a ticket source | the full loop | the engineer approves the plan and the merge |
| 3 Escalated | risk high, or a stop-list word: auth, session, permission, migration, payment, deploy, release, secret, token, credential, env var, personal data, export | the full loop plus the `/execute` stop list | engineer, lead and policy owner |

A stop-list word counts only under `## Proposed outcome`, `## Affected users and systems` or `## Constraints`, the sections that say what the change does.
Under `## Problem`, `## Out of scope` or `## Risk` it is being discussed and does not raise the level.
Code spans, fenced blocks and HTML comments are never read.
The reason names the section, such as `stop-list words in Proposed outcome: deploy, release`.
A reviewer who sees a risky word hidden elsewhere raises `risk:` or the level by hand.

A level only goes up.
`factory.py level` returns the highest of the computed level and every value the field has had on the default branch.
`risk-classify.py` raises it again at merge when the real diff reads medium or high.

## The roles

| Role | Acts at |
|---|---|
| Product owner | accepts the intent, gives final approval to the spec, accepts user-facing changes |
| Engineer | approves the plan, validates, reads review findings, confirms the deploy |
| Lead | co-approves high-risk plans, approves merges at level 3 |
| Policy owner | closes flagged security, data and compliance concerns, signs off skill and hook changes |
| Platform owner | owns hooks, CI and the factory settings |

A solo repo puts one name in every role.

## Step 1: install

```bash
claude plugin marketplace add jodybrewster/pro-dev-skillset
for p in pro-core pro-ai-sdlc pro-ship pro-quality pro-security; do
  claude plugin install "$p@pro-dev-skillset" --scope project
done
```

Validate: `claude plugin list` shows the five plugins enabled, pro-ai-sdlc at 0.14.0 or later.
pro-security is required for level 1: without it the runner cannot read the security surface and stops every build.

## Step 2: set the repo up

In a Claude Code session in the repo run `/pro-dev install`.
It creates `intent/`, `REVIEW.md` and a `## Roles` block with your git name in every role.

Validate:

```bash
python3 "$(ls -d ~/.claude/plugins/cache/pro-dev-skillset/pro-ai-sdlc/*/ | tail -1)scripts/factory.py" roles --repo .
```

You see five lines, one per role.
To name more people, edit the block:

```yaml
roles:
  product_owner: [Sam Rivera]
  engineer: [Sam Rivera]
  lead: [Lee Chen]
  policy_owner: [Pat Okafor]
  platform_owner: [Sam Rivera]
```

The factory reads the block from the default branch, so a change counts once it is merged.

## Step 3: protect the default branch

The runner refuses to start unless the default branch requires a pull request, because the token in the container could otherwise push to it.

```bash
gh api -X PUT repos/<owner>/<repo>/branches/main/protection --input - <<'EOF'
{"required_status_checks": null, "enforce_admins": true,
 "required_pull_request_reviews": {"required_approving_review_count": 0}, "restrictions": null}
EOF
```

Validate: `gh api repos/<owner>/<repo>/branches/main/protection --jq .enforce_admins.enabled` prints `true`.
From now on intents reach main through a pull request too; merging that pull request is how the product owner accepts the intent.
Add a CI workflow that runs the tests on `pull_request`; the runner waits for it before merging.

## Step 4: give the factory a token

Create a fine-grained token for this one repo with Contents and Pull requests set to read and write, plus read access to the marketplace repo while it is private.
Export it as `FACTORY_GH_TOKEN`; export `ANTHROPIC_API_KEY` as well.
For a demo on your own account, `--allow-broad-token` uses `gh auth token` instead; the record notes that it did.

Validate: `docker info` answers; the first run builds the `pro-dev-factory:<version>` image (about a minute).

## Step 5: write and accept a small intent

Run `/intent` and describe something small, for example "list tasks sorted by title".
The report ends with the level and the reasons, such as `level: 1 (meets every level 1 rule)`.
Set `status: accepted`, open a pull request with the intent and merge it as the product owner.

`<folder>` is `<date>-<slug>`, or `<ID>-<slug>` in a repo whose `intent/project.json` sets a shortcode ([ADR-0026](./decisions/0026-change-ids.md)); the factory reads both forms.

Validate:

```bash
python3 "$SDLC/scripts/factory.py" level intent/<folder> --repo .
```

prints `level: 1 (meets every level 1 rule)`.

## Step 6: run the factory once

```bash
python3 "$SDLC/scripts/factory.py" run intent/<folder> --repo . --max-cost-usd 10
```

What you see, from a live run on the demo repo (the trim-titles bug, https://github.com/jodybrewster/factory-demo/pull/5):

```
factory: queued intent/2026-11-03-trim-titles
factory: brief pr 4
factory: build pr 5
factory: merged d24d4759f0cd, deploy is yours, unread diff: 27 lines
```

A run ends with either that merged line or `factory: stopped level <n> (<reason>)`.
Validate: `gh pr list --state all` shows the brief PR and the build PR; `.pro-dev/factory/factory-<folder in lowercase>.json` holds the record with `status`, `summary` and `cost_usd`.
The build PR holds a test commit, then the fix, then the plan's Done section; CI ran `npm test` on it before the merge.
A level 1 run on the demo costs about $1 to $3.

## Step 7: run it with nobody there

```bash
while true; do python3 "$SDLC/scripts/factory.py" run --next --repo . --max-cost-usd 8; sleep 300; done
```

`--next` takes the oldest accepted level 1 intent with no spec and no record.
Daily caps stop it at 10 runs or $40 a day by default (`--max-runs`, `--max-daily-usd`).
A `/loop 5m` in an open session or mieruka's "Run the factory" setting do the same.

Validate: accept a second small intent and watch the loop pick it up within five minutes.

## Step 8: read a stop

A stop is the factory working.
`factory.py record --state merged --sha <sha>` writes a merged record only when the sha is on the default branch tip (`git merge-base --is-ancestor`).
Any other sha, or no sha, exits 2 with no record, naming the sha, the tip and the branch; run `git fetch` first when the merge is newer than the last fetch.
With no remote there is no base to check against, so it refuses the same way.

The record's `reason` names the rule, for example:

```
factory: stopped level 2 (commits without a Factory-Run: build 2026-11-03-sorted-by-title trailer: ...)
```

The pull request stays open for the engineer, who reviews and merges it as at level 2.
`factory.py run <dir>` on the same intent resumes at the host checks without a new session and without spending again.

## Step 9: a larger intent that you review

Write an intent that touches more, for example "add due dates to tasks and a filter for overdue ones, with the date taken from an environment variable for tests".
`factory.py level` puts it at level 3 because it names an environment variable; without that it would be level 1 or 2 by risk.
The runner never picks it up.
Then:

1. `/spec intent/<folder>/intent.md`: read the flagged concerns; the policy owner closes each one in the spec and the product owner accepts it.
2. `/plan intent/<folder>/spec.md`: put the engineer and the lead in `Approver:`, set `Status: approved` and commit.
3. `/execute intent/<folder>/plan.md`: it pauses at any stop-list step the plan did not consent to.
4. `/review` on the pull request, then `/pr-babysit` until it is green.
5. The lead merges with `gh pr merge <n> --squash --match-head-commit <sha>`.

Validate: each commit at a gate is authored by the role that owns it; `factory.py level` still prints 3.

## Step 10: deploy and record it

`/pro-ship:ship` proposes the version in plain words and writes the GO or NO-GO preflight.
After a GO it offers `ship.py prepare <version>` for the release change; once that has merged, `ship.py version --agree <version> --commit <merged> --carry` prints the tag command.
Tag and push the release yourself, then run `/pro-ship:deployed`, which walks the checks for the target's kind and takes the time from the tag.
Validate: a deploy record under `.pro-dev/ship/deploys/`.
When something breaks, `/incident` writes `incident.md` and a new intent at level 2 or higher.

## Step 11: mieruka

Mieruka shows the same files.
Settings, Agents and models, has a People section with the role map, Edit roles, a "You are" picker and a "Run the factory" toggle that is off by default.
Cards show their level; a level 1 card shows the factory run state.
Merge and approve plan answer 403 with the owning role for the wrong person; that is routing on a local server, not authorization.

Validate in the browser: People lists the five roles from `REVIEW.md`, the demo cards read `Level 1`; choosing a person outside the lead role makes a level 3 merge say it waits for the lead.

## Step 12: the end-to-end eval

```bash
node tests/e2e-sdlc.mjs --dry                                   # offline: 3 scenarios, 31 steps, 35 checks
node tests/e2e-sdlc.mjs --scenario 1 --allow-broad-token        # about $5 to $8
node tests/e2e-sdlc.mjs --scenario 1,2,3 --allow-broad-token    # about $18 to $30
```

It builds a throwaway private repo, installs the plugins at the branch under test and runs a product owner feature (level 1), an engineer bug (level 1, test first) and a data export (level 3 through every role to a tagged deploy and an incident).
Mieruka's twin, `apps/web/tests/e2e/factory.spec.ts`, imports the same checks.
Run the live ones only when you mean to spend.

## Stopping and undoing

- Stop the loop with ctrl-c; a run in progress finishes its phase; a timeout kills its container by name.
- Undo a merge with `git revert` of the squash commit through a pull request.
- Turn level 1 off by removing names from `product_owner` and `engineer`; every intent then reads level 2.
