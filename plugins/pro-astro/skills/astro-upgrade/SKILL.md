---
name: astro-upgrade
description: Structured workflow for upgrading Astro major versions (5 to 6, 6 to 7) and official integrations and adapters (@astrojs/vercel, cloudflare, node, netlify, mdx, sitemap, rss) using npx @astrojs/upgrade. Use when asked to upgrade Astro or when the astro version in package.json is behind the latest.
---

# Astro upgrade

Structured approach for moving an Astro project to a newer major version.

Announce at start: "I'm using the astro-upgrade skill to upgrade Astro."

Per-hop breaking-change checklists live in sidecar files.
For 5 to 6 see `v6.md`.
For 6 to 7 see `v7.md`.
Read each sidecar before touching code for that hop.

## Rules

- Upgrade one major at a time. Never skip a major, even when the target is two ahead.
- Finish and verify one hop (build, check, tests, dev server) before starting the next.
- Read the official guide for each hop. The sidecars are a working summary, and the guides are the source of truth.
- Do not edit generated files or lockfiles by hand. Let the package manager write them.
- Commit after each verified hop so a bad hop is easy to revert.

## Step 1 - Detect current versions

Read `package.json` and the installed versions:

```bash
node -v
npm ls astro @astrojs/vercel @astrojs/cloudflare @astrojs/node @astrojs/netlify @astrojs/mdx @astrojs/sitemap @astrojs/rss
npm view astro version               # latest stable
cat node_modules/astro/package.json | grep '"version"'
```

Also note the UI framework integrations (`@astrojs/react` and similar), any custom integrations, the package manager and the host.
List the config features in use: `output`, `adapter` options, `redirects`, `prefetch`, `session`, `i18n`, `markdown` and `experimental` flags.
Check `src/content.config.ts` (or the legacy `src/content/config.ts`) and any `Astro.glob()` usage.
Search for removed APIs up front:

```bash
grep -rn "ViewTransitions\|Astro.glob\|entry.render()\|astro:schema\|@astrojs/db\|getEntryBySlug" src astro.config.* 
```

## Step 2 - Plan the hops

Work out the ordered hop list from the current major to the target.
The official guides are:

- `https://docs.astro.build/en/guides/upgrade-to/v6/`
- `https://docs.astro.build/en/guides/upgrade-to/v7/`

If the `search_astro_docs` tool is available, use it for follow-up questions.
Otherwise fetch the guide pages directly.
Do not use `llms.txt` files. Astro no longer publishes them.

Check the Node floor for each hop before installing:

- Astro 6 and 7 both need Node 22.12.0 or newer.
- Update `.nvmrc`, `engines`, CI images and the host's Node setting before running the upgrade tool.

## Step 3 - Run the upgrade tool for one hop

From a clean git tree on a new branch:

```bash
npx @astrojs/upgrade --dry-run   # walk through the steps without changing anything
npx @astrojs/upgrade             # upgrade to latest
```

The tool takes an optional `[version]` argument.
Run it with `--help` to see the exact options your installed copy supports.

`@astrojs/upgrade` bumps `astro` and the official `@astrojs/*` packages it finds.
It does not rewrite your source code.
Because the tool targets the latest release, a 5 to 7 path needs the hops done by hand: install the intermediate major with the package manager (for example `npm install astro@6`), bump each `@astrojs/*` package to the major whose peer dependency matches, and finish that hop before moving on.
The upgrade tool can run for the final hop.

Use the table below to pick adapter and integration majors.
Confirm with `npm view <pkg>@<version> peerDependencies`.

| Package | Astro 5 | Astro 6 | Astro 7 |
| --- | --- | --- | --- |
| `@astrojs/vercel` | 8 or 9 | 10 | 11 |
| `@astrojs/cloudflare` | 12 | 13 | 14 |
| `@astrojs/node` | 9 | 10 | 11 |
| `@astrojs/netlify` | 6 | 7 | 8 |
| `@astrojs/mdx` | 4 | 5 (6 needs Astro 6.4 or newer) | 7 or 8 (8 needs Astro 7.2.6 or newer) |
| `@astrojs/sitemap` | 3 | 3 | 3 |
| `@astrojs/rss` | 4 | 4 | 4 |
| `@astrojs/react` | 4 | 5 | 6 or 7 |

