# tests/ - marketplace test + eval harness

Zero-dependency checks for `pro-dev-skillset`. Most of what the marketplace
ships is content, so these mostly validate the **content contract**: Claude and
Codex manifests, frontmatter, the version-bump law, cross-skill references, and
the `using-pro-dev` router. The hook scripts are the exception - they are real
executable code, so `git-safe.py` also gets a **behaviour** test that runs it.

Everything runs on plain Node ≥ 18 - no `npm install`, no toolchain.

## Run it here (the marketplace repo)

```bash
node tests/check.mjs          # every check         (alias: npm test)
node tests/check.mjs versions # one check by name
node tests/git-safe.mjs       # the git-safe hook cases, standalone + verbose
node tests/memory-hooks.mjs   # the memory-hook cases (recall + ledger), standalone
node tests/eval.mjs --dry     # validate eval cases reference real skills (no API)
node tests/eval.mjs           # live routing eval  (needs ANTHROPIC_API_KEY)
```

`check.mjs` exits non-zero on any failure (warnings are allowed). It's the same
gate CI runs (`.github/workflows/validate.yml`).

### Static checks (`check.mjs`)

| Check | What it asserts | Fails on |
|---|---|---|
| `versions` | `plugin.json` version == its `marketplace.json` entry; intra-marketplace `^x.y.z` deps are satisfiable | the version-bump law being violated |
| `frontmatter` | every `SKILL.md` has `name` + `description` and only portable Agent Skills frontmatter keys | missing/non-portable frontmatter |
| `codex-parity` | command/skill/sidecar prose avoids hard-required Claude-only tool names and flags harness-specific surfaces | Claude-Code-only tool names |
| `codex-manifests` | concrete skill-bearing plugins have `.codex-plugin/plugin.json` aligned with their Claude manifests and the repo-local Codex marketplace | missing/stale Codex plugin metadata |
| `references` | every `@sidecar.md` and relative `.md` link resolves on disk | dangling sidecar references |
| `wikilinks` | every `[[slug]]` resolves to a real skill or a known bridge target | broken memory-style links |
| `router` | every route target in `using-pro-dev`'s diagram is a real/planned/external/command slug; warns on shipped skills the router never mentions | router drift |
| `bridges` | bridge skills (`qa-suite`, `impeccable-bridge`, `lavish`, `taste-skills-bridge`, `web-design-engineer-bridge`, `tastemaker-bridge`, `mengto-skills-bridge`) name an install command that exists | a bridge pointing at a missing command |
| `hooks` | only `hooks/hooks.json` is auto-loaded, so every hook config is either that file or declared in `plugin.json` `hooks`; referenced `${CLAUDE_PLUGIN_ROOT}` scripts exist and are tracked by git; event names are valid | an unloaded hook file, a missing hook script, a misspelled event; an existing-but-untracked hook script warns locally and fails when `CI` is set |
| `git-safe` | runs the real `pro-core/scripts/git-safe.py` once per case (PreToolUse payload on stdin) and asserts its block/allow exit code | a wrong block or allow decision; no `python3` = warning-level skip |
| `memory-hooks` | runs the real `memory-recall.py` and `daily-log.py` once per case (hook JSON payload on stdin, sandboxed `HOME`) and asserts recall/ledger/timer-gate behaviour | a wrong recall or ledger decision, or `dream-timer.has_memory_content()` counting the daily ledger as memory content; no `python3` = warning-level skip |
| `agents` | every `agents/*.md` has `name`+`description`, name matches filename, and has a `.codex-plugin/agents/<n>.toml` counterpart | agent frontmatter drift, malformed Codex `.toml` (missing counterpart = warning) |
| `eval-coverage` | every shipped skill and subagent is named by at least one `expect` in `routing.jsonl` | never fails; warns so untested routing stays visible |

### Coverage reality

`eval-coverage` currently warns on ~32 skills and subagents with no routing case
against 32 cases covering the rest. Routing coverage is partial by design at the
edges (SPDD leads route as a pipeline, `pro-motion` and `pro-nextjs` skills are
picked by file context more than by prompt), but the warnings are the honest list
of what no eval asserts.

The **live** eval never runs in CI - `.github/workflows/validate.yml` runs
`eval.mjs --dry`, which only proves cases reference real slugs. Run
`node tests/eval.mjs` locally with a key before shipping routing-visible changes.

Roadmap skills the router intentionally names (pro-security, pro-ship, the
Phase 4–7 build folds) live in the `PLANNED` allowlist at the top of
`check.mjs` - trim each as it lands so drift re-arms.

### Hook behaviour test (`git-safe.mjs`)

The `hooks` check proves `git-safe.py` is wired into `hooks/hooks.json` and exists on disk.
It cannot prove the script decides correctly, and this is the one hook where a wrong decision is expensive in both directions: a false negative lets an irreversible command through, a false positive wedges the session on safe work.

So `git-safe.mjs` drives the real script the way Claude Code does - one `python3` process per case, the PreToolUse JSON payload on stdin, exit code read back (2 = blocked, anything else = allowed).

```bash
node tests/git-safe.mjs                # every case  (alias: npm run test:git-safe)
node tests/git-safe.mjs --only=heredoc # substring filter on case id
node tests/check.mjs git-safe          # the same cases, as the gated check
```

The case table lives in `git-safe.mjs` only.
`check.mjs` imports its `runGitSafeCases()` runner and reports the results as the `git-safe` check, so the cases are part of the required PR gate rather than something you have to remember to run.
Failures are real failures; a missing `python3` is a warning-level skip, so a runner without a Python interpreter never goes red over a missing dependency.

### Hook behaviour test (`memory-hooks.mjs`)

