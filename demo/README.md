# demo/ — install + test the marketplace by building a real site

This is a working **proof-of-concept**: it installs `pro-dev-skillset` into a
target repo and drives the lifecycle skills to build, verify, and ship a real
Next.js marketing landing page. It exists to answer one question end-to-end —
*does the marketplace actually work when you install it and use it?*

```
demo/
  app/            # the POC: a Next.js + Tailwind landing page for pro-dev-skillset
  setup.sh        # one command: install marketplace → install stack → build → test
  teardown.sh     # undo it all; leaves your global Claude Code config clean
  LIFECYCLE.md    # how the site was built "through the skills" (the dogfood trail)
```

## Quick start

```bash
./demo/setup.sh
```

That registers **this local working copy** as a project-scope marketplace inside
`demo/app`, installs the default stack, then installs deps, builds, and tests the
site. Everything is scoped to `demo/app/.claude/settings.json` — your global
config is never touched (`./demo/teardown.sh` reverses it).

Then verify the install **through the skills**:

```bash
cd demo/app
claude                # open Claude Code in the target repo
> /pro-dev-doctor     # checks installed stack, validates plugins, smoke-tests routing
```

## What "the install" looks like

`setup.sh` runs the same commands a real user would, but at project scope so it's
self-contained and reversible:

```bash
claude plugin marketplace add <repo-root> --scope project
claude plugin install pro-core@pro-dev-skillset --scope project
# … pro-execution, pro-quality, pro-design, pro-data, pro-testing
```

Project scope means the marketplace + enabled plugins are declared in
`demo/app/.claude/settings.json`. Because the source is a **directory**, the
install reflects your local edits (including unreleased work like
`/pro-dev-doctor`) — no commit or tag required to dogfood.

## What "the tests" looks like

Two layers, run by `setup.sh` and re-runnable any time:

| Layer | Command | What it proves |
|---|---|---|
| Marketplace contract | `node ../../tests/check.mjs` (from `demo/app`) | manifests, version-bump law, router resolves |
| The site itself | `npm run build && npx vitest run` (in `demo/app`) | the POC compiles and its content/render invariants hold |
| Install + routing | `/pro-dev-doctor` (in a Claude session) | the installed stack is present and routes correctly |

## The site

A single static landing page (`app/page.tsx`) for the marketplace: hero, the
eight-phase lifecycle, a plugin grid, the bridges concept, the two use-case
paths, and an install CTA. Design-forward on purpose — it's the artifact the
`pro-design` skills produced. See [LIFECYCLE.md](./LIFECYCLE.md) for the
phase-by-phase trail of how it was built.

```bash
cd demo/app
npm run dev     # http://localhost:3000
```
