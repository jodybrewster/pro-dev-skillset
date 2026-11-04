---
intent: intent/2026-11-03-factory-demo-kit/intent.md
intent-status: accepted
status: accepted
created: 2026-11-03T21:30:00-0500
author: the maintainer
---

# Spec: one command builds a fresh factory demo

Built from `intent.md` in this folder.
Status: accepted.

## Summary

Two shell scripts under `demo/factory/` create and remove a factory demo.
`new-demo.sh` builds the tiny-tasks fixture with fictional people, a role map, CI, a `## Ship` block, two accepted level 1 intents, a private GitHub repo with a `v1.0.0` tag, a protected main and the four plugins at local scope.
`remove-demo.sh` follows the cleanup section of `docs/factory-demo.md` step for step and never deletes anything on GitHub.

## Assumptions

- `gh` is logged in with the `repo` scope; `claude` and `git` are on the path.
- `plugins/pro-ai-sdlc/evals/spec-from-intent/scaffold.sh` stays the source of the fixture.

## Requirements

- R1 `new-demo.sh <name> [--owner O] [--dir D]` refuses a name that fails `^[a-z0-9][a-z0-9-]{1,40}$`, one that exists on GitHub and one that exists on disk, each before it creates anything.
- R2 The checkout has repo-local git user `Sam Rivera <sam@example.com>`, a `## Roles` block in `REVIEW.md` (Sam Rivera in product owner, engineer and platform owner, Lee Chen as lead, Pat Okafor as policy owner), `intent/README.md`, a `.gitignore`, `.github/workflows/test.yml` (`npm test` on pull request and push to main, contents read) a `## Ship` block with a `tag-release` target, a rollback, a `documented_use` and `tag_pattern: "v*"` and a `CHANGELOG.md` with an Unreleased heading.
- R3 Two accepted level 1 intents exist, each with `breaking: false`: sorted-by-title (`kind: idea`) authored by the product owner and trim-titles (`kind: bug`) authored by the engineer; neither names a new dependency.
- R4 The script commits, runs `gh repo create <owner>/<name> --private --source . --push`, tags `v1.0.0` on that commit and pushes the tag.
- R5 It protects main through `gh api`: a required pull request with 0 approvals, `enforce_admins` and the required check `test`.
  It adds an active `v*` tag ruleset restricting creation, update and deletion with the repository admin role as the only bypass, after the `v1.0.0` tag is pushed.
- R6 It installs pro-ai-sdlc, pro-ship, pro-quality and pro-security at `--scope local` in the checkout and prints the next commands.
- R7 `remove-demo.sh <name> [--owner O] [--dir D] [--delete-image]` refuses unless the name matches the regex and the checkout's `origin` is `<owner>/<name>`.
- R8 It uninstalls the four local plugins, moves the checkout to `~/.Trash/<name>-<date>`, archives the repo with `gh repo archive`, prints the `gh repo delete` command without running it, removes `pro-dev-factory` images only with `--delete-image` and prints each validation from the doc.
- R9 Neither script kills a process; `remove-demo.sh` prints the `lsof` hint instead.
- R10 Both scripts use `set -eu`, argv only and no `eval`.
- R11 `tests/demo-kit.mjs` runs offline with stub `gh`, `claude` and `docker` and is part of `tests/check.mjs`.
- R12 `docs/factory-demo.md` starts "Before the audience arrives" with `new-demo.sh` and the cleanup section with `remove-demo.sh`, keeping the manual steps as the fallback.

## Acceptance criteria

- `sh -n` passes on both scripts.
- `node tests/demo-kit.mjs` and `node tests/check.mjs` pass.
- The test log shows the gh calls in the order of R4 to R6 and no `gh repo delete` call.

## Out of scope

The e2e harness, deleting a GitHub repo and killing processes.
