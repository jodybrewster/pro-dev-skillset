#!/bin/sh
# session.sh - the one script a factory container runs.
#   session.sh <repo url> <marketplace ref> <phase: brief|build|verify> <intent dir>
# Environment from the host: GH_TOKEN, ANTHROPIC_API_KEY, CLAUDE_GUARD_MODE, FACTORY_BUDGET_USD,
# FACTORY_MODEL and, for the verify phase, FACTORY_PR, FACTORY_HEAD (the sha the host verified) and
# optionally FACTORY_VERIFY_CMD. FACTORY_WORK moves /work for tests.
# The token is read from the environment by a git credential helper and is never written to a file.
# The token also needs read access to the marketplace repo, or that repo must be public.
set -eu

# ship.py refuses its release steps (prepare, version --agree, deployed) in a headless session.
export FACTORY_SESSION=1

repo_url=${1:?repo url}
mkt_ref=${2:?marketplace ref}
phase=${3:?phase}
dir=${4:?intent dir}

case "$phase" in brief|build|verify) ;; *) echo "factory: unknown phase $phase" >&2; exit 64 ;; esac
# An intent folder is named by its date (intent/2026-01-02-slug) or by its change id (intent/PDS-51-slug);
# capitals are allowed only in the id prefix. The slug, the folder name without either prefix, names the branch.
refuse_dir() { echo "factory: refusing intent dir $dir" >&2; exit 64; }
base=${dir#intent/}
case "$dir" in
  intent/[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]-*) slug=${base#????-??-??-} ;;
  intent/[ABCDEFGHIJKLMNOPQRSTUVWXYZ]*-*-*)
    code=${base%%-*}; rest=${base#*-}; num=${rest%%-*}; slug=${rest#*-}
    case "$code" in ?|???????*|*[!ABCDEFGHIJKLMNOPQRSTUVWXYZ]*) refuse_dir ;; esac
    case "$num" in ''|0*|*[!0123456789]*) refuse_dir ;; esac
    ;;
  *) refuse_dir ;;
esac
case "$slug" in ''|*[!abcdefghijklmnopqrstuvwxyz0123456789-]*) refuse_dir ;; esac
case "$mkt_ref" in *[!A-Za-z0-9._/-]*|-*) echo "factory: refusing marketplace ref" >&2; exit 64 ;; esac

# Every plugin's gates read this mode file, not only the one CLAUDE_GUARD_MODE reaches; the home is
# the container's own and thrown away with it.
mkdir -p "$HOME/.claude/hooks"
echo enforce > "$HOME/.claude/hooks/mode"

work=${FACTORY_WORK:-/work}
git config --global user.name "factory"
git config --global user.email "factory@users.noreply.github.com"
git config --global credential.https://github.com.helper \
  '!f() { test "$1" = get && echo username=x-access-token && echo "password=$GH_TOKEN"; }; f'

# Every commit in this container carries the run's trailer, whoever makes it (/execute commits
# on its own), so the host can bind the pull request to this run. The host still checks it.
mkdir -p "$HOME/.factory-hooks"
cat > "$HOME/.factory-hooks/commit-msg" <<HOOK
#!/bin/sh
git interpret-trailers --in-place --if-exists replace --trailer "Factory-Run: ${phase} ${dir#intent/}" "\$1"
HOOK
chmod +x "$HOME/.factory-hooks/commit-msg"
git config --global core.hooksPath "$HOME/.factory-hooks"

git clone --quiet "$repo_url" "$work/repo"
cd "$work/repo"

if [ "$phase" = verify ]; then
  # The code under test never sees a secret: they are dropped before it runs.
  git fetch --quiet origin "pull/${FACTORY_PR:?FACTORY_PR}/head"
  if [ -n "${FACTORY_HEAD:-}" ]; then
    case "$FACTORY_HEAD" in *[!0-9a-f]*) echo "factory: refusing FACTORY_HEAD" >&2; exit 64 ;; esac
    git checkout --quiet "$FACTORY_HEAD"   # the exact sha the host verified
  else
    git checkout --quiet FETCH_HEAD
  fi
  cmd=${FACTORY_VERIFY_CMD:-}
  if [ -z "$cmd" ]; then
    if [ -f package.json ] && grep -q '"test"' package.json; then cmd='npm ci --no-audit --no-fund && npm test'
    elif [ -f pytest.ini ] || [ -f conftest.py ] || [ -d tests ]; then cmd='python3 -m pytest -q'
    else echo "factory: no verify command found" >&2; exit 3; fi
  fi
  exec env -u GH_TOKEN -u ANTHROPIC_API_KEY sh -c "$cmd"
fi

claude plugin marketplace add "https://github.com/jodybrewster/pro-dev-skillset.git#${mkt_ref}" >/dev/null
# User scope inside this throwaway home: --setting-sources user below ignores the repo's own
# settings, and a project-scope install would also dirty the clone.
for p in pro-ai-sdlc pro-ship pro-quality pro-security; do
  claude plugin install "${p}@pro-dev-skillset" --scope user >/dev/null
done

claude -p "/pro-ai-sdlc:auto ${phase} ${dir}" \
  --model "${FACTORY_MODEL:-opus}" \
  --permission-mode bypassPermissions \
  --setting-sources user \
  --max-budget-usd "${FACTORY_BUDGET_USD:-8}" \
  --max-turns 200 \
  --disallowedTools WebFetch WebSearch "Bash(curl:*)" "Bash(wget:*)" "Bash(gh api:*)" "Bash(gh repo:*)" \
    "Bash(gh secret:*)" "Bash(gh release:*)" "Bash(gh pr merge:*)" "Bash(git tag:*)" "Bash(claude:*)" \
  --output-format stream-json --verbose || echo "factory: claude exited $?" >&2

# The PR is found by the branch name the phase is told to use: <id>/brief or <id>/build when the
# intent's frontmatter has an id: line (ADR-0026), else <slug>-brief for the brief and /execute's own
# <slug> for the build. There is no fallback to a newer PR; the host checks the same name again.
cid=$(awk 'NR == 1 { sub(/\r$/, ""); if ($0 != "---") exit; next }
  { sub(/\r$/, "") } $0 == "---" { exit }
  /^id:/ { sub(/^id:[ \t]*/, ""); sub(/[ \t]+$/, ""); print; exit }' "$dir/intent.md" 2>/dev/null || true)
case "$cid" in
  [ABCDEFGHIJKLMNOPQRSTUVWXYZ]*-[123456789]*)
    case "${cid%%-*}" in ?|???????*|*[!ABCDEFGHIJKLMNOPQRSTUVWXYZ]*) cid="" ;; esac
    case "${cid#*-}" in *[!0123456789]*) cid="" ;; esac
    ;;
  *) cid="" ;;
esac
if [ -n "$cid" ]; then want="$cid/$phase"
else case "$phase" in brief) want="${slug}-brief" ;; *) want="$slug" ;; esac
fi
pr=$(gh pr list --head "$want" --state open --json number --jq '.[0].number // empty' 2>/dev/null || true)
case "$pr" in ''|*[!0-9]*) echo "factory: no pull request found for branch $want" >&2; exit 1 ;; esac
echo "factory: pr $pr"
