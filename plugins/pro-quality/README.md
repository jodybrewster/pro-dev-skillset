# pro-quality

The format-on-edit hook runs the repo's own formatter on every edit, on the edited file only.
Biome, Ruff, gofmt and rustfmt run automatically, because their configs are JSON or TOML and run no code.
Prettier and ESLint load their config as code, so they are off until you opt a repo in from a shell you approve: `python3 plugins/pro-quality/scripts/format-on-edit.py --allow` (`--disallow` undoes it, `--root DIR` names another repo).
The opt-in is a line in `format-on-edit.allow` in `CLAUDE_GUARD_DIR` or `~/.claude/hooks`, outside the repo, so an edit cannot grant it.
Until then the hook adds a one-line note naming the command, at most once per repo per day.
Even when opted in, Prettier and ESLint skip a file that is a tool config or `package.json` and skip while any Prettier or ESLint config or `package.json` between the file and the repo root is untracked or differs from HEAD.
The opt-in trusts the repo's `node_modules/`: a modified module there cannot be told from an install, so opt in only repos whose dependencies you installed.
It trusts the same way the modules a committed config imports, such as local ESLint rules or a Prettier plugin path.
Configs are matched by name prefix (`.prettierrc*`, `prettier.config.*`, `eslint.config.*`, `.eslintrc*`) plus `package.json`, so a new extension such as `.mts` is covered.
`--allow` refuses unless stdin is a terminal, so a session cannot opt itself in: run it yourself, for example with the `!` prefix.
The hook uses only tools installed in the repo's untracked `node_modules/` or `.venv/` or found in an absolute `PATH` entry, refuses any tool git tracks and never downloads one.
