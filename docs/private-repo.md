# Private repo gotchas

Moved from `CLAUDE.md`.

- Bootstrap uses `gh api` (not `curl`) because the repo is private - `raw.githubusercontent.com` 404s without auth.
- `claude -p` (headless) does NOT trigger the folder-trust prompt; CI must either drop `templates/project-settings.json` and run an explicit `claude plugin install` or pre-trust the directory.
  See README "Headless / CI gotcha."
