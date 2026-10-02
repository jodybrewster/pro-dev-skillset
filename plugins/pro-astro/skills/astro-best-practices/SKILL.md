---
name: astro-best-practices
description: Auto-applied Astro best practices for Astro 5, 6 and 7 - project structure, routing, output modes, islands and server islands, content layer and collections, actions, sessions, middleware, astro:env, images and fonts, view transitions, testing, type checking and agent hygiene (docs MCP, dev server). Applied automatically when an astro.config.* file or an astro dependency is present; do not invoke directly unless reviewing Astro conventions.
---

# Astro best practices

Apply these rules when writing or reviewing code in an Astro project.

## Check the installed version first

Astro changed a lot between 5, 6 and 7.
Read `node_modules/astro/package.json` (or `npm ls astro`) before giving version-specific advice.
Adapters and integrations must match the Astro major, so check `@astrojs/*` versions too.

| Topic | Astro 5 | Astro 6 | Astro 7 |
| --- | --- | --- | --- |
| Node | 18.20.8, 20.3+ or 22+ | 22.12.0 or newer | 22.12.0 or newer |
| Vite | 6 | 7 | 8 |
| Zod | 3 (`z` from `astro:content`) | 4, import `z` from `astro/zod` | 4, import `z` from `astro/zod` |
| Fonts API | experimental | stable | stable |
| Live collections | experimental flag | stable | stable |
| Compiler | Go | Go | Rust, stricter HTML |
| Default Markdown processor | remark and rehype | remark and rehype | Sätteri |

The Node, Vite and Zod rows reflect the `engines` and `dependencies` fields of the published `astro` package for each major.
When a claim matters, confirm it against the docs for the installed version.

## Look things up, do not guess

Prefer the Astro Docs MCP server over memory.
If the `search_astro_docs` tool is available, call it before relying on recollection of any API.
If it is not available, tell the user they can add it with:

```bash
claude mcp add --transport http astro-docs https://mcp.docs.astro.build/mcp
```

Until then, fetch the relevant page from docs.astro.build.
Never cite or fetch `llms.txt`, `llms-full.txt` or `llms-small.txt`.
Astro removed those files from the docs in April 2026 (withastro/docs PR 13538), so any copy is stale.

## Project structure and routing

- `src/pages/` holds routes. A file becomes a route: `.astro`, `.md`, `.mdx` and endpoint files (`.ts` or `.js` exporting `GET`, `POST` and so on).
- `src/content.config.ts` defines build-time collections. `src/live.config.ts` defines live collections.
- `src/layouts/` and `src/components/` are conventions, not magic. Keep shared page chrome in one layout.
- `public/` is copied as-is with no processing. Put processed assets (images, fonts you want optimized) in `src/`.
- Dynamic routes use `[slug].astro` and `[...rest].astro`. In static output every dynamic route needs `getStaticPaths()` returning `{ params, props }` entries.
- Route params from `getStaticPaths()` must be strings. Numbers are rejected from Astro 6.
- Do not read `Astro.site` or `Astro.generator` inside `getStaticPaths()` on Astro 6 or later. Use `import.meta.env.SITE` there.
- Redirects belong in the `redirects` config or in a page that returns `Astro.redirect()`.

## Output modes and adapters

- Astro is static by default. Every page is prerendered at build time.
- Opt a single route into on-demand rendering with `export const prerender = false`. This keeps the rest of the site static.
- `output: 'server'` flips the default: every route renders on demand and you opt pages back in with `export const prerender = true`. Start from `static` unless most routes need a server.
- On-demand routes need an adapter (`@astrojs/node`, `@astrojs/vercel`, `@astrojs/netlify` or `@astrojs/cloudflare`). A fully static site needs no adapter.
- Response headers can only be set at the page level, not from inside a component.
- Server-only data (cookies, request headers, `Astro.locals`) is available only on on-demand routes.
- On Astro 7, route caching is stable. Use `Astro.cache` and `routeRules` with `memoryCache()` or a CDN provider such as `cacheVercel()` from `@astrojs/vercel/cache`.

## Islands and client JavaScript

Astro ships zero client JavaScript for components unless you add a `client:*` directive.
Choose the least eager directive that still works:

- `client:visible` for anything below the fold.
- `client:idle` for non-critical UI that can wait for the main thread to settle.
- `client:media="(query)"` for UI that exists only at certain viewport sizes.
- `client:load` only for UI that must be interactive immediately.
- `client:only="react"` (or another framework) only when the component cannot render on the server.

Prefer a plain `.astro` component with a `<script>` tag for small interactions.
Do not hydrate a whole framework tree to toggle one class.

Server islands (`server:defer` on a component) render a slow or personalized piece on demand while the page shell stays cached.
They require an adapter.
Give them a `slot="fallback"` placeholder so the layout does not jump.

## Content layer and collections

