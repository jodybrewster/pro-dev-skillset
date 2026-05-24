#!/usr/bin/env bash
# Install pro-dev-skillset's recommended cross-marketplace companion plugins.
#
# The pro-* plugins are self-contained and load fine on their own. These
# companions add useful tooling for the stack patterns they're paired with:
#
#   - vercel    : Next.js / Vercel deployment workflows  (paired with pro-nextjs)
#   - figma     : Figma asset extraction + design lookup (paired with pro-nextjs)
#   - playwright: browser E2E testing                    (paired with pro-quality)
#
# Why this is a separate script: Claude Code 2.1.150 declares dependencies
# across marketplaces but does NOT auto-install them — and a depending plugin
# is silently disabled when its cross-marketplace dep is missing. So pro-* keeps
# its cross-marketplace deps OUT of plugin.json, and you opt in via this script.
#
# Usage:
#   bash <(curl -fsSL https://raw.githubusercontent.com/jodybrewster/pro-dev-skillset/main/templates/install-companions.sh)
#
# Or copy this file into your project and run it. Pass --scope project or
# --scope user (default: user) to control where the companions get installed.

set -euo pipefail

SCOPE="${1:---scope user}"

# Make sure claude-plugins-official is registered (it's bundled in recent CC
# installs; this is the one-line safety net if it ever isn't).
if ! claude plugin marketplace list 2>/dev/null | grep -q claude-plugins-official; then
  echo "Registering claude-plugins-official marketplace..."
  claude plugin marketplace add anthropics/claude-plugins-official
fi

for plugin in vercel figma playwright; do
  echo "Installing ${plugin}@claude-plugins-official ${SCOPE}..."
  claude plugin install "${plugin}@claude-plugins-official" ${SCOPE}
done

echo
echo "Done. Run 'claude plugin list' to verify."
