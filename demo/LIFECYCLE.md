# How this POC was built — the lifecycle trail

This page wasn't hand-waved into existence; it was built by walking the same
`using-pro-dev` lifecycle the marketplace ships. This is the dogfood record.

## Define → *interview-me / idea-refine* (pro-pdd)

**Decision:** the demo would be a **marketing landing page** (design-forward,
no database) and its subject would be **`pro-dev-skillset` itself** — the most
concrete, useful, repurposable POC. Audience: a developer evaluating whether to
install the marketplace. The page must answer "what is this and why" in one
scroll and end on an install CTA.

## Plan → *writing-plans* (pro-pdd) / pure planning mode

**Approach:** Next.js 15 App Router + Tailwind, statically prerendered (`output:
static`-friendly, zero runtime data). Content modeled as data in
`components/data.ts` so copy is editable and **testable** in one place. Sections:
hero · lifecycle · plugins · bridges · use-cases · install · footer.

## Build → *frontend-ui-engineering + pro-design skills*

- **Design tokens** (`app/globals.css`): space-separated RGB channels so Tailwind
  `<alpha-value>` works; a calm dark theme with a violet→cyan accent.
- **Type scale & spacing** via Tailwind utilities; `max-w-content` rhythm.
- **Motion** (`components/Reveal.tsx`): IntersectionObserver fade-up, gated by
  `prefers-reduced-motion` in CSS.
- **Accessibility**: semantic landmarks, a skip-to-content link, visible focus
  rings, `aria-hidden` on decorative elements, contrast-checked muted text.

## Verify → *vitest* (pro-testing) + *verification-before-completion* (pro-quality)

- `app/__tests__/data.test.ts` — content invariants (all 8 phases present, every
  bridge has an install command, install steps add the marketplace then the
  starter).
- `app/__tests__/page.test.tsx` — render smoke (hero headline, install commands,
  all phases visible).
- `npm run build` — compiles and prerenders to static HTML.
- The marketplace's own `tests/check.mjs` stays green throughout.

## Review → */code-review*, */simplify* (pro-quality)

Left as the live exercise: run `/code-review` on the diff and `/simplify` on
`app/page.tsx` to see the Review phase act on this code.

## Ship → pro-ship (planned)

The Ship phase is a planned plugin. For now: `npm run build` produces the static
bundle; deploy is a manual step. When `pro-ship` lands, this is where
`shipping-and-launch` + `ci-cd-and-automation` would take over.
