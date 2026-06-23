#!/usr/bin/env bash
# One-line bootstrap for a fresh project that wants Jody's pro-dev stack.
#
# Usage (from inside a project dir):
#   bash <(gh api repos/jodybrewster/pro-dev-skillset/contents/templates/bootstrap.sh --jq .content | base64 -d)
#
# (gh is required because pro-dev-skillset is a private repo — raw.github
# URLs 404 without auth. gh uses your existing GitHub auth.)
#
# What it does:
#   1. Writes .claude/settings.json from this repo's templates/project-settings.json
#      (registers the pro-dev-skillset marketplace + enables pro-starter)
#   2. Optionally runs install-companions.sh before dependency resolution if
#      --with-companions is passed (installs vercel + figma + playwright from
#      claude-plugins-official explicitly)
#   3. Installs pro-starter@pro-dev-skillset at project scope (cascades to the
#      default stack: pro-core, pro-execution, pro-quality, pro-nextjs,
#      pro-design, pro-testing, pro-data, and pro-mieruka)
#   4. Installs the bridge engines by default — impeccable (behind ui-ux-pro-max)
#      and qa-skills (behind qa-suite). These are external npx packages, not
#      marketplace plugins, so they install here. (Mieruka is project-specific;
#      run /init-mieruka in the project that needs it.)
#
# Flags:
#   --with-companions   Pre-install the cross-marketplace dependencies explicitly
#   --no-engines        Skip step 4 (e.g. offline / CI with no network)
#   --scope <s>         Install scope: user | project (default: project)

set -euo pipefail

SCOPE="project"
WITH_COMPANIONS=0
WITH_ENGINES=1
while [ $# -gt 0 ]; do
  case "$1" in
    --with-companions) WITH_COMPANIONS=1; shift ;;
    --no-engines) WITH_ENGINES=0; shift ;;
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
  echo "warning: .claude/settings.json already exists — leaving it alone."
  echo "         If you want the pro-dev-skillset settings, fetch with:"
  echo "         gh api repos/jodybrewster/pro-dev-skillset/contents/templates/project-settings.json --jq .content | base64 -d"
else
  fetch templates/project-settings.json > .claude/settings.json
  echo "wrote .claude/settings.json"
fi

# 2. Optional explicit cross-marketplace dependency install
if [ $WITH_COMPANIONS -eq 1 ]; then
  echo "Pre-installing official cross-marketplace dependencies..."
  bash <(fetch templates/install-companions.sh) --scope "${SCOPE}"
fi

# 3. Install pro-starter (cascades to all stack plugins)
echo "Installing pro-starter@pro-dev-skillset --scope ${SCOPE}..."
claude plugin install pro-starter@pro-dev-skillset --scope "${SCOPE}"

# 4. Install the bridge engines (default ON; --no-engines to skip). These are
#    external npx packages the bridge skills route to, not marketplace plugins.
#    Failures here are non-fatal — the stack is already installed, and the
#    per-engine commands (/design-engine, /qa-engine) can finish the job later.
if [ "$WITH_ENGINES" -eq 1 ]; then
  echo
  echo "Installing bridge engines (impeccable, qa-skills)..."
  if command -v npx >/dev/null 2>&1; then
    echo "  • impeccable  (ui-ux-pro-max engine)"
    npx --yes impeccable skills install \
      || echo "    ! impeccable install failed — run /design-engine install later"

    echo "  • qa-skills   (qa-suite engine)"
    QA_SUBSET="qa-do qa-start playwright-automation visual-testing api-testing contract-testing test-reliability test-strategy risk-based-testing test-planning qa-project-context"
    QA_SCOPE_FLAG=""
    [ "$SCOPE" = "user" ] && QA_SCOPE_FLAG="-g"
    # -y skips the scope/confirm prompt; --agent claude-code copies into
    # .claude/skills (where Claude Code and /qa-engine check both look);
    # --skill must come LAST since it greedily consumes the names that follow.
    # shellcheck disable=SC2086
    npx --yes skills add petrkindlmann/qa-skills -y $QA_SCOPE_FLAG --agent claude-code --skill $QA_SUBSET \
      || echo "    ! qa-skills install failed — run /qa-engine install later"
  else
    echo "  ! npx not found — skipping engines. Install Node, then run /pro-starter engines."
  fi
fi

echo
echo "Done. Verify with: claude plugin list   (and /pro-dev-doctor in a session)"
