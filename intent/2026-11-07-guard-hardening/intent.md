---
id: PDS-51
source: idea
kind: change
breaking: false
status: proposed
risk: medium
level: 3
created: 2026-11-07T14:00:00-0500
author: the maintainer
---

# Intent: guard hardening

Author: the maintainer.
Source: idea, from [docs/roadmap.md](../../docs/roadmap.md) items 32, 33, 34, 40 and 43 and its "Guard hardening" grouping, after the comparison with super-board 3.3.0 and agent-skills in #166.
Status: proposed.
Created: 2026-11-07.

## Problem

The guards that every starter install runs leave five holes, each verified on 2026-11-07 against `origin/main` at 20c5666.
They let an agent delete or overwrite a protected branch, read a secret into the transcript, write a live key into a file, delete files outside the project or print a staged secret into the log.

Hole 1 (item 32): `plugins/pro-core/scripts/git-safe.py` matches pushes with regexes and only knows `main` and `master`.
Fed the hook's own Bash payload (`{"tool_name":"Bash","tool_input":{"command":...}}`, as `tests/git-safe.mjs` does) in a scratch repo with `main` checked out, these all exit 0 and pass:

- `git push origin --delete main`, `git push --delete origin main` and `git push origin :main`, because `_GIT_PUSH_DELETE` exempts any command with `--delete` or `:main` from the protected-branch rule.
- `git push origin HEAD:refs/heads/main` and `git push origin refs/heads/main`, because the regex wants `:main` or a bare `main` token.
- A bare `git push` and `git push origin HEAD` while `main` is checked out, because the script never asks git which branch is checked out.
- `git push origin trunk` in a repo whose default branch is `trunk`, because the protected set is the two literal names.
- `git -C ../x push origin main`, because the regex wants `push` right after `git`.
- `git push --all` and `git push --mirror`, which update every branch.

The same regex also blocks safe pushes: `git push origin main-fix` and `git push origin master.bak` exit 2 because `\b` matches before the hyphen and the dot.
`git push origin main`, `git push origin +main` and `git push origin feat:main` do exit 2 today.
The pro-ai-sdlc `production-gate.py` reads refspecs and the checked-out branch but it only covers `main` and `master`, only asks rather than denies and is not in `pro-dev-starter`.

Hole 2 (item 33): no plugin registers a PreToolUse hook on `Read` or `Grep` so the Read tool opens `.env` with no check.
On Bash, `cat .env`, `grep KEY .env.local` and `head -5 ~/.ssh/id_ed25519` all exit 0 from `git-safe.py`, which only stops a redirect into `.env`.
An agent that wants to know whether a key is set has no way to ask that does not print the value.

Hole 3 (item 34): no plugin checks the text of an `Edit`, `Write` or `MultiEdit` for a credential.
The PreToolUse hooks on those tools today are `protect-tests.py` (pro-ai-sdlc) and `docs-to-project.py` (pro-quality); neither looks at content.
A pasted `sk-ant-` or `AKIA` key reaches disk and is only caught, if at all, by the floor guard or the push gate when it is about to leave the machine.

Hole 4 (item 43): `git-safe.py` blocks only `rm -rf` of `/`, `~` and `$HOME`.
`rm -rf ../other-project`, `rm -rf ~/Documents`, `find /srv/old -delete` and `git -C ../other clean -fd` all exit 0.

