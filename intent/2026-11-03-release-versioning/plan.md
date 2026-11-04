# Plan: releases carry a version, checks that fit the target and deploy facts from the deploy

Built from `spec.md` and `intent.md` in this folder.
Status: draft.
Approver: the maintainer.
Dated: 2026-11-03.

## How it works in one breath

`ship.py` gains five deterministic subcommands and one `deployed` flag; the `ship` and `deployed` skills call them and say the results in plain words.
pro-ai-sdlc gains one intent field and one `/execute` step so the inputs exist.
Nothing tags, pushes or edits a generated file.
The work lands as six stacked pull requests, each bumping the plugin it touches.

## Interfaces

All in `plugins/pro-ship/scripts/ship.py`, standard library only, JSON on stdout, a refusal on stderr with exit 1, like the current subcommands (`ship.py:1094-1131`).

```
ship.py version [--target ID] [--base REF]
  {"state": "proposal|first-release|nothing",
   "target": "<id>", "last_tag": "v1.0.0"|null, "last_version": "1.0.0"|null,
   "declared": {"file": "package.json", "version": "1.0.0"}|null,
   "bump": "major|minor|patch"|null, "next": "1.1.0"|null, "next_if_not_breaking": "1.1.0"|null,
   "tag": "v1.1.0", "base_candidate": {"sha": "<40 hex>", "subject": "<text>"}|null,
   "counts": {"breaking": 0, "feature": 2, "fix": 1, "unknown": 0},
   "changes": [{"subject": "", "kind": "feature|fix|breaking|unknown", "source": "intent|commit", "intent": "<folder>|null"}],
   "unclassified": ["<subject>"], "reasons": ["0.x: breaking bumps minor"],
   "sentence": "v1.1.0 (minor): two features and one fix since v1.0.0",
   "question": null | "<one plain sentence>"}
ship.py version --agree X.Y.Z      -> {"checks": [{"item": "manifest|changelog|tag", "status": "pass|finding|confirm", "evidence": ""}]}
ship.py changelog                  -> {"mode": "manual|generated|none", "why": "<marker or key>", "path": "CHANGELOG.md"|null,
                                       "unreleased": ["<line>"], "groups": ["Added"]}
ship.py changelog --check BASE HEAD -> {"missing": ["<intent folder>"], "no_migration": ["<intent folder>"], "confirm": ["deprecation window"]}
ship.py prepare X.Y.Z              -> {"files": ["package.json", "CHANGELOG.md"], "skipped": [{"file": "", "why": ""}]}
ship.py checks --target ID         -> {"kind": "tag-release", "items": ["tests on a clean checkout of the tag", "documented use runs", "rollback dry run"], "refused": ["health", "error rate", "latency", "logs"]}
ship.py protection [--target ID]   -> {"tags_protected": "yes|no|unknown", "via": "ruleset|classic|none|null", "ci_on_tags": "yes|no|unknown", "notes": []}
ship.py deployed --from-tag TAG --target ID [--env E] [--checks FILE]
  (adds detail_json keys "time_source": "github-deployment|release|tag-push-run|tagger-date|commit-date|given|github", "env_source": "target|default|given")
```

Rules the code follows:

- Last tag: `release_tag`-style, newest release tag merged into HEAD, filtered by the target's `tag_pattern` or by the tag prefix when the target path is a package (`ship.py:517-559`).
- Tag style: the newest tag's prefix is kept (`v`, none or `name--v`); with no tag it is `v` or `<id>--v` when the Ship block's `tag_pattern` has a `--v` shape.
- Intent of a change: the `intent/<folder>/intent.md` paths touched in `base..HEAD` (`git diff --name-only`); read with `factory.py`'s plain frontmatter rule, copied as a few lines because pro-ship cannot import pro-ai-sdlc.
- Commit fallback only for commits that touch no `intent/` path.
- First release: `base_candidate` is the parent of the oldest commit that added a path under `intent/` (`git log --diff-filter=A --format=%H --reverse -- intent/`); with no `intent/`, the newest commit where `git show <sha>:<manifest>` holds the declared version.
- Manifest readers: `package.json` through `json`; `pyproject.toml` and `Cargo.toml` through `tomllib` with a regex fallback on the `[project]`, `[tool.poetry]` and `[package]` tables; a workspace uses the file at the target's `path` (`ship.py:416-440`).
- `prepare` edits with a single anchored regex on the version line of the one manifest and rewrites the changelog heading; it re-reads the file and refuses if the written version differs.
- Changelog mode order: Ship block `changelog:` key, then markers, then the file (spec R10).
- `checks` kinds: `tag-release`, `publish` and `desktop` get the library set; `deploy-on-merge` and `manual-deploy` get the service set; `deployed` calls the same function to refuse a mismatched item (matching health, error rate, latency or log, case-insensitive).
- `protection`: `gh api repos/{owner}/{repo}/rulesets` then `rulesets/<id>` for each active one (conditions `ref_name.include` against `refs/tags/*` or the pattern); `gh api repos/{owner}/{repo}/tags/protection` as the classic fallback; any `gh` error is `unknown` with the message in `notes`.
- Time ladder for `--from-tag`: deployments for the commit, release `published_at` (`repos/{owner}/{repo}/releases/tags/<tag>`), the workflow run with `event=push` and `head_branch=<tag>` (`actions/runs?head_sha=<sha>`), `git for-each-ref --format=%(taggerdate:iso-strict)`, `git log -1 --format=%cI`.
- Skills: `ship/SKILL.md` gets a "Version" step between "Targets and scope" and "Coverage" and a changed base-null rule; `deployed/SKILL.md` gets "Checks by target kind" and the `--from-tag` path.
- Intent template and commands: `breaking:` after `kind:`; `/intent` asks it; `/execute` finds `ship.py` with the same sibling-script lookup pr-check uses (`pr-check.py find pro-ship ship.py`) and writes the changelog line by hand when it is absent.

