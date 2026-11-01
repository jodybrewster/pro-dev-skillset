# Report layout

`/ship` writes the report as Markdown, once, and passes it as `report_md` in `report.json`.
The record writes it to `.pro-dev/ship/preflight.md`.
The sections come in this order.
Leave out Rollout plan when no target is `deploy-on-merge` or `manual-deploy`.

````markdown
## Ship decision: GO | GO with 1 accepted risk | NO-GO (2 Blockers)

### Scope
- Targets: [id (kind), one per line]
- Range: <base 8 chars>..<head 8 chars>, [n] commits, from [last deploy source]
- Covered by a passing pr-check: PRs [numbers], or "every commit"
- Uncovered: [sha subject, one per line], or "none"
- Legal: [Ship | Ship with changes | Hold | not installed | could-not-run]

### Blockers (must fix before ship)
- [Source: finding + file:line, command and output, or URL]

### Recommended fixes (should fix before ship)
- [Source: finding + evidence]

### Acknowledged risks (shipping anyway)
- [Risk + mitigation. Accepted by: name, at: ISO 8601]
- [Feature flag the range adds + its default]

### Rollout plan
[Per deploy target. Written here and never run by /ship.]

1. Deploy to staging: full test suite, manual smoke test of the critical flows.
2. Deploy to production [with the feature flag OFF when the range adds a flag]: health check passes, no new errors in monitoring.
3. [Flag on for the team, 24 hour window.]
4. [Canary: flag on for 5% of users, 24 to 48 hours, advance only if every threshold below passes.]
5. [Gradual: 25% -> 50% -> 100%, the same monitoring at each step.]
6. [Full rollout, monitor for one week, remove the flag.]

| Metric | Advance (green) | Hold and investigate (yellow) | Roll back (red) |
|--------|-----------------|-------------------------------|-----------------|
| Error rate | Within 10% of baseline | 10-100% above baseline | More than 2x baseline |
| P95 latency | Within 20% of baseline | 20-50% above baseline | More than 50% above baseline |
| Client JS errors | No new error types | New errors at under 0.1% of sessions | New errors at over 0.1% of sessions |
| Business metrics | Neutral or positive | Decline under 5% (may be noise) | Decline over 5% |

### Rollback plan
#### [target id] ([kind])
- Trigger conditions: [signals that prompt a rollback]
- Rollback steps: [exact commands, numbered]
- Database: [migration rollback, or "no migration in the range"]
- Recovery time objective: [target]

### Post-launch verification
In the first hour after launch:
1. Health endpoint returns 200.
2. Error monitoring shows no new error types.
3. Latency shows no regression.
4. Test the critical user flow by hand.
5. Logs are flowing and readable.
6. Confirm the rollback path works (dry run if possible).

### Verification checklist
[Per target.]

Before deploying:
- [ ] Pre-launch checklist completed (all sections green)
- [ ] Feature flag configured (if applicable)
- [ ] Rollback plan documented
- [ ] Monitoring dashboards set up
- [ ] Team notified of the deployment

After deploying:
- [ ] Health check returns 200
- [ ] Error rate is normal
- [ ] Latency is normal
- [ ] Critical user flow works
- [ ] Logs are flowing
- [ ] Rollback tested or verified ready

For every shipped service:
- [ ] Error budget policy in place: know what action to take when the budget drops below 20% and when it is exhausted

### Evidence
- Release checks: [section, item, pass | finding | confirm, evidence, one per line]
- Code reviewer: [report, verbatim, or "not run: every commit covered"]
- Security review: [report, verbatim, or the reason it did not run]
- Test engineer: [report, verbatim, or "not run: low tier"]
- Legal review: [report, verbatim, or "not installed"]
- Web performance audit: [report, verbatim, with its mode, or "not run: no UI files"]
- Accessibility audit: [report, verbatim, or the six checks marked confirm]
````

## Rules

1. The first line is the verdict.
   Each Blocker names its evidence.
2. The rollback plan is mandatory for every target before any GO.
3. A Critical or Blocking finding makes the default verdict NO-GO unless the person accepts it by name.
   Record who and when under Acknowledged risks.
4. Print the report in chat and end with the paths of the report and the record.

Adapted from agent-skills (commands/ship.toml and skills/shipping-and-launch/SKILL.md), MIT, Copyright (c) 2025 Addy Osmani.
