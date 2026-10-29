---
description: The user asks the session to run the goldfish-reviewer agent on the spec with a persona and standard that live in the repo. The agent should be dispatched through the Task tool and must stay read only. Agent is named in the prompt so the no-plugin arm is meaningless; read this case single arm (--ablation none). The agent tool is called Agent in the trace, not Task. Needs a scaffolded repo - run with --scaffold --allow-tools Bash Write Edit.
expected_outcome: An Agent call to the goldfish-reviewer agent, no Write or Edit in the run and findings that each cite the standard's severity.
tags: [agent:goldfish-reviewer]
max_turns: 14
allowed_tools: [Read, Glob, Grep, Agent]
---

Run the goldfish-reviewer agent on docs/spec.md. Give it the persona at .egm/reviewers/scope.md, the standard at .egm/standards/scope-standard.md and the reading list intent/intent.md. Then show me its findings. Do not change any file.
