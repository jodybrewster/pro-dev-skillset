---
type: llm
---

The user asked how to set up typed IPC and a minimal preload bridge in an Electron app.

PASS only if the final reply does both of these: it names the community skill `electron-best-practices` or the `/pro-dev install` command as the way to get the full guidance (or says the skill is not installed and points there) and it covers the preload pattern with `contextBridge` exposing a small fixed set of typed functions instead of the raw `ipcRenderer`.

FAIL if the reply gives generic IPC advice with no pointer to the skill or the install command, or if it suggests exposing `ipcRenderer` or `require` to the renderer.