The `hooks` check proves `memory-recall.py` and `daily-log.py` are wired into `hooks/hooks.json` and point at scripts that exist on disk.
It cannot prove either script decides correctly - that recall actually ranks and injects the right memory note, or that the ledger actually writes what it claims to write.

So `memory-hooks.mjs` drives the real `memory-score.py`, `memory-recall.py`, and `daily-log.py` scripts the way Claude Code does - one `python3` process per case, the hook's JSON payload on stdin, stdout and exit code read back.

Cases split into three families.
Recall behaviour: a prompt relevant to a stored memory note injects that note's body, an unrelated prompt injects nothing, an archived memory is excluded even when it would otherwise score highest, and `MEMORY.md` itself is never injected, since it is the index and not a note.
Ledger behaviour: a session writes exactly one dated entry under `<memory dir>/daily/YYYY-MM-DD.md`, a later turn in the same session increments that entry's turn count instead of duplicating it, and the hook never creates a memory directory that did not already exist.
The timer regression is the reason this suite exists: the daily ledger lives inside the memory directory it logs for, and if `dream-timer.has_memory_content()` counted the ledger file as memory content, every project would fall due at every interval and nudge forever with nothing ever eligible to promote.
That is the exact failure the content gate in `dream-timer.py` was written to prevent, and no existing check would have caught it - `hooks` only proves the script is wired up, not that it counts correctly.

`--plugin-root` matters because the same case table runs against two different trees.
`check.mjs` runs it against the source tree in `plugins/pro-core/scripts/`, on every PR, which proves the logic itself is correct.
`demo/setup.sh` runs it again with `--plugin-root` pointed at the installed copy in the plugin cache, which proves the version-bump law actually served fresh content into a real install rather than a stale cached copy.

```bash
node tests/memory-hooks.mjs                            # every case
node tests/memory-hooks.mjs --only=ledger              # substring filter on case id
node tests/memory-hooks.mjs --plugin-root=/abs/path    # run against an installed copy
node tests/check.mjs memory-hooks                      # the same cases, as the gated check
```

The case table lives in `memory-hooks.mjs` only.
`check.mjs` imports its `runMemoryHookCases()` runner and reports the results as the `memory-hooks` check, so the cases are part of the required PR gate rather than something you have to remember to run.
Failures are real failures; a missing `python3` is a warning-level skip, same as `git-safe`.

All cases run inside a disposable sandbox `HOME` and never touch the developer's real `~/.claude` memory files.

### Routing evals (`eval.mjs`)

Feeds every non-gstack skill's `name`+`description` to Claude as the router and
checks it picks the expected skill per case. Cases are in
[`cases/routing.jsonl`](cases/routing.jsonl):

```json
{ "prompt": "...", "expect": "slug" | ["slugA","slugB"], "notOneOf": ["x"] }
```

`expect` = chosen skill must be one of these. `notOneOf` = chosen skill must
NOT be one of these (encodes HOLD boundaries, e.g. "secure this endpoint" must
not fire a pro-testing skill). Without `ANTHROPIC_API_KEY` it runs `--dry`
(static case validation only), so keyless CI still passes.

The router runs at `temperature: 0`, so results are deterministic run to run -
a failure is a real routing disagreement, not sampling noise.
The catalog also includes a hardcoded `DISTRACTORS` list (`impeccable`,
`dataviz`, `skill-creator`, `humanizer`) - external user-level skills that
compete for the same prompts in real sessions.
They keep the eval honest: a marketplace description has to win against the
neighbors it actually faces, not just against its siblings.
Distractor slugs are valid in `expect`/`notOneOf`.

### Bridge install smoke test (`bridge-install-smoke.mjs`)

Network-dependent: proves the `npx skills add` targets behind the pro-design
bridges actually install with valid frontmatter into a fresh temp dir. It now
covers several collections, not only the original one:
`Leonxlnx/taste-skill` (13 skills, behind `taste-skills-bridge`),
`ConardLi/garden-skills` `web-design-engineer`, `MengTo/Skills`
`video-to-superprompt`, and `codeswithroh/tastemaker`.

```bash
node tests/bridge-install-smoke.mjs
```

Not part of `check.mjs` or the required PR gate - it needs network access, so
it runs on demand (`workflow_dispatch`) and on a weekly schedule
(`.github/workflows/bridge-install-smoke.yml`).

### Handoff evals (`handoff.mjs`)

`eval.mjs` tests a synthetic router - it never proves a real session actually
reaches for a bridge. This harness drives real headless `claude -p` sessions
against the built demo app and checks whether the session itself routes to a
bridge's install path (`taste-skills-bridge`, `impeccable-bridge`) instead of
winging the work inline. Cases live in
[`cases/handoff.jsonl`](cases/handoff.jsonl):

```json
{ "prompt": "...", "mustMatch": ["regex", ...], "mustNotMatch": ["regex", ...], "note": "..." }
```

```bash
./demo/setup.sh              # one-time: install the plugin stack into demo/app
node tests/handoff.mjs       # run every case
node tests/handoff.mjs --only=1   # run just case 1 - a cheap sanity check
```

Opt-in and spends real API tokens - not part of `check.mjs` or the PR gate.
Skips cleanly (exit 0) if the `claude` CLI isn't on PATH or `demo/app` has no
installed plugin state. See the header comment in `handoff.mjs` for the
output-format and flag choices.

## Run it in a target repo (after install)

The only guaranteed runtime in a user's repo is Claude Code itself, so the
install-time check ships as a slash command, not a script:

```
/pro-dev-doctor
```

It verifies the expected plugin set is installed, runs `claude plugin validate`
on what's present, and does a routing smoke check ("where do I start" →
`using-pro-dev`). See `plugins/pro-core/commands/pro-dev-doctor.md`.
