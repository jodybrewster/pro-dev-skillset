---
name: deployed
description: Use after a deploy has happened - when asked to "record the deploy", "we just deployed", "post-deploy checks", "did the release go out fine" or after /pro-ship:ship said GO and the deploy is done - collects the facts of the deploy (or reads them from the GitHub deployment), walks the post-deploy checks with the person and writes a deploy record with ship.py. Never runs a deploy, a rollback or a tag. Not the go/no-go before a release (ship).
---

# deployed

Run this after a deploy has happened, to record it and to check it.
It writes `.pro-dev/ship/deploys/<evidence_key>.json`, one file per deploy and a copy for mieruka when the repo is set up for one.
The record contract is "The deploy record" in `docs/loop-records.md` in the marketplace repo.

`/deployed` never deploys, rolls back, tags, publishes or pushes.
It records what happened and what the person confirms.
A rollback is the person's call, using the plan in the `/ship` report.

## Setup

```bash
SHIP="${CLAUDE_PLUGIN_ROOT}/scripts/ship.py"
```

If `${CLAUDE_PLUGIN_ROOT}` is empty or not substituted, or the file does not exist, go to "No script" below.
Run every command from the repo root.

## Steps

1. Get the target.
   `python3 "$SHIP" targets` lists the ids.
   Use the one that shipped.
   Ask when there is more than one and the person did not say.
2. Get the facts of the deploy.
   - GitHub deployments exist for the environment: use `--from-github` in step 4.
     It fills the commit, the URL, the time and the outcome from the newest deployment and its newest status.
     Tell the person what it found and ask them to confirm when the commit is not HEAD.
   - Otherwise ask for: the environment, the URL (http or https only), the commit (default HEAD), whether it `succeeded`, `failed` or was `rolled-back` and when it finished.
3. Walk the checks below with the person, one at a time.
   Run what can be run (a health check with `curl`, a log tail) and show the output.
   Give each check a status of `pass`, `finding` or `confirm` and one line of evidence.
   A check that needs a dashboard the session cannot open is `confirm`, with what to look at.
   Never mark `pass` for a check that was not run or seen.
4. Write the checks to `.pro-dev/ship/deploy-checks.json` as an array of `{"item": "", "status": "pass|finding|confirm", "evidence": ""}`.
   Then run:

   ```bash
   python3 "$SHIP" deployed --target <id> --env <env> [--url <url>] [--commit <sha>] [--outcome succeeded|failed|rolled-back] [--deployed-at <iso>] --checks .pro-dev/ship/deploy-checks.json
   ```

   For a GitHub deployment use `--from-github --target <id> --env <env> --checks ...` and leave out `--url`, `--commit`, `--outcome` and `--deployed-at`.
5. Print the status, the evidence key, the path it wrote and, when one was written, the mieruka copy.
   When the status is `fail` or a check is a `finding`, point at the rollback triggers and steps in the record and leave the decision to the person.

The script refuses an unknown target, a URL that is not http or https and an environment with anything but `a-z`, `0-9` and `-`.
Read its message, fix the input and run it again.
The record shows `preflight.state`: if it is not `fresh`, say so in one line.

## Checks

In the first hour after launch:

1. Health endpoint returns 200.
2. Error monitoring dashboard shows no new error types.
3. Latency dashboard shows no regression.
4. Test the critical user flow manually.
5. Logs are flowing and readable.
6. Confirm the rollback mechanism works (dry run if possible).

After deploying:

- Health check returns 200.
- Error rate is normal.
- Latency is normal.
- Critical user flow works.

Error watch:

- Monitor for errors for 15 minutes after the deploy.
  Errors detected means rollback is the next conversation.
  Clean means the watch is done.
  When the session cannot wait 15 minutes, record this check as `confirm` with the time the window ends.

Items that repeat across the two lists (health, errors, latency, critical flow) are one check each in the file.

## No script

When the script is missing (Codex ships only skills, or the plugin path is not substituted), walk the same checks by hand and write the table in chat.
Say "no record was written", because only the script writes it.

## Red flags

- A `pass` on a check nobody ran.
- A deploy recorded as `succeeded` with a failing health check.
- A URL pasted from a deployment status without a look: the script keeps only http and https.
- Running a deploy, a rollback or a tag from this skill.

Adapted from agent-skills (skills/shipping-and-launch/SKILL.md and skills/ci-cd-and-automation/SKILL.md), MIT, Copyright (c) 2025 Addy Osmani.
