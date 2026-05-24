#!/usr/bin/env bash
# One-line bootstrap for a fresh project that wants Jody's pro-dev stack.
#
# Usage (from inside a project dir):
#   bash <(curl -fsSL https://raw.githubusercontent.com/jodybrewster/pro-dev-skillset/main/templates/bootstrap.sh)
#
# What it does:
#   1. Writes .claude/settings.json from this repo's templates/project-settings.json
#      (registers the pro-dev-skillset marketplace + enables pro-starter)
#   2. Installs pro-starter@pro-dev-skillset at project scope (cascades to
#      pro-core + pro-quality + pro-nextjs + pro-design)
#   3. Optionally runs install-companions.sh if --with-companions is passed
#      (installs vercel + figma + playwright from claude-plugins-official)
#
# Flags:
#   --with-companions   Also install the cross-marketplace companion plugins
#   --scope <s>         Install scope: user | project (default: project)

set -euo pipefail

SCOPE="project"
WITH_COMPANIONS=0
while [ $# -gt 0 ]; do
  case "$1" in
    --with-companions) WITH_COMPANIONS=1; shift ;;
    --scope) SCOPE="$2"; shift 2 ;;
    *) echo "unknown arg: $1" >&2; exit 2 ;;
  esac
done

if ! command -v claude >/dev/null 2>&1; then
  echo "error: claude CLI not found on PATH. Install Claude Code first: https://claude.com/claude-code" >&2
  exit 127
fi

# 1. Drop the project-settings template
mkdir -p .claude
if [ -f .claude/settings.json ]; then
  echo "warning: .claude/settings.json already exists — leaving it alone."
  echo "         If you want the pro-dev-skillset settings, merge from:"
  echo "         https://raw.githubusercontent.com/jodybrewster/pro-dev-skillset/main/templates/project-settings.json"
else
  curl -fsSL https://raw.githubusercontent.com/jodybrewster/pro-dev-skillset/main/templates/project-settings.json \
    -o .claude/settings.json
  echo "wrote .claude/settings.json"
fi

# 2. Install pro-starter (cascades to all stack plugins)
echo "Installing pro-starter@pro-dev-skillset --scope ${SCOPE}..."
claude plugin install pro-starter@pro-dev-skillset --scope "${SCOPE}"

# 3. Optional companions
if [ $WITH_COMPANIONS -eq 1 ]; then
  echo "Installing recommended companion plugins..."
  bash <(curl -fsSL https://raw.githubusercontent.com/jodybrewster/pro-dev-skillset/main/templates/install-companions.sh) \
    --scope "${SCOPE}"
fi

echo
echo "Done. Verify with: claude plugin list"
