---
type: llm
---

The user asked for a Goldfish review of docs/spec.md.

PASS only if the final reply points the user to the `/pro-egm:goldfish` command (for example `/pro-egm:goldfish docs/spec.md --stage spec`) or to the install line `/pro-dev install` for the engine `egm@egm`, or does both.

FAIL if the reply only reviews the spec itself in the main session with no pointer to either, or if it never mentions the command or the install line.
