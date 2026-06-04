#!/usr/bin/env bash
# demo/teardown.sh — undo what setup.sh installed, leaving your global config clean.
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP="$REPO_ROOT/demo/app"
MARKETPLACE="pro-dev-skillset"
STACK=(pro-testing pro-data pro-design pro-quality pro-execution pro-core)

cd "$APP"
echo "▸ Uninstalling project-scope plugins…"
for plugin in "${STACK[@]}"; do
  claude plugin uninstall "$plugin@$MARKETPLACE" --scope project 2>/dev/null || true
done

echo "▸ Removing the local marketplace registration…"
# Only removes the project-scope declaration in demo/app/.claude/settings.json;
# your user-scope GitHub marketplace of the same name is untouched.
claude plugin marketplace remove "$MARKETPLACE" --scope project 2>/dev/null || true

echo "▸ Removing build/install artifacts…"
rm -rf "$APP/.next" "$APP/node_modules"

echo "Done. demo/app source and demo/app/.claude (if it remains) are left in place."