- Define collections in `src/content.config.ts` with `defineCollection({ loader, schema })`. The legacy `src/content/config.ts` form was removed in Astro 6.
- Use `glob()` for Markdown, MDX, JSON, YAML or TOML files and `file()` for one file holding many entries. Both come from `astro/loaders`. Custom loaders are plain objects with a `load()` function.
- Schemas use Zod. On Astro 6 and 7 import `z` from `astro/zod` and use Zod 4 syntax (`z.email()`, `z.url()`, `{ error: '...' }`). On Astro 5 the Zod 3 `z` from `astro:content` applies.
- Query with `getCollection()` and `getEntry()`. Render Markdown or MDX with the standalone `render(entry)` from `astro:content`, never `entry.render()`.
- Entry ids come from file names. Do not rely on slug-based ids.
- Use `reference()` for typed links between collections.
- Live collections fetch at request time. Define them in `src/live.config.ts` with `defineLiveCollection()` and query with `getLiveCollection()` and `getLiveEntry()`. They need an adapter and on-demand rendering, and are stable on Astro 6 and later.
- Replace `Astro.glob()` (removed in Astro 6) with `getCollection()` or `import.meta.glob()`.

## Actions, sessions, middleware and env

- Actions (`astro:actions`) are typed server functions. Define them with `defineAction({ input, handler })` in `src/actions/index.ts` and use `accept: 'form'` for HTML forms. Validate every input with Zod.
- Check `isInputError(error)` and `error.fields` on the client side of an action call. Do not trust client-side validation alone.
- Sessions use `Astro.session`. On Astro 6 and later, configure the driver with `sessionDrivers.<name>()` from `astro/config` and not with a driver string.
- Middleware lives in `src/middleware.ts` and exports `onRequest`. Chain with `sequence()`. Pass per-request data through `context.locals`.
- On Astro 7, `src/fetch.ts` is a reserved file name used by advanced routing. Do not use that name for anything else.
- Use `astro:env` for environment variables. Declare them in `env.schema` with `envField.string()` and friends, setting `context` (`client` or `server`) and `access` (`public` or `secret`).
- Never read a secret on the client. Secrets are server-only, so keep `access: 'secret'` variables out of components that hydrate and out of `client:*` islands.
- Do not use `import.meta.env` for secrets. On Astro 6 and later its values are always inlined at build time and never coerced.

## Images and fonts

- Use `<Image />` and `<Picture />` from `astro:assets` for local and remote images. Pass `width` and `height` (or import the image so they are inferred) to avoid layout shift.
- Remote images need `image.domains` or `image.remotePatterns` in the config.
- Astro 6 changed the default image service: it crops when `fit` is not set, never upscales, and can rasterize SVGs. Check hero images after upgrading. `getImage()` throws if called in client code.
- The Fonts API is stable on Astro 6 and later. Declare fonts in the `fonts` config using `fontProviders` (Google, Fontsource, local and others) with a `cssVariable`, then render `<Font cssVariable="--font-name" preload />` from `astro:assets` in the layout head.
- On Astro 5 the Fonts API is experimental. Self-host with Fontsource or a local `@font-face` instead.

## View transitions and prefetch

- Add `<ClientRouter />` from `astro:transitions` to the shared layout head to get client-side navigation. `<ViewTransitions />` was removed in Astro 6.
- Scripts that must run on every navigation listen for `astro:page-load`. Use lifecycle event names directly. The `TRANSITION_*` constants and `isTransition...Event()` helpers are gone as of Astro 7.
- Configure `prefetch` in `astro.config.*` (`prefetchAll`, `defaultStrategy`) and override per link with `data-astro-prefetch`. The `with` option of `prefetch()` was removed in Astro 6.

## Testing and type checking

- Unit test with Vitest through `getViteConfig()` from `astro/config` so Astro's config and plugins load.
- Test `.astro` components with the Container API (`AstroContainer` from `astro/container`, `renderToString()`). Astro components cannot render in a Vitest client environment on Astro 6 and later.
- On Astro 7, import `getContainerRenderer()` from the `container-renderer` entry of the framework package, for example `@astrojs/react/container-renderer`.
- Run `npx astro check` for type checking of `.astro`, TypeScript and content. It needs `@astrojs/check` and `typescript` installed. `astro sync` regenerates the generated types and runs automatically during `dev`, `build` and `check`.

## Working with the dev server as an agent

On Astro 7, `astro dev` detects an AI coding agent on macOS and Linux and starts itself as a detached background process.
It writes `.astro/dev.json` with the URL, port and PID, so a second start for the same project reuses it.
Do not run a blocking foreground `astro dev` in that case.

- Read `.astro/dev.json` to find the URL and port.
- Check health with the `/_astro/status` endpoint.
- `astro dev status` shows URL, PID and uptime. `astro dev logs` (add `-f` to follow) prints the structured JSON logs. `astro dev stop` shuts the server down.
- Set `ASTRO_DEV_BACKGROUND=0` to opt out of automatic background mode.
- `astro preview --background` is available from Astro 7.2.

On Astro 5 and 6 there is no background mode.
Start the dev server as a managed background process in your own tooling and poll its URL instead of blocking on it.

## Guardrails checklist

- Installed Astro, adapter and integration majors match.
- Static unless a route needs a server, and each on-demand route says so explicitly.
- Least eager `client:*` directive, and no framework component hydrated without reason.
- Collections use `src/content.config.ts`, loaders and Zod from `astro/zod` (Astro 6 and later).
- Secrets only through `astro:env` with server context.
- `npx astro check` and a production `astro build` pass before calling work done.

---

_Written from the official Astro documentation (docs.astro.build), verified October 2026._
