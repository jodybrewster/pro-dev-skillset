---
name: next-best-practices
description: Next.js App Router conventions to follow whenever writing or reviewing code in a Next.js project - routing files, Server and Client Components, async request APIs, data fetching and Server Functions, errors, Route Handlers, metadata, images, fonts, bundling, scripts, hydration, streaming, parallel and intercepting routes and self-hosting. Written from the official Next.js docs, current to Next.js 16. For a version upgrade use next-upgrade; for Cache Components, Partial Prefetching, bundle audits or the dev verify loop use next-skills-bridge.
---

# Next.js App Router conventions

Follow these when you write or review code in a Next.js app.
Each section names the docs page it comes from; when a rule here and the docs disagree, the docs win.
On Next.js 16.2 and later the docs for the installed version ship in `node_modules/next/dist/docs/`, so read those first when they exist.

## Routing files and folders

- A folder under `app/` is a URL segment, and it becomes public only once it holds a `page` or `route` file.
- The special files are `layout`, `page`, `loading`, `not-found`, `error`, `global-error`, `route`, `template` and `default`.
- Dynamic segments are `[slug]`, catch-all `[...slug]` and optional catch-all `[[...slug]]`.
- `(group)` folders organize routes without adding to the URL; `_private` folders are never routable.
- From Next.js 16, request interception lives in `proxy.ts` with an exported `proxy` function; `middleware.ts` is deprecated and the `middleware-to-proxy` codemod renames it.
  `proxy` always runs on the Node.js runtime, so code that needs the edge runtime keeps `middleware` for now.

