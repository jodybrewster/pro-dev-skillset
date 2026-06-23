#!/usr/bin/env bash
# Install Jody's Claude Code and Codex CLI status lines.
#
# Usage:
#   bash <(gh api repos/jodybrewster/pro-dev-skillset/contents/templates/install-statuslines.sh --jq .content | base64 -d)
#
# Flags:
#   --claude-only   Only install the Claude Code command-backed status line
#   --codex-only    Only configure the Codex native TUI status line
#   --no-backup     Do not create .bak.<timestamp> backups before replacing files
#
# Notes:
# - Claude Code supports a command-backed statusLine hook, so this installs the
#   richer shell renderer at ~/.claude/statusline-command.sh.
# - Codex CLI currently supports native status-line items, not an arbitrary
#   shell-backed renderer. This script configures the closest native equivalent.

set -euo pipefail

INSTALL_CLAUDE=1
INSTALL_CODEX=1
BACKUP=1

while [ $# -gt 0 ]; do
  case "$1" in
    --claude-only) INSTALL_CODEX=0; shift ;;
    --codex-only) INSTALL_CLAUDE=0; shift ;;
    --no-backup) BACKUP=0; shift ;;
    *) echo "unknown arg: $1" >&2; exit 2 ;;
  esac
done

timestamp() {
  date +"%Y%m%d%H%M%S"
}

backup_file() {
  local path="$1"
  if [ "$BACKUP" -eq 1 ] && [ -e "$path" ]; then
    cp "$path" "${path}.bak.$(timestamp)"
  fi
}

require_cmd() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "error: required command not found: $cmd" >&2
    exit 127
  fi
}

