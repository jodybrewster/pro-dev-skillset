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
  version: "0.2.0"
  category: design
---

# Visual Context

Use Mieruka's Live Designer to read exactly what the user is pointing at before making
any targeted UI change. This prevents blind edits and ensures you modify the right element.

## Prerequisites

Mieruka must be running (`/start-mieruka` or `mieruka dev`). The Live Designer is at
`http://localhost:7777/live`. If Mieruka is not running, tell the user to start it first.

---

## Step 1 — Check for a pending prompt (fast path)

Call the MCP tool `read_pending_prompt`.

- If `exists: true` → the user just clicked "Send to Claude ↑" in the Live Designer.
  The `text` field contains their instruction + selected element summary. Read it, then
  call `read_ui_context` for the full structured context (elements, annotations, etc.)
  and proceed directly to Step 3.
- If `exists: false` → check for a fresh context (Step 1b).

### Step 1b — Check for fresh context

Call `read_ui_context`.

- If `exists: true` and `capturedAt` is within the **last 10 minutes** → proceed to Step 3.
- If `exists: false` or stale → proceed to Step 2.

---

## Step 2 — Ask the user to capture context

Tell the user:

> "I don't have a visual context snapshot yet. In the Mieruka **Live Designer** tab
> (`localhost:7777/live`), navigate to the element you want to change, click it to select
> it (Ctrl/Shift+click for multiple), optionally type your instruction in the bubble that
> appears, then click **Send to Claude ↑** or **Send ↑** in the bubble. I'll wait."

Do **not** attempt to locate or guess the element from source code alone. Wait for the
user to confirm they've sent the context.

---

## Step 3 — Interpret the context

From `read_ui_context`, use:

| Field | How to use it |
|---|---|
| `elements[]` | All selected elements — use each `domPath` to find components in source |
| `element` | Alias for `elements[0]` — kept for backward compatibility |
| `elements[i].domPath` | CSS selector path — use to find the component in source code |
| `elements[i].outerHTML` | Confirm you found the right DOM node in source |
| `elements[i].computedStyles` | Current visual state before your change (`color`, `fontSize`, etc.) |
| `elements[i].boundingBox` | Spatial dimensions — useful for layout reasoning |
| `elements[i].innerText` | Confirm the element's content matches what the user described |
| `annotations` | Circles/boxes the user drew — each has `tool`, `color`, `points`. Prioritize the annotated sub-region. |
| `instruction` | Plain-English instruction the user typed in the bubble (may be empty) |
| `sourceUrl` | The page URL the user was inspecting |

Use each `domPath` to search the source files (grep for tag + class names). Cross-reference
`outerHTML` to confirm the right component before editing.

If `instruction` is non-empty, use it as the primary intent. Otherwise infer from context
what the user wants to change.

---

## Step 4 — Make the targeted change

1. For each element in `elements[]`, find its source file using `domPath` (grep for the
   CSS classes or tag pattern).
2. Confirm by matching `outerHTML` snippet against the JSX/HTML.
3. Make the changes.
4. Call `clear_ui_context` to signal the context has been consumed. This also deletes
   `pending-prompt.md`.
5. Tell the user what files and lines you changed, and suggest they reload the Live Designer
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

- If `elements` has multiple entries, make all requested changes. Address them in the order
  listed unless the instruction specifies otherwise.
- If `annotations` is non-empty, the user has drawn marks. Treat those as spatial emphasis —
  they're indicating a sub-region of the selected element, not a different element.
- If `element` is null but `annotations` is non-empty, the user drew over a frozen screenshot
  without clicking an element. Use `frozenDomSnapshot` and `annotations` to reason spatially.
- Never call `push_ui_focus` with a selector you derived from source code. It may not match
  the live DOM. Only use `element.domPath` from `read_ui_context`.
- If the context is more than 10 minutes old, ask the user to re-capture rather than acting
  on stale data — the page may have changed.
