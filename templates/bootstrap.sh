#!/usr/bin/env bash
# One-line bootstrap for a fresh project that wants Jody's pro-dev stack.
#
# Usage (from inside a project dir):
#   bash <(gh api repos/jodybrewster/pro-dev-skillset/contents/templates/bootstrap.sh --jq .content | base64 -d)
#
# (gh is required because pro-dev-skillset is a private repo - raw.github
# URLs 404 without auth. gh uses your existing GitHub auth.)
#
# What it does, in three steps:
#   1. Writes .claude/settings.json from this repo's templates/project-settings.json
#      if it is absent (registers the pro-dev-skillset marketplace and enables
#      pro-dev-starter)
#   2. Installs pro-dev-starter@pro-dev-skillset at the chosen scope (cascades
#      to the default stack: pro-core, pro-pdd, pro-execution,
#      pro-quality, pro-design, pro-motion, pro-testing, pro-data, pro-research
#      and pro-security)
#   3. Prints the next step: run /pro-dev install in a Claude Code session,
#      which installs the engines and project-local skills
#
# pro-ai-sdlc, pro-nextjs and pro-astro are opt-in: install them by hand.
#
# Flags:
#   --scope <s>   Install scope: user | project (default: project)

set -euo pipefail

SCOPE="project"
while [ $# -gt 0 ]; do
  case "$1" in
    --scope) SCOPE="$2"; shift 2 ;;
    *) echo "unknown arg: $1" >&2; exit 2 ;;
  esac
done

if ! command -v claude >/dev/null 2>&1; then
  echo "error: claude CLI not found on PATH. Install Claude Code first: https://claude.com/claude-code" >&2
  exit 127
fi

# pro-dev-skillset is a private repo, so we fetch via gh api (which uses
# GitHub auth) rather than raw.githubusercontent.com (which 404s on private).
if ! command -v gh >/dev/null 2>&1; then
  echo "error: gh CLI not found on PATH. Install with: brew install gh" >&2
  echo "       (Needed because pro-dev-skillset is a private repo.)" >&2
  exit 127
fi

fetch() {
  # $1 = path within repo; writes content to stdout
  gh api "repos/jodybrewster/pro-dev-skillset/contents/$1" --jq '.content' | base64 -d
}

# 1. Drop the project-settings template
mkdir -p .claude
if [ -f .claude/settings.json ]; then
  echo "warning: .claude/settings.json already exists - leaving it alone."
  echo "         If you want the pro-dev-skillset settings, fetch with:"
  echo "         gh api repos/jodybrewster/pro-dev-skillset/contents/templates/project-settings.json --jq .content | base64 -d"
else
  fetch templates/project-settings.json > .claude/settings.json
  echo "wrote .claude/settings.json"
fi

# 2. Install pro-dev-starter (cascades to all stack plugins)
echo "Installing pro-dev-starter@pro-dev-skillset --scope ${SCOPE}..."
claude plugin install pro-dev-starter@pro-dev-skillset --scope "${SCOPE}"

# 3. Hand over to /pro-dev
echo
echo "Done. Open Claude Code in this project and run /pro-dev install"
