---
name: next-upgrade
description: Upgrade Next.js to the latest version following official migration guides and codemods. Use when asked to upgrade Next.js or when the `next` version in package.json is behind the latest.
---

# Next.js Upgrade

Structured approach for upgrading Next.js projects to the latest (or a specified) version.

**Announce at start:** "I'm using the next-upgrade skill to upgrade Next.js."

## Step 1 — Detect current versions

Read `package.json` and identify:
- Current `next` version
- Current `react` and `react-dom` versions
- Current TypeScript version (if applicable)
- Target version (from skill argument, or latest if unspecified)

```bash
cat package.json | grep -E '"next"|"react"'
npm show next version          # latest stable
npm show next@canary version   # latest canary
```

## Step 2 — Plan the upgrade path

For upgrades spanning multiple major versions (e.g., 13 → 15), upgrade one major at a time:
- 13 → 14, verify, then 14 → 15

Fetch the official migration guide for each hop from `https://nextjs.org/docs/upgrading`.

## Step 3 — Apply codemods

Run the official codemods before touching code manually:

```bash
npx @next/codemod@latest <transform> <path>
```

Common transforms by version:
| Version | Codemod | What it does |
|---------|---------|--------------|
| 15 | `next-async-request-api` | Converts `params`, `searchParams`, `cookies()`, `headers()` to async |
| 15 | `next-og-import` | Migrates `ImageResponse` import path |
| 14 | `next-dynamic-imports` | Converts `import()` expressions |
| 15 | `geo-ip-deprecated` | Removes deprecated `geo` and `ip` properties |

Run the full codemod suite with:
```bash
npx @next/codemod@latest upgrade latest
```

## Step 4 — Update dependencies

```bash
npm install next@latest react@latest react-dom@latest
```

If using TypeScript:
```bash
npm install --save-dev @types/react@latest @types/react-dom@latest @types/node@latest
```

For a specific version:
```bash
npm install next@15.0.0
```

## Step 5 — Address breaking changes manually

Review the migration guide for changes codemods don't cover:
- Config option renames in `next.config.ts`
- Deprecated APIs removed in this version
- New required file conventions
- Changed default behaviors (caching, rendering, etc.)

Key changes by major version:

**Next.js 15:**
- `cookies()`, `headers()`, `params`, `searchParams` are now async (codemod handles most)
- Caching defaults changed: `fetch()` is no longer cached by default
- `unstable_cache` → `'use cache'` directive (with `cacheComponents: true`)
- `experimental.ppr` → `cacheComponents: true` for PPR

**Next.js 14:**
- Stable App Router, stable Server Actions
- `next/font` replaces `@next/font`

## Step 6 — Update TypeScript config (if applicable)

Ensure `tsconfig.json` targets are compatible. Next.js 15+ requires TypeScript 5+.

## Step 7 — Validate

```bash
npm run build       # Check for build errors
npm run dev         # Check for runtime warnings
```

Fix any remaining TypeScript or ESLint errors. Check the browser for hydration errors or console warnings.

## Step 8 — Commit

```bash
git add package.json package-lock.json
git commit -m "chore: upgrade Next.js to vX.Y.Z"
```

---

_Adapted from [vercel/next.js](https://github.com/vercel/next.js/tree/canary/skills) (Next.js agent skills by Vercel), MIT License. See the repository for full license text._
