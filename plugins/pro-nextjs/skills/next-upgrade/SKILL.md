---
name: next-upgrade
description: Upgrade a Next.js app to a newer version (latest, canary or a named release) with the official upgrade command and codemods, one major version at a time, then fix what the codemods leave and verify the build. Use when asked to upgrade or migrate Next.js, or when package.json pins a `next` version behind the latest. Written from the official Next.js upgrade guides.
---

# Upgrading Next.js

Say at the start that you are using the next-upgrade skill.
Each step names the docs page it comes from; the per-version guide is the authority for anything this page leaves out.

## 1. Find where the app is and where it is going

- Read `package.json` for the installed `next`, `react`, `react-dom`, `eslint-config-next` and `typescript` versions, and the lockfile for the package manager.
- The target is the version the user named, else the latest stable (`npm view next version`; `npm view next dist-tags` lists canary too).
- Check the runtime floor for the target.
  Next.js 16 needs Node.js 20.9.0 or later and TypeScript 5.1.0 or later; the App Router has needed React 19 since Next.js 15.
- Work on a clean branch so the codemod diff can be reviewed on its own.

Sources: [Upgrading](https://nextjs.org/docs/app/getting-started/upgrading), [Version 16](https://nextjs.org/docs/app/guides/upgrading/version-16), [Version 15](https://nextjs.org/docs/app/guides/upgrading/version-15).

## 2. Plan one major at a time

- Crossing several majors (say 14 to 16) goes one hop per major: upgrade, verify, commit, then take the next hop.
- Read the guide for each hop before running anything: [version 14](https://nextjs.org/docs/app/guides/upgrading/version-14), [version 15](https://nextjs.org/docs/app/guides/upgrading/version-15), [version 16](https://nextjs.org/docs/app/guides/upgrading/version-16).
- Optionally run `npx @next/codemod@canary agents-md` first, so `AGENTS.md` points at the docs bundled with the installed version in `node_modules/next/dist/docs/`.

Source: [Upgrade guides](https://nextjs.org/docs/app/guides/upgrading).

## 3. Run the upgrade command

- On Next.js 16.1 and later, run the built-in command with the project's package manager: `npx next upgrade` (or `pnpm next upgrade`, `yarn next upgrade`, `bunx next upgrade`).
  `--revision <version>` picks a target such as `latest`, `canary` or `16.4.0`.
- Before 16.1 the command does not exist; use `npx @next/codemod@canary upgrade latest`, which bumps the packages and runs the codemods for that release.
  `--skip-react-upgrade`, `--skip-eslint-upgrade` and `-y` control what it touches.
- To hand the whole upgrade to a coding agent instead, the docs offer `npx next@canary upgrade --agent=latest` (experimental).

Sources: [Upgrading](https://nextjs.org/docs/app/getting-started/upgrading), [next CLI: next upgrade](https://nextjs.org/docs/app/api-reference/cli/next), [Upgrade with a coding agent](https://nextjs.org/docs/app/guides/upgrading/agent-upgrade).

## 4. Run the codemods the upgrade command skips

A single codemod runs as `npx @next/codemod <transform> <path>`; add `--dry` to preview and `--print` to see the output.

| Target | Codemod | What it changes |
|---|---|---|
| 16.0 | `middleware-to-proxy` | Renames `middleware` to `proxy` |
| 16.0 | `next-lint-to-eslint-cli` | Replaces `next lint` with the ESLint CLI |
| 16.0 | `remove-unstable-prefix` | Drops `unstable_` from APIs that are now stable |
| 16.0 | `remove-experimental-ppr` | Removes the `experimental_ppr` segment config |
| 15.0 | `next-async-request-api` | Makes `params`, `searchParams`, `cookies()`, `headers()` and `draftMode()` async |
| 15.0 | `app-dir-runtime-config-experimental-edge` | Turns `runtime = 'experimental-edge'` into `'edge'` |
| 15.0 | `next-request-geo-ip` | Replaces the removed `geo` and `ip` on `NextRequest` |
| 14.0 | `next-og-import` | Moves `ImageResponse` imports to `next/og` |
| 14.0 | `metadata-to-viewport-export` | Splits viewport fields out of `metadata` |

The 16 upgrade does not run `next-async-request-api`.
If the code still reads request APIs synchronously from the Next.js 15 compatibility period, run `npx @next/codemod@canary next-async-request-api .` and resolve every `@next-codemod-error` comment it leaves.

Sources: [Codemods](https://nextjs.org/docs/app/guides/upgrading/codemods), [Version 16: using the codemod](https://nextjs.org/docs/app/guides/upgrading/version-16).

## 5. Upgrade packages by hand when needed

When the upgrade command is not an option, install the packages directly with the project's package manager, for example `npm i next@latest react@latest react-dom@latest eslint-config-next@latest`.
With TypeScript, update `@types/react` and `@types/react-dom` in the same step.

Source: [Upgrading](https://nextjs.org/docs/app/getting-started/upgrading).

## 6. Work through the breaking changes

Go through the target's guide top to bottom; the codemods cover only part of it.

Next.js 16:

- Turbopack is the default for `next dev` and `next build`; a project that still needs webpack opts out with the `--webpack` flag.
- Synchronous request API access is gone.
- `middleware` is deprecated in favor of `proxy`.
- Every parallel-route slot needs a `default` file.
- `next lint`, AMP support and runtime config (`serverRuntimeConfig`, `publicRuntimeConfig`) are removed.
- `next/image` defaults changed (`minimumCacheTTL`, `imageSizes`, `qualities`, local images with query strings) and `priority` is deprecated in favor of `preload`.
- `revalidateTag` takes a `cacheLife` profile as its second argument.
- Cache Components (`cacheComponents: true`) replaces `experimental.ppr` and stays opt-in; adopting it is separate work for `next-skills-bridge`.

Next.js 15:

- Request APIs became async (with temporary synchronous access).
- The App Router requires React 19.
- `fetch` requests and `GET` Route Handlers are no longer cached by default, and the client router cache no longer reuses page segments.
- `@next/font` is removed in favor of `next/font`.

Sources: [Version 16](https://nextjs.org/docs/app/guides/upgrading/version-16), [Version 15](https://nextjs.org/docs/app/guides/upgrading/version-15).

## 7. Verify

- Run the type check, the linter (through the ESLint CLI from 16), the test suite, `next build` and `next dev`.
- Load the main routes in a browser and watch the console for hydration and deprecation warnings.
- For runtime checks against a running `next dev`, `next-skills-bridge` routes to the upstream `next-dev-loop` skill.

Source: [Version 16](https://nextjs.org/docs/app/guides/upgrading/version-16).

## 8. Commit each hop

Commit `package.json`, the lockfile and the codemod changes for each major as its own commit (for example `chore: upgrade Next.js to 16.4.2`), so a regression can be bisected to one hop.

---

_Written from the [Next.js documentation](https://nextjs.org/docs) in [vercel/next.js](https://github.com/vercel/next.js/tree/canary/docs) (MIT, Copyright (c) 2025 Vercel, Inc.); each step cites its page. See this plugin's LICENSE._