## Files that change

- `plugins/pro-ship/scripts/ship.py` (modified): `version`, `changelog`, `prepare`, `checks`, `protection`, `deployed --from-tag`, no `now()` default (`ship.py:1045`), env rules, the module docstring.
- `plugins/pro-ship/skills/ship/SKILL.md` (modified): "Version" step, replace the ask-for-a-commit rule at line 41, prepare offer, tag command, protection line, rationalization rows for patch-for-small and changelog-at-release.
- `plugins/pro-ship/skills/ship/release-checks.md` (modified): Documentation items for changelog and agreement; the "never edits a document" line at 77 names `prepare` as the one exception the person asks for.
- `plugins/pro-ship/skills/deployed/SKILL.md` (modified): the check lists by kind, the time and env rules, the `--from-tag` path.
- `plugins/pro-ship/.claude-plugin/plugin.json`, `.codex-plugin/plugin.json`, `.claude-plugin/marketplace.json` (modified): version bumps and `metadata.version`.
- `plugins/pro-ai-sdlc/templates/intent.md`, `commands/intent.md`, `commands/execute.md` (modified): `breaking:` and the changelog step; its two manifests and the marketplace entry bumped.
- `plugins/pro-ai-sdlc/.codex-plugin/` counterparts of the touched commands, where they exist (modified).
- `tests/ship-version.mjs` (new): `version`, `changelog`, `prepare`, `--agree`.
- `tests/ship-deploy.mjs` (modified): `--from-tag`, checks by kind, env rules, protection, the gh stub gains rulesets, releases and runs.
- `tests/check.mjs`, `package.json` (modified): register `ship-version` and `test:ship-version`.
- `tests/fixtures/ship-version/` (new): small file trees for the manifests and changelog modes.
- `docs/loop-records.md`, `docs/ship-preflight.md` (modified): `time_source`, `env_source`, check sets, new check items.
- `docs/decisions/0025-release-versions.md` and its row in `docs/decisions/README.md` (new, drafted with the spec): flipped to accepted at sign-off.
- `CLAUDE.md` (modified): the Ship block gains `changelog: generated`.
- `docs/roadmap.md` (modified): move the item to done as each PR merges.

## Order of work

Each step is its own pull request off a fresh `origin/main`, stacked on the one before so the manifest bumps do not collide.
Before each: `node tests/check.mjs && node tests/eval.mjs --dry`, `node --test tests/unit/*.test.mjs`, `claude plugin validate . --strict` and the per-plugin loop.

1. pro-ship 0.13.0: `version`, first-release detection, manifest readers, `changelog` mode and the `ship` skill's Version step (size S; R1 to R8, R10, R23; AC1 to AC5).
   Checkpoint: `python3 plugins/pro-ship/scripts/ship.py version` in a fixture repo prints the sentence of AC2; `node tests/ship-version.mjs` passes.
2. pro-ai-sdlc 0.15.0: `breaking:` in the template, `/intent` question, `/execute` changelog step (size XS; R9, R11).
   Checkpoint: `node tests/check.mjs` passes; a read of `execute.md` shows the generated-mode refusal; AC5 execute half by reading the command.
3. pro-ship 0.14.0: `changelog --check`, `prepare`, `version --agree`, the release-check items (size S; R12 to R14, R22; AC6).
   Checkpoint: `prepare 1.1.0` on the fixture, `git status --short` lists only the manifest and the changelog, `git tag` is empty, `--agree 1.1.0` passes.
4. pro-ship 0.15.0: `checks`, the refusal in `deployed`, `--from-tag`, no `now()` default, env rules, the `deployed` skill and `docs/loop-records.md` (size S; R15 to R19, R24; AC7, AC8).
   Checkpoint: `node tests/ship-deploy.mjs` passes with the new cases.
5. pro-ship 0.16.0: `protection` and the `/ship` line (size XS; R20, R21; AC9).
   Checkpoint: the three stubbed answers print `yes`, `no` and `unknown`.
6. Docs and law: ADR-0025 accepted at sign-off, `CLAUDE.md` Ship block `changelog: generated`, `docs/ship-preflight.md`, roadmap (size XS; R24; AC10, AC11).
   Checkpoint: the grep of AC11 is empty; `node tests/check.mjs` passes.

