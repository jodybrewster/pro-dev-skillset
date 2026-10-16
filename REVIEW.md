# Review

How a pull request in this repo is reviewed, by a person or by an agent (`/code-review`, a reviewer subagent).
This repo ships skills, hooks, commands and agents into every repo that installs the marketplace, so a defect here reaches all of them on the next update.
Read the change's brief first: the `intent.md`, `spec.md` and `plan.md` under [`intent/`](./intent/) that the PR names.
Then make three passes over the diff, in this order, and report only what this page asks for.

## Pass 1: bugs

- Logic errors in hook scripts and test harnesses: wrong condition, wrong order, a value read before it is set, a regex that matches more or less than intended.
- Broken edge cases: an empty or missing field in a hook payload, a missing env var, a missing `python3`, a second concurrent session, a resumed or compacted session.
- Regressions: behavior the diff changes that a skill, a command, a test case under `tests/` or a doc still relies on.
- A skill, command or agent that references a sidecar, script or path that does not exist or is not tracked by git.
- A rule applied in the Claude manifest but not its Codex sibling, or in one plugin's hook but not the same hook in another plugin.
- A blocking hook with no behavior case in `tests/` that shows it blocking and one that shows it allowing.

## Pass 2: security

Hook scripts under `plugins/*/scripts/` run on every matching tool call in every consumer's session, so read each one the diff touches:

- A blocking decision is a `deny` (PreToolUse) or `block` (Stop, UserPromptSubmit) with a `reason` the user and the model can act on, and it blocks what the hook was written to block.
- A malformed, empty or unexpected payload must not crash the user's turn or wedge the session: the script catches its own errors, exits cleanly and never loops a Stop block (check `stop_hook_active`).
- A hook does not run network calls, write outside the project or the plugin's own state or execute text taken from the payload.

Secrets and personal data:

- No credentials in tracked files: AWS keys (`AKIA`, `ASIA`), Anthropic keys (`sk-ant-`), GitHub tokens (`ghp_`, `gho_`, `ghu_`, `ghs_`, `ghr_`, `github_pat_`), Slack tokens (`xoxb-`, `xoxp-`, `xoxa-`, `xapp-`) and private key blocks (`-----BEGIN ... PRIVATE KEY-----`).
- No absolute personal paths (`/Users/<name>`, `/home/<name>`) outside fictional fixtures; use a path relative to the repo root or a placeholder such as `<path-to-pro-dev-skillset>`.
- No tilde-prefixed home paths to one person's files: grep the diff for `~/.claude/` and `~/Projects/`.
  A documented location every user has, such as `~/.claude/settings.json` or `~/.codex/agents/`, is fine; a plan file, a checkout or a session folder is a finding.
- No email addresses outside the `author` or `owner` fields of manifests.
- Gathered evidence (`.research/`, `handoff.jsonl`, `routing.jsonl`) never enters a commit.

## Pass 3: compliance

- The diff does what its plan says, and nothing the plan rules out.
  A deviation is fine when the PR body or the plan records it.
- The version-bump law holds: every content change under `plugins/` bumps the plugin in both manifests and the marketplace entry, and `metadata.version` once ([ADR-0002](./docs/decisions/0002-version-bump-law.md)).
- The hook-loading law holds: every hook a plugin registers is in its one `hooks/hooks.json` and every script it runs exists and is tracked ([ADR-0003](./docs/decisions/0003-one-hooks-json-per-plugin.md)).
- Codex parity holds: harness-neutral skill prose, standard frontmatter, a version-aligned `.codex-plugin/plugin.json` and a `.toml` for every agent ([ADR-0004](./docs/decisions/0004-codex-parity.md)).
- Forked or adapted content keeps its footer and its upstream's copyright line in the plugin `LICENSE`, and [`docs/licenses.md`](./docs/licenses.md) gains its row.
- A new load-bearing decision comes with an ADR in [`docs/decisions/`](./docs/decisions/).

## What Important means

A finding is Important when it breaks behavior, leaks data or breaches a law above (the version-bump law, the hook-loading law, Codex parity or a rule in `CLAUDE.md` or this page).
Important findings block the merge.
Style, naming, wording and structure are nits.

## Nits

Report at most five nits per review, the ones most worth fixing.
Drop the rest.

## Do not report

- Vendored upstream content under `plugins/pro-spdd/upstream/`; it is reviewed against its upstream, not line by line.
- Build output and installed packages under `demo/app/` (`.next/`, `node_modules/`, `coverage/`) and any `node_modules/` elsewhere.
- Lockfiles (`package-lock.json`, `pnpm-lock.yaml`, `yarn.lock`).
- Anything `node tests/check.mjs`, `node tests/eval.mjs --dry` or `claude plugin validate --strict` already enforces: manifest shape, frontmatter keys, version equality, hook file names, sidecar references and routing case targets.
- `CHANGELOG.md` wording and other generated files.
