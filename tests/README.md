# tests/ — marketplace test + eval harness

Zero-dependency checks for `pro-dev-skillset`. The marketplace ships no runtime
code, so these validate the **content contract**: Claude and Codex manifests,
frontmatter, the version-bump law, cross-skill references, and the
`using-pro-dev` router.

Everything runs on plain Node ≥ 18 — no `npm install`, no toolchain.

## Run it here (the marketplace repo)

```bash
node tests/check.mjs          # all static checks  (alias: npm test)
node tests/check.mjs versions # one check by name
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
| `bridges` | bridge skills (`qa-suite`, `impeccable-bridge`, `lavish`, `taste-skills-bridge`) name an install command that exists | a bridge pointing at a missing command |

Roadmap skills the router intentionally names (pro-security, pro-ship, the
Phase 4–7 build folds) live in the `PLANNED` allowlist at the top of
`check.mjs` — trim each as it lands so drift re-arms.

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

Network-dependent: proves `npx skills add https://github.com/Leonxlnx/taste-skill`
(the vercel-labs/agent-skills CLI behind `taste-skills-bridge`) actually
installs its 13 skills with valid frontmatter into a fresh temp dir.

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
