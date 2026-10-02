---
name: astro-on-cloudflare
description: Use when an Astro project deploys to Cloudflare Workers (the @astrojs/cloudflare adapter or a wrangler.jsonc or wrangler.toml is present) or when moving an Astro site to Cloudflare. Covers adapter v13 and v14 behavior, the Pages to Workers move, wrangler config and bindings, typed env, sessions, images, Workers limits, deploys and the official Cloudflare companions.
---

# Astro on Cloudflare Workers

This skill is a thin router.
It holds the guardrails that cause the most breakage and points at the canonical pages for everything else.
When a detail matters, read the linked page instead of trusting memory, because both Astro and Cloudflare move quickly.

## Sources of truth

- Adapter reference: https://docs.astro.build/en/guides/integrations-guide/cloudflare/
- Astro deploy guide: https://docs.astro.build/en/guides/deploy/cloudflare/
- Cloudflare Workers guide for Astro: https://developers.cloudflare.com/workers/framework-guides/web-apps/astro/
- The older Cloudflare Pages guide for Astro is legacy.
  Do not follow it for new work.
- Adapter changelog: `packages/integrations/cloudflare/CHANGELOG.md` in the withastro/astro repository.
- Cloudflare docs serve Markdown when you append `/index.md` to a page URL.
  Each product also has an `llms-full.txt`, for example `https://developers.cloudflare.com/workers/llms-full.txt`.
- For Astro questions, call the Astro Docs MCP tool `search_astro_docs` if it is available.
  To add it: `claude mcp add --transport http astro-docs https://mcp.docs.astro.build/mcp`.
  Astro no longer publishes `llms.txt` files, so do not look for them.

## Companion plugin

The official Cloudflare plugin complements this skill.
In Claude Code run `/plugin marketplace add cloudflare/skills`, then `/plugin install cloudflare@cloudflare`.
In Codex run `codex plugin marketplace add cloudflare/skills`.
It bundles `wrangler`, `workers-best-practices`, `web-perf` and the Cloudflare MCP server.
Cloudflare publishes no Astro-specific skill, which is the gap this one fills.
If those skills are installed, defer to them for generic Workers questions such as Wrangler commands, binding APIs and Workers performance, and keep this skill for the Astro-specific parts.

## Which adapter major goes with which Astro

- `@astrojs/cloudflare` 13.x pairs with Astro 6.
- `@astrojs/cloudflare` 14.x pairs with Astro 7 and moves to Vite 8.
- Read the installed `astro` version before giving advice, and upgrade the adapter whenever Astro crosses a major.

## What changed in v13 and carries into v14

- `astro dev` runs on workerd through the Cloudflare Vite plugin, so dev behaves much closer to production.
  `astro preview` runs the built output locally.
- `Astro.locals.runtime` is gone.
  Read bindings and variables with `import { env } from 'cloudflare:workers'`.
- The request metadata object is `Astro.request.cf`.
  The execution context is `Astro.locals.cfContext`, for example `Astro.locals.cfContext.waitUntil(promise)`.
- Cloudflare Pages is no longer supported by the adapter.
  New and migrated sites target Workers, with static files served as Workers static assets.
- `wrangler.jsonc` is optional for a basic project and is generated when absent.
  Add your own once you need bindings, a custom name or other settings.
- The `workerEntryPoint` option and `createExports()` are removed.
  The default entry is `@astrojs/cloudflare/entrypoints/server`, set as `main` in the wrangler file.
- Prerendering runs in workerd by default.
  Set `prerenderEnvironment: 'node'` in the adapter options when a prerendered page needs Node APIs that workerd lacks.

```ts
import { env } from 'cloudflare:workers';

const value = await env.MY_KV.get('key');
```

## Static site or on-demand

- A purely static site needs no adapter.
  Build with `astro build` and point `assets.directory` at `./dist` in the wrangler file.
  Bindings are not available to a purely static site.
- Add the adapter (`npx astro add cloudflare`) when any route must render on demand, or when you need bindings, sessions, actions or server islands.
- Astro's default output is static, and individual routes opt out with `export const prerender = false`.
  Setting `output: 'server'` flips the default.
  Keep as many routes prerendered as you can, since prerendered pages are served as static assets without running the Worker.

## wrangler config and bindings

A minimal on-demand setup looks like this:

```jsonc
{
  "name": "my-astro-app",
  "main": "@astrojs/cloudflare/entrypoints/server",
  "compatibility_date": "YYYY-MM-DD",
  "compatibility_flags": ["nodejs_compat"],
  "assets": { "binding": "ASSETS", "directory": "./dist" },
  "vars": { "PUBLIC_THING": "value" },
  "kv_namespaces": [{ "binding": "MY_KV", "id": "<namespace_id>" }]
}
```

- Set `compatibility_date` to a recent date and update it on purpose, not by accident.
- `nodejs_compat` enables `node:*` imports in server code.
  Add it when a dependency needs Node APIs, and confirm the package supports workerd.
