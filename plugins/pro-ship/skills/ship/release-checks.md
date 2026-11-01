# Release checks

The release-time checks `/ship` runs after the specialists.
Each item ends as `pass`, `finding` or `confirm` with its evidence: a `file:line`, a command and its output or a URL.
`finding` becomes a Blocker or a Recommended fix as written on the item.
`confirm` means the check could not read the answer and the person must look.
Never write `pass` for an item that was not checked.

An item a passing `pr-check` already proved per PR (tests, build, lint, typecheck, review) reads its result from the stamp for HEAD or from `pr-check.py run` and is not run again.
A publish target adds only the Blockers in "Publish".

## Code quality

- All tests pass, the build succeeds with no warnings, lint and type checking pass: read from the stamp or from the repo's own checks.
  A failing check is a Blocker.
- Code reviewed and approved: read from the coverage step.
  An uncovered commit with no reviewer result is `confirm`.
- No `TODO` or `FIXME` that the range adds in non-test code (`git diff <base>..<head>` added lines): each is a Recommended fix.
- No debugging statement the range adds (`console.log`, `print(`, `debugger`) in production code: each is a Recommended fix.
- Error handling covers the expected failure modes: from the reviewer's report, else `confirm`.

## Security

- No secrets in code or version control.
  A credential-shaped string the range adds (the patterns in `REVIEW.md`) is a Blocker.
- The ecosystem's dependency audit shows no critical or high vulnerabilities.
  Run `npm audit --audit-level=high`, `pnpm audit`, `pip-audit` or `cargo audit` for the manifests the repo ships.
  A critical or high finding is a Blocker.
  A missing tool or no network is `confirm`.
- Input validation, authentication and authorization on user-facing endpoints: from the security reviewer, else `confirm`.
- For a web deploy target, read [references/security-checklist.md](./references/security-checklist.md) for each of these and write a Recommended fix for a miss:
  - Security headers configured (CSP, HSTS and the rest of its Security Headers block).
  - Rate limiting on authentication endpoints.
  - CORS set to specific origins and never a wildcard.

## Performance

- Core Web Vitals within the "Good" thresholds: for a web target whose range touches UI files, dispatch the web performance auditor as SKILL.md says.
  A regression past a threshold measured in Deep mode is a Blocker.
  Quick mode findings are `potential impact` and Recommended fixes.
- Backend items of [references/performance-checklist.md](./references/performance-checklist.md) found in the range: an N+1 query on a critical path, a query with no matching index, an unbounded list endpoint.
  Each is a Recommended fix.
- Images optimized, bundle size within budget and caching configured for static assets: the auditor's report, else `confirm`.

## Accessibility

For a web target whose range touches UI files.
Run `pro-design:accessibility-audit` on the changed views when pro-design is installed.
A Critical finding is a Blocker and the rest are Recommended fixes.
Without pro-design, write `confirm` and list the six checks for the person:

- Keyboard navigation works for all interactive elements.
- A screen reader can convey page content and structure.
- Color contrast meets WCAG 2.1 AA (4.5:1 for text).
- Focus management is correct for modals and dynamic content.
- Error messages are descriptive and associated with form fields.
- No accessibility warnings in axe-core or Lighthouse.

## Infrastructure

- Environment variables set in production.
  Read what the range adds from `.env.example`, `.env.*.example` and `process.env.X` or `os.environ` references in the diff.
  When the production config can be read (`vercel env ls production` for a linked Vercel project) and lacks a variable, that is a Blocker.
  When it cannot be read, that is a `confirm` Recommended fix naming each variable.
- Database migrations applied or ready to apply.
  Look in `prisma/migrations`, `drizzle`, `supabase/migrations`, `db/migrate`, `alembic/versions` and `migrations/`.
  A new migration that drops a table or a column, or that has no down step where the tool supports one, is a Blocker unless the report names how to go back (see rollbacks.md, Database).
- DNS and SSL configured for a target with a `url`: `curl -sSI <url>` answers 2xx or 3xx over a valid certificate.
  A failure is a Blocker.
  No `url` is `confirm`.
- CDN configured for static assets: `confirm`.
- Logging and error reporting configured and a health check endpoint that responds: from "Monitoring" below.

## Documentation

Each missing item is a Recommended fix.
`/ship` never edits a document.

- README updated for new setup steps, env vars or commands.
- API documentation current for changed endpoints.
- An ADR for any architectural decision in the range.
- The changelog picked up the release: a release-please config with no open release PR, or a `CHANGELOG.md` with no entry for the version.
- User-facing documentation updated, when there is any.

## Version

A tag or release version that differs from the version in the manifests the repo ships is a Blocker.
In this marketplace the version-bump check in `tests/check.mjs` stands in for it through the repo's own checks.

## Publish

A `publish` target can only add Blockers:

- The version already exists: `npm view <name>@<version> version` (or the registry's equivalent) returns it.
- A failing dry run of the publish command (`npm publish --dry-run`, `cargo publish --dry-run` and the like).
- A publish workflow with no provenance (`--provenance` or `publishConfig.provenance`).

## Feature flags

For each flag the range adds, a miss is a Recommended fix:

- It has an owner and a removal date.
- It is not nested inside another flag.
- Both states (on and off) are tested.

List each added flag with its default under Acknowledged risks.
The lifecycle to carry into the Rollout plan:

```
1. DEPLOY with flag OFF     -> code is in production but inactive
2. ENABLE for team or beta  -> internal testing in production
3. GRADUAL ROLLOUT          -> 5% -> 25% -> 50% -> 100% of users
4. MONITOR at each stage    -> error rates, performance, user feedback
5. CLEAN UP                 -> remove the flag and the dead path within 2 weeks of full rollout
```

## Monitoring

For a `deploy-on-merge` or `manual-deploy` target, check the pre-launch gate of [references/observability-checklist.md](./references/observability-checklist.md):

- Structured logs flowing to the log aggregator.
- Error reporting configured (an error boundary on the client, a handler on the server that does not leak internals).
- A health check endpoint, or a monitoring config that probes one.
- An alert on the error rate, with a runbook.

A missing error reporter or health check is a Recommended fix.
Anything that lives outside the repo (dashboards, alert rules) is `confirm`.

What to watch after launch, for the Post-launch verification section:

```
Application metrics:    error rate (total and by endpoint), response time (p50, p95, p99), request volume, key business metrics
Infrastructure metrics: CPU and memory, database connection pool, disk space, queue depth
Client metrics:         Core Web Vitals (LCP, INP, CLS), JavaScript errors, API error rates from the client, page load time
```

## Error budget

Read `error_budget` from the Ship block (a percent remaining, or a command that prints one).

```
Budget remaining over 20%   -> changes nothing
Budget remaining 0 to 20%   -> a high-tier range is a Blocker (slow rollouts only, no high-risk changes)
Budget exhausted            -> the verdict is NO-GO unless the person accepts it by name
```

Without an `error_budget`, write one `confirm` line: "error budget: not named in the Ship block".
A high burn rate during a canary is a hold signal in the Rollout plan table, the same as an elevated error rate.

Adapted from agent-skills (skills/shipping-and-launch/SKILL.md), MIT, Copyright (c) 2025 Addy Osmani.
