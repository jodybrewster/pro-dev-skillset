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
cat > goldfish_review_report.md <<'MD'
# Goldfish review report

## Findings

1. Blocker: the design never says how ownership is checked on the export route.
2. Major: no limit is given for exports above 50,000 rows.
3. Major: the CSV encoding and delimiter are not stated.
4. Nit: the Goal section repeats the title.
MD
git init -q . && git config user.name "Sam Rivera" && git config user.email sam@example.com && git add -A && git -c user.email=e@e -c user.name=e commit -qm init
