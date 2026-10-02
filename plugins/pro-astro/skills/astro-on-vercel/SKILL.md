---
name: astro-on-vercel
description: Use when an Astro project uses the @astrojs/vercel adapter or deploys to Vercel. Covers adapter options and which adapter major matches which Astro major, the .vercel/output layout, static versus on-demand routes, ISR, streaming and function timeouts, env vars, redirects and headers, image optimization, preview deployments and common gotchas.
---

# Astro on Vercel

Use this when touching `@astrojs/vercel`, `vercel.json` or the deploy path of an Astro site.
Read the installed `astro` and `@astrojs/vercel` versions first, because option names changed between adapter majors.

## Sources of truth

- Adapter reference: https://docs.astro.build/en/guides/integrations-guide/vercel/
- Astro deploy guide: https://docs.astro.build/en/guides/deploy/vercel/
- Adapter changelog: `packages/integrations/vercel/CHANGELOG.md` in the withastro/astro repository.
- Vercel function duration: https://vercel.com/docs/functions/configuring-functions/duration
- Build Output API: https://vercel.com/docs/build-output-api
- The Vercel page "Astro on Vercel" still shows the old `@astrojs/vercel/serverless` and `/static` imports and `output: 'hybrid'`.
  Treat it as stale for syntax and use the Astro adapter page instead.
- For Astro questions, call the Astro Docs MCP tool `search_astro_docs` if it is available.
  To add it: `claude mcp add --transport http astro-docs https://mcp.docs.astro.build/mcp`.
  Astro no longer publishes `llms.txt` files, so do not look for them.
- Optional companion: the `vercel@claude-plugins-official` plugin covers Vercel platform workflows such as deploys, logs and project settings.
  This skill stays on the Astro-specific side.

## Adapter major to Astro major

- `@astrojs/vercel` 8.x and 9.x require Astro 5.
- `@astrojs/vercel` 10.x requires Astro 6.
- `@astrojs/vercel` 11.x requires Astro 7.
- Upgrade the adapter whenever Astro crosses a major, and read the changelog of every major in between.

What changes across those majors:

- 8.0: single `@astrojs/vercel` entry point is the way forward, and `functionPerRoute`, the `speedInsights` option and the `/edge` export are gone.
  Use the `@vercel/speed-insights` package for Speed Insights.
- 8.2: `experimentalStaticHeaders`, which pairs with Astro's CSP support.
- 10.0: the `@astrojs/vercel/serverless` and `/static` entry points are removed.
  `edgeMiddleware: true` is deprecated in favor of `middlewareMode: 'edge'`.
  `experimentalStaticHeaders` becomes `staticHeaders`.
- 11.0: Vite 8, plus the `cacheVercel()` route cache provider.

## Adapter setup and options

```js
import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';

export default defineConfig({
  adapter: vercel({ maxDuration: 60 }),
});
```

Options listed on the current adapter page:

- `maxDuration`: timeout in seconds for the on-demand function.
- `isr`: `true` or an object with `expiration`, `bypassToken` and `exclude`.
- `imageService`: `true` serves images through Vercel Image Optimization in production.
- `devImageService`: the service used in dev, `'sharp'` by default.
- `imagesConfig`: `sizes`, `domains`, `remotePatterns`, `minimumCacheTTL` and `formats` for the optimization endpoint.
- `webAnalytics`: `{ enabled: true }` turns on Vercel Web Analytics.
- `includeFiles` and `excludeFiles`: add or drop files in the function bundle.
- `skewProtection`: Vercel skew protection, which needs a plan that includes it.
  Since adapter 9.0 the deployment ID is also attached automatically when `VERCEL_SKEW_PROTECTION_ENABLED=1` is set.
- `staticHeaders`: writes static response headers (10.0 and later, named `experimentalStaticHeaders` in 8.2 and 9.x).
- `middlewareMode: 'edge'`: runs Astro middleware as an edge function (10.0 and later).
  Before 10.0 the equivalent is `edgeMiddleware: true`.

Not every option exists in every major, so check the changelog before writing config for an older adapter.

## Build output

The adapter writes the Build Output API layout under `.vercel/output`:

- `config.json` holds `version: 3`, the routing rules and the `images` config.
- `static/` holds prerendered pages and client assets.
- `functions/` holds the on-demand function.
  Since 8.0 all on-demand routes bundle into one function, so `maxDuration` and bundle settings are global to every on-demand route.
- Anything that post-processes the static site must read from `.vercel/output/static`, not `dist`.
  A search indexer such as Pagefind runs as a postbuild step over that directory.

## Static versus on-demand

- Astro's default output is static.
  Routes opt into on-demand rendering with `export const prerender = false`, and the adapter then emits the function.
  Setting `output: 'server'` flips the default, so prerender explicitly the routes that can stay static.
