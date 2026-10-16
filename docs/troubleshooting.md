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
