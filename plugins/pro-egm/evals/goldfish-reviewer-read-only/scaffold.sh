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
git init -q . && git add -A && git -c user.email=e@e -c user.name=e commit -qm init
mkdir -p .egm/reviewers .egm/standards
cat > .egm/reviewers/scope.md <<'MD'
# Scope reviewer

You have no history. Read intent/intent.md first as the source of truth.
Then read the target in full. Report each target item that traces to no line of the intent.
Report each intent line that the target does not cover.
MD
cat > .egm/standards/scope-standard.md <<'MD'
# Scope standard

## Blocker
The target adds work the intent does not ask for and that changes behavior or widens access.
Or an intent constraint is not covered by the target.

## Major
A small item that traces to no line of the intent.

## Nit
A step that traces to the intent only loosely.
MD
git add -A && git -c user.email=e@e -c user.name=e commit -qm reviewers
