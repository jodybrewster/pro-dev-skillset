#!/usr/bin/env bash
# One-line bootstrap for a project that wants Jody's pro-dev stack in Codex.
#
# Usage from a target project:
#   bash <(gh api repos/jodybrewster/pro-dev-skillset/contents/templates/codex-bootstrap.sh --jq .content | base64 -d)
#
# Flags:
#   --source <s>       Marketplace source. Defaults to a gh-authenticated local clone at
#                      ~/.codex/marketplaces/pro-dev-skillset.
#                      Use an explicit local checkout path for local development, e.g.
#                      --source /Users/jodybrewster/Projects/pro-dev-skillset
#   --default-only     Install only the default stack.
#   --with-opt-in      Also install pro-spdd and pro-gstack.
#   --no-lavish        Skip project-local lavish skill install.

set -euo pipefail

SOURCE=""
WITH_OPT_IN=0
WITH_LAVISH=1
MARKETPLACE_NAME="pro-dev-skillset"

while [ $# -gt 0 ]; do
  case "$1" in
    --source) SOURCE="$2"; shift 2 ;;
    --default-only) WITH_OPT_IN=0; shift ;;
    --with-opt-in) WITH_OPT_IN=1; shift ;;
    --no-lavish) WITH_LAVISH=0; shift ;;
    *) echo "unknown arg: $1" >&2; exit 2 ;;
  esac
done

if ! command -v codex >/dev/null 2>&1; then
  echo "error: codex CLI not found on PATH. Install and authenticate Codex first." >&2
  exit 127
fi

if [ -z "${SOURCE}" ]; then
  if ! command -v gh >/dev/null 2>&1; then
    echo "error: gh CLI not found on PATH. Install with: brew install gh" >&2
    echo "       (Needed because pro-dev-skillset is a private repo.)" >&2
    exit 127
  fi

  SOURCE="${HOME}/.codex/marketplaces/pro-dev-skillset"
  if [ -d "${SOURCE}/.git" ]; then
    echo "Updating local marketplace checkout: ${SOURCE}"
    git -C "${SOURCE}" pull --ff-only
  else
    echo "Cloning private marketplace with gh: ${SOURCE}"
    mkdir -p "$(dirname "${SOURCE}")"
    gh repo clone jodybrewster/pro-dev-skillset "${SOURCE}"
  fi
fi

echo "Adding Codex marketplace source: ${SOURCE}"
if ! add_output="$(codex plugin marketplace add "${SOURCE}" 2>&1)"; then
  if printf '%s\n' "${add_output}" | grep -q "marketplace '${MARKETPLACE_NAME}' is already added from a different source"; then
    echo "Replacing existing ${MARKETPLACE_NAME} marketplace registration with: ${SOURCE}"
    codex plugin marketplace remove "${MARKETPLACE_NAME}"
    codex plugin marketplace add "${SOURCE}"
  else
    printf '%s\n' "${add_output}" >&2
    exit 1
  fi
else
  printf '%s\n' "${add_output}"
fi

DEFAULT_PLUGINS=(
  pro-core
  pro-pdd
  pro-execution
  pro-quality
  pro-nextjs
  pro-design
  pro-testing
  pro-data
  pro-research
)

OPT_IN_PLUGINS=(
  pro-spdd
  pro-gstack
)

install_plugin() {
  local plugin="$1"
  echo "Installing ${plugin}@${MARKETPLACE_NAME}"
  codex plugin add "${plugin}@${MARKETPLACE_NAME}"
}

install_lavish_project_command() {
  mkdir -p .claude/commands
  cat > .claude/commands/lavish.md <<'LAVISH_COMMAND'
---
description: "Render a plan, comparison, diagram, table, code diff, report, or other complex response as a Lavish review artifact. Usage: /lavish <what to render>"
argument-hint: "<what the artifact should show>"
allowed-tools:
  - "Bash(test -f .claude/skills/lavish/SKILL.md*)"
  - "Bash(mkdir -p .lavish*)"
  - "Bash(npx -y lavish-axi*)"
  - "Bash(npx skills add kunchenguid/lavish-axi*)"
---

Use Lavish as the review surface for `$ARGUMENTS`.

First verify the project-local upstream skill exists at `.claude/skills/lavish/SKILL.md`. If it is missing, install it from the project root with:

```bash
npx skills add kunchenguid/lavish-axi --agent claude-code --skill lavish
```

Then follow `.claude/skills/lavish/SKILL.md` exactly:

1. Read every relevant Lavish playbook before writing HTML, starting with `npx -y lavish-axi playbook plan` for plans.
2. Create the artifact under `.lavish/` unless the user specified another location.
3. Open or resume the review session with `npx -y lavish-axi <html-file>`.
4. Poll for feedback with `npx -y lavish-axi poll <html-file>` and fix any reported layout warnings before asking the user to review.
5. End the session with `npx -y lavish-axi end <html-file>` when review is finished.

Lavish is the default review surface for substantive implementation plans, milestone plans, client-facing plans, decision matrices, diagrams, dense tables, code diffs, and reports. Keep short answers in plain text.
LAVISH_COMMAND
  echo "Project /lavish command installed at .claude/commands/lavish.md"
}

for plugin in "${DEFAULT_PLUGINS[@]}"; do
  install_plugin "${plugin}"
done

if [ "${WITH_OPT_IN}" -eq 1 ]; then
  for plugin in "${OPT_IN_PLUGINS[@]}"; do
    install_plugin "${plugin}"
  done
fi

if [ "${WITH_LAVISH}" -eq 1 ]; then
  if command -v npx >/dev/null 2>&1; then
    echo "Installing project-local lavish skill at .claude/skills/lavish"
    npx --yes skills add kunchenguid/lavish-axi --skill lavish \
      || echo "warning: lavish install failed — run: npx skills add kunchenguid/lavish-axi --skill lavish"
    npx --yes skills add kunchenguid/lavish-axi --agent claude-code --skill lavish \
      || echo "warning: lavish Claude Code skill install failed — run: npx skills add kunchenguid/lavish-axi --agent claude-code --skill lavish"
    install_lavish_project_command
  else
    echo "warning: npx not found — run later: npx skills add kunchenguid/lavish-axi --skill lavish"
    install_lavish_project_command
  fi
fi

cat <<'EOF'

Codex setup complete.

Verify from the target repo with:
  codex "/skills"
  test -f .claude/skills/lavish/SKILL.md && echo "lavish project skill installed"
  test -f .claude/commands/lavish.md && echo "/lavish project command installed"
  codex "Summarize active project instructions."

If you want project-local instructions, add an AGENTS.md at the target repo root.
EOF
