---
name: hyperframes
description: Compose complex multi-step animation sequences with Framer Motion — orchestrated variants, imperative useAnimate sequences, scroll-linked animations with useScroll/useTransform, shared layout transitions with layoutId, and gesture choreography. Use when the basic motion skill patterns aren't enough and you need fine-grained animation control.
---

# hyperframes

For basic state-driven UI animations, use the `motion` skill.
This skill covers the advanced Framer Motion patterns: orchestration, imperatives, scroll, layout, and gesture composition.

## Variants and orchestration

Variants let you coordinate multiple children from a parent:

```tsx
import { motion } from 'motion/react'

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,      // each child starts 80ms after the previous
      delayChildren: 0.2,         // wait 200ms before starting any children
    },
  },
}

const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.25, ease: 'easeOut' } },
}

<motion.ul variants={container} initial="hidden" animate="show">
  {items.map(i => (
    <motion.li key={i} variants={item}>{i}</motion.li>
  ))}
</motion.ul>
```

Children automatically inherit the parent's `initial`/`animate` — no need to repeat them.

### when

Control whether the parent animates before or after its children:

```tsx
transition: {
  when: 'beforeChildren',  // parent finishes, then children start
  // or 'afterChildren'    // children finish, then parent animates
}
```

## Imperative sequences with useAnimate

When you need precise ordering that variants can't express:

```tsx
import { useAnimate } from 'motion/react'

function Component() {
  const [scope, animate] = useAnimate()

  async function runSequence() {
    await animate('.step-1', { opacity: 1, y: 0 }, { duration: 0.3 })
    await animate('.step-2', { opacity: 1, x: 0 }, { duration: 0.2 })
    animate('.step-1', { scale: 1.05 }, { duration: 0.15 })  // no await = fire-and-forget
    await animate('.step-1', { scale: 1 }, { duration: 0.15 })
  }

  return (
    <div ref={scope}>
      <div className="step-1" style={{ opacity: 0, y: 20 }}>First</div>
      <div className="step-2" style={{ opacity: 0, x: -20 }}>Second</div>
      <button onClick={runSequence}>Go</button>
    </div>
  )
}
```

`animate()` returns a promise — `await` it to sequence; omit `await` to run in parallel.

## Scroll-linked animations

```tsx
import { useScroll, useTransform, motion } from 'motion/react'

function ParallaxHero() {
  const { scrollYProgress } = useScroll()

  // Map scroll 0→1 to y 0→-100px
  const y = useTransform(scrollYProgress, [0, 1], [0, -100])
  const opacity = useTransform(scrollYProgress, [0, 0.3], [1, 0])

  return (
    <motion.div style={{ y, opacity }}>
      <HeroContent />
    </motion.div>
  )
}
```

### Scroll within a container

```tsx
const ref = useRef(null)
const { scrollYProgress } = useScroll({
  target: ref,
  offset: ['start end', 'end start'],  // [when target enters viewport, when it leaves]
})
```

### useSpring for smooth scroll animations

Raw `useTransform` output can feel mechanical. Wrap it in `useSpring` for a trailing feel:

```tsx
import { useSpring } from 'motion/react'

const smoothY = useSpring(y, { stiffness: 100, damping: 30 })
```

## Shared layout transitions with layoutId

Animate an element between two positions in the DOM by giving both the same `layoutId`:

```tsx
// List item expands into a modal
function Card({ id, isOpen, onClick }) {
  return (
    <motion.div layoutId={`card-${id}`} onClick={onClick}>
      <motion.h2 layoutId={`title-${id}`}>{title}</motion.h2>
      {isOpen && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }}>Details...</motion.p>}
    </motion.div>
  )
}
```

Framer Motion handles the interpolation between the two DOM positions automatically.
The component itself doesn't move — FLIP does.

### AnimatePresence + layoutId

Always wrap layoutId transitions in `AnimatePresence` when elements enter/leave the DOM:

```tsx
<AnimatePresence>
  {isOpen && <motion.div layoutId="modal">...</motion.div>}
</AnimatePresence>
```

## Gesture choreography

Compose drag + layout + presence:

```tsx
<Reorder.Group axis="y" values={items} onReorder={setItems}>
  <AnimatePresence>
    {items.map(item => (
      <Reorder.Item
        key={item.id}
        value={item}
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: 'auto' }}
        exit={{ opacity: 0, height: 0 }}
      />
    ))}
  </AnimatePresence>
</Reorder.Group>
```

### Drag constraints

```tsx
<motion.div
  drag
  dragConstraints={{ left: -100, right: 100, top: 0, bottom: 0 }}
  dragElastic={0.1}        // 0 = rigid, 1 = full elastic
  dragMomentum={false}     // disable momentum if you want precise snapping
/>
```

## MotionConfig for global settings

Set defaults for all motion elements in a subtree:

```tsx
import { MotionConfig } from 'motion/react'

<MotionConfig transition={{ duration: 0.2, ease: 'easeOut' }} reducedMotion="user">
  <App />
</MotionConfig>
```

`reducedMotion="user"` automatically disables animations based on the OS preference.

## Relationship to the motion skill

The `motion` skill covers when to animate and the basic implementation patterns.
This skill takes over when you need multi-element orchestration, imperative control, scroll-linked behaviour, or layout transitions.
They compose: use `motion` for the rules, use `hyperframes` for the execution.

---

_Original skill for pro-dev-skillset (Jody Brewster). MIT License._