Irreversible: none in the code.
The first release tag a person pushes is irreversible and is theirs.

## Tests that prove it

- `tests/ship-version.mjs` builds throwaway git repos like `tests/ship-deploy.mjs` does (temp dir, git config pointed away, `gh` stub on PATH) and covers:
  - no tag with each of the three manifests, a manifest that differs at the candidate commit, no manifest and no intent folder (`v0.1.0`);
  - tag `v1.0.0` with feature, fix, breaking and unknown intents and the 0.x rule;
  - tag styles `v1.2.3`, `1.2.3` and `name--v1.2.3` with `tag_pattern`;
  - a commit with no intent classified by `feat:`, `fix:`, `!` and `BREAKING CHANGE:`;
  - an empty range;
  - changelog mode for each marker, the Ship block key winning and a file saying it is generated;
  - `prepare` on manual, generated and none; a dirty tree; a bad version string; an existing tag; the tree after (only two files change, `git tag` empty, no commit);
  - `--agree` pass and each of the three failures;
  - a PATH stub for `git` subcommands `tag` and `push` that fails the test if called.
- `tests/ship-deploy.mjs` adds: `--from-tag` for each rung of the ladder (the stub answers one rung at a time), no flag and no `--deployed-at` refusal, `env` default `release` with `env_source`, a health check refused on `tag-release` and accepted on `deploy-on-merge`, the record shape unchanged (`schema` 1), `protection` with ruleset, empty and 403 answers and `ci_on_tags` from a workflow fixture.
- `tests/unit/` gains a case for the frontmatter `breaking:` read if the helper is shared.
- A manual end-to-end on the factory demo repo: `/pro-ship:ship` with no tag asks the one question; the proposal sentence matches; `prepare`; tag by hand; `/pro-ship:deployed` on the tag.
- Live evals are manual: since the `ship` and `deployed` skill bodies change, remind the maintainer before the PRs that `node tests/run-evals.mjs pro-ship` (and `node tests/behavioral.mjs ship --baseline`) is best practice at roughly the usual cost; run only on a yes.

## Risks

- The step most likely to go wrong is the first-release candidate (R7): a repo whose first `intent/` commit is not the first factory change picks the wrong commit.
  The question names the commit by subject and the person can pick another, so the damage is a wrong question and not a wrong tag.
- `prepare` edits a manifest with a regex; a manifest with two version-like lines could change the wrong one.
  It edits only inside the named table and re-reads the file; a mismatch refuses.
- Removing the `now()` default breaks any caller of `deployed` that relied on it; the refusal text names the replacement flags and the skill is updated in the same PR.
- A stack of six PRs with version bumps conflicts if the maintainer merges in parallel (as happens in this repo); each is rebased on `origin/main` before it opens.
- Protection rulesets are not readable without admin; the answer is `unknown`, which the report says once.

Stop-list categories: deploys (steps 4 and 5 touch what `deployed` records and what `/ship` reports; neither runs a deploy).

## Options not taken

- One large pull request: six small ones review faster and roll back separately.
- A new `pro-release` plugin: the work is `ship` and `deployed` behaviour, which already live in pro-ship (ADR-0013 layering).
- A model decides the bump from the diff: not deterministic and steerable by text; the intent kinds are the record.
- `/ship` runs `prepare` itself on every run: it would edit files on a clean-tree command; the person asks for it.
- Add `breaking:` to the level rules: `risk-classify.py` already reads the diff.

## Proof of done

```bash
node tests/check.mjs && node tests/eval.mjs --dry
node tests/route-lexical.mjs --min-rank1 70 && node --test tests/unit/*.test.mjs
node tests/ship-version.mjs && node tests/ship-deploy.mjs
claude plugin validate . --strict
( for p in plugins/*/; do claude plugin validate "${p%/}" --strict || exit 1; done )
```

Each prints its pass line with 0 failures.
On the factory demo repo with no release tag: `/pro-ship:ship` asks the one question, proposes `v1.1.0 (minor)` with the changes grouped, `prepare 1.1.0` changes only the manifest and the changelog and `/pro-ship:deployed` on the tag records `env: release`, the tag push time with its source and three checks.
`git diff origin/main --stat` over the whole work touches no `CHANGELOG.md`.

## Security challenge

Run on 2026-11-03; kept verbatim in `security-challenge.md` beside this plan.
Verdict: proceed with required changes, two of them blocking.
The plan stays `Status: draft` until each item is folded into the interfaces and steps above and listed here with how it is met.

## Done

Filled in when the build is finished, before sign-off.

- Build commit: <sha>
- Checks run: <each command with its real result>
- Definition of done: <met or the items not met>
- Visual: none
- Doubt: <one line per doubted step or "none">
- AC1: <pass or fail, with what was observed>
- Sign-off: <the person's words and the date>

The sign-off moves `status` in the intent and the spec to `accepted` and ADR-0025 to `accepted`.

## Departures from plan

None yet.

## Noticed but not touched

None yet.
