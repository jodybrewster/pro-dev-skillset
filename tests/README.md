# tests/ — marketplace test + eval harness

Zero-dependency checks for `pro-dev-skillset`. The marketplace ships no runtime
code, so these validate the **content contract**: manifests, frontmatter, the
version-bump law, cross-skill references, and the `using-pro-dev` router.

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
| `frontmatter` | every `SKILL.md` has `name` + `description`; no `harness:`/`claude_code:` keys (Codex parity) | missing/forbidden frontmatter |
| `codex-parity` | no hard-coded `TodoWrite`/`TaskCreate`/`TaskUpdate` in skill bodies | Claude-Code-only tool names (warn) |
| `references` | every `@sidecar.md` and relative `.md` link resolves on disk | dangling sidecar references |
| `wikilinks` | every `[[slug]]` resolves to a real skill or a known bridge target | broken memory-style links |
| `router` | every route target in `using-pro-dev`'s diagram is a real/planned/external/command slug; warns on shipped skills the router never mentions | router drift |
| `bridges` | bridge skills (`qa-suite`, `ui-ux-pro-max`) name an install command that exists | a bridge pointing at a missing command |

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

## Run it in a target repo (after install)

The only guaranteed runtime in a user's repo is Claude Code itself, so the
install-time check ships as a slash command, not a script:

```
/pro-dev-doctor
```

It verifies the expected plugin set is installed, runs `claude plugin validate`
on what's present, and does a routing smoke check ("where do I start" →
`using-pro-dev`). See `plugins/pro-core/commands/pro-dev-doctor.md`.
