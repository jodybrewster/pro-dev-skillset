set -e
mkdir -p docs intent
cat > intent/intent.md <<'MD'
# Intent

Let users export their saved reports as CSV from the reports page.
Only the report owner may export. Exports must finish in under 10 seconds for 50,000 rows.
MD
cat > docs/spec.md <<'MD'
# Spec: CSV export

## Behavior

1. The reports page gets an Export button that downloads a CSV of the report.
2. Any signed-in user can export any report by id.
3. Large exports are queued and emailed as a link.
4. The export also adds a PDF option and a scheduled weekly export.

## Open questions

None.
MD
git init -q . && git config user.name "Sam Rivera" && git config user.email sam@example.com && git add -A && git -c user.email=e@e -c user.name=e commit -qm init
