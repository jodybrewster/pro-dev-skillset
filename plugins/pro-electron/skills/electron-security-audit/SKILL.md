---
name: electron-security-audit
description: Electron app security audit - scans BrowserWindow webPreferences (nodeIntegration, contextIsolation, sandbox, webSecurity), setWindowOpenHandler, will-navigate, shell.openExternal, the Content-Security-Policy and Electron Fuses and ASAR integrity in main-process and packaging code, then reports a file:line checklist. Use when asked to audit an Electron desktop app or check whether it is safe to ship. Not for web servers, endpoints or dependency scans.
---

# Electron security audit

Announce: "Using electron-security-audit to check this Electron app against the Electron security checklist."

## Steps

1. Find the app root: the folder with the app's `package.json` that depends on `electron`.
2. Run the checker from this skill's `scripts/` folder, resolved relative to this SKILL.md:
   `node <skill dir>/scripts/audit.mjs <app root> --json`
   It needs Node 20 or later and reads files as text only.
   Exit code 1 means findings and 0 means none.
3. The checker is a heuristic.
   Open each finding's `file:line` and confirm it before reporting.
   Drop false alarms and say why.
4. Write the checklist, grouped by severity (high, medium, low).
   For each confirmed finding give the `file:line`, why it matters and the fix.
5. Add the manual items below and mark each as checked, failing or not applicable.

## What the script checks

`nodeIntegration`, `contextIsolation`, `sandbox`, `webSecurity`, `allowRunningInsecureContent`, the remote module, a missing `setWindowOpenHandler`, a missing `will-navigate` handler, `shell.openExternal` on an unchecked value, a missing Content-Security-Policy, missing Electron Fuses and the `EnableNodeCliInspectArguments` fuse set to true.
It does not check the fuse values beyond that one.
Read the fuse config yourself: `RunAsNode` and `EnableNodeOptionsEnvironmentVariable` should be off.
Turn on `EnableEmbeddedAsarIntegrityValidation` and `OnlyLoadAppFromAsar`.

## Manual items the script cannot check

- Electron version: it should be within the latest three supported major versions.
  Run `npm view electron dist-tags` for the current majors and compare with the version in `package.json` and the lockfile.
- Permission handling: look for `session.setPermissionRequestHandler` and `setPermissionCheckHandler` that deny by default.
- IPC sender validation: every `ipcMain.handle` and `ipcMain.on` handler should check `event.senderFrame` or `event.sender` before acting.
- Remote debugging: confirm no `--remote-debugging-port` switch ships in a release build.
- Loaded content: no remote URLs in `loadURL` without a reason.
- Webviews: review every `<webview>` before it ships.

## References

- Electron security checklist: https://www.electronjs.org/docs/latest/tutorial/security
- Electron Fuses: https://www.electronjs.org/docs/latest/tutorial/fuses
