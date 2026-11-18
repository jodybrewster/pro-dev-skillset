set -e
mkdir -p docs/designs
cat > docs/designs/export.md <<'MD'
# Design: CSV export

## Goal

Let a report owner download a report as CSV.

## Design

1. The reports page gets an Export button.
2. The server streams rows as CSV, 50,000 rows in under 10 seconds.
3. Only the report owner may export.

## Open questions

None.
MD
git init -q . && git config user.name "Sam Rivera" && git config user.email sam@example.com && git add -A && git -c user.email=e@e -c user.name=e commit -qm init
