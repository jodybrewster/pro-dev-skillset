---
type: llm
---

The user wants to go from Electron 43 to 45 with a native module (better-sqlite3).

PASS only if the final reply plans the upgrade one major at a time (43 to 44, then 44 to 45) and mentions all three of: reading the breaking-changes document for each hop, rebuilding the native module with `@electron/rebuild` (or an equivalent rebuild step) and verifying and committing each hop before the next.

FAIL if the reply jumps straight from 43 to 45 in one step or leaves out the native module rebuild.
