#!/usr/bin/env bash
# Install pro-dev-skillset's cross-marketplace companion plugins.
#
# No pro-* plugin declares these as dependencies. Plugins in
# claude-plugins-official ship no `version` field, so Claude Code falls back to
# the marketplace git commit SHA as the version string. The dependency resolver
# cannot match a SHA against any range - "*" included - so a plugin that depends
# on one fails to load with "Requires <dep> *, installed version unknown" even
# when the dependency is installed and enabled. This script installs them
# explicitly instead, which sidesteps the resolver:
#
#   - vercel    : Next.js / Vercel deployment workflows  (paired with pro-nextjs, pro-astro)
#   - figma     : Figma asset extraction + design lookup (paired with pro-design, pro-nextjs)
#   - playwright: browser E2E testing                    (paired with pro-quality, pro-testing)
#
# Usage:
#   bash <(gh api repos/jodybrewster/pro-dev-skillset/contents/templates/install-companions.sh --jq .content | base64 -d)
#
# Or copy this file into your project and run it. Pass --scope project or
# --scope user (default: user) to control where the companions get installed.

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

echo
echo "Done. Run 'claude plugin list' to verify."
