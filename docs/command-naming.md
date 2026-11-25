<!-- command-namespace: off (this page shows the broken form on purpose) -->

# Command naming

Every slash command written anywhere in this repo uses its full `/<plugin>:<command>` form.
`/pro-core:pro-dev install`, never `/pro-dev install`.
`/pro-ai-sdlc:intent`, never `/intent`.

## Why

Claude Code registers a plugin's commands under the plugin's name.
A bare `/pro-dev` is not a shorter spelling of `/pro-core:pro-dev`; it is a command that does not exist, so typing it does nothing.
A person who is handed the short form has to work out the plugin themselves before they can run the step they were just told to run.

The short form is not even unambiguous.
Nine command names in this marketplace are owned by more than one plugin:

- `adr`: `pro-ai-sdlc`, `pro-ai-sdlc-egm`
- `auto`: `pro-ai-sdlc`, `pro-ai-sdlc-egm`
- `execute`: `pro-ai-sdlc`, `pro-ai-sdlc-egm`
- `incident`: `pro-ai-sdlc`, `pro-ai-sdlc-egm`
- `install`: `pro-design`, `pro-egm`, `pro-electron`, `pro-nextjs`, `pro-pdd`, `pro-ship`, `pro-speckit`, `pro-testing`
- `intent`: `pro-ai-sdlc`, `pro-ai-sdlc-egm`
- `plan`: `pro-ai-sdlc`, `pro-ai-sdlc-egm`
- `pr-babysit`: `pro-ai-sdlc`, `pro-ai-sdlc-egm`
- `review`: `pro-ai-sdlc`, `pro-ai-sdlc-egm`, `pro-egm`, `pro-quality`

`/review` alone could mean four different commands.

## The rule

A slash command in a command file, a skill, an agent, a plugin description, a script's output, a README or anything under `docs/` is written in full.
This covers what a command tells the model to print as the next step, which is the case that bit: the install told someone to run `/pro-dev install` on a fresh machine and nothing happened.

Three places are deliberately out of scope:

- `plugins/pro-spdd/upstream/` is vendored upstream content and is not edited here.
- `*/evals/*/prompt.md` holds simulated user input. A person typing a half-remembered command is realistic input to an eval, so the prompts keep whatever they say.
- `tests/cases/` and the other test fixtures record prompts, not instructions anyone follows.

## Excluding a block

A line or a block that names another project's commands, or that shows the broken form on purpose, is wrapped in markers:

```markdown
<!-- command-namespace: off (the reason) -->
...
<!-- command-namespace: on -->
```

Both the rewrite pass and `checks.commandNamespace` honour them.
Two places use this today. The `## The agent-skills comparison` appendix in [roadmap.md](./roadmap.md) has another project's command names in its Command column. This page shows the broken form itself.
A marker carries its reason in the comment, so the next reader does not have to guess.

## The check

`checks.commandNamespace` in `tests/check.mjs` reads the command files under `plugins/*/commands/`, builds the name set from them and fails on any bare `/<command>` reference in a tracked file outside the three exclusions above.
It is keyless and runs on every pull request.
A new command needs no change to the check: adding `plugins/<p>/commands/<n>.md` adds `<n>` to the set the check enforces.

## Every command

| Command | Plugin |
|---------|--------|
| `/pro-pdd:adhd` | `pro-pdd` |
| `/pro-ai-sdlc:adr` | `pro-ai-sdlc` |
| `/pro-ai-sdlc-egm:adr` | `pro-ai-sdlc-egm` |
| `/pro-quality:api-docs` | `pro-quality` |
| `/pro-ai-sdlc:auto` | `pro-ai-sdlc` |
| `/pro-ai-sdlc-egm:auto` | `pro-ai-sdlc-egm` |
| `/pro-egm:bootstrap` | `pro-egm` |
| `/pro-egm:brainstorm` | `pro-egm` |
| `/pro-quality:constraints` | `pro-quality` |
| `/pro-design:critique-screen` | `pro-design` |
| `/pro-ai-sdlc-egm:design` | `pro-ai-sdlc-egm` |
| `/pro-quality:document` | `pro-quality` |
| `/pro-egm:draft` | `pro-egm` |
| `/pro-core:dream` | `pro-core` |
| `/pro-egm:drift` | `pro-egm` |
| `/pro-ai-sdlc:execute` | `pro-ai-sdlc` |
| `/pro-ai-sdlc-egm:execute` | `pro-ai-sdlc-egm` |
| `/pro-core:gh` | `pro-core` |
| `/pro-egm:goldfish` | `pro-egm` |
| `/pro-ai-sdlc:incident` | `pro-ai-sdlc` |
| `/pro-ai-sdlc-egm:incident` | `pro-ai-sdlc-egm` |
| `/pro-design:install` | `pro-design` |
| `/pro-egm:install` | `pro-egm` |
| `/pro-electron:install` | `pro-electron` |
| `/pro-nextjs:install` | `pro-nextjs` |
| `/pro-pdd:install` | `pro-pdd` |
| `/pro-ship:install` | `pro-ship` |
| `/pro-speckit:install` | `pro-speckit` |
| `/pro-testing:install` | `pro-testing` |
| `/pro-ai-sdlc:intent` | `pro-ai-sdlc` |
| `/pro-ai-sdlc-egm:intent` | `pro-ai-sdlc-egm` |
| `/pro-core:kaizen` | `pro-core` |
| `/pro-pdd:lavish` | `pro-pdd` |
| `/pro-research:lead-research` | `pro-research` |
| `/pro-legal:legal-review` | `pro-legal` |
| `/pro-egm:lite` | `pro-egm` |
| `/pro-ai-sdlc:plan` | `pro-ai-sdlc` |
| `/pro-ai-sdlc-egm:plan` | `pro-ai-sdlc-egm` |
| `/pro-ai-sdlc:pr-babysit` | `pro-ai-sdlc` |
| `/pro-ai-sdlc-egm:pr-babysit` | `pro-ai-sdlc-egm` |
| `/pro-core:pro-dev` | `pro-core` |
| `/pro-speckit:remove` | `pro-speckit` |
| `/pro-research:research` | `pro-research` |
| `/pro-egm:resolve` | `pro-egm` |
| `/pro-ai-sdlc:review` | `pro-ai-sdlc` |
| `/pro-ai-sdlc-egm:review` | `pro-ai-sdlc-egm` |
| `/pro-egm:review` | `pro-egm` |
| `/pro-quality:review` | `pro-quality` |
| `/pro-security:security-audit` | `pro-security` |
| `/pro-spdd:spdd-analysis` | `pro-spdd` |
| `/pro-spdd:spdd-api-test` | `pro-spdd` |
| `/pro-spdd:spdd-code-review` | `pro-spdd` |
| `/pro-spdd:spdd-generate` | `pro-spdd` |
| `/pro-spdd:spdd-install-to` | `pro-spdd` |
| `/pro-spdd:spdd-prompt-update` | `pro-spdd` |
| `/pro-spdd:spdd-reasons-canvas` | `pro-spdd` |
| `/pro-spdd:spdd-reverse` | `pro-spdd` |
| `/pro-spdd:spdd-story` | `pro-spdd` |
| `/pro-spdd:spdd-sync` | `pro-spdd` |
| `/pro-ai-sdlc:spec` | `pro-ai-sdlc` |
| `/pro-security:threat-model` | `pro-security` |
| `/pro-quality:validate` | `pro-quality` |
| `/pro-quality:verify` | `pro-quality` |
