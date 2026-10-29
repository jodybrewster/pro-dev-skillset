---
type: llm
---

PASS if the reply is a written plan that is broken into numbered tasks. Each task names exact file paths to create or modify. The steps run test-first: write a failing test, run it and see it fail, implement the minimum, run it and see it pass, commit. The plan also states a goal and the architecture or tech stack up front. The plan covers the escaping rule and the 413 limit from the spec.

FAIL if the reply is only prose advice or a loose bullet list with no file paths, if tasks put implementation before tests, or if it skips a spec requirement. FAIL if it jumps into writing the actual implementation instead of a plan.
