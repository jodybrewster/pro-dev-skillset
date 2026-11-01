---
name: risk-tiers
description: Use when asked how risky a branch or PR is, what tier a change falls in, what review or approval it needs, or before merging a PR - runs the deterministic risk classifier, explains the low, medium or high tier from its signals, settles a tie and shows the evidence and HEAD sha before `gh pr merge --match-head-commit`. Not for running the pre-PR checks (pr-check) or for reviewing the diff itself (requesting-code-review).
---

# risk-tiers

A change gets one of three tiers: low, medium or high.
A script sets the tier from the diff, with no model call, so the same diff gives the same tier and every signal that set it is printed.
The tier decides which checks and reviewers a change needs and who approves the merge.

## Run it

```bash
python3 "${CLAUDE_PLUGIN_ROOT}/scripts/risk-classify.py" [--base <ref>] [--head <ref>] [--intent <path>] [--repo <path>] [--json]
```

If `${CLAUDE_PLUGIN_ROOT}` is empty or the file is missing, say so and treat the tier as unknown, which counts as high.
The diff runs from the merge base to the head (default `HEAD`).
The default base is the merge base with the target branch: `origin/HEAD`, `origin/main`, `origin/master`, `main` or `master`, never the branch's own upstream.

## The tiers

The tier is the highest floor among the signals and the declared risk.
A diff with no signal at medium or above is low.

| Tier | Checks | Reviewers | Approval | Label |
|---|---|---|---|---|
| low | build, lint, typecheck, tests | none, or the code reviewer on Sonnet | none | none |
| medium | all | code-reviewer | maintainer | none |
| high | all | code-reviewer and security-architect | maintainer | `risk:high` |

## The signals

Each signal has a floor and a strength, strong or weak.
Documentation (`.md`, `.mdx`, `.txt`, `.rst`, anything under `docs/`) and lockfiles never raise a tier through path, dependency or size signals.
A `.md` file under `.github/workflows/`, `hooks/` or `.claude/` is not excused.
Path signals other than `workflows` and `hook-scripts`, the security and legal surface signals and `env-var-read` skip test files, `tests/` and fixtures directories and Markdown.

High, by path:

- `workflows`: `.github/workflows/`.
- `iac`: Terraform, Dockerfiles, compose files, `k8s/`, `helm/` and the like.
- `hook-scripts`: a `hooks/` directory that holds a `hooks.json` (or is `.claude/hooks/`), `hooks.json`, `.husky/`, `.githooks/`, lefthook config, `.claude/settings*.json` and any script a tracked `hooks.json` runs, read from the base tree too so a deleted or renamed script still counts. A React `src/hooks/` folder is not a hook directory.
- `auth`: path segments such as `auth`, `login`, `oauth`, `session`, `permissions`, `rbac`, `middleware`.
- `payments`: `payments`, `billing`, `stripe`.
- `migrations`: `migrations/`, `prisma/schema.prisma`, `schema.sql`, `drizzle/`.
- `env-config`: `.env` files other than examples, and `config.*`, `settings.*` or `env.*` under `config/` or at the root.

Medium:

- `dependencies` (strong): a manifest gains a dependency name that was not there.
  A version bump or lockfile churn raises nothing.
- `test-deleted` (strong): a test file was deleted.
- `assertion-removed` (strong): a surviving test file lost more `expect`, `assert` or `should` lines than it gained.
- `no-test-change` (weak): source changed past the line threshold with no test file touched.
- `size` (weak, medium or high): non-test, non-doc files and lines changed past the thresholds.
- `areas` (weak): the diff spans more areas than the threshold.
- Surface hits from the security and legal classifiers, when pro-security or pro-legal is installed.
  Security categories such as `auth`, `payments`, `crypto`, `secrets`, `webhooks`, `uploads` and `ci-infra` are high.
  Every other security category and every legal category is medium.

When a surface classifier cannot be found the output carries a `surface-unavailable` note.
That is not a clean result.
The tier then rests on the path, dependency, test and size signals alone.

