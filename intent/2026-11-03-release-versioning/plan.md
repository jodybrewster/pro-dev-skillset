# Plan: releases carry a version, checks that fit the target and deploy facts from the deploy

Built from `spec.md` and `intent.md` in this folder.
Status: approved.
Approver: the maintainer.
Dated: 2026-11-03.

## How it works in one breath

`ship.py` gains six deterministic subcommands and one `deployed` flag; the `ship` and `deployed` skills call them and say the results in plain words.
pro-ai-sdlc gains one intent field, one `/execute` step and new raises in `factory.py check_build`, so the inputs exist and a build cannot rewrite them.
Nothing tags, pushes or edits a generated file.
The work lands as six stacked pull requests, each bumping the plugin it touches.

## Interfaces

All in `plugins/pro-ship/scripts/ship.py`, standard library only, JSON on stdout, a refusal on stderr with exit 1, like the current subcommands (`ship.py:1094-1131`).

```
ship.py version [--target ID] [--base REF]
  {"state": "proposal|first-release|nothing",
   "target": "<id>", "last_tag": "v1.0.0"|null, "last_version": "1.0.0"|null,
   "declared": {"file": "package.json", "version": "1.0.0"|null, "valid": true}|null,
   "bump": "major|minor|patch"|null, "next": "1.1.0"|null, "next_if_not_breaking": "1.1.0"|null,
   "tag": "v1.1.0", "tag_command": "git tag -a v1.1.0 <40 hex> -m 'Release 1.1.0'"|null,
   "base_candidate": {"sha": "<40 hex>", "short": "abc1234", "date": "2026-01-05", "subject": "<clean text>"}|null,
   "counts": {"breaking": 0, "feature": 2, "fix": 1, "unknown": 0},
   "changes": [{"subject": "", "kind": "feature|fix|breaking|unknown", "source": "intent|commit", "intent": "<folder>|null"}],
   "unclassified": ["<subject>"], "reasons": ["0.x: breaking bumps minor"], "notes": ["<skipped tag or folder>"],
   "sentence": "v1.1.0 (minor): two features and one fix since v1.0.0",
   "question": null | "<one plain sentence>"}
ship.py version --agree X.Y.Z [--commit SHA] [--carry]
  -> {"checks": [{"item": "manifest|changelog|tag|go", "status": "pass|finding|confirm", "evidence": ""}],
      "tag_command": "<built by ship.py>"|null, "carried": "<preflight evidence key>"|null}
ship.py version --baseline X.Y.Z --commit SHA
  -> {"evidence_key": "ship-preflight-<sha12>", "tag_command": "<built by ship.py>"}
ship.py changelog                  -> {"mode": "manual|generated|none", "why": "<marker or key>", "path": "CHANGELOG.md"|null,
                                       "unreleased": ["<clean line>"], "groups": ["Added"]}
ship.py changelog --check BASE HEAD -> {"missing": ["<intent folder>"], "no_migration": ["<intent folder>"], "confirm": ["deprecation window"],
                                        "mode_change": {"from": "manual", "to": "generated"}|null}
ship.py prepare X.Y.Z              -> {"files": ["package.json", "CHANGELOG.md"], "skipped": [{"file": "", "why": ""}]}
ship.py checks --target ID         -> {"kind": "tag-release", "items": ["tests on a clean checkout of the tag", "documented use runs", "rollback dry run"],
                                       "refused": ["health", "error rate", "latency", "logs"],
                                       "documented_use": {"source": "ship-block|readme|none", "text": "<clean text>", "commit": "<short sha>|null", "runnable": true|false}}
ship.py clean-run --tag TAG --target ID --step tests|use
  -> {"step": "tests", "tag": "v1.1.0", "command": "<what ran>", "image": "<image>", "exit": 0, "tail": "<clean last lines>"}
ship.py protection [--target ID]   -> {"tags_protected": "yes|partial|no|unknown", "via": {"kind": "ruleset|classic|none", "name": ""|null, "bypass": ["<actor>"]}|null,
                                       "missing": ["creation|update|deletion|active|exclude"], "ci_on_tags": "yes|no|unknown", "factory_repo": true|false, "notes": []}
ship.py deployed --from-tag TAG --target ID [--env E] [--checks FILE]
  (adds detail_json keys "time_source": "github-deployment|release|tag-push-run|tagger-date|commit-date|given|github", "env_source": "target|default|given")
```

