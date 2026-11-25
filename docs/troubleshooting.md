# When you're stuck

Moved from `CLAUDE.md`, whose "Things Claude gets wrong" list keeps the short form.

- Skill not loading after edit? You forgot the version bump.
- Hook not firing, no error anywhere? It is not in `hooks/hooks.json`.
  See the [hook-loading law](./hook-loading.md).
  Run `node tests/check.mjs hooks`.
- Cross-marketplace dependency problems? No `pro-*` plugin declares a `claude-plugins-official` dependency any more: those plugins report version `unknown`, which fails every range, so vercel, figma and playwright are optional companions installed by `templates/install-companions.sh`.
  The marketplace still allowlists `claude-plugins-official` in case a future official plugin ships a real semver.
- `failed to load ... Requires <dep> *, installed version unknown`, but the dependency is installed and enabled?
  The upstream `plugin.json` has no `version` field, so Claude Code uses the marketplace git commit SHA as the version string, and the resolver cannot match a SHA against any range - `*` included.
  Drop the hard dependency and install that plugin explicitly from `templates/install-companions.sh`.
  `node tests/check.mjs versions` now fails on any `*` cross-marketplace dependency, which is how `worktrunk@worktrunk` silently broke `pro-execution` and `pro-starter`.
- `claude plugin validate --strict` failing on a freshly-forked skill? Likely an unrecognized frontmatter key or a missing sidecar `@reference`.
- A bridge says its engine is missing?
  Run `/pro-core:pro-dev install` to install it, or `/pro-core:pro-dev check` to see what is missing.
- A new plugin version does not seem to run?
  A project-scope install in a subfolder such as `demo/app` shadows the user-scope one.
  `/pro-core:pro-dev update` updates those installs too; then restart Claude Code.
- `/pro-core:pro-dev` refuses `.claude/pro-dev.json`?
  It must be a regular file inside the repo's `.claude` folder, not a symlink.
  Fix it or delete it and run `/pro-core:pro-dev install` again.
- A slash command does nothing, as if you never typed it?
  Plugin commands are namespaced: the plugin name, a colon, then the command.
  `/pro-core:pro-dev install` resolves.
  The same command typed without the `pro-core:` part does not resolve, with nothing printed to say why.
  `claude plugin list` or the `/help` listing shows the real name of every installed command.
- A site still enables `pro-starter`?
  The shim keeps it loading for one release because it depends on `pro-dev-starter`.
  `/pro-core:pro-dev update` offers to swap it; a disabled `pro-starter` or a disabled plugin it bundles is skipped, so the swap never turns them back on.

## pro-ai-sdlc is still installed after the starter update

Version 3.0.0 of `pro-dev-starter` dropped `pro-ai-sdlc` from its dependencies.
Removing a dependency does not uninstall the plugin, so a site that already has it keeps it.
Run `claude plugin uninstall pro-ai-sdlc@pro-dev-skillset` to drop it or leave it in place to keep the intent, spec and plan loop.

## python3 is not found on Windows, or `python3 --version` opens the Microsoft Store

Windows installs `python.exe` and never `python3.exe`, while every command in this marketplace calls `python3`.
Windows also keeps a `python3` alias on PATH that only opens the Microsoft Store, so the command appears to exist and then does nothing useful.
`/pro-core:pro-dev check` reports the row as missing even when `python` works.
`/pro-core:pro-dev install` prints the repair lines from the `python3` prerequisite row in `plugins/pro-core/registry/engines.json`.

Two steps fix it:

1. Turn the aliases off: Settings > Apps > Advanced app settings > App execution aliases, switch off `python.exe` and `python3.exe`.
2. Copy the real binary next to itself under the name `python3.exe`:

```
copy "%LOCALAPPDATA%\Programs\Python\Python313\python.exe" "%LOCALAPPDATA%\Programs\Python\Python313\python3.exe"
```

Open a new terminal and check `python3 --version`.
A Python installed in this session is not on the session's PATH yet, so Claude Code needs a restart before it sees it.
