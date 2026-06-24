---
name: gsap
description: Animate marketing and hero surfaces with GSAP — timelines, ScrollTrigger for scroll-driven animations, MotionPath, and React integration via useGSAP. GSAP is the right tool for expressive landing page and marketing animations. For product UI use the motion skill (Framer Motion) instead.
---

# gsap

GSAP (GreenSock Animation Platform) is the standard for complex, high-performance web animations on marketing and hero surfaces.
The `motion` skill (Framer Motion) handles product UI; GSAP handles the expressive, scroll-driven, and timeline-orchestrated animations that landing pages and marketing sites need.

## Installation

```bash
npm install gsap
```

For React:

```bash
npm install gsap @gsap/react
```

## Core API

### gsap.to / gsap.from / gsap.fromTo

```js
gsap.to('.hero-title', { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out' })
gsap.from('.card', { opacity: 0, scale: 0.95, duration: 0.4, stagger: 0.08 })
gsap.fromTo('.badge', { scale: 0 }, { scale: 1, duration: 0.5, ease: 'back.out(1.7)' })
```

### Timeline

Chain animations with precise control over sequencing and overlap:

```js
const tl = gsap.timeline({ defaults: { ease: 'power2.out', duration: 0.5 } })

tl.from('.hero-eyebrow', { opacity: 0, y: 12 })
  .from('.hero-title',   { opacity: 0, y: 20 }, '-=0.3')   // start 300ms before previous ends
  .from('.hero-body',    { opacity: 0, y: 16 }, '-=0.2')
  .from('.hero-cta',     { opacity: 0, scale: 0.9 }, '-=0.1')
```

Position parameter shorthands: `'-=0.3'` (overlap), `'+=0.5'` (gap), `'<'` (same start as previous), `'<0.2'` (200ms after previous starts).

## ScrollTrigger

Scroll-driven animations. Import and register once at app initialization:

```js
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)
```

### Scrub (parallax / progress-linked)

```js
gsap.to('.parallax-bg', {
  y: -200,
  ease: 'none',        // linear for scrub
  scrollTrigger: {
    trigger: '.hero',
    start: 'top top',  // [trigger position] [viewport position]
    end: 'bottom top',
    scrub: true,       // animation tracks scroll position
  },
})
```

### Snap (section-based scroll)

```js
gsap.to('.panels', {
  xPercent: -100 * (panels.length - 1),
  ease: 'none',
  scrollTrigger: {
    trigger: '.panels-container',
    pin: true,
    scrub: 1,
    snap: 1 / (panels.length - 1),
    end: () => '+=' + document.querySelector('.panels-container').offsetWidth,
  },
})
```

### On-enter trigger (reveal on scroll)

```js
gsap.from('.reveal', {
  opacity: 0,
  y: 40,
  duration: 0.7,
  stagger: 0.1,
  scrollTrigger: {
    trigger: '.reveal-section',
    start: 'top 80%',   // trigger fires when top of section hits 80% down the viewport
  },
})
```

## React integration with useGSAP

`useGSAP` is the official React hook — it handles cleanup automatically:

```tsx
import { useRef } from 'react'
import { useGSAP } from '@gsap/react'
import { gsap } from 'gsap'

gsap.registerPlugin(useGSAP)

function HeroSection() {
  const container = useRef(null)

  useGSAP(() => {
    // Selectors are scoped to `container` automatically
    gsap.from('.hero-title', { opacity: 0, y: 30, duration: 0.6 })
    gsap.from('.hero-body', { opacity: 0, y: 20, duration: 0.5, delay: 0.2 })
  }, { scope: container })

  return (
    <section ref={container}>
      <h1 className="hero-title">...</h1>
      <p className="hero-body">...</p>
    </section>
  )
}
```

Avoid creating GSAP animations directly in component bodies or useEffect without `useGSAP` — it won't clean up timelines or ScrollTriggers on unmount.

## Common eases

```
power1/2/3/4.out   — standard deceleration (power2.out is the everyday choice)
back.out(1.7)      — slight overshoot on entrance
elastic.out(1, 0.3)— springy, use sparingly
expo.out           — fast start, slow finish (for hero reveals)
none               — linear, required for scrub
```

## Performance

- Animate `transform` and `opacity` only — they stay on the compositor thread.
Never animate `width`, `height`, `top`, `left`, `margin`, or `padding`.
- Use `will-change: transform` on elements that animate, but only while animating (add/remove via JS).
- Call `ScrollTrigger.refresh()` after layout changes (e.g. after images load).
- On mobile, consider reducing or disabling heavy scroll animations: check `window.matchMedia('(prefers-reduced-motion: reduce)')`.

## MotionPath

Animate along an SVG path:

```js
import { MotionPathPlugin } from 'gsap/MotionPathPlugin'
gsap.registerPlugin(MotionPathPlugin)

gsap.to('.dot', {
  duration: 3,
  repeat: -1,
  ease: 'none',
  motionPath: {
    path: '#curve',
    align: '#curve',
    autoRotate: true,
    alignOrigin: [0.5, 0.5],
  },
})
```

## Choosing GSAP vs. Framer Motion

| | GSAP | Framer Motion (`motion` skill) |
|---|---|---|
| Marketing / hero / landing page | Yes | Possible but not idiomatic |
| Product UI state transitions | No | Yes |
| Scroll-driven scrub animations | ScrollTrigger | useScroll + useTransform |
| Timeline orchestration | Yes | useAnimate (`hyperframes` skill) |
| Shared layout transitions | No | layoutId |
| React integration | useGSAP | Native |

---

_Original skill for pro-dev-skillset (Jody Brewster). MIT License._
