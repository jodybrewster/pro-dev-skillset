---
type: llm
focus: trace
---

The session dispatched the goldfish-reviewer agent with a scope persona and a scope standard, then showed its findings.

PASS only if the findings the agent returned each give a severity of Blocker, Major or Nit that follows the standard's rubric and a rationale tied to the spec and intent (for example the spec's any-user export against the intent's owner-only rule, or the PDF and weekly export items that trace to no intent line). The agent made no edits.

FAIL if there are no findings, a finding has no severity or no rationale tied to the standard, or the agent edited a file.
