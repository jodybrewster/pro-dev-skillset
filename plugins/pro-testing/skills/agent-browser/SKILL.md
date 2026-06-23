---
name: agent-browser
description: >-
  AI-driven browser automation via the agent-browser CLI (Chrome over CDP, no
  Playwright/Puppeteer dependency). Drive a live browser to navigate pages, fill
  forms, click buttons, take screenshots, scrape data, run login flows, do
  exploratory/manual QA, and verify a running app. Uses accessibility-tree
  snapshots with compact @eN refs (~200-400 tokens) instead of parsing raw HTML.
  Use when: "agent-browser," "open this URL," "screenshot the app," "click
  through the flow," "is my change working in the browser," "scrape this page,"
  "log into the site." Prefer over Playwright for ad-hoc, interactive, one-off
  automation where you do not need a committed, typed test suite. This is the
  interactive-verification axis; for a committed, typed regression suite use
  `playwright-automation` instead.
  Not for: writing a durable typed E2E test suite — use `playwright-automation`.
  Related: playwright-automation, visual-testing (bridged qa-skills — install via the
  `qa-suite` skill / `/qa-engine`).
---

<objective>
How an expert agent drives a real browser with agent-browser to interact with and verify a live web app — fast, token-efficient, and without flaky waits.
</objective>

Source: adapted from `vercel-labs/agent-browser` under Apache-2.0.

## Quick Start

```bash
# Install once (CLI + a matched Chrome for Testing build)
npm install -g agent-browser && agent-browser install

# The browser persists across commands, so these feel like one session:
agent-browser open http://localhost:3000   # 1. open a page
agent-browser snapshot -i                   # 2. see interactive elements + @eN refs
agent-browser fill @e3 "user@example.com"   # 3. act on refs
agent-browser click @e5
agent-browser wait --url "**/dashboard"     # 4. wait for the result
agent-browser snapshot -i                   # 5. re-snapshot — refs are now stale
agent-browser screenshot /tmp/done.png
agent-browser close
```

The canonical, version-matched usage guide ships with the CLI itself — read it
when in doubt: `agent-browser skills get core --full`.

## Discovery Questions

Before driving the browser, settle:

1. **Is it installed?** `agent-browser --version`. If missing, `npm i -g agent-browser && agent-browser install` (the second step downloads a Chrome-for-Testing build, ~170 MB).
2. **What is the target URL and is it up?** For a local app, confirm the dev server responds first (`curl -sof /dev/null <url>` or `wait --load`). Driving a not-yet-listening server wastes a 25s timeout.
3. **Headless or headed?** Headless by default. Add `--headed` only when a human needs to watch; it is not required for screenshots.
4. **Authenticated?** If the flow needs login, decide up front: the auth vault (`auth save`/`auth login`) or a saved `state save`/`state load` session. Never put real passwords in shell history — use `--password-stdin`.
5. **One session or several?** Independent flows (e.g. two roles) should use `--session <name>` to isolate cookies/tabs.

---

## Core Workflow: snapshot → ref → act → re-snapshot

```bash
agent-browser open <url>
agent-browser snapshot -i      # interactive-only tree with @e1, @e2, ... refs
agent-browser click @e3        # act on a ref
agent-browser snapshot -i      # ALWAYS re-snapshot after the page changes
```

Refs (`@e1`, `@e2`, …) are assigned **fresh on every snapshot** and go stale the
instant the page changes — after a navigating click, a form submit, a dynamic
re-render, or a dialog opening. Acting on a stale ref clicks the wrong thing or
errors. The single most common agent failure here is *forgetting to re-snapshot*.

When you do not want to snapshot (or refs keep going stale), use semantic
locators instead — they resolve at action time:

```bash
agent-browser find role button click --name "Save"
agent-browser find text "Sign In" click
agent-browser find label "Email" fill "user@test.com"
agent-browser find placeholder "Search" type "query"
```

Rule of thumb: **snapshot + `@eN` is fastest and most reliable**; `find
role/text/label` is the next best and needs no prior snapshot; a raw CSS
selector (`click "#submit"`) is the last-resort fallback.

---

## Common Mistakes

**Do not do these.**

### 1. Acting on stale refs after the page changed
Re-snapshot after every navigation, submit, or re-render. If a ref click "does nothing" or hits the wrong element, a stale ref is the first suspect.

### 2. Bare `wait <ms>` as synchronization
```bash
# BAD — slow on fast machines, flaky on slow ones
agent-browser wait 2000
# GOOD — wait for the actual condition
agent-browser wait --text "Saved"
agent-browser wait --url "**/dashboard"
agent-browser wait --load networkidle
agent-browser wait --fn "window.app?.ready === true"
```
Reserve `wait <ms>` for debugging only. Timeouts default to 25s.

### 3. Assuming a reactive UI updated instantly
After an action that triggers an async refetch/re-render, the DOM may lag a beat. Poll the real condition (`wait --fn` / `wait --text`) rather than reading state immediately, or you will observe pre-update values.

### 4. Fighting shell quoting in `eval`
Inline `eval "..."` only survives simple expressions. For anything with nested quotes or special chars, use `--stdin` (heredoc) or `-b` (base64):
```bash
cat <<'EOF' | agent-browser eval --stdin
[...document.querySelectorAll('a')].map(a => a.href)
EOF
```