Sources: [Project structure](https://nextjs.org/docs/app/getting-started/project-structure), [proxy](https://nextjs.org/docs/app/api-reference/file-conventions/proxy).

## Server and Client Components

- Components are Server Components unless a file starts with `'use client'`, which goes above the imports.
- That directive marks a boundary: the file and everything it imports join the client bundle, so put it on the smallest interactive leaf.
  A Server Component passed to a Client Component as `children` or another prop stays on the server.
- Props that cross from server to client must be serializable; plain functions cannot cross.
- Server Components cannot use React context, so wrap providers in a Client Component that takes `children`.
- Add `import 'server-only'` to modules that must never reach the browser (secrets, database clients).
- `'use server'` marks Server Functions, which must be `async`; a Client Component can only import them from a file that starts with `'use server'`.

Sources: [Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components), [use client](https://nextjs.org/docs/app/api-reference/directives/use-client), [use server](https://nextjs.org/docs/app/api-reference/directives/use-server).

## Async request APIs

- `cookies()`, `headers()` and `draftMode()` return promises; `await` them on the server or unwrap them with React's `use` in a Client Component.
- `params` is a promise in layouts, pages, Route Handlers, `default` files and the image metadata files; `searchParams` is a promise in pages.
- Next.js 16 removed synchronous access entirely.
  Older code converts with `npx @next/codemod@canary next-async-request-api .`; resolve every `@next-codemod-error` comment and temporary `UnsafeUnwrapped` cast it leaves behind.

Sources: [cookies](https://nextjs.org/docs/app/api-reference/functions/cookies), [headers](https://nextjs.org/docs/app/api-reference/functions/headers), [Upgrading to version 16](https://nextjs.org/docs/app/guides/upgrading/version-16).

## Fetching and changing data

- Fetch in Server Components, close to where the data is used.
  `fetch` is not cached by default; identical calls in one render are deduplicated.
- Start independent requests together and `await Promise.all([...])` instead of awaiting them one after another; use `Promise.allSettled` when one failure should not sink the rest.
- To preload, call the data function without `await` early and again where the data is consumed, and make the function deduplicate (with `fetch` memoization or `React.cache`).
- Change data with Server Functions.
  Each one is reachable by a direct POST, so check authentication and authorization inside every function.
- After a change, call `revalidatePath`, `revalidateTag` or `refresh()` so the UI shows it.

Sources: [Fetching data](https://nextjs.org/docs/app/getting-started/fetching-data), [Mutating data](https://nextjs.org/docs/app/getting-started/mutating-data).

## Errors, not-found and redirects

- Return expected errors from a Server Function as values (read them with `useActionState`) rather than throwing.
- An `error` file must be a Client Component.
  It receives `error` and `reset`, plus `retry` from Next.js 16.3 (`unstable_retry` in 16.2), and it does not catch errors thrown by the layout above it.
- `global-error` replaces the root layout when it renders, so it must render its own `<html>` and `<body>` and does not get the app's global styles.
- `notFound()` renders the nearest `not-found` file; call it before streaming starts or the response stays 200.
- `redirect()` responds 307 and `permanentRedirect()` 308; in Server Functions and Route Handlers call them outside `try`/`catch`, because they work by throwing.
- `forbidden()` (403) and `unauthorized()` (401) need `experimental.authInterrupts` in `next.config`, render `forbidden` and `unauthorized` files and cannot be used in the root layout.
- If a `catch` block might swallow one of these framework errors, call `unstable_rethrow(error)` first.

Sources: [Error handling](https://nextjs.org/docs/app/getting-started/error-handling), [error.js](https://nextjs.org/docs/app/api-reference/file-conventions/error), [forbidden](https://nextjs.org/docs/app/api-reference/functions/forbidden), [unstable_rethrow](https://nextjs.org/docs/app/api-reference/functions/unstable_rethrow).

## HTTP endpoints with Route Handlers

- A `route.ts` file exports one async function per method: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD` and `OPTIONS`.
  Other methods get a 405, and `OPTIONS` is filled in when you leave it out.
- A segment holds either a `page` or a `route`, never both.
- Route Handlers are not cached by default; a `GET` can opt in with `export const dynamic = 'force-static'`.
- The second argument's `params` is a promise.

Sources: [Route Handlers](https://nextjs.org/docs/app/getting-started/route-handlers), [route.js](https://nextjs.org/docs/app/api-reference/file-conventions/route).

## Metadata and social images

- Set metadata with a `metadata` object or an async `generateMetadata` function, never both in one segment, and only from Server Components.
- When `generateMetadata` and the page need the same data, share it through `React.cache` or a memoized `fetch`.
- File conventions cover the rest: `favicon`, `icon`, `apple-icon`, `opengraph-image`, `twitter-image`, `sitemap` and `robots`.
- Generate images with `ImageResponse` from `next/og`.
  It supports flexbox and a subset of CSS (no grid), a 500 KB bundle and `ttf`, `otf` or `woff` fonts.

Sources: [Metadata and OG images](https://nextjs.org/docs/app/getting-started/metadata-and-og-images), [ImageResponse](https://nextjs.org/docs/app/api-reference/functions/image-response).

## Images

- Render images with `next/image`.
- Remote sources need an `images.remotePatterns` entry in `next.config` plus explicit `width` and `height`; `images.domains` is deprecated.
- Give `sizes` to every `fill` or responsive image, or the browser assumes full viewport width.
- In Next.js 16, `priority` is deprecated in favor of `preload`; for the largest above-the-fold image the docs usually recommend `loading="eager"` or `fetchPriority="high"` instead.
- `placeholder="blur"` works out of the box for static imports; remote images also need `blurDataURL`.

Sources: [Images](https://nextjs.org/docs/app/getting-started/images), [Image component](https://nextjs.org/docs/app/api-reference/components/image).

## Fonts

- Load fonts with `next/font/google` or `next/font/local`; both self-host, so the browser never calls Google.
- Apply app-wide fonts in the root layout.
- `subsets` (Google fonts only) trims the download; variable fonts need no `weight`, static ones do.
- `variable: '--font-name'` exposes a CSS variable, which is how Tailwind picks the font up.

Sources: [Fonts](https://nextjs.org/docs/app/getting-started/fonts), [Font module](https://nextjs.org/docs/app/api-reference/components/font).

## Package bundling

- `serverExternalPackages` in `next.config` keeps a package out of the server bundle and loads it with Node's `require`.
- `transpilePackages` in `next.config` compiles listed packages (monorepo siblings, dependencies shipping TS or JSX); it takes package names, not paths.
- `next analyze` (Next.js 16.1 and later, Turbopack) shows what each route ships; `@next/bundle-analyzer` with `ANALYZE=true` is the webpack equivalent.
  For a full initial-load audit, route to `next-skills-bridge` and its `next-bundle-optimizer`.

Sources: [Package bundling](https://nextjs.org/docs/app/guides/package-bundling), [serverExternalPackages](https://nextjs.org/docs/app/api-reference/config/next-config-js/serverExternalPackages), [transpilePackages](https://nextjs.org/docs/app/api-reference/config/next-config-js/transpilePackages).

## Third-party scripts

- Load them with `next/script`.
  A script in a layout loads once and survives navigation.
- `strategy` is `afterInteractive` by default; `beforeInteractive` must sit in the root layout; `lazyOnload` waits for idle time; `worker` is experimental and does not yet work with the App Router.
- Every inline script needs an `id`.
- `@next/third-parties/google` wraps Google Tag Manager, Analytics and similar embeds.

Sources: [Scripts](https://nextjs.org/docs/app/guides/scripts), [Script component](https://nextjs.org/docs/app/api-reference/components/script), [Third-party libraries](https://nextjs.org/docs/app/guides/third-party-libraries).

## Hydration mismatches

- The usual causes are invalid nesting (a `<div>` or `<p>` inside a `<p>`, an `<a>` inside an `<a>`), `typeof window` branches or browser-only APIs during render, time-dependent values such as `Date()` and markup injected by browser extensions or a CDN.
- Move browser-only values into `useEffect`, or load the component with `dynamic(..., { ssr: false })`.
- `suppressHydrationWarning` silences one element one level deep; treat it as an escape hatch, not a fix.

Source: [React hydration error](https://nextjs.org/docs/messages/react-hydration-error).

## Streaming and Suspense

- A `loading` file wraps the whole page in Suspense; a `<Suspense>` boundary placed right around the slow or dynamic part streams more of the page sooner.
- The status code goes out with the first streamed chunk, so call `notFound()` before any `await` or `<Suspense>` boundary to get a real 404; a `redirect()` after that point becomes a client-side redirect.
- `useSearchParams()` on a statically rendered route needs a `<Suspense>` boundary around the component that calls it, or the whole page falls back to client rendering.

Sources: [Streaming](https://nextjs.org/docs/app/guides/streaming), [Missing Suspense boundary with useSearchParams](https://nextjs.org/docs/messages/missing-suspense-with-csr-bailout).

## Parallel and intercepting routes

- An `@slot` folder becomes a prop of the parent layout and does not change the URL.
- Every slot needs a `default` file for hard navigations; from Next.js 16 the build fails without one.
  It can return `null` or call `notFound()`.
- `(.)`, `(..)`, `(..)(..)` and `(...)` intercept by route segment, not by file-system folder, so `@slot` folders do not count.
- A modal is a slot plus an intercepting route, closed with `router.back()` or a `Link`; the URL stays shareable and a refresh shows the full page.

Sources: [Parallel routes](https://nextjs.org/docs/app/api-reference/file-conventions/parallel-routes), [Intercepting routes](https://nextjs.org/docs/app/api-reference/file-conventions/intercepting-routes).

## Self-hosting

- `output: 'standalone'` in `next.config` emits `.next/standalone` with a minimal `server.js`; copy `public/` and `.next/static/` next to it yourself.
- With more than one instance, share `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` across all of them, set a `deploymentId` and point `cacheHandler` (and `cacheHandlers` for `'use cache'`) at a shared store such as Redis.
- Streaming needs response buffering turned off in nginx or any similar proxy in front of the server (for nginx, send `X-Accel-Buffering: no`).

Sources: [Self-hosting](https://nextjs.org/docs/app/guides/self-hosting), [output](https://nextjs.org/docs/app/api-reference/config/next-config-js/output), [cacheHandler](https://nextjs.org/docs/app/api-reference/config/next-config-js/incrementalCacheHandlerPath).

---

_Written from the [Next.js documentation](https://nextjs.org/docs) in [vercel/next.js](https://github.com/vercel/next.js/tree/canary/docs) (MIT, Copyright (c) 2025 Vercel, Inc.); each section cites its page. See this plugin's LICENSE._
