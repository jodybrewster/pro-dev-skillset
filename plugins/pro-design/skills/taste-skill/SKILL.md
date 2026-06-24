---
name: taste-skill
description: Run a targeted visual polish pass on an existing UI — spacing rhythm, alignment, color nuance, type hierarchy, interactive states, micro-interactions. Use when the UI is functionally complete but needs to feel more considered and intentional. Scoped to a surface or component tree, not a full redesign. For a comprehensive end-to-end pass use impeccable-bridge instead.
---

# taste-skill

Polish is what separates UI that works from UI that feels considered.
This skill runs a focused, opinionated pass over an existing surface — not a redesign, just the disciplined last mile of craft.

## When to use

- The feature is done but the UI feels rough or hasty
- Spacing feels inconsistent or cramped
- Colors or shadows look slightly off
- Interactive states (hover, focus, active, disabled) are missing or weak
- Typography hierarchy isn't landing
- Animations feel generic or too fast/slow

Use `impeccable-bridge` instead when the ask is a full redesign, a bolder aesthetic direction, or a structural layout overhaul.

## The pass

Work through these in order. Each is a distinct read — don't try to catch everything at once.

### 1. Spacing and rhythm

- Does the layout use the spacing scale consistently? (No magic numbers.)
- Are related elements closer together than unrelated ones? (Proximity principle.)
- Does the page have a clear vertical rhythm?
- Are there overcrowded sections or wasteful empty sections?

### 2. Alignment and grid

- Do elements align to an implicit grid?
- Are left edges consistent across sections?
- Is text aligned correctly relative to its container and surrounding elements?

### 3. Color and contrast

- Does text meet WCAG AA contrast ratios? (4.5:1 for body, 3:1 for large text.)
- Are color roles consistent? (Brand color not overused; neutrals doing their job.)
- Do interactive elements feel distinct from static ones?
- Are disabled states clearly muted without being invisible?

### 4. Type hierarchy

- Is there a clear visual difference between heading levels?
- Is body copy size, weight, and line-height comfortable to read?
- Are UI labels (buttons, form labels, table headers) correctly sized and weighted?
- Is tracking (letter-spacing) used only where it earns its place?

### 5. Border, radius, and shadow

- Are border radii consistent with the project's scale?
- Are shadows used sparingly and at the right elevation (cards vs. modals vs. dropdowns)?
- Do borders add structure or just visual noise?

### 6. Interactive states

Every interactive element needs all four states: default, hover, active (pressed), focus, disabled.

- Hover: subtle — color shift, slight shadow, cursor change
- Focus: visible ring, not the browser default unless it's already good
- Active: momentary feedback (scale down slightly, darken)
- Disabled: clearly muted, `pointer-events: none`, no hover state

### 7. Micro-interaction timing

- Are transitions 150–250ms with ease-out? Anything faster feels broken; anything slower feels sluggish.
- Do things that appear use a gentle fade-in or slide-in? Do things that disappear exit quickly?
- Are there any jarring jumps (no transition where one is expected)?

### 8. Edge cases and empty states

- What does this look like with no data? An empty state is still UI.
- What does it look like with one item? With fifty items?
- What does it look like with a very long string? Does text truncate or wrap correctly?

## Reporting

List each finding as:
- **What**: the specific element or section
- **Issue**: what's off
- **Fix**: the concrete change (token value, CSS property, behavior)

Fix as you go when the change is unambiguous. Flag as a question when there's a design decision embedded in it.

---

_Original skill for pro-dev-skillset (Jody Brewster). MIT License._
