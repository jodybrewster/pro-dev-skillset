---
name: next-best-practices
description: Auto-applied Next.js best practices — file conventions, RSC boundaries, async APIs, data patterns, error handling, metadata, image/font optimization, bundling, hydration, and caching. Applied automatically when working on Next.js projects.
user-invocable: false
---

# Next.js Best Practices

Apply these rules when writing or reviewing Next.js code.

## File Conventions

- `app/` uses the App Router. `pages/` uses the Pages Router. Never mix conventions in the same route.
- Special files: `layout.tsx`, `page.tsx`, `loading.tsx`, `error.tsx`, `not-found.tsx`, `route.ts`, `middleware.ts` (v16: `proxy.ts`).
- Dynamic segments: `[slug]`, `[...rest]`, `[[...optional]]`. Route groups with `(group)` don't affect URL paths.
- Parallel routes: `@slot` folders. Intercepting routes: `(.)`, `(..)`, `(...)` prefix.
- Always provide `default.tsx` for parallel route slots.

## RSC Boundaries

- Server Components: async by default, can fetch data directly, can't use hooks or browser APIs.
- Client Components: `'use client'` at top of file. Must be synchronous (no `async` client components).
- Props crossing the RSC boundary must be serializable — no functions, class instances, or Symbols.
- Server Actions (`'use server'`) can be defined in Server Components or in separate files with `'use server'` at the top.

## Async APIs (Next.js 15+)

These are now async — always `await` them:
```tsx
const { slug } = await params          // was synchronous
const { q } = await searchParams       // was synchronous
const cookieStore = await cookies()    // was synchronous
const headersList = await headers()    // was synchronous
```
Apply the `next-async-request-api` codemod when upgrading: `npx @next/codemod@latest next-async-request-api .`

## Data Patterns

- **Server Components**: fetch directly in the component. Use `Promise.all` to avoid sequential waterfalls.
- **Server Actions**: for mutations from Client Components. Mark with `'use server'`.
- **Route Handlers**: for REST APIs called from outside React. Don't use for Server Component data.
- Avoid passing large data from Server → Client Component props — fetch separately or use Context.
- Preload pattern: call a `preload()` function before `<Suspense>` to kick off parallel fetches.

## Error Handling

- `error.tsx` — must be a Client Component (`'use client'`). Receives `error` and `reset` props.
- `global-error.tsx` — replaces the root layout on error; must include `<html>` and `<body>`.
- `not-found.tsx` — renders when `notFound()` is called. No props.
- Use `redirect(url)` / `permanentRedirect(url)` for navigation in Server Components and Server Actions.
- Use `forbidden()` / `unauthorized()` (v15+) for auth errors — requires `forbidden.tsx` / `unauthorized.tsx`.
- In `catch` blocks that re-throw, use `unstable_rethrow(error)` first to let Next.js handle framework errors.

## Route Handlers

- File: `app/path/route.ts`. Export named functions: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, `OPTIONS`.
- A `route.ts` at the same path as a `page.tsx` causes a conflict — only one is resolved.
- Route Handlers run in a server environment without React DOM. Don't use JSX.
- Prefer Server Actions over Route Handlers for mutations from React components.

## Metadata & OG Images

```tsx
// Static
export const metadata: Metadata = { title: 'Page', description: '...' }

// Dynamic
export async function generateMetadata({ params }): Promise<Metadata> {
  return { title: (await params).slug }
}
```
- OG images: use `ImageResponse` from `next/og` in a `opengraph-image.tsx` file or a Route Handler.
- File-based: `favicon.ico`, `icon.png`, `apple-icon.png`, `opengraph-image.png` in the `app/` folder.

## Image Optimization

- Always use `next/image` — never bare `<img>` tags.
- Remote images require `remotePatterns` in `next.config.ts`.
- Add `sizes` prop for responsive images: `sizes="(max-width: 768px) 100vw, 50vw"`.
- `priority` on the LCP image (hero, above-the-fold).
- `placeholder="blur"` with `blurDataURL` for progressive loading.

## Font Optimization

- Use `next/font` — never `@import` or `<link>` for Google Fonts.
- Apply via `className` on `<html>` (in root layout) or component root.
- Specify `subsets` to reduce download size: `{ subsets: ['latin'] }`.
- Local fonts: `localFont({ src: './font.woff2' })`.
- Tailwind: set `variable` option and add to `tailwind.config` `fontFamily`.

## Bundling

- Mark server-only packages in `package.json` `serverExternalPackages` or import from `server-only`.
- CSS: import `.css` files — never use `<link>` tags in components.
- Polyfills for `fetch`, `URL`, `Web Crypto` are included — don't add them.
- For ESM/CJS issues, use `transpilePackages` in `next.config.ts`.
- Bundle analyzer: `@next/bundle-analyzer` — wrap config and run with `ANALYZE=true`.

## Scripts

- Use `next/script` for third-party scripts — never bare `<script>` tags in layouts.
- Inline scripts need an `id` prop.
- `strategy="beforeInteractive"`: blocking, use sparingly. `"afterInteractive"`: default. `"lazyOnload"`: lowest priority.
- Google Analytics: use `@next/third-parties/google` (`GoogleAnalytics` component).

## Hydration Errors

Common causes and fixes:
- **Browser extensions** injecting DOM — wrap in `suppressHydrationWarning` on `<html>`.
- **`Date.now()` / `Math.random()`** — move to `useEffect` or use stable IDs.
- **Invalid HTML nesting** — e.g., `<p>` inside `<p>`, `<div>` inside `<p>`.
- **`localStorage` / `window` at module level** — guard with `typeof window !== 'undefined'` or `useEffect`.

## Suspense Boundaries

- `useSearchParams()` and `usePathname()` in Client Components require a `<Suspense>` boundary wrapping the component in a parent Server Component, or cause a CSR bailout.
- `<Suspense fallback={...}>` enables streaming SSR for dynamic content.

## Parallel & Intercepting Routes

- Modal pattern: parallel route `@modal` + intercepting route `(.)path`.
- `router.back()` closes intercepted modals (not `router.push`).
- Always add `default.tsx` to slots — fallback when slot can't be matched.

## Self-Hosting (Docker)

```ts
// next.config.ts
output: 'standalone'
```
- Multi-instance ISR: set a custom `cacheHandler` in `next.config.ts`.
- Features not supported in self-hosted: `revalidatePath` / `revalidateTag` across instances (need shared cache).

## Suspense & Streaming

Wrap dynamic content in `<Suspense>` with a fallback for streaming SSR. Avoid blocking the entire page on slow data fetches — stream the slow parts and serve the shell instantly.

---

_Adapted from [vercel-labs/next-skills](https://github.com/vercel-labs/next-skills)._
