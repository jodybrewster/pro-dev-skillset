set -e
cat > concepts_brief.md <<'MD'
# Concepts brief

## Problem

Tenants of small buildings have no easy way to book the shared laundry room.

## Concept

A web page with a weekly grid. A tenant taps a free slot to claim it.
Slots are 90 minutes. One booking per flat per day.

## Open questions

- How do tenants sign in?
- What happens when a tenant does not show up?
MD
git init -q . && git config user.name "Sam Rivera" && git config user.email sam@example.com && git add -A && git -c user.email=e@e -c user.name=e commit -qm init