### 5. Reusing refs across tabs
The daemon has one active tab; `@eN` refs belong to the tab that was active when you snapshotted. Switch tabs (`tab <id|label>`) and re-snapshot before interacting.

### 6. Leaking credentials into argv
`auth save --password-stdin` and `state load` keep secrets out of shell history and `ps`. Never type a real password as a positional arg.

### 7. Forgetting to clean up
`agent-browser close` (or `close --all`) ends the session. Leaving browsers running leaks processes across tasks.

---

## Key Commands

```bash
# Navigate
agent-browser open <url>           # launch + navigate (aliases: goto, navigate)
agent-browser back | forward | reload
agent-browser close [--all]

# Read the page
agent-browser snapshot -i          # interactive elements only (preferred)
agent-browser snapshot -i -c       # compact; -d N caps depth; -s "#main" scopes
agent-browser get text @e1         # text | html | value | attr <n> | title | url | count <sel>
agent-browser get styles @e1       # computed styles; get box @e1 for bounding box

# Interact
agent-browser click @e1            # dblclick | hover | focus
agent-browser fill @e2 "text"      # clear then type; `type` appends
agent-browser press Enter          # press Control+a, etc.
agent-browser check @e1 | uncheck @e1 | select @e1 "value"
agent-browser scroll down 500 | scrollintoview @e1 | drag @e1 @e2 | upload @e1 f.pdf

# Wait (prefer condition-based)
agent-browser wait @e1 | --text "x" | --url "**/p" | --load networkidle | --fn "expr"

# Verify / debug
agent-browser screenshot [path] [--full]
agent-browser console [--clear]    # console messages
agent-browser errors [--clear]     # uncaught page errors
agent-browser eval --stdin         # run JS (use --stdin or -b for non-trivial scripts)

# Find without snapshot
agent-browser find role|text|label|placeholder|testid|first|last|nth <value> <action> [text]
```

Full reference (every command, flag, and alias): `references/commands.md`.
Deep dive on the ref model, staleness, and iframes: `references/snapshot-refs.md`.

---

## Parallel Sessions

Each named session is an isolated browser (separate cookies, storage, tabs).
Use them to drive independent flows concurrently — e.g. two user roles:

```bash
agent-browser --session admin open https://app.example.com
agent-browser --session user  open https://app.example.com
agent-browser --session admin snapshot -i
agent-browser --session user  snapshot -i
# ... drive each independently, then:
agent-browser close --all
```

For multiple tabs within one session, use labels: `tab new --label docs <url>`,
then `tab docs` to switch. Tab ids (`t1`, `t2`) are stable and never reused.

---

## Advanced Features

- **Auth & sessions** — `auth save/login` (vault, `--password-stdin`) and `state save/load` (cookies + storage to a JSON file) replay logins across runs. See `references/commands.md` → State Management.
- **Network control** — `network route <url> --abort|--body '{}'` to block or mock; `network requests` to inspect traffic; `--resource-type script` to SSR-lock a page.
- **Emulation** — `set viewport W H [scale]`, `set device "iPhone 14"`, `set media dark`, `set geo`, `set offline on`.
- **Video & trace** — `record start demo.webm` / `record stop`; `trace start` / `trace stop trace.zip` for a full timeline.
- **React & Web Vitals** — launch with `--enable react-devtools`, then `react tree` / `react inspect <id>` / `react renders`; `vitals` reports LCP/CLS/TTFB/FCP/INP (framework-agnostic).
- **Pre-navigation staging** — `open` with no URL, register routes/cookies/init-scripts, then `navigate` so they take effect on the first real load.

---

## Done When

- The target interaction was driven against the **live app** (not just asserted in code), and the result was confirmed by a snapshot, `get text`/`get styles`, or a screenshot.
- Every ref interaction was preceded by a fresh `snapshot` taken after the most recent page change.
- Waits are condition-based (`--text`/`--url`/`--load`/`--fn`), not bare `wait <ms>`.
- `console` and `errors` were checked for unexpected output when verifying a change.
- The session was closed (`close`/`close --all`) and any saved auth/state files are git-ignored.

## Related Skills and References

### Reference Files (in `references/`)

| File | Purpose |
|------|---------|
| `commands.md` | Complete command reference — every command, flag, and alias by function |
| `snapshot-refs.md` | The snapshot-and-ref model: ref invalidation, iframes, targeted snapshots, troubleshooting |

### Related Skills

- **playwright-automation** — the committed-regression-suite axis: when you need a durable, typed, CI-run E2E *test suite* rather than ad-hoc interactive driving. Bridged qa-skill — install via the `qa-suite` skill / `/qa-engine`.
- **visual-testing** — screenshot baselines and pixel-diff review; pairs with `agent-browser screenshot`. Bridged qa-skill — install via the `qa-suite` skill / `/qa-engine`.
- **dogfood** — systematic exploratory app testing. CLI-bundled, **not a repo skill**: it ships with the agent-browser CLI itself (`agent-browser skills get dogfood`), so there is no `skills/dogfood/` in this plugin.

---

_Forked from [vercel-labs/agent-browser](https://github.com/vercel-labs/agent-browser) (v0.27.0) — Apache-2.0. The `references/` files are adapted from the CLI's bundled `skill-data/core`. See `LICENSE` for attribution._