install_claude_statusline() {
  require_cmd jq

  mkdir -p "$HOME/.claude"

  local script_path="$HOME/.claude/statusline-command.sh"
  local settings_path="$HOME/.claude/settings.json"

  backup_file "$script_path"
  cat > "$script_path" <<'STATUSLINE_SCRIPT'
#!/usr/bin/env bash

# Claude Code statusline script.
# Reads Claude's statusLine JSON from stdin and writes a compact, colored line:
#   [*branch] model effort ctx:123k (45%) $0.12 +10/-2
# plus optional monthly/daily usage bars when ~/.claude/monthly-cost-cache.json exists.

set -u

input=$(cat)
[ -n "$input" ] || input="{}"

jq_input() {
  printf '%s' "$input" | jq -r "$1" 2>/dev/null
}

settings="$HOME/.claude/settings.json"

model=$(jq_input '.model.display_name // .model.name // .model // "?"')
[ -n "$model" ] && [ "$model" != "null" ] || model="?"

cost=$(jq_input '.cost.total_cost_usd // 0')
[ -n "$cost" ] && [ "$cost" != "null" ] || cost=0

ctx_tokens=$(jq_input '.context_window.total_input_tokens // .context_window.used_tokens // .context_window.input_tokens // 0')
[ -n "$ctx_tokens" ] && [ "$ctx_tokens" != "null" ] || ctx_tokens=0

ctx_pct=$(jq_input '.context_window.used_percentage // 0')
[ -n "$ctx_pct" ] && [ "$ctx_pct" != "null" ] || ctx_pct=0

added=$(jq_input '.cost.total_lines_added // 0')
[ -n "$added" ] && [ "$added" != "null" ] || added=0

removed=$(jq_input '.cost.total_lines_removed // 0')
[ -n "$removed" ] && [ "$removed" != "null" ] || removed=0

cwd=$(jq_input '.workspace.current_dir // ""')
[ -n "$cwd" ] && [ "$cwd" != "null" ] || cwd="$PWD"

effort=$(jq_input '
  (.effort // .model.effort // .effortLevel // null) |
  if type == "array" then .[0].level elif type == "string" then . else empty end
')
if [ -z "$effort" ] && [ -f "$settings" ]; then
  effort=$(jq -r '.effortLevel // empty' "$settings" 2>/dev/null)
fi
[ -n "$effort" ] && [ "$effort" != "null" ] || effort="?"

cost_fmt=$(awk -v c="$cost" 'BEGIN { printf "%.2f", c + 0 }')

make_bar() {
  local pct="$1" width="${2:-8}"
  local filled
  filled=$(awk -v p="$pct" -v w="$width" 'BEGIN {
    n = int((p + 0) / 100 * w + 0.5)
    if (n < 0) n = 0
    if (n > w) n = w
    print n
  }')
  local empty=$((width - filled))
  printf "%${filled}s" "" | tr ' ' '█'
  printf "%${empty}s" "" | tr ' ' '░'
}

pct_color() {
  local pct="$1"
  if awk -v p="$pct" 'BEGIN { exit !(p >= 80) }'; then
    printf "\033[1;31m"
  elif awk -v p="$pct" 'BEGIN { exit !(p >= 60) }'; then
    printf "\033[33m"
  else
    printf "\033[32m"
  fi
}

warn_pct=40
alert_pct=60
if [ -f "$settings" ]; then
  warn_pct=$(jq -r '.statusLine.contextWarnPct // 40' "$settings" 2>/dev/null)
  alert_pct=$(jq -r '.statusLine.contextAlertPct // 60' "$settings" 2>/dev/null)
fi

ctx_int=$(awk -v p="$ctx_pct" 'BEGIN { printf "%.0f", p + 0 }')
ctx_alert=""
if awk -v p="$ctx_pct" -v a="$alert_pct" 'BEGIN { exit !(p >= a) }'; then
  ctx_color="\033[1;31m"
  ctx_alert=" \033[1;31m⚠ compact/clear\033[0m"
elif awk -v p="$ctx_pct" -v w="$warn_pct" 'BEGIN { exit !(p >= w) }'; then
  ctx_color="\033[33m"
  ctx_alert=" \033[33m⚠\033[0m"
else
  ctx_color="\033[32m"
fi

if [ "${ctx_tokens:-0}" -ge 1000 ] 2>/dev/null; then
  ctx_tok_fmt=$(awk -v t="$ctx_tokens" 'BEGIN { printf "%.0fk", t / 1000 }')
else
  ctx_tok_fmt="$ctx_tokens"
fi

usage_stats=""
cost_cache="$HOME/.claude/monthly-cost-cache.json"
if [ -f "$cost_cache" ]; then
  current_month=$(date +"%Y-%m")
  today=$(date +"%Y-%m-%d")
  divisor=40
  monthly_budget_api=3000
  if [ -f "$settings" ]; then
    divisor=$(jq -r '.statusLine.maxCostDivisor // 40' "$settings" 2>/dev/null)
    monthly_budget_api=$(jq -r '.statusLine.monthlyBudgetApi // 3000' "$settings" 2>/dev/null)
  fi

  month_cost=$(jq -r --arg m "$current_month" '.[$m] // 0' "$cost_cache" 2>/dev/null)
  day_cost=$(jq -r --arg d "$today" '._daily[$d] // 0' "$cost_cache" 2>/dev/null)
  [ -n "$month_cost" ] && [ "$month_cost" != "null" ] || month_cost=0
  [ -n "$day_cost" ] && [ "$day_cost" != "null" ] || day_cost=0

  month_cost_fmt=$(awk -v c="$month_cost" -v d="$divisor" 'BEGIN { printf "%.1f", (d > 0 ? c / d : 0) }')
  day_cost_fmt=$(awk -v c="$day_cost" -v d="$divisor" 'BEGIN { printf "%.1f", (d > 0 ? c / d : 0) }')

  days_in_month=$(cal "$(date +%m)" "$(date +%Y)" | awk 'NF{f=$NF}END{print f}')
  daily_budget_api=$(awk -v b="$monthly_budget_api" -v d="$days_in_month" 'BEGIN { printf "%.2f", (d > 0 ? b / d : 0) }')

  mo_pct=$(awk -v c="$month_cost" -v b="$monthly_budget_api" 'BEGIN { if (b > 0) printf "%.1f", c / b * 100; else print "0" }')
  dy_pct=$(awk -v c="$day_cost" -v b="$daily_budget_api" 'BEGIN { if (b > 0) printf "%.1f", c / b * 100; else print "0" }')

  mo_color=$(pct_color "$mo_pct")
  dy_color=$(pct_color "$dy_pct")
  mo_bar=$(make_bar "$mo_pct" 8)
  dy_bar=$(make_bar "$dy_pct" 8)

  usage_stats=$(printf " ${mo_color}mo:%s\033[0m \$%s ${dy_color}dy:%s\033[0m \$%s" \
    "$mo_bar" "$month_cost_fmt" "$dy_bar" "$day_cost_fmt")
fi

git_status=""
if cd "$cwd" 2>/dev/null && git rev-parse --git-dir >/dev/null 2>&1; then
  branch=$(git symbolic-ref --short HEAD 2>/dev/null || git rev-parse --short HEAD 2>/dev/null)
  if ! git diff --quiet 2>/dev/null || ! git diff --cached --quiet 2>/dev/null || [ -n "$(git ls-files --others --exclude-standard 2>/dev/null)" ]; then
    git_status=$(printf "\033[32m[\033[31m*\033[32m%s]\033[0m " "$branch")
  else
    git_status=$(printf "\033[32m[%s]\033[0m " "$branch")
  fi
fi

printf "%s\033[36m%s\033[0m \033[35m%s\033[0m ${ctx_color}ctx:%s (%s%%)\033[0m%s \$%s +%s/-%s" \
  "$git_status" "$model" "$effort" "$ctx_tok_fmt" "$ctx_int" "$ctx_alert" "$cost_fmt" "$added" "$removed"
[ -n "$usage_stats" ] && printf "\n%s" "$usage_stats"
STATUSLINE_SCRIPT
  chmod +x "$script_path"

  if [ -f "$settings_path" ]; then
    backup_file "$settings_path"
  else
    printf '{}\n' > "$settings_path"
  fi

  local tmp
  tmp=$(mktemp)
  jq --arg command 'bash $HOME/.claude/statusline-command.sh' '
    .statusLine = (.statusLine // {}) |
    .statusLine.type = "command" |
    .statusLine.command = $command |
    .statusLine.contextWarnPct = (.statusLine.contextWarnPct // 40) |
    .statusLine.contextAlertPct = (.statusLine.contextAlertPct // 60) |
    .statusLine.maxCostDivisor = (.statusLine.maxCostDivisor // 40) |
    .statusLine.monthlyBudgetApi = (.statusLine.monthlyBudgetApi // 3000)
  ' "$settings_path" > "$tmp"
  mv "$tmp" "$settings_path"

  echo "Claude status line installed:"
  echo "  $script_path"
  echo "  $settings_path -> statusLine.command"
}

install_codex_statusline() {
  mkdir -p "$HOME/.codex"

  local config_path="$HOME/.codex/config.toml"
  local tmp
  local status_line
  local colors_line

  status_line='status_line = ["model-with-reasoning", "git-branch", "branch-changes", "context-used", "five-hour-limit", "weekly-limit", "current-dir"]'
  colors_line='status_line_use_colors = true'

  [ -f "$config_path" ] || : > "$config_path"
  backup_file "$config_path"

  tmp=$(mktemp)
  awk -v status_line="$status_line" -v colors_line="$colors_line" '
    BEGIN {
      in_tui = 0
      seen_tui = 0
      saw_status = 0
      saw_colors = 0
    }
    function emit_missing() {
      if (in_tui) {
        if (!saw_status) print status_line
        if (!saw_colors) print colors_line
      }
    }
    /^\[/ {
      if (in_tui) emit_missing()
      in_tui = ($0 == "[tui]")
      if (in_tui) {
        seen_tui = 1
        saw_status = 0
        saw_colors = 0
      }
    }
    in_tui && /^[[:space:]]*status_line[[:space:]]*=/ {
      if (!saw_status) print status_line
      saw_status = 1
      next
    }
    in_tui && /^[[:space:]]*status_line_use_colors[[:space:]]*=/ {
      if (!saw_colors) print colors_line
      saw_colors = 1
      next
    }
    { print }
    END {
      if (in_tui) emit_missing()
      if (!seen_tui) {
        print ""
        print "[tui]"
        print status_line
        print colors_line
      }
    }
  ' "$config_path" > "$tmp"
  mv "$tmp" "$config_path"

  echo "Codex status line configured:"
  echo "  $config_path -> [tui].status_line"
}

if [ "$INSTALL_CLAUDE" -eq 1 ]; then
  install_claude_statusline
fi

if [ "$INSTALL_CODEX" -eq 1 ]; then
  install_codex_statusline
fi

cat <<'EOF'

Status line setup complete.

Restart Claude Code / Codex sessions for config changes to load.
Codex can also be adjusted interactively with /statusline.
EOF
