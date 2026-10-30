# Accessibility checklist

A WCAG 2.2 AA checklist for `accessibility-audit`, walked group by group: keyboard, screen readers, visual, forms and content.
Each failed check is a finding in the Issue Format with its WCAG criterion number.

## Table of contents

- [Essential checks](#essential-checks)
- [Common HTML patterns](#common-html-patterns)
- [Testing tools](#testing-tools)
- [ARIA live regions](#aria-live-regions)
- [Anti-patterns](#anti-patterns)

## Essential checks

### Keyboard

- [ ] All interactive elements are focusable with the Tab key (2.1.1)
- [ ] Focus order follows the visual and logical order (2.4.3)
- [ ] Focus is visible, with an outline or ring on focused elements (2.4.7)
- [ ] Focused elements are not hidden behind sticky headers, banners or modals (2.4.11 Focus Not Obscured (Minimum))
- [ ] Focus indicator has enough size and contrast (2.4.13 Focus Appearance, AAA, rate as Enhancement)
- [ ] Custom widgets have keyboard support (Enter to activate, Escape to close) (2.1.1)
- [ ] No keyboard traps; the user can always Tab away from a component (2.1.2)
- [ ] Skip-to-content link at the top of the page, visible at least on keyboard focus (2.4.1)
- [ ] Modals trap focus while open and return focus on close (2.4.3)
- [ ] Every drag interaction has a single-pointer alternative, such as buttons or a menu (2.5.7 Dragging Movements)

### Screen readers

- [ ] All images have `alt` text, or `alt=""` for decorative images (1.1.1)
- [ ] All form inputs have an associated label (`<label>` or `aria-label`) (1.3.1, 4.1.2)
- [ ] Buttons and links have descriptive text, not "Click here" (2.4.4)
- [ ] Icon-only buttons have `aria-label` (4.1.2)
- [ ] The page has one `<h1>` and headings do not skip levels (1.3.1)
- [ ] Dynamic content changes are announced with `aria-live` regions (4.1.3)
- [ ] Tables have `<th>` headers with scope (1.3.1)

### Visual

- [ ] Text contrast is at least 4.5:1 for normal text and at least 3:1 for large text (at least 24px regular or 18.66px bold) (1.4.3)
- [ ] UI components and graphics have contrast of at least 3:1 against the background (1.4.11)
- [ ] Color is not the only way to convey information (1.4.1)
- [ ] Text resizes to 200% without breaking the layout (1.4.4)
- [ ] No content flashes more than 3 times per second (2.3.1)
- [ ] Pointer targets are at least 24 by 24 CSS pixels, or have enough spacing (2.5.8 Target Size (Minimum))
- [ ] Touch targets are at least 44 by 44 px on mobile (2.5.5, AAA, rate as Enhancement)

### Forms

- [ ] Every input has a visible label (3.3.2)
- [ ] Required fields are indicated by more than color (1.4.1)
- [ ] Error messages are specific and associated with the field (3.3.1)
- [ ] The error state is visible by more than color, such as an icon, text or border (1.4.1)
- [ ] Submission errors are summarized and focusable (3.3.1)
- [ ] Known fields use autocomplete, for example `type="email" autocomplete="email"` (1.3.5)
- [ ] Information the user already gave in the same process is not asked for again (3.3.7 Redundant Entry)
- [ ] Login does not depend on a cognitive test; paste and password managers work (3.3.8 Accessible Authentication (Minimum))

### Content

- [ ] Language is declared, for example `<html lang="en">` (3.1.1)
- [ ] The page has a descriptive `<title>` (2.4.2)
- [ ] Links are distinguishable from surrounding text by more than color (1.4.1)
- [ ] Help links or contact options sit in the same place across pages (3.2.6 Consistent Help)
- [ ] Meaningful empty states, not blank screens (best practice, Enhancement)

## Common HTML patterns

### Buttons and links

```html
<!-- Use <button> for actions -->
<button onClick={handleDelete}>Delete Task</button>

<!-- Use <a> for navigation -->
<a href="/tasks/123">View Task</a>

<!-- Never use div or span as a button -->
<div onClick={handleDelete}>Delete</div>  <!-- BAD -->
```

### Form labels

```html
<!-- Explicit label association -->
<label for="email">Email address</label>
<input id="email" type="email" required />

<!-- Implicit wrapping -->
<label>
  Email address
  <input type="email" required />
</label>

<!-- Hidden label (a visible label is preferred) -->
<input type="search" aria-label="Search tasks" />
```

### ARIA roles

```html
<nav aria-label="Main navigation">...</nav>
<div role="status" aria-live="polite">Task saved</div>
<div role="alert">Error: Title is required</div>
<dialog aria-modal="true" aria-labelledby="dialog-title">
  <h2 id="dialog-title">Confirm Delete</h2>
</dialog>
<div role="status" aria-busy="true" aria-label="Loading tasks">...</div>
```

### Accessible lists

```html
<ul role="list" aria-label="Tasks">
  <li>
    <input type="checkbox" id="task-1" aria-label="Complete: Buy groceries" />
    <label for="task-1">Buy groceries</label>
  </li>
</ul>
```

## Testing tools

```bash
# Automated audit
npx --package=@axe-core/cli axe http://localhost:3000
npx pa11y             # CLI accessibility checker

# In the browser
# Chrome DevTools > Lighthouse > Accessibility
# Chrome DevTools > Elements > Accessibility tree

# Screen reader testing
# macOS: VoiceOver (Cmd + F5)
# Windows: NVDA (free) or JAWS
# Linux: Orca
```

Automated tools catch only part of the issues, so pair them with a keyboard pass and one screen reader.

## ARIA live regions

| Value | Behavior | Use for |
|-------|----------|---------|
| `aria-live="polite"` | Announced at the next pause | Status updates, saved confirmations |
| `aria-live="assertive"` | Announced immediately | Errors, time-sensitive alerts |
| `role="status"` | Same as `polite` | Status messages |
| `role="alert"` | Same as `assertive` | Error messages |

## Anti-patterns

| Anti-pattern | Problem | Fix |
|---|---|---|
| `div` as button | Not focusable, no keyboard support | Use `<button>` |
| Missing `alt` text | Images invisible to screen readers | Add descriptive `alt` |
| Color-only states | Invisible to color-blind users | Add icons, text or patterns |
| Autoplaying media | Disorienting, cannot be stopped | Add controls, do not autoplay |
| Custom dropdown with no ARIA | Unusable by keyboard or screen reader | Use native `<select>` or a proper ARIA listbox |
| Removing focus outlines | Users cannot see where they are | Style outlines, do not remove them |
| Empty links or buttons | Announced as "link" with no description | Add text or `aria-label` |
| `tabindex > 0` | Breaks natural tab order | Use `tabindex="0"` or `-1` only |

_Adapted from [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills) (`references/accessibility-checklist.md`) - MIT, Copyright (c) 2025 Addy Osmani. Lifted from WCAG 2.1 AA to 2.2 AA for this skill._