Rules the code follows:

- Tag names: every tag name ship.py reads or proposes passes a full match of `^(?:[a-z0-9][a-z0-9._-]{0,63}(?:--|@))?v?\d+\.\d+\.\d+$` before it reaches a command, a `gh api` path or a record.
  `release_tags` applies it after the glob or semver filter; a tag that fails is not a release tag and is named once in `notes`.
- Last tag: the highest version among the target's valid release tags merged into HEAD, never the newest by date.
  The target's tags are the ones with its `<id>--v` or `<id>@` prefix when any exist, else the unprefixed ones, else the prefix of the newest tag by date.
  `scope` (several prefixes share one range) takes each prefix's highest and then the newest of those by date, so a late lightweight `v0.0.1` moves nothing.
- Collision: `version` refuses a `next` that is not above every valid release tag, local and from `git ls-remote --tags origin` with a 10 second timeout; `--agree` checks the same list.
  An unreadable remote gives a note and the local list; `--agree` then reads `confirm` for the tag item.
  This is the one network call in `version` and it overrides N1 for that call.
- Tag style: the last tag's prefix is kept (`v`, none or `name--v`); with no tag it is `v` or `<id>--v` when the Ship block's `tag_pattern` has a `--v` shape.
- Built by ship.py and printed verbatim by the skill: `sentence`, `question` and `tag_command`.
  `tag_command` goes through `shlex.quote` and holds a real commit; `version` builds it for HEAD and `--agree --commit` rebuilds it for the commit that gets tagged.
- Repo text: every string read from the repo (subjects, changelog lines, folder names, the declared version) goes through `clean()`, which strips control and escape characters and caps the length at 200.
  An intent folder that fails `^\d{4}-\d{2}-\d{2}-[a-z0-9-]{1,60}$` is skipped and named in `notes`.
  The question names a commit as `abc1234, 2026-01-05, "subject"`; the short sha sits beside the words so a swapped sha shows, which is how this plan reads AC1's "no bare hash".
- Severity: `kind` and `breaking` of an intent are the most severe values that file has had on HEAD's history (`git log` over the file, read with `git show`, never from the working tree).
  Once `breaking: true`, always true; breaking outranks feature, feature outranks fix.
  The person can still lower the result when answering the proposal.
