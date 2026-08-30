#!/usr/bin/env bash
# Install pro-dev-skillset's cross-marketplace companion plugins.
#
# The pro-* plugins declare the claude-plugins-official ones as dependencies.
# This script is useful as an explicit pre-install/fallback path for Claude Code
# versions that do not auto-install cross-marketplace dependencies correctly:
#
#   - vercel    : Next.js / Vercel deployment workflows  (paired with pro-nextjs)
#   - figma     : Figma asset extraction + design lookup (paired with pro-nextjs)
#   - playwright: browser E2E testing                    (paired with pro-quality/pro-testing)
#
# worktrunk is deliberately NOT declared as a dependency by any pro-* plugin.
# The worktrunk marketplace's plugin.json ships no `version` field, so Claude
# Code falls back to the marketplace git commit SHA as the version string. The
# dependency resolver cannot match a SHA against any range - "*" included - so
# a plugin that depends on it fails to load with "Requires worktrunk@worktrunk
# *, installed version unknown" even when worktrunk is installed and enabled.
# This script installs it explicitly instead, which sidesteps the resolver.
#
#   - worktrunk : parallel worktree management           (paired with pro-execution)
#
# Usage:
#   bash <(gh api repos/jodybrewster/pro-dev-skillset/contents/templates/install-companions.sh --jq .content | base64 -d)
#
# Or copy this file into your project and run it. Pass --scope project or
# --scope user (default: user) to control where the dependencies get installed.

set -euo pipefail

# Default scope is user. Override with: install-companions.sh --scope project
SCOPE="user"
if [ "${1:-}" = "--scope" ] && [ -n "${2:-}" ]; then
  SCOPE="$2"
fi

# Make sure claude-plugins-official is registered (it's bundled in recent CC
# installs; this is the one-line safety net if it ever isn't).
if ! claude plugin marketplace list 2>/dev/null | grep -q claude-plugins-official; then
  echo "Registering claude-plugins-official marketplace..."
  claude plugin marketplace add anthropics/claude-plugins-official
fi

for plugin in vercel figma playwright; do
  echo "Installing ${plugin}@claude-plugins-official at ${SCOPE} scope..."
  claude plugin install "${plugin}@claude-plugins-official" --scope "${SCOPE}"
done

# worktrunk requires the worktrunk marketplace to already be registered.
# If it is not, register it before running this script.
if claude plugin marketplace list 2>/dev/null | grep -q worktrunk; then
  echo "Installing worktrunk@worktrunk at ${SCOPE} scope..."
  claude plugin install "worktrunk@worktrunk" --scope "${SCOPE}"
else
  echo "WARNING: worktrunk marketplace not registered — skipping worktrunk install."
  echo "  Register it first, then re-run this script to pick it up."
fi

echo
echo "Done. Run 'claude plugin list' to verify."