- Declare KV, D1, R2, Durable Objects, Queues and other bindings in the wrangler file.
  The binding API itself is a generic Workers topic, so use the Workers docs or the `wrangler` skill for it.
- Plain variables go in `vars`.
  Secrets never go in the file.
  Use `npx wrangler secret put <KEY>` for production and a `.dev.vars` file for local development.
- Run `npx wrangler types` to generate `worker-configuration.d.ts` with a typed `Env`.
  Include that file in `tsconfig.json` and rerun the command after every change to the wrangler file.
- For custom 404 behavior on static assets, set `assets.not_found_handling` to `"404-page"`.
- If assets must pass through the Worker first, for example for auth checks, set `assets.run_worker_first`.

## Sessions, actions, server islands

- Astro sessions use Workers KV with no extra setup.
  The default binding name is `SESSION`, and `sessionKVBindingName` changes it.
  Create the KV namespace and declare the binding in the wrangler file.
- KV is eventually consistent between regions, so do not rely on a session write being visible everywhere immediately.
- Actions and server islands need on-demand rendering, so the adapter must be installed and the routes must not be prerendered.

## Images

- `astro:assets` cannot use Sharp on Workers.
- The adapter's `imageService` option defaults to `'cloudflare-binding'`, which uses the Cloudflare Images binding (default name `IMAGES`, changed with `imagesBindingName`).
  Other values are `'cloudflare'`, `'compile'`, `'custom'` and `'passthrough'`.
- Since v14 `imageService` also accepts an object with separate `build` and `runtime` settings, so prerendered images can be processed at build time while runtime requests use another service.
- `passthrough` keeps the `<Image />` component but performs no optimization.
- Check the adapter page for the current option table before recommending a value.

## Astro 7 and adapter v14

- Advanced routing (Astro 7.0): add `src/fetch.ts` that exports an object with a `fetch()` method, to control the request pipeline.
  The adapter ships `cf` and `finalize` helpers from `@astrojs/cloudflare/fetch` and a `cf` middleware from `@astrojs/cloudflare/hono`.
  Read https://docs.astro.build/en/guides/routing/ before using it.
- Route caching (Astro 7.0): set `cache: { provider: cacheCloudflare() }` with the import from `@astrojs/cloudflare/cache`, then call `Astro.cache.set()` in pages and endpoints.
  The provider sets Cloudflare cache headers and tags, and cache hits do not invoke the Worker.
  Invalidate by tag or path with `cache.invalidate()`.

## Limits that bite Astro apps

Confirm numbers on https://developers.cloudflare.com/workers/platform/limits/ before quoting them.
At the time of writing:

- CPU time is 10 ms per request on the free plan.
  On paid plans it defaults to 30 seconds and can be raised to 5 minutes.
  Wall-clock time spent waiting on I/O does not count as CPU time.
- Memory is 128 MB per isolate.
- Global scope startup must finish within 1 second, so avoid heavy work at module top level.
- Static assets allow 25 MiB per file and 20,000 files on free or 100,000 on paid.
- Node APIs are available only with `nodejs_compat`, and not every package works on workerd.
  Native addons such as Sharp do not run there.
- Bundle size limits apply to the Worker script.
  Look up the current figure, and keep large server-only dependencies out of on-demand routes.

## Migrating from Pages to Workers

1. Upgrade to Astro 6 or later and the matching adapter major.
2. Replace `Astro.locals.runtime.env` with `import { env } from 'cloudflare:workers'`, and `Astro.locals.runtime.ctx` with `Astro.locals.cfContext`.
3. Create or update `wrangler.jsonc`.
   Replace `pages_build_output_dir` with `assets.directory`, set `main` for on-demand sites and set `compatibility_date`.
4. Move variables and bindings from the Pages dashboard into the wrangler file, and recreate secrets with `wrangler secret put`.
5. `_headers` and `_redirects` keep working as static asset files.
   Remove any advanced-mode `_worker.js` from the assets directory.
6. Remember that Workers serves assets first by default and Pages ran functions first.
   Set `assets.run_worker_first` if you relied on the old order.
7. Replace `wrangler pages dev` and `wrangler pages deploy` with `wrangler dev` and `wrangler deploy`.
   The default dev port changes from 8788 to 8787.
8. Custom domains on Workers need nameservers managed by Cloudflare, and `pages.dev` becomes `workers.dev`.
9. Full checklist: https://developers.cloudflare.com/workers/static-assets/migration-guides/migrate-from-pages/

## Deploy

- Local: `npx astro build && npx wrangler deploy`.
  Preview first with `npx astro build && npx wrangler dev` or `astro preview`.
- Git integration: in the Cloudflare dashboard create a Workers application from the repository (Workers Builds).
  Use `npx astro build` as the build command and `npx wrangler deploy` as the deploy command.
  Non-production branches get preview URLs.

_Written from the official Astro and Cloudflare documentation, verified October 2026._
