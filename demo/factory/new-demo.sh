#!/bin/sh
# Build a fresh factory demo: the tiny-tasks fixture with fictional people, a private GitHub
# repo, a v1.0.0 tag, a protected main, protected release tags and the four plugins at local scope.
# Usage: new-demo.sh <name> [--owner <gh owner>] [--dir <parent dir, default ~/Projects>]
set -eu

usage() {
  echo "usage: new-demo.sh <name> [--owner <gh owner>] [--dir <parent dir>]" >&2
  exit 64
}

name=""
owner=""
parent="${HOME}/Projects"
while [ $# -gt 0 ]; do
  case "$1" in
    --owner) [ $# -ge 2 ] || usage; owner="$2"; shift 2 ;;
    --dir) [ $# -ge 2 ] || usage; parent="$2"; shift 2 ;;
    -h|--help) usage ;;
    -*) echo "new-demo: unknown flag $1" >&2; usage ;;
    *) [ -z "$name" ] || usage; name="$1"; shift ;;
  esac
done
[ -n "$name" ] || usage

if ! printf '%s' "$name" | grep -Eq '^[a-z0-9][a-z0-9-]{1,40}$'; then
  echo "new-demo: refusing name '$name': it must match ^[a-z0-9][a-z0-9-]{1,40}\$" >&2
  exit 1
fi

here="$(cd "$(dirname "$0")" && pwd)"
scaffold="$here/../../plugins/pro-ai-sdlc/evals/spec-from-intent/scaffold.sh"
[ -f "$scaffold" ] || { echo "new-demo: missing $scaffold" >&2; exit 1; }

if [ -z "$owner" ]; then
  owner="$(gh api user --jq .login)"
fi
[ -n "$owner" ] || { echo "new-demo: could not work out the GitHub owner; pass --owner" >&2; exit 1; }

dest="$parent/$name"
if [ -e "$dest" ]; then
  echo "new-demo: refusing: $dest already exists" >&2
  exit 1
fi
if gh repo view "$owner/$name" >/dev/null 2>&1; then
  echo "new-demo: refusing: $owner/$name already exists on GitHub" >&2
  exit 1
fi

day="$(date +%F)"
mkdir -p "$dest"
cd "$dest"

# The fixture, then a clean history of our own with the fictional author only.
sh "$scaffold"
rm -rf .git intent/2026-01-05-due-dates
git init -q -b main .
git config user.name "Sam Rivera"
git config user.email "sam@example.com"

cat >> REVIEW.md <<'MD'

## Roles

Who fills each role.
Names are git `user.name` values.

```yaml
roles:
  product_owner: [Sam Rivera]
  engineer: [Sam Rivera]
  lead: [Lee Chen]
  policy_owner: [Pat Okafor]
  platform_owner: [Sam Rivera]
```
MD

mkdir -p intent .github/workflows
cat > intent/README.md <<'MD'
# Intents

Every change starts here, one folder per change, named `<date>-<slug>/`.
`intent.md` says why, `spec.md` says what must be true and `plan.md` says how.
Merging the pull request that adds an accepted intent is how the product owner accepts it.
MD

cat > .gitignore <<'GI'
.pro-dev/
.mieruka/
.claude/test-lock
node_modules/
docs/spdd/
GI

cat > .github/workflows/test.yml <<'YML'
name: test
on:
  pull_request:
  push:
    branches: [main]
permissions:
  contents: read
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: npm test
YML

cat >> CLAUDE.md <<'MD'

## Ship

`/pro-ship:ship` reads this block.
The library ships as a tag; a person pushes it.

```yaml
targets:
  - id: library
    kind: tag-release
    documented_use: "node examples/use.js"
    rollback:
      triggers:
        - "the release breaks a caller"
      steps:
        - "Delete the release on the consumer side and point it back at the previous tag."
        - "Revert the release commits on main through a pull request."
      rto: "one release cycle"
tag_pattern: "v*"
last_deploy: tag
```
MD

mkdir -p examples
cat > examples/use.js <<'JS'
import { createStore, addTask, listTasks } from '../src/index.js';