`@astrojs/sitemap` and `@astrojs/rss` have no new major for these hops. Keep them on the latest 3.x and 4.x.
Framework integrations other than React follow the same pattern: use the major whose `astro` peer range covers the target.
`@astrojs/vercel` 9 still targets Astro 5, so a site on 8 upgrades to 10 together with Astro 6.

## Step 4 - Fix breaking changes

Work through the sidecar checklist for the hop.
Typical order:

1. Config file: remove or rename flags and options, update adapter options.
2. Content config: collection definitions, Zod imports, loaders.
3. Components and pages: removed components, removed APIs, stricter markup.
4. Custom integrations and adapter code: hook signatures and virtual modules.
5. Tests: Vitest config, Container API imports.

Make one logical change per commit when practical.

## Step 5 - Type check

```bash
npx astro sync
npx astro check
```

Fix every error and warning that the hop introduced.
If `@astrojs/check` or `typescript` is missing, install them as dev dependencies first.

## Step 6 - Build

```bash
npm run build
```

Compare the output with the previous build.
Look at the page count, the routes list, sitemap output, RSS feeds, redirects and the adapter's output directory (`.vercel/output` for Vercel).
On a site with prerendered and on-demand routes, confirm each route kind still behaves as before.

## Step 7 - Test

Run the project's test suite (`npm test` or the Vitest command).
Add or update tests where a removed API forced a code change.
Run `npm run preview` (or `npx astro preview`) and click through key routes, an on-demand API route and a redirect.

## Step 8 - Verify the dev server

On Astro 7 an agent session starts `astro dev` in the background by itself.
Read `.astro/dev.json` for the URL, check `/_astro/status`, and read `astro dev logs` for warnings.
Stop it with `astro dev stop` when done.
Set `ASTRO_DEV_BACKGROUND=0` if a blocking foreground server is needed.
On Astro 5 and 6 run the dev server as a managed background process and poll the URL.
Open a few pages and watch the terminal and the browser console for deprecation warnings.

## Step 9 - Commit

```bash
git add package.json package-lock.json astro.config.* src
git commit -m "chore: upgrade Astro to vX.Y.Z"
```

Repeat from Step 3 for the next hop.

## Upgrading a site shaped like a personal site (5 to 7)

A typical target: Astro 5, `@astrojs/vercel` 8, `@astrojs/mdx` 4, `@astrojs/sitemap`, `@astrojs/rss`, `output: 'static'` with a few on-demand API routes, `vercel({ maxDuration: 60 })`, `redirects`, `prefetch`, a custom integration and a content layer in `src/content.config.ts`.
Do the 5 to 6 hop fully, then the 6 to 7 hop.

Hop 5 to 6 for this shape:

- Move Node to 22.12.0 or newer locally, in CI and on Vercel.
- `astro` 6, `@astrojs/vercel` 10, `@astrojs/mdx` 5 (or 6 on Astro 6.4 or newer).
- Zod 4: import `z` from `astro/zod`, rewrite `z.string().email()` as `z.email()`, `{ message }` as `{ error }`, and check `.default()` values against transformed output.
- Check every `getStaticPaths()` for numeric params and for `Astro.site` use.
- Check the custom integration for `astro:build:ssr` `entryPoints`, `astro:build:done` `routes`, `astro:ssr-manifest` and HMR use.
- Keep `maxDuration`, `redirects` and `prefetch`. Remove any `prefetch()` `with` option from client code.
- Replace `<ViewTransitions />` with `<ClientRouter />` if used. See `v6.md`.

Hop 6 to 7 for this shape:

- `astro` 7, `@astrojs/vercel` 11, `@astrojs/mdx` 7 or 8.
- Fix unclosed or invalid HTML in `.astro` files for the Rust compiler.
- If posts use remark or rehype plugins, install `@astrojs/markdown-remark` and set `markdown.processor: unified()`.
- Review `compressHTML` whitespace changes in inline markup.
- Check that no file is named `src/fetch.ts`.
- Keep an eye on feed and sitemap output after the Markdown processor change.
- See `v7.md`.

---

_Written from the official Astro documentation (docs.astro.build), verified October 2026._