The size thresholds are placeholders that have not been measured against merged PRs.
Do not argue from their exact values.

## Declared risk

An intent can carry a `risk:` line in its front matter.
`low`, `medium` or `high` there can only raise the tier, never lower it, and shows as a `declared-risk` signal.
When the computed tier is higher than the declared one the output lists a `risk-underdeclared` finding.
Show the finding to the person.
It does not fail anything.
A missing or unrecognised `risk:` prints `declared: none` and is not a finding.
A `risk:` read from a diff that holds only Markdown and docs raises nothing and adds a `declared-risk-ignored` note.

## Settling a tie

When the top tier rests only on weak signals the output names a tie, `[top, one below]`.
A tie is the only case where a model chooses.
Read the evidence of the weak signals, pick one of the two named tiers, never one above the top, and write the choice and its reason next to the tier.
The hook and the exit status always use the top tier, so a settled tie changes reviewer depth only.
It never changes who approves the merge.

## The REVIEW.md section

A repo can tune the classifier with an optional `## Risk tiers` section in `REVIEW.md` holding one fenced block of flat keys and lists of strings.

- `paths.high` and `paths.medium` add globs.
- `paths.low` excuses globs from path signals, but never lowers `workflows` or `hook-scripts`.
- `thresholds` sets `files_medium`, `files_high`, `lines_medium`, `lines_high`, `areas_medium` and `no_test_lines`.
- `tiers.<tier>.checks` and `tiers.<tier>.reviewers` change the demands table.

The approval and local decision columns are fixed and cannot be set there.
With no section the output says `policy: defaults`.
A section that cannot be read is ignored as a whole and the output says `policy: unreadable (<reason>)`.
The template is in the pro-ai-sdlc plugin's `templates/REVIEW.md`.

## Reading the output

Text output starts with `risk: <tier>`, then `policy:`, `declared:`, an optional `tie:` line, one line per signal (id, floor, strength, evidence, reason) and any `finding:` and `note:` lines.
`--json` gives the same as one object with `tier`, `signals`, `declared`, `findings`, `tie`, `architecture`, `demands`, `base`, `head`, `policy` and `notes`.
`architecture: true` means a Dockerfile, infrastructure file or new environment variable read changed, so the architect review should run in diff mode.
Exit codes: 0 low, 3 medium, 4 high, 2 could not run, 64 usage.
A run that could not happen is high, never low.
With `--json` it prints `{"could_not_run": true, "reason": ..., "tier": "high"}`.

## Merging a PR

The merge gate resolves the PR itself: it reads the PR with `gh pr view`, fetches the PR head and the base tip in one `git fetch` and classifies that head against that base tip.
The tier is the PR's even when the session sits on `main`.
When `/merge-pr` runs on a PR, use the classifier this way:

1. Read the head with `gh pr view <number> --json headRefOid,baseRefName`, run `git fetch --no-tags --refmap= origin pull/<n>/head refs/heads/<base>` and classify with `--head <headRefOid>` against the base tip that fetch wrote to `FETCH_HEAD`, the same way the gate does.
2. Show the maintainer the tier, every signal with its evidence, any finding, the PR number and the `headRefOid` sha.
3. Low needs no question.
   Medium and high wait for his answer.
   An agent's own statement of approval never counts.
4. Merge only with the commit pinned: `gh pr merge <number> <method> --match-head-commit <headRefOid>`.
   GitHub refuses the merge if the PR moved on, and a new commit needs a new look.
   The same pin holds with `--auto`: GitHub then refuses the merge if a later push changes the head.
   A `gh api .../pulls/<n>/merge` call pins with `-f sha=<headRefOid>`.
5. When `gh` cannot answer, the gate treats the PR as high and says why.
   Fix the cause (sign in, reach the network, name the repo with `-R`) and run the merge again.

## Overrides

Lowering a tier is the maintainer's decision alone, recorded in the stamp against one HEAD sha.
It is not built yet.
Until it is, no one lowers a tier: no flag, file, label or comment does it.