- A static site needs the adapter only for Vercel features such as Web Analytics, Image Optimization or ISR.
- Actions, server islands and sessions need on-demand rendering.
  Sessions need a storage driver, for example Redis connected through the Vercel marketplace.
- Prerendered routes cost nothing at request time, so keep on-demand routes for APIs and truly dynamic pages.

## Streaming responses and timeouts

- Return a `Response` built from a `ReadableStream` in an endpoint to stream, for example LLM tokens.
  Set `Content-Type: text/event-stream` or `text/plain` and avoid buffering the whole body first.
- `maxDuration` caps the whole invocation, streaming included.
  A stream that outlives the cap is cut off mid-response, so size the cap for the slowest realistic completion.
- With Fluid compute, which is on by default, Vercel's documented default is 300 seconds on every plan.
  The maximum is 300 seconds on Hobby and 800 seconds on Pro and Enterprise, with an extended 30 minute maximum in beta.
  Verify against the duration page before quoting these.
- Because the adapter emits one function, a long `maxDuration` set for one streaming route applies to all on-demand routes.
  Keep the value as low as the slowest route allows.
- For streams that may sit idle, send progress or heartbeat chunks, since idle HTTP/1.1 connections can be closed by intermediaries.

## ISR

- Enable with `isr: true`, or an object to set `expiration` in seconds, a `bypassToken` for on-demand regeneration and an `exclude` list of strings or regexes that always render fresh.
- ISR function requests do not include search params, so a route that reads the query string must be in `exclude`.
- ISR applies to on-demand routes, so it only helps pages that are `prerender = false`.
- With Astro 7 and adapter 11 consider route caching instead: set `cache: { provider: cacheVercel() }` with the import from `@astrojs/vercel/cache`, then call `Astro.cache.set({ maxAge, tags })` and invalidate with `cache.invalidate()`.
  The provider sets `Vercel-CDN-Cache-Control` and `Vercel-Cache-Tag` headers.

## Environment variables

- Set values in the Vercel project settings per environment (Production, Preview, Development) and mirror non-secret defaults in `.env` for local work.
- Declare variables in `env.schema` with `envField` from `astro/config` and import them from `astro:env/server` or `astro:env/client`.
  `context: 'server'` with `access: 'secret'` keeps a value out of client bundles and validates it at runtime.
- Never put a secret in a `PUBLIC_` variable or in a schema entry with `context: 'client'`, because those are inlined into browser code.
- `astro:env` is a virtual module, so it does not work in `astro.config.mjs` or build scripts.
  Use `process.env` there.
- Preview deployments use the Preview environment variables, so check that API keys exist for that scope.

## Redirects and headers

- Put redirects in the Astro `redirects` config.
  The adapter turns them into routes in `.vercel/output/config.json`, so Vercel serves them at the edge without invoking the function.
- Vercel's guidance is to prefer framework-native redirects, and not to use `vercel.json` rewrites with Astro because behavior is inconsistent and unsupported.
  Use Vercel Routing Middleware if you need rewrites.
- Keep each redirect in one place, either Astro config or `vercel.json`, so the two sources cannot disagree.
- Custom response headers such as caching and security headers belong in `vercel.json` under `headers`.
  For dynamic responses set them in code with `Astro.response.headers.set(...)` or on the returned `Response`.
- Astro middleware in `src/middleware.ts` is separate from Vercel Routing Middleware, which lives in a root-level `middleware.ts`.
  Prefer Astro middleware.

## Image optimization

- With `imageService: true`, `astro:assets` components emit `/_vercel/image` URLs in production and Vercel resizes on demand.
- The endpoint only serves sizes and hosts you allow.
  Add `imagesConfig.sizes` and `imagesConfig.domains` or `remotePatterns` for remote images, or requests fail.
- Dev uses `devImageService`, so URLs differ between dev and production.
- Optimization usage is billed, so keep `minimumCacheTTL` reasonable.

## Previews and deploys

- Push to a branch for a Preview Deployment.
  Pushes to the production branch create a Production Deployment.
- `vercel` from the CLI deploys a preview and `vercel --prod` deploys production.
- The adapter output is built at deploy time, so a local `astro build` followed by inspecting `.vercel/output` shows what Vercel will serve.

## Gotchas

- An adapter major that does not match the installed Astro major fails to install or run.
  Match them using the table above.
- A route that reads `request.url` search params under ISR sees none of them.
- Files read at runtime from disk are not in the function bundle unless traced.
  Add them with `includeFiles`.
- Secrets read through `import.meta.env` without a schema can be inlined if prefixed `PUBLIC_`.
  Prefer `astro:env/server`.
- Static output from a postbuild tool written to `dist` is lost.
  Write into `.vercel/output/static`.

_Written from the official Astro and Vercel documentation, verified October 2026._
