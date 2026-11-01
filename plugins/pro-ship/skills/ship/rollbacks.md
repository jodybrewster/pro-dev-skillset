# Rollbacks

A rollback plan is mandatory for every target before any GO.
For each target, copy the entry for its kind and host into the report's Rollback plan, then fill in the commit, the project name and the URL from the repo.
A target's `rollback` in the Ship block replaces the entry here.
A target with no entry and no `rollback` has no plan and the verdict is NO-GO.

Every entry has the same three parts: the trigger, the steps and the recovery time.
The triggers below apply to every deploy target unless the entry says otherwise:

- Error rate more than 2x baseline.
- P95 latency more than 50% above baseline.
- New client errors at over 0.1% of sessions.
- User-reported issues spike.
- Data integrity issues detected.
- A security vulnerability is discovered.

`/ship` writes these steps and never runs them.

## Template

```markdown
## Rollback plan for [feature or release]

### Trigger conditions
- Error rate > 2x baseline
- P95 latency > [X] ms
- User reports of [specific issue]

### Rollback steps
1. Disable the feature flag (if applicable)
   OR
1. Deploy the previous version: [the host's command below]
2. Verify the rollback: health check, error monitoring
3. Communicate: notify the team of the rollback

### Database considerations
- Migration [X] has a rollback: [verified command or runbook link]
- Data inserted by the new feature: [preserved or cleaned up]

### Time to rollback
- Feature flag: under 1 minute
- Redeploy the previous version: under 5 minutes
- Database rollback: under 15 minutes
```

## Deploy on merge

### Vercel

- Trigger: the common triggers, or a failed production deployment.
- Steps:
  1. `vercel rollback` (or promote the previous production deployment in the dashboard, or `vercel promote <previous deployment url>`).
  2. Verify the production URL and the health check.
  3. `git revert <merge commit>` on the default branch so the next merge does not redeploy the bad commit.
- Recovery time: under 2 minutes for the promote, under 10 minutes with the revert and its deploy.
- Note: environment variables changed in the range are not rolled back by promoting an old deployment. Name them.

### Generic CI deploy on merge

For a workflow that deploys on push to the default branch with a host not listed here.

- Trigger: the common triggers.
- Steps:
  1. `git revert -m 1 <merge commit>` (or `git revert <commit>` for a squash) on the default branch and push through a PR.
  2. Wait for the workflow to deploy the revert and check its run.
  3. If the host keeps releases, redeploy the previous release from the host's console while the revert is in flight.
- Recovery time: the workflow's run time plus review time, typically 5 to 20 minutes.

### Netlify

- Trigger: the common triggers.
- Steps:
  1. In Deploys, publish the previous production deploy (or `netlify api restoreSiteDeploy --data '{"site_id":"<id>","deploy_id":"<previous>"}'`).
  2. Verify the site URL.
  3. Revert the commit on the default branch so auto-publishing does not redeploy it.
- Recovery time: under 2 minutes.

## Manual deploy

### Fly

- Trigger: the common triggers.
- Steps:
  1. `fly releases` to find the previous good version.
  2. `fly deploy --image <previous image reference from fly releases --image>`.
  3. Verify `fly status` and the health check.
- Recovery time: 2 to 5 minutes.
- Note: `fly secrets` changes are not rolled back by redeploying an image.

### Wrangler (Cloudflare)

- Trigger: the common triggers.
- Steps:
  1. `wrangler deployments list` to find the previous deployment.
  2. `wrangler rollback <previous deployment id>`.
  3. Verify the Worker's URL and the health check.
- Recovery time: under 2 minutes.
- Note: Durable Object migrations and D1 changes are not undone by a rollback. Name them.

## Tag release

### Tag only, local release

For a repo whose release is a tag (a plugin marketplace, a library installed from git) with no deploy.

- Trigger: a consumer reports a broken install or behavior on the new tag, or a check fails after the tag is cut.
- Steps:
  1. Tell consumers to pin the previous tag (`git checkout <previous tag>` or the install command with that ref).
  2. Land a revert of the bad commits on the default branch through a PR.
  3. Cut a new patch tag from the fixed default branch. Do not move or delete the published tag: caches and clones hold it.
- Recovery time: minutes for a consumer to pin, a PR cycle for the fix.

## Desktop

### With an installer and auto-update

- Trigger: crash reports, a failing launch or an auto-update that breaks users.
- Steps:
  1. Stop the rollout: mark the release a draft or pre-release, or remove it from the update feed.
  2. Point the update feed back at the previous release, or publish a higher patch version built from the previous good commit (auto-updaters do not move backwards).
  3. Verify an installed previous version updates to the fixed build.
- Recovery time: hours, bounded by the update check interval of installed clients.

### Without an installer

For a build users download by hand.

- Trigger: a broken download or a reported crash on the new build.
- Steps:
  1. Move the release assets for the bad version out of the Latest slot (mark the release a pre-release or delete the asset).
  2. Re-upload the previous build as Latest, or cut a patch release from the previous good commit.
  3. Update the download link or page if it names the version.
- Recovery time: minutes to hide the bad build. Users who already downloaded it keep it.

## Publish

### npm

- Trigger: a broken or insecure published version.
- Steps:
  1. `npm deprecate <name>@<version> "<reason, use <good version>>"`.
  2. Move the `latest` tag: `npm dist-tag add <name>@<good version> latest`.
  3. Publish a fixed patch version. `npm unpublish` only works inside the registry's window and breaks dependents, so use it only for leaked secrets.
  4. If a secret shipped, rotate it first.
- Recovery time: under 5 minutes for the dist-tag move. Installs that already resolved the bad version keep it.
- Other registries (PyPI, crates.io, RubyGems): yank the version (`twine` has no yank, use the PyPI console or `cargo yank`, `gem yank`) and publish a fixed version.

## Database

A migration the range adds needs its own line in the plan:

- A migration with a down step: name the command (`prisma migrate resolve`, `alembic downgrade -1`, `rails db:rollback` and the like) and verify it on a copy.
- A migration without one, or one that drops a table or a column: restore from a backup taken before the release. Name the backup and who runs the restore. If there is no way back, it is a Blocker.
- Data the new feature wrote: say whether the old code can read it and whether it is preserved or cleaned up.
- Prefer expand and contract: ship the additive migration first and drop in a later release.

## Feature flag

- Trigger: the common triggers on the flagged path.
- Steps: turn the flag off in the flag service, then verify the error rate returns to baseline.
- Recovery time: under 1 minute.

Adapted from agent-skills (skills/shipping-and-launch/SKILL.md, the Rollback Strategy section), MIT, Copyright (c) 2025 Addy Osmani.