const store = createStore();
addTask(store, 'Water the plants');
console.log(listTasks(store).length === 1 ? 'one task listed' : 'task list is wrong');
JS

cat >> README.md <<'MD'

## Usage

```sh
node examples/use.js
```
MD

cat > CHANGELOG.md <<'MD'
# Changelog

All notable changes to tiny-tasks are written here, in the change that makes them.

## [Unreleased]

## [1.0.0] - 2026-01-01

### Added

- A task list with a store and a formatter.
MD

mkintent() {
  slug="$1"; role="$2"; kind="$3"; title="$4"; problem="$5"; outcome="$6"; files="$7"; success="$8"
  mkdir -p "intent/$day-$slug"
  cat > "intent/$day-$slug/intent.md" <<MD
---
source: idea
kind: $kind
breaking: false
status: accepted
risk: low
level: 1
created: ${day}T09:00:00-0500
author: Sam Rivera
---

# Intent: $title

Author: Sam Rivera ($role).
Source: idea.
Status: accepted.
Created: $day.

## Problem

$problem

## Proposed outcome

$outcome

## Affected users and systems

Anyone calling the tiny-tasks library.
$files

## Constraints

Keep the standard library only.
Bad input is rejected with a TypeError, like every other bad input.

## Out of scope

Anything not named above.

## Success looks like

$success
\`npm test\` stays green.

## Open questions

None.

## Evidence

None.
MD
}

mkintent "sorted-by-title" "product owner" "idea" "List tasks sorted by title" \
  "Tasks come back in the order they were added, so a long list is hard to scan." \
  "A listing function returns the tasks ordered by title, case-insensitive, without changing the stored order." \
  "The files \`src/index.js\` and \`src/format.js\`." \
  "Adding tasks named b, A and c and asking for the sorted listing returns A, b, c."

mkintent "trim-titles" "engineer" "bug" "Trim whitespace around task titles" \
  "A title typed with leading or trailing spaces is stored as typed, so two tasks that look alike differ." \
  "Adding a task stores its title with surrounding whitespace removed." \
  "The file \`src/tasks.js\`." \
  "Adding a task titled with spaces around it stores the trimmed title."

git add -A
git commit -q -m "tiny-tasks baseline with roles, CI, ship block and two accepted intents"

gh repo create "$owner/$name" --private --source . --push
git tag v1.0.0
git push origin v1.0.0

gh api -X PUT "repos/$owner/$name/branches/main/protection" --input - <<'JSON'
{"required_status_checks": {"strict": false, "contexts": ["test"]},
 "enforce_admins": true,
 "required_pull_request_reviews": {"required_approving_review_count": 0},
 "restrictions": null}
JSON

# Release tags: an owner can still push them, nobody else can create, move or delete one.
gh api -X POST "repos/$owner/$name/rulesets" --input - <<'JSON'
{"name": "release tags", "target": "tag", "enforcement": "active",
 "conditions": {"ref_name": {"include": ["refs/tags/v*"], "exclude": []}},
 "rules": [{"type": "creation"}, {"type": "update"}, {"type": "deletion"}],
 "bypass_actors": [{"actor_id": 5, "actor_type": "RepositoryRole", "bypass_mode": "always"}]}
JSON

for p in pro-ai-sdlc pro-ship pro-quality pro-security; do
  claude plugin install "$p@pro-dev-skillset" --scope local
done

cat <<EOF2

Demo ready: https://github.com/$owner/$name
Checkout: $dest

Next:
  export SDLC="\$(ls -d ~/.claude/plugins/cache/pro-dev-skillset/pro-ai-sdlc/*/ | tail -1)"
  export ANTHROPIC_API_KEY=...
  cd "$dest"
  python3 "\$SDLC/scripts/factory.py" roles --repo .
  python3 "\$SDLC/scripts/factory.py" run --next --repo . --max-cost-usd 10 --allow-broad-token

Remove it later with: demo/factory/remove-demo.sh $name --owner $owner
EOF2
