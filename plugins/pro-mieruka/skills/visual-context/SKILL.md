---
name: visual-context
description: >-
  Read the visual context captured in Mieruka's Live Designer before making UI changes.
  Invoke when the user says "look at this", "this element", "the button here",
  "I'm pointing at", "circle this", or any similar phrase indicating they want changes
  to a specific visible UI element. Also invoke before any UI edit when Mieruka is running
  and no recent context exists. Requires Mieruka running at localhost:7777.
metadata:
  author: pro-mieruka
  version: "0.1.0"
  category: design
---

# Visual Context

Use Mieruka's Live Designer to read exactly what the user is pointing at before making
any targeted UI change. This prevents blind edits and ensures you modify the right element.

## Prerequisites

Mieruka must be running (`/start-mieruka` or `mieruka dev`). The Live Designer is at
`http://localhost:7777/live`. If Mieruka is not running, tell the user to start it first.

---

## Step 1 — Check for fresh context

Call the MCP tool `read_ui_context`.

- If `exists: true` and `capturedAt` is within the **last 10 minutes** → proceed to Step 3.
- If `exists: false` or stale → proceed to Step 2.

---

## Step 2 — Ask the user to capture context

Tell the user:

> "I don't have a visual context snapshot yet. In the Mieruka **Live Designer** tab
> (`localhost:7777/live`), navigate to the element you want to change, click it to select
> it, optionally draw a circle or box over it using **Freeze & Annotate**, then click
> **Send to Claude ↑**. I'll wait."

Do **not** attempt to locate or guess the element from source code alone. Wait for the
user to confirm they've sent the context.

---

## Step 3 — Interpret the context

From `read_ui_context`, use:

| Field | How to use it |
|---|---|
| `element.domPath` | CSS selector path — use to find the component in source code |
| `element.outerHTML` | Confirm you found the right DOM node in source |
| `element.computedStyles` | Current visual state before your change (`color`, `fontSize`, etc.) |
| `element.boundingBox` | Spatial dimensions — useful for layout reasoning |
| `element.innerText` | Confirm the element's content matches what the user described |
| `annotations` | Circles/boxes the user drew — each has `tool`, `color`, `points`. Prioritize the annotated sub-region. |
| `sourceUrl` | The page URL the user was inspecting |

Use `element.domPath` to search the source files (grep for tag + class names). Cross-reference
`element.outerHTML` to confirm the right component before editing.

---

## Step 4 — Make the targeted change

1. Find the source file using `element.domPath` (grep for the CSS classes or tag pattern).
2. Confirm the element by matching `element.outerHTML` snippet against the JSX/HTML.
3. Make the change.
4. Call `clear_ui_context` to signal the context has been consumed.
5. Tell the user what file and line you changed, and suggest they reload the Live Designer
   to verify.

---

## Step 5 — Optional: confirm with push_ui_focus

After making the change, you can highlight the element in the user's Live Designer:

```
push_ui_focus({ selector: <element.domPath from read_ui_context> })
```

This scrolls to and briefly flashes a green highlight on the element in the live preview.
Only use the `domPath` returned by `read_ui_context` — never construct your own selector.

---

## Notes

- If `annotations` is non-empty, the user has drawn marks. Treat those as spatial emphasis —
  they're indicating a sub-region of the selected element, not a different element.
- If `element` is null but `annotations` is non-empty, the user drew over a frozen screenshot
  without clicking an element. Use `frozenDomSnapshot` and `annotations` to reason spatially.
- Never call `push_ui_focus` with a selector you derived from source code. It may not match
  the live DOM. Only use `element.domPath` from `read_ui_context`.
- If the context is more than 10 minutes old, ask the user to re-capture rather than acting
  on stale data — the page may have changed.
