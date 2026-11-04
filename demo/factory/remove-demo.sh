#!/bin/sh
# Clean up a factory demo for a retest, following docs/factory-demo.md "Clean up everything
# for a retest" step by step. It archives the GitHub repo and prints the delete command; it
# never deletes the repo and never kills a process.
# Usage: remove-demo.sh <name> [--owner <gh owner>] [--dir <parent dir>] [--delete-image]
set -eu

usage() {
  echo "usage: remove-demo.sh <name> [--owner <gh owner>] [--dir <parent dir>] [--delete-image]" >&2
  exit 64
}

name=""
owner=""
parent="${HOME}/Projects"
delimg=0
while [ $# -gt 0 ]; do
  case "$1" in
    --owner) [ $# -ge 2 ] || usage; owner="$2"; shift 2 ;;
    --dir) [ $# -ge 2 ] || usage; parent="$2"; shift 2 ;;
    --delete-image) delimg=1; shift ;;
    -h|--help) usage ;;
    -*) echo "remove-demo: unknown flag $1" >&2; usage ;;
    *) [ -z "$name" ] || usage; name="$1"; shift ;;
  esac
done
[ -n "$name" ] || usage

if ! printf '%s' "$name" | grep -Eq '^[a-z0-9][a-z0-9-]{1,40}$'; then
  echo "remove-demo: refusing name '$name': it must match ^[a-z0-9][a-z0-9-]{1,40}\$" >&2
  exit 1
fi
if [ -z "$owner" ]; then
  owner="$(gh api user --jq .login)"
fi
[ -n "$owner" ] || { echo "remove-demo: could not work out the GitHub owner; pass --owner" >&2; exit 1; }

dest="$parent/$name"
[ -d "$dest" ] || { echo "remove-demo: refusing: $dest is not a directory" >&2; exit 1; }
origin="$(git -C "$dest" remote get-url origin 2>/dev/null || true)"
case "$origin" in
  "https://github.com/$owner/$name"|"https://github.com/$owner/$name.git"|"git@github.com:$owner/$name"|"git@github.com:$owner/$name.git") ;;
  *) echo "remove-demo: refusing: origin of $dest is '$origin', not $owner/$name" >&2; exit 1 ;;
esac

trash="${HOME}/.Trash/$name-$(date +%F)"
if [ -e "$trash" ]; then
  echo "remove-demo: refusing: $trash already exists" >&2
  exit 1
fi

echo "== 1. Stop the loop and any demo mieruka server (this script kills nothing)"
echo "Stop the factory loop with ctrl-c. For a mieruka dev server, find its pid and stop it yourself:"
echo "  lsof -tiTCP:<port> -sTCP:LISTEN"

echo "== 2. Uninstall the local-scope plugins"
for p in pro-ai-sdlc pro-ship pro-quality pro-security; do
  (cd "$dest" && claude plugin uninstall "$p@pro-dev-skillset" --scope local) || echo "remove-demo: could not uninstall $p (already gone?)"
done

echo "== 3. Move the checkout to the Trash"
mkdir -p "${HOME}/.Trash"
mv "$dest" "$trash"
echo "moved to $trash"

echo "== 4. Archive the GitHub repo"
gh repo archive "$owner/$name" --yes
echo "Deleting is permanent, so it is yours to run:"
echo "  gh auth refresh -h github.com -s delete_repo    # once, adds the scope"
echo "  gh repo delete $owner/$name --yes"

echo "== 5. Factory images"
if command -v docker >/dev/null 2>&1; then
  if [ "$delimg" -eq 1 ]; then
    for id in $(docker images -q pro-dev-factory); do
      docker rmi "$id" || echo "remove-demo: could not remove image $id"
    done
  else
    echo "Kept. Pass --delete-image to remove them, or run: docker images pro-dev-factory"
  fi
else
  echo "docker is not installed; nothing to remove"
fi

echo "== Validate"
if ls "$parent" | grep -qx -- "$name"; then
  echo "FAIL: $parent still lists $name"
else
  echo "ok: $parent lists no $name"
fi
if out="$(gh repo view "$owner/$name" --json isArchived --jq .isArchived 2>&1)"; then
  echo "repo $owner/$name archived: $out"
else
  echo "repo $owner/$name: $out"
fi
python3 -c "import json,os,sys; n=sys.argv[1]; d=json.load(open(os.path.expanduser('~/.claude/plugins/installed_plugins.json')))['plugins']; print('local plugin entries:', [k for k,v in d.items() for e in v if os.path.basename(e.get('projectPath','')) == n])" "$name" || echo "could not read installed_plugins.json"
if command -v docker >/dev/null 2>&1; then
  echo "factory images left:"
  docker images pro-dev-factory
fi
echo "Check by eye: mieruka shows no $name project."
