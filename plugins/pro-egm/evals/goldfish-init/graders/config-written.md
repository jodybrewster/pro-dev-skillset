---
type: llm
focus:
  source: file
  path: .egm/goldfish.json
---

This is the contents of `.egm/goldfish.json` after `/pro-egm:goldfish init`.

PASS only if the file is valid JSON with a `spec` section whose `reviewers` include `zoom_out`, `design_critic`, `.egm/reviewers/policy.md` and `.egm/reviewers/scope.md`. Its `plan` section must list `implementation_readiness`, `codebase_details` and `.egm/reviewers/scope.md`.

FAIL if the file is missing or empty, is not JSON or leaves out any of those reviewers.
