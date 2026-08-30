#!/usr/bin/env bash
# demo/setup.sh - reproduce the pro-dev-skillset POC from scratch.
#
# Installs THIS marketplace (the local working copy, not the GitHub one) into
# demo/app at *project scope*, then installs deps, builds, and tests the site.
# Project scope means everything lands in demo/app/.claude/settings.json - your
# global Claude Code config is never touched.
#
#   ./demo/setup.sh            # full setup
#   ./demo/setup.sh --clean    # tear down first, then set up
#
# After it finishes: open Claude Code inside demo/app and run /pro-dev-doctor.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP="$REPO_ROOT/demo/app"
MARKETPLACE="pro-dev-skillset"

say() { printf "\n\033[1;35m▸ %s\033[0m\n" "$1"; }

if [[ "${1:-}" == "--clean" ]]; then
  "$REPO_ROOT/demo/teardown.sh" || true
fi

cd "$APP"

say "1/6  Register the local marketplace (project scope)"
if claude plugin marketplace list 2>/dev/null | grep -q "directory.*$REPO_ROOT"; then
  echo "already registered from $REPO_ROOT"
else
  claude plugin marketplace add "$REPO_ROOT" --scope project
fi

say "2/6  Install the default stack via pro-starter (project scope)"
if ! claude plugin install "pro-starter@$MARKETPLACE" --scope project 2>&1; then
  echo "  ! pro-starter install failed - check marketplace registration and version-bump law"
  exit 1
fi

# The source-tree run (node tests/check.mjs memory-hooks) already proves the
# memory hook scripts are logically correct. This step proves something
# different: that the hooks actually reached a real plugin install intact,
# unmodified, at the version the marketplace claims to be serving. The
# plugin cache is keyed by (marketplace, plugin, version), so this is also
# where a version-bump-law violation would surface - a stale cache silently
# serving old content instead of the version just installed.
say "3/6  Run memory-hook tests against the installed pro-core copy"
PRO_CORE_VERSION=$(node -p "require('$REPO_ROOT/plugins/pro-core/.claude-plugin/plugin.json').version")
INSTALLED="$HOME/.claude/plugins/cache/pro-dev-skillset/pro-core/$PRO_CORE_VERSION"
# `plugin install` is a no-op for an already-installed plugin, and pro-starter
# depends on pro-core with a `*` constraint, so any cached version satisfies it.
# On a re-run that leaves the previous version installed and this step would
# test yesterday's scripts. `plugin update` is what actually re-resolves against
# the marketplace. It exits non-zero when there is nothing to do, which is fine:
# the directory assertion below is the real gate.
claude plugin update "pro-core@$MARKETPLACE" --scope project --yes 2>&1 | tail -1 || true
if [[ ! -d "$INSTALLED" ]]; then
  echo "  ! plugin cache did not serve pro-core $PRO_CORE_VERSION"
  echo "    expected: $INSTALLED"
  echo "    The plugin cache is keyed by (marketplace, plugin, version). A"
  echo "    missing directory here means the cache is stale and did not pick"
  echo "    up the version bump from plugins/pro-core/.claude-plugin/plugin.json -"
  echo "    this is exactly what a version-bump-law violation looks like."
  exit 1
fi
node "$REPO_ROOT/tests/memory-hooks.mjs" --plugin-root="$INSTALLED"

say "4/6  Install app dependencies"
NEXT_TELEMETRY_DISABLED=1 npm install --no-audit --no-fund

say "5/6  Build the site"
NEXT_TELEMETRY_DISABLED=1 npm run build

say "6/6  Run the site's tests"
npx vitest run

say "Done."
cat <<EOF

  The site is built and tested. To see the install verified *through the skills*:

    cd "$APP"
    claude            # open Claude Code here
    > /pro-dev-doctor # verifies the installed stack + routing

  To preview the site:        npm run dev   (then open http://localhost:3000)
  To tear the demo back down:  ./demo/teardown.sh
EOF
