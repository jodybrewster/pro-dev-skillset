---
name: motion
description: Framer Motion (motion library) for functional UI — state-driven animation, when to animate vs. when to cut, and implementation rules for product interfaces.
---

# Motion

Functional UI uses Framer Motion (`motion`) for animation. Animation is state-driven: things animate because state changed, not because a designer thought it would look cool.

GSAP is not used here — that's the marketing surface.

**Default to no animation.** A minimal product UI looks worse, not better, when everything moves. Add motion only where it does a job.

---

## When to animate

**State feedback** — something changed and the user needs to feel it.

```tsx
// Modal open/close
<AnimatePresence>
  {isOpen && (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  )}
</AnimatePresence>
```

```tsx
// Toast / notification appear
<motion.div
  initial={{ opacity: 0, y: 16 }}
  animate={{ opacity: 1, y: 0 }}
  exit={{ opacity: 0, y: -8 }}
  transition={{ duration: 0.18, ease: 'easeOut' }}
/>
```

```tsx
// Expand/collapse
<motion.div
  initial={false}
  animate={{ height: isOpen ? 'auto' : 0, opacity: isOpen ? 1 : 0 }}
  transition={{ duration: 0.2, ease: 'easeOut' }}
  style={{ overflow: 'hidden' }}
/>
```

**Spatial continuity** — something moved and the user needs to track it.

```tsx
// List reorder / item added / item removed
<Reorder.Group values={items} onReorder={setItems}>
  {items.map(item => (
    <Reorder.Item key={item.id} value={item} />
  ))}
</Reorder.Group>
```

```tsx
// Shared layout transition — item moves from list to detail
<motion.div layoutId={`card-${id}`}>
  <CardContent />
</motion.div>
```

**Single entrance on first load** — only if it genuinely earns it (hero content, empty state, onboarding step).

```tsx
<motion.div
  initial={{ opacity: 0, y: 12 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.25, ease: 'easeOut' }}
/>
```

---

## When NOT to animate

- Static layout, text, headings, cards just sitting there.
- Every element on the page — staggered-everything is the vibe-coded tell.
- Decorative motion with no meaning. If you can't name what it communicates, cut it.

---

## Rules

**Short and quiet.** 150–250ms, ease-out. Use consistent timing so the product doesn't feel schizophrenic.

```ts
const TRANSITION = { duration: 0.2, ease: 'easeOut' } as const
```

**Transform + opacity only.** Never animate layout properties (`width`, `height` via CSS, `padding`, `margin`, `top`, `left`). Use `transform` equivalents — `y`, `x`, `scale` — which stay on the compositor thread.

```tsx
// Good
initial={{ opacity: 0, y: 8 }}

// Bad — triggers layout
initial={{ opacity: 0, marginTop: 8 }}
```

**One thing moving at a time.** No competing animations. If two things need to animate, sequence them or pick the more important one.

---

## Installation

```bash
npm install motion
```

```tsx
import { motion, AnimatePresence } from 'motion/react'
```

`motion/react` is the React entry point for Framer Motion v11+. The package was renamed from `framer-motion` to `motion`. Both names resolve to the same library — use `motion` in new code.

---

## Reduced motion

Always respect `prefers-reduced-motion`. Wrap the transition, not the animation:

```tsx
import { useReducedMotion } from 'motion/react'

function FadeIn({ children }: { children: React.ReactNode }) {
  const reduce = useReducedMotion()
  return (
    <motion.div
      initial={{ opacity: 0, y: reduce ? 0 : 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduce ? 0 : 0.2, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  )
}
```

Or set it globally via `MotionConfig`:

```tsx
<MotionConfig reducedMotion="user">
  <App />
</MotionConfig>
```

`reducedMotion="user"` reads the OS preference automatically and disables animations for users who have requested it.

---

## AnimatePresence

Required for exit animations. Wrap the conditional render:

```tsx
<AnimatePresence mode="wait">
  {show && <motion.div key="panel" exit={{ opacity: 0 }} />}
</AnimatePresence>
```

- `mode="wait"` — outgoing element finishes before incoming starts. Use for route transitions or content swaps.
- `mode="popLayout"` — outgoing element is immediately removed from layout (popped), surrounding content reflows instantly while the element fades out. Use for list removal.
- Default (no mode) — incoming and outgoing overlap. Use for toasts, overlays.

---

## Relationship to motion-system

The `motion-system` skill defines the token vocabulary (duration scales, easing names, choreography rules). This skill governs when and how to use Framer Motion in code. They compose: pull timing values from your motion tokens, implement them here.

---

_Original skill for pro-dev-skillset (Jody Brewster). MIT License._
