---
name: electron-upgrade
description: Structured workflow for upgrading Electron major versions in an app, one major at a time, with native module rebuilds (@electron/rebuild, Node ABI, N-API) and the packager (electron-builder, Electron Forge, electron-vite) checked at each hop. Use when asked to upgrade or bump Electron or when the electron version in package.json is behind the supported majors. For IPC, packaging or release help use electron-skills-bridge; for a security audit use electron-security-audit.
---

# Electron upgrade

Structured approach for moving an Electron app to a newer major version.

Announce at start: "I'm using the electron-upgrade skill to upgrade Electron."

This skill was written against the Electron docs as of 2026-10-30.
It names no version as current.
Read the live facts from the registry and the release pages in Step 1 and Step 2.

## Rules

- Upgrade one major at a time. Never skip a major, even when the target is several ahead.
- Finish and verify one hop (rebuild, build, typecheck, tests, launch) before starting the next.
- Read the official [breaking changes doc](https://www.electronjs.org/docs/latest/breaking-changes) for each hop. It is the source of truth.
- Do not edit lockfiles or generated files by hand. Let the package manager write them.
- Commit after each verified hop so a bad hop is easy to revert.

## Step 1 - Detect current versions

Read `package.json` and the installed versions:

```bash
node -v
npm ls electron electron-builder @electron-forge/cli electron-vite @electron/rebuild
npm view electron dist-tags
grep '"version"' node_modules/electron/package.json
```

Also note:

- The package manager and the lockfile it writes.
- The packager: electron-builder, Electron Forge, electron-vite or another.
- Native dependencies. Find packages that carry a `binding.gyp` or prebuilt binaries:

```bash
find node_modules -maxdepth 3 \( -name binding.gyp -o -name prebuilds \) -not -path '*/node_modules/.cache/*'
```

- The bundled Node and Chromium versions of the installed Electron, from its release notes.
- Whether CI and the release pipeline pin a Node version.

Show the person the current major, the target major and the list of hops before changing anything.

## Step 2 - Check the support window

Electron ships a new major roughly every 8 weeks and supports the latest three.
Check [releases.electronjs.org](https://releases.electronjs.org) and [endoflife.date/electron](https://endoflife.date/electron) for which majors are supported today.
Pick the target as the newest stable major unless the person names another.
If the app is outside the support window, say so: it receives no security fixes, which raises the priority of this work.

## Step 3 - One hop

Repeat this step for each major between the current and the target.

1. Bump `electron` to the next major with the package manager.
   Bump the `@electron/*` packages (`@electron/rebuild`, `@electron/packager`, `@electron/notarize` and similar) and the packager major when their release notes require it for this Electron major.
2. Read the breaking changes for that major in the official doc.
   List every removed, renamed or behavior-changed API.
3. Grep the codebase for each item on the list. Search main, preload and renderer code, config files and tests.
   Fix each hit.
4. Rebuild native modules.
   Run `npx @electron/rebuild` or the packager's own rebuild step (electron-builder `install-app-deps`, Forge's rebuild on package).
   Prefer a native dependency version that ships a prebuild for the new Electron or uses N-API, which keeps working across Node ABI changes.
5. Compare the bundled Node and Chromium versions from the release notes with `engines` in `package.json`, the native modules' supported Node range and any Node version pinned in CI.
   Update what no longer matches.
6. Run the build, the typecheck and the tests.
7. Launch the app.
   Open the main window and exercise IPC, a second window if the app has one, file dialogs, the menu, auto-update checks and any native module feature.
   Watch the terminal and DevTools console for deprecation warnings.
   Do not open a debugging port for this without asking the person.
8. Commit the hop:

```bash
git add package.json package-lock.json src
git commit -m "chore: upgrade Electron to vX"
```

Adjust the lockfile name to the package manager in use.

## Step 4 - Report

End with one row per hop:

| Hop | Breaking changes hit | Native modules rebuilt | Build | Typecheck | Tests | Launch | Commit |
| --- | --- | --- | --- | --- | --- | --- | --- |

Below the table list anything left open: a deprecation warning kept for later, a native module with no prebuild for the new ABI or a packaging change that needs a release test.
If the app signs or notarizes builds, say that a signed test build is still needed and point to `electron-skills-bridge` for `electron-release`.

---

_Written from the official Electron documentation (electronjs.org), checked 2026-10-30._

_Original skill for pro-dev-skillset (Jody Brewster). MIT License._
