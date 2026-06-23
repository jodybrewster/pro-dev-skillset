---
name: stitch-skill
description: Create or update a DESIGN.MD file — the project's canonical design-system reference capturing tokens, component patterns, typography, color decisions, motion spec, and open questions. Use when starting a new project's design foundation, after a major visual update, or before handing off to another developer or AI session.
---

# stitch-skill

A DESIGN.md is the single source of truth for how a project looks and feels.
It saves context across sessions and tells any AI or developer "here's the visual language of this project." The `impeccable` engine reads it as project context before any design pass.

## When to create or update

- Starting a new project and establishing the design foundation
- After a design sprint that introduced new tokens, components, or patterns
- Before handoff to another developer or AI session
- When `impeccable-bridge` loads DESIGN.md as its project context

## Process

1. **Read the codebase first.** Check `tailwind.config.*`, CSS variables in `globals.css` / `theme.css`, token files, and a representative set of components.
Don't invent values — capture what's actually there.
2. **Check for an existing DESIGN.md.** If one exists, update it rather than overwrite.
Preserve intentional decisions; update stale values.
3. **Write concisely.** This is a reference document, not a narrative.
Tables and token lists over paragraphs.
4. **Flag gaps explicitly.** If a token isn't defined, say so — that's signal, not noise.

## What to capture

### 1. Product overview

- What is this? Who uses it?
- Register: product UI (functional, quiet) vs. marketing surface (expressive, bold)
- Key brand adjectives (3–5 words)

### 2. Design tokens

Read live values from the codebase. Format:

```
Color
  Background:      #... (or CSS var)
  Surface:         #...
  Text primary:    #...
  Text secondary:  #...
  Brand:           #...
  Accent:          #...

Spacing
  Base unit:  4px or 8px
  Scale:      xs=4 sm=8 md=16 lg=24 xl=32 2xl=48

Typography
  Font family:  ...
  Size scale:   xs=12 sm=14 base=16 lg=18 xl=20 2xl=24 3xl=30
  Weights:      normal=400 medium=500 semibold=600 bold=700

Border radius
  sm: 4px   md: 8px   lg: 12px   xl: 16px   full: 9999px

Motion
  Duration:  fast=150ms base=200ms slow=300ms
  Easing:    ease-out (default)
```

### 3. Component catalog

For each key component: purpose, variant list, props that matter, usage notes.

### 4. Typography decisions

- Heading hierarchy (H1–H4 scale, weight, tracking)
- Body copy (line height, max-width for readability)
- UI labels (size, weight, case)
- Code blocks (font, size)

### 5. Color decisions

- Primary surface color and why
- Brand color usage rules (where it's allowed, where it isn't)
- Dark mode delta (if applicable)

### 6. Motion spec

- Default transition (duration + easing)
- What animates vs. what cuts
- Scroll-linked patterns (if any)

### 7. Open questions

Things not yet decided.
Flag them so they don't get silently resolved wrong.

---

_Original skill for pro-dev-skillset (Jody Brewster). MIT License._
