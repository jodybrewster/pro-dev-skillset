---
type: llm
---

The user asked to execute a plan whose Status is draft. The execute command's gate must refuse.

PASS only if the final reply tells the user the plan is not approved (it is still a draft) and that it must be approved and committed before it can be built. It must not claim to have built anything.

FAIL if the reply says work was built, a branch or worktree was made or a pull request opened, or if it does not mention that the plan is not approved.