- Declared version that is not `X.Y.Z`: `declared.version` is null, `declared.valid` false, the state follows R8 (`v0.1.0`) and `notes` says the manifest holds an unusable value without quoting it.
- Intent of a change: the `intent/<folder>/intent.md` paths touched in `base..HEAD` (`git diff --name-only`); read with `factory.py`'s plain frontmatter rule, copied as a few lines because pro-ship cannot import pro-ai-sdlc.
- Commit fallback only for commits that touch no `intent/` path; a commit with no prefix counts as `unknown` and also lands in `unclassified`, so `next` assumes breaking and `question` asks (this replaces R3's "counts as a fix").
- First release: `base_candidate` is the parent of the oldest commit that added a path under `intent/` (`git log --diff-filter=A --format=%H --reverse -- intent/`); with no `intent/`, the newest commit where `git show <sha>:<manifest>` holds the declared version.
- Manifest readers: `package.json` through `json`; `pyproject.toml` and `Cargo.toml` through `tomllib` with a regex fallback on the `[project]`, `[tool.poetry]` and `[package]` tables; a workspace uses the file at the target's `path` (`ship.py:416-440`).
- `prepare` edits with a single anchored regex on the version line of the one manifest and rewrites the changelog heading; it re-reads the file and refuses if the written version differs.
  It refuses when the manifest, the changelog or any parent folder is a symlink or resolves outside the repo root and writes with `tempfile.mkstemp` in the same folder, never through `write_atomic`.
  `version` and `changelog` read a manifest or changelog through the same check and treat a symlink as absent, with a note.
- Binding a release commit to its GO: `version --agree X.Y.Z --commit Z` reads the GO head from `.pro-dev/ship/preflight.json`, reruns `prepare`'s own transform on that commit's manifest and changelog and compares the result byte for byte with Z.
  The `go` check fails on any other path in `git diff <GO head> Z` and on any other line in those two files (the changelog date is read from Z's heading); `tag_command` is then null.
  `--carry` writes a new preflight record for Z with `detail.carried_from: <GO head>`, so `ship-gate` reads Z as fresh and nothing relies on the retry.
- First-release tag: `version --baseline X.Y.Z --commit B` writes a preflight record for B with `detail.baseline: true` after the person answers the first-release question.
  It refuses when a release tag exists, when B is not an ancestor of HEAD or when the name fails the tag rule.
  It says "nothing new ships, this names what was already out"; the first real release then gets its own GO on its own range.
- Headless sessions never run `prepare`, `version --agree`, `version --baseline`, `clean-run` or `deployed`.
  `session.sh` exports `FACTORY_SESSION=1` and ship.py refuses those subcommands when it is set; the host's branch protection and level checks remain the real control, since a steered session can unset a variable.
- Clean checkout: `clean-run` pipes `git archive <tag>` into `docker run -i --rm --entrypoint sh --cap-drop ALL --security-opt no-new-privileges <image>` and untars inside the container.
  No host path is mounted, no `-e` or `--env-file` is passed, so no token and no env file reach it.
  The network is off, because Docker Desktop can reach the host and the LAN from the default bridge; tests that install need `test_network: true` in the Ship block, a policy file the factory cannot touch without level 3.
  The image is the target's `check_image` or else the newest local `pro-dev-factory` image; no docker or no image is a refusal and the skill records `confirm` with the command for the person.
  It never falls back to the host.
- Test command: the target's `test_command` in the Ship block, else `npm ci && npm test`, `npm test`, `pytest` or `cargo test` from the manifest; none is a refusal naming the key.
- Documented use: the target's `documented_use` in the Ship block, a policy file the factory cannot touch without level 3.
  The skill shows that command and runs `clean-run --step use` only after the person confirms.
  With no key, `checks` prints the README's first usage example as text with the commit that last touched it and `runnable: false`; the skill never runs it and the item ends `confirm`.
- Changelog mode order: Ship block `changelog:` key, then markers, then the file (spec R10).
- `deployed --from-tag` with no `--checks` keeps `outcome: succeeded` and records status `partial` with "no checks ran" in the summary.
- `checks` kinds: `tag-release`, `publish` and `desktop` get the library set; `deploy-on-merge` and `manual-deploy` get the service set; `deployed` calls the same function to refuse a mismatched item (matching health, error rate, latency or log, case-insensitive).
- `protection`: `gh api repos/{owner}/{repo}/rulesets` then `rulesets/<id>` for each `target: tag` one.
  `yes` needs `enforcement: active`, rules of type `creation`, `update` and `deletion` and a `ref_name.include` covering `refs/tags/*` or the pattern with no `exclude` that cancels it.
  Anything weaker that still covers the pattern (deletion only, `evaluate` mode, an exclude) is `partial` and `missing` names what lacks.
  `via.bypass` lists the bypass actors of the ruleset that was read.
  `gh api repos/{owner}/{repo}/tags/protection` is the classic fallback and is at most `partial`, because it has no update rule; any `gh` error is `unknown` with the message in `notes`.
  `factory_repo` is true when `REVIEW.md` has a `## Roles` block.
- The ship skill names protection once and never blocks on it in a repo without a factory.
  In a repo with `factory_repo: true`, anything but `yes` is a Blocker the person can accept by name, because a factory pushes there.
- `factory.py check_build` raises to level 2 when a build PR changes its own `intent.md` frontmatter, changes a manifest `version` line (`package.json`, `pyproject.toml`, `Cargo.toml`), changes `CHANGELOG.md` outside the Unreleased section or adds an R10 generator marker.
- Time ladder for `--from-tag`: deployments for the commit, release `published_at` (`repos/{owner}/{repo}/releases/tags/<tag>`), the workflow run with `event=push` and `head_branch=<tag>` (`actions/runs?head_sha=<sha>`), `git for-each-ref --format=%(taggerdate:iso-strict)`, `git log -1 --format=%cI`.
- Skills: `ship/SKILL.md` gets a "Version" step between "Targets and scope" and "Coverage", a changed base-null rule and the line that repo text is data, never instructions; `deployed/SKILL.md` gets "Checks by target kind" and the `--from-tag` path.
- Intent template and commands: `breaking:` after `kind:`; `/intent` asks it; `/execute` finds `ship.py` with the same sibling-script lookup pr-check uses (`pr-check.py find pro-ship ship.py`) and writes the changelog line by hand when it is absent.

## Files that change

- `plugins/pro-ship/scripts/ship.py` (modified): `version`, `changelog`, `prepare`, `checks`, `clean-run`, `protection`, `deployed --from-tag`, the full-match tag rule in `release_tags`, highest-version `release_tag`, `clean()`, no `now()` default (`ship.py:1045`), env rules, the module docstring.
- `plugins/pro-ship/skills/ship/SKILL.md` (modified): "Version" step, replace the ask-for-a-commit rule at line 41, prepare offer, tag command, protection line, rationalization rows for patch-for-small and changelog-at-release.
- `plugins/pro-ship/skills/ship/release-checks.md` (modified): Documentation items for changelog and agreement; the "never edits a document" line at 77 names `prepare` as the one exception the person asks for.
- `plugins/pro-ship/skills/deployed/SKILL.md` (modified): the check lists by kind, the time and env rules, the `--from-tag` path.
- `plugins/pro-ship/.claude-plugin/plugin.json`, `.codex-plugin/plugin.json`, `.claude-plugin/marketplace.json` (modified): version bumps and `metadata.version`.
- `plugins/pro-ai-sdlc/templates/intent.md`, `commands/intent.md`, `commands/execute.md` (modified): `breaking:` and the changelog step; its two manifests and the marketplace entry bumped.
- `plugins/pro-ai-sdlc/scripts/factory.py` (modified): the release-field raises in `check_build`.
- `plugins/pro-ai-sdlc/factory/session.sh` (modified): `export FACTORY_SESSION=1`.
- `tests/factory.mjs` (modified): a case per new raise.
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

1. pro-ship 0.13.0: `version`, the tag rule, highest-version last tag, the remote collision check, `clean()`, severity over history, first-release detection, manifest readers, `changelog` mode and the `ship` skill's Version step (size S; R1 to R8, R10, R23; AC1 to AC5).
   Checkpoint: `python3 plugins/pro-ship/scripts/ship.py version` in a fixture repo prints the sentence of AC2; `node tests/ship-version.mjs` passes, including a tag holding a command substitution that never reaches `tag_command`.
2. pro-ai-sdlc 0.15.0: `breaking:` in the template, `/intent` question, `/execute` changelog step, the `check_build` raises and `FACTORY_SESSION` (size S; R9, R11; AC5).
   Checkpoint: `node tests/check.mjs` passes; `node tests/factory.mjs` passes with a case per raise; a read of `execute.md` shows the generated-mode refusal.
3. pro-ship 0.14.0: `changelog --check` with `mode_change`, `prepare` with the symlink rule and `mkstemp`, `version --agree --commit --carry`, `version --baseline`, the headless refusal and the release-check items (size S; R12 to R14, R22; AC6).
   Checkpoint: `prepare 1.1.0` on the fixture, `git status --short` lists only the manifest and the changelog, `git tag` is empty, `--agree 1.1.0` passes; a symlinked `CHANGELOG.md.tmp` writes nothing outside the repo; a stray line in the release commit fails the `go` check.
4. pro-ship 0.15.0: `checks`, `documented_use`, `clean-run`, the refusal in `deployed`, `--from-tag` with its name check and partial rule, no `now()` default, env rules, the `deployed` skill and `docs/loop-records.md` (size M; R15 to R19, R24; AC7, AC8).
   Checkpoint: `node tests/ship-deploy.mjs` passes with the new cases; a docker stub shows `clean-run` passes no `-v`, `-e` or `--env-file`.
5. pro-ship 0.16.0: `protection` with `partial`, the `/ship` line and the factory-repo Blocker (size S; R20, R21; AC9).
   Checkpoint: stubbed answers print `yes`, `partial`, `no` and `unknown`.
6. Docs and law: `CLAUDE.md` Ship block `changelog: generated`, `docs/ship-preflight.md`, roadmap (size XS; R24; AC10, AC11).
   ADR-0025 stays proposed until the sign-off.
   Checkpoint: the grep of AC11 is empty; `node tests/check.mjs` passes.

Irreversible: none in the code.
The first release tag a person pushes is irreversible and is theirs.

## Tests that prove it

- `tests/ship-version.mjs` builds throwaway git repos like `tests/ship-deploy.mjs` does (temp dir, git config pointed away, `gh` stub on PATH) and covers:
  - no tag with each of the three manifests, a manifest that differs at the candidate commit, no manifest and no intent folder (`v0.1.0`);
  - tag `v1.0.0` with feature, fix, breaking and unknown intents and the 0.x rule;
  - tag styles `v1.2.3`, `1.2.3` and `name--v1.2.3` with `tag_pattern`;
  - tags holding `$(...)`, backticks, `#` or `&`: not release tags, named in `notes`, absent from `tag_command`;
  - a later lightweight `v0.0.1` does not become `last_tag`; a `next` that collides with a remote-only tag refuses (a local bare repo stands in for origin);
  - an intent that was `breaking: true` then `false` still reads breaking; an intent folder with a bad name is skipped; a subject with ANSI escapes comes out clean;
  - a commit with no intent classified by `feat:`, `fix:`, `!` and `BREAKING CHANGE:` plus one with no prefix counted as `unknown`;
  - a declared version that is not `X.Y.Z` never appears in `question` or `tag_command`;
  - an empty range;
  - changelog mode for each marker, the Ship block key winning and a file saying it is generated;
  - `prepare` on manual, generated and none; a dirty tree; a bad version string; an existing tag; the tree after (only two files change, `git tag` empty, no commit);
  - `prepare` with a symlinked manifest, changelog, parent folder and `CHANGELOG.md.tmp`: refused or nothing written outside the repo;
  - `prepare`, `--agree`, `--baseline`, `clean-run` and `deployed` refuse under `FACTORY_SESSION=1`;
  - `--agree` pass and each of the failures, `--commit` with a stray line or file failing `go`, `--carry` making `check` read fresh on Z and `--baseline` on a first release;
  - a PATH stub for `git` subcommands `tag` and `push` that fails the test if called.
- `tests/ship-deploy.mjs` adds: `--from-tag` for each rung of the ladder (the stub answers one rung at a time), no flag and no `--deployed-at` refusal, `env` default `release` with `env_source`, a health check refused on `tag-release` and accepted on `deploy-on-merge`, the record shape unchanged (`schema` 1), `clean-run` against a docker stub that logs its argv and stdin (no `-v`, no `-e`, no `--env-file`, a tar on stdin; no docker refuses), `documented_use` from the Ship block and the README path with `runnable: false`, `--from-tag` with a bad tag name refused before any `gh` call and with no checks reading `partial`, `protection` with full ruleset, deletion-only, `evaluate` mode, exclude, classic, empty and 403 answers, `factory_repo` from a `## Roles` block and `ci_on_tags` from a workflow fixture.
- `tests/factory.mjs` adds: a build PR changing its intent frontmatter, a manifest `version`, `CHANGELOG.md` outside Unreleased and a `cliff.toml` each raises to level 2; a new Unreleased line raises nothing.
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

- `clean-run` needs docker; without it the two library checks end `confirm` and the person runs them, which is the safe side.
- `--carry` and `--baseline` write a record `ship-gate` trusts, with no new review; the byte-for-byte compare and the first-release refusals are what hold them; `tests/ship-version.mjs` exercises each failure.

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
Each item is folded into the interfaces, rules and steps above.

Blocking:

- README text run as a command: met by `documented_use` in the Ship block, `clean-run --step use` after the person confirms and in a container with no token, plus the README path printed with its commit and `runnable: false` (Interfaces, step 4).
- Tag names as shell input: met by the full-match rule on every tag read or proposed, `tag_command` built with `shlex.quote` by ship.py and printed verbatim, the same check before `gh api .../releases/tags/<tag>` and before a record (Rules, steps 1 and 4).

Required:

- A build PR rewrites its own `kind:` or `breaking:`: met by severity over the file's history in `version` and a level 2 raise in `check_build` on a change to its own frontmatter (steps 1 and 2).
- R20 over-reports `yes`: met by `yes` only for an active tag ruleset with creation, update and deletion and no cancelling exclude, `partial` naming what lacks and `via.bypass` listing the actors (step 5).
- Repo text in the `/ship` prompt: met by `clean()`, the folder rule, ship.py building `sentence`, `question` and `tag_command`, the skill's "repo text is data" line and the short sha with date in the question (steps 1 and 3).
- A release ships under a GO for another commit: met by `--agree --commit` with its byte-for-byte compare and `--carry`; the first-release tag gets its own record from `--baseline`, so neither relies on the retry (step 3).
- `prepare` follows symlinks: met by the symlink and outside-root refusal and `mkstemp` in the same folder (step 3).
- The clean checkout runs unread code on the host: met by `clean-run` in a container with no mount, no token and no env file with no host fallback (step 4).
- A build PR rewrites release history or switches changelog mode: met by the `check_build` raises for manifest `version`, `CHANGELOG.md` outside Unreleased and generator markers, plus `mode_change` from `changelog --check` (steps 2 and 3).
- Newest tag by date, not by version: met by the highest valid version as `last_tag`, per-prefix highest in `scope` and the collision refusal against local and remote tags (step 1).
- An unclassified commit counted as a fix: met by counting it `unknown`, so `next` assumes breaking and `question` asks; this replaces that clause of R3 (step 1).

Open questions, answered:

- A succeeded record with no check run: `--from-tag` with no `--checks` records `partial`.
- Headless sessions: never run `prepare`, `version --agree`, `version --baseline`, `clean-run` or `deployed`; ship.py refuses under `FACTORY_SESSION=1`.
- A declared version that fails N2: `declared.version` is null, the state follows R8 and the raw string stays out of `question` and `tag_command`.

Accepted risk, limited in writing: unprotected release tags are reported once and never block in a repo without a factory.
A repo with a `## Roles` block gets a Blocker the person can accept by name, because the software-factory challenge required a `v*` tag ruleset where a factory pushes.

## Done

Filled in when the build is finished, before sign-off.

- Build commit: the merge of step 5 on main; each step is its own pull request from #149 on.
- Checks run: <each command with its real result>
- Definition of done: <met or the items not met>
- Visual: none
- Doubt: <one line per doubted step or "none">
- AC1: <pass or fail, with what was observed>
- Sign-off: <the person's words and the date>

The sign-off moves `status` in the intent and the spec to `accepted` and ADR-0025 to `accepted`.

## Departures from plan

- Step 1: a release change (only the manifest's version line and the changelog) is not counted as a change, so rerunning `version` on the merged commit gives the same number.
- Step 1: `tag_command` is null while `question` waits for an answer, since the number depends on it.
- Step 1: `scope` gains `base_tag` and, with no `tag_pattern`, ignores a tag series no target owns; `v1.0.0` and `1.0.0` are one series (security review of the diff).
- Step 1: a commit's own breaking mark or `feat` prefix raises the intent it touches (security review of the diff).
- Step 1: `CLAUDE.md` gains `pr-check timeout: 900`, because `node tests/check.mjs` passes the 300 second default and every pr-check read `incomplete`.
- Step 1: `merge_kind` reads the commits a merge brought in, so a merge commit's own subject never decides the kind; messages are read split on NUL so a separator in a body shifts nothing.
- Step 1: `version` counts every intent touched in the range as R3 says and adds a note when no commit there changes anything outside `intent/`.
- Step 2: `/execute` reads the changelog mode from the repo by hand instead of through `ship.py`: the rule is short, `python3` is not pre-approved and no dependency on pro-ship is needed.

- Step 3: `--baseline` needs `--already-out` on every commit, passed only on the person's own yes, and refuses an unreadable origin; the whole-history answer goes through a normal preflight from the empty tree so the first commit is reviewed; `version` never offers HEAD as the commit (security review).
- Step 3: `changelog --check` counts a line while it is still under Unreleased and matches a build in a separate commit on the words of the intent's title, since R12 gives no other link between an entry and an intent.
- Step 3: `prepare` takes `--target` so it follows `version --target`.
- Step 4: `clean-run` names its container so a timeout can kill it and refuses a command longer than what the person is shown.
- Step 4: `tests/fixtures/ship-version/` is not added; the tests build their repos inline like `tests/ship-deploy.mjs`.
- Step 5: in a factory repo any bypass actor but the repository admin role is `partial`; an unreadable bypass list proves nothing.

## Noticed but not touched

- `ship.py` `intent_facts` does not follow a renamed intent folder: `git log --follow` reads similar intents as renames and mixes their severity. A build that renames a folder already raises level 3 as a policy path.
- The tag rule rejects `@scope/pkg@1.2.3`, the shape changesets uses, so such a repo reads as having no release tag and `version` asks; the rule is the one the security challenge named.
