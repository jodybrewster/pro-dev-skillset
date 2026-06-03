---
name: qa-do
description: >-
  Routing skill of last resort. Use ONLY when the user's request does not match
  any other skill's trigger phrases. Takes a plain-language QA situation and
  identifies the right 1-3 skills to use and in what order. Use when: "which
  skill should I use," "where do I start," "I'm not sure what to test,"
  "/qa-do," or any vague QA situation that doesn't map to one skill. Do NOT use
  if the request clearly matches another skill — invoke that skill directly.
  Related: qa-start, qa-project-context, test-strategy.
---

# qa-do

Follow `../../upstream/qa-skills/skills/qa-do/SKILL.md` and any files it references.

- Adapt upstream tool names to the current session's capabilities.
- Do not run any upstream CLI bootstrap, install flow, or `.agents/` provisioning unless the user explicitly asks.
- Sibling QA skills the upstream doc points to live under `../../upstream/qa-skills/skills/` — consult them there even if they don't auto-trigger here.
- CROSS-REF: `qa-do` routes *within* the testing / Verify phase. To route across the whole dev lifecycle (define → plan → build → verify → ship), use `using-pro-dev` (pro-core), which hands off to `qa-do` for verification.

_Vendored from [petrkindlmann/qa-skills](https://github.com/petrkindlmann/qa-skills) — MIT. See plugin `LICENSE` and `../../upstream/qa-skills/LICENSE`._
