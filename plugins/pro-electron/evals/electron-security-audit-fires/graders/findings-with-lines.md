---
type: llm
focus: trace
---

The app in the working directory has planted faults in main.js: `nodeIntegration: true`, `contextIsolation: false`, `sandbox: false`, an unchecked `shell.openExternal(url)` in an `ipcMain.on` handler, no `setWindowOpenHandler` or `will-navigate` handler and no Content-Security-Policy in index.html.

PASS only if the final reply is a checklist that reports at least `nodeIntegration`, `contextIsolation` and the unchecked `shell.openExternal` as findings, each with a file and line reference such as `main.js:7` and also flags the missing CSP or the missing window-open and navigation handlers.

FAIL if the findings have no file and line references or if the three named faults are not all reported.