Hole 5 (item 40): line 32 of `plugins/pro-ship/skills/ship/references/security-checklist.md` tells `/ship` to run `git diff --cached | grep -i "password\|secret\|api_key\|token"`.
That prints every matching staged line so a staged secret lands in the terminal, the transcript and any log.
agent-skills fixed the same line upstream in 30187c1 (#718); this repo still carries the old one and no other file has it.

Who runs into it: every repo with `pro-dev-starter`, on every Bash, Read, Grep, Edit and Write call an agent makes.
How often: the holes have not fired in the warn log yet, which is the point: nothing watches them.

## Proposed outcome

Each hole is closed by a guard or a doc fix that names what it caught and never prints a secret:

1. Item 32: `git-safe.py` parses each `git push` into its flags and refspecs, beside the regexes it keeps.
   It flags a push that would update or delete a protected branch: `--delete` or `-d` of one, `:<protected>`, `refs/heads/<protected>`, `+<ref>`, a bare push or `HEAD` while one is checked out and `--all` or `--mirror`.
   The protected set is `main`, `master`, the repo's default branch read from `origin/HEAD` and any name listed one per line in a `protected-branches` file in the guard folder.
2. Item 33: a secret-read guard on `Read`, `Grep` and `Bash` (`cat`, `less`, `more`, `head`, `tail`, `sed`, `grep`, `xargs` and input redirects) for dotenv files except `.env.example`, `id_*` keys, `.pem` files, `.npmrc`, `credentials*` files and service-account JSON.
   It fails open on its own errors.
   A helper, `env-check.py`, prints `present`, `empty` or `missing` for each key name it is given and never a value; a plain call to it is always allowed.
3. Item 34: a key-literal guard in pro-security.
   PreToolUse on `Edit`, `Write` and `MultiEdit` flags a live-looking key before it reaches disk, using the patterns `incident.py` already keeps for AWS (`AKIA`, `ASIA`), Anthropic (`sk-ant-`), GitHub (`ghp_`, `gho_`, `ghu_`, `ghs_`, `ghr_`, `github_pat_`), Slack (`xox[bpa]-`, `xapp-`) and private key blocks.
   PostToolUse on the same tools flags one already on disk.
   It reports the line number and never the value; a line that reads the key from the environment is fine.
4. Item 43: a delete-outside guard for `rm`, `rmdir`, `unlink`, `find -delete`, `find -exec rm` and `git clean` whose resolved target is outside the project root.
   It honors `cd X &&` and `git -C X`, exempts the temp roots and the pro-dev state folder.
5. Item 40: the staged-secret check in `/ship`'s security checklist becomes `git diff --cached -i -G'password|secret|api_key|token' --name-only`, which names files and never prints a matching line.

Every guard in 1 to 4 runs under the warn and enforce modes of ADR-0016 with its own mode key and a row in `docs/enforce-mode.md`, never a plain deny.
What `git-safe.py` blocks today keeps blocking.

Where each lands: 32, 33 and 43 in pro-core, where `git-safe.py` gains a sibling script per guard and every hook sits in pro-core's one `hooks/hooks.json`; 34 in pro-security's one `hooks/hooks.json`; 40 in pro-ship.

## Affected users and systems

- `pro-core`: `scripts/git-safe.py`, two new hook scripts, `scripts/env-check.py`, a shared guard helper and `hooks/hooks.json`.
- `pro-security`: a new hook script and `hooks/hooks.json`.
- `pro-ship`: `skills/ship/references/security-checklist.md`.
- Tests: `tests/git-safe.mjs`, a new `tests/guards.mjs` and its check in `tests/check.mjs`.
- Docs: `docs/enforce-mode.md` (a row per guard), `docs/licenses.md` (adapted rows for super-board), `docs/hook-loading.md` and `docs/roadmap.md`.
- Every repo that installs `pro-dev-starter` (pro-core) or pro-security, on the next update.

## Constraints

- Hook-loading law (ADR-0003): every new hook goes into its plugin's one `hooks/hooks.json` and every script it runs is tracked.
- Version-bump law (ADR-0002): each plugin change bumps both manifests, the marketplace entry and `metadata.version` in the same commit.
- Warn start (ADR-0016): every new guard ships in warn and moves to enforce only on its own decision record.
- Fail open (REVIEW.md pass 2): a malformed, empty or unexpected payload never blocks and never crashes the turn.
- Python 3.9 standard library only, as macOS ships it.
- No double denial with `push-gate.py`: the key-literal guard does not watch Bash so it never sees a push.
- No secret value in any hook output, `warn.log` line or test output.
- Adapted super-board code keeps an attribution footer and a row in `docs/licenses.md` (MIT, Copyright (c) 2026 Eric Tech).

## Out of scope

- Installing a secret scanner such as gitleaks or trufflehog.
- Scanning the whole repo for keys; the key-literal guard reads only the text of an edit or the one file it wrote.
- Blocking reads of `.env.example`.
- Any change to `push-gate.py`, `production-gate.py` or the floor guard.

## Success looks like

Every command in the Problem section that passes today is flagged in warn mode and denied under its own enforce mode file.
An agent asked whether `OPENAI_API_KEY` is set answers from `env-check.py` without the value entering the transcript.
`warn.log` gains lines from the four new guards during the warn period and none of them holds a secret.

## Open questions

None open.
Where each guard lives, its mode key and the warn start are settled in the specs.

## Evidence

Verified by feeding Bash payloads to `plugins/pro-core/scripts/git-safe.py` on 2026-11-07, recorded in the Problem section.
Upstreams: super-board at `d0b7d5a` (`hooks/guard-protected-push.py`, `hooks/guard-secrets.py`, `hooks/guard-key-literals.py`, `hooks/guard-delete-outside.py`, `scripts/super-board-env-check.sh`) and agent-skills 30187c1.
