#!/usr/bin/env bash
# demo/setup.sh — reproduce the pro-dev-skillset POC from scratch.
#
# Installs THIS marketplace (the local working copy, not the GitHub one) into
# demo/app at *project scope*, then installs deps, builds, and tests the site.
# Project scope means everything lands in demo/app/.claude/settings.json — your
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
# The default stack /pro-dev-doctor expects. pro-core/pro-design carry the
# skills this landing page exercised; the rest round out the lifecycle.
STACK=(pro-core pro-execution pro-quality pro-design pro-data pro-testing)

say() { printf "\n\033[1;35m▸ %s\033[0m\n" "$1"; }

if [[ "${1:-}" == "--clean" ]]; then
  "$REPO_ROOT/demo/teardown.sh" || true
fi

cd "$APP"

say "1/5  Register the local marketplace (project scope)"
if claude plugin marketplace list 2>/dev/null | grep -q "directory.*$REPO_ROOT"; then
  echo "already registered from $REPO_ROOT"
else
  claude plugin marketplace add "$REPO_ROOT" --scope project
fi

say "2/5  Install the default stack (project scope)"
for plugin in "${STACK[@]}"; do
  if claude plugin install "$plugin@$MARKETPLACE" --scope project 2>&1 | tail -1; then :; else
    echo "  ! $plugin failed (often a cross-marketplace official dep) — continuing"
  fi
done

say "3/5  Install app dependencies"
NEXT_TELEMETRY_DISABLED=1 npm install --no-audit --no-fund

say "4/5  Build the site"
NEXT_TELEMETRY_DISABLED=1 npm run build

say "5/5  Run the site's tests"
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
