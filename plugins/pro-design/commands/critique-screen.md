---
description: Run all seven visual critiques on a screen and output a prioritised P1/P2/P3 fix list covering hierarchy, brand, composition, typography, colour, affordance, and information density.
argument-hint: '[screen name, URL, Figma frame, or screenshot - e.g. "onboarding step 2"]'
---

Run a full visual critique of the screen at `$ARGUMENTS` across hierarchy, brand, composition, typography, colour, affordance, and information density.
If `$ARGUMENTS` is empty, critique the screen or screenshot most recently shared in this session, and say which one you picked before starting.

Load the `screen-critique` skill first.
Each step below reads one of its `critique-<dimension>.md` sidecars, so load the sidecar named in the step before working that step.

## Steps

1. Visual hierarchy. Analyse entry point, eye flow, weight, and emphasis using the `critique-visual-hierarchy.md` sidecar.
2. Brand consistency. Check mood, voice, and token alignment using the `critique-brand-consistency.md` sidecar. This step needs the project's own `mood.md`, `voice.md`, and `tokens.md`; note any that are missing and skip that dimension rather than inventing brand rules.
3. Composition. Evaluate balance, whitespace, rhythm, and gestalt using the `critique-composition.md` sidecar.
4. Typography. Audit scale, readability, consistency, and token compliance using the `critique-typography.md` sidecar.
5. Colour. Audit contrast ratios, palette coherence, semantic colour use, and accessibility using the `critique-color.md` sidecar.
6. Affordance. Evaluate clickability signals, state visibility, CTA clarity, and action discoverability using the `critique-affordance.md` sidecar.
7. Information density. Assess cognitive load, content priority, scanning patterns, and progressive disclosure using the `critique-information-density.md` sidecar.
8. Prioritise. Collect every flagged issue from all seven critiques and rank them:
   - P1 Critical: breaks usability, accessibility, or brand compliance; fix before shipping.
   - P2 Important: degrades the experience or creates inconsistency; fix in the current sprint.
   - P3 Polish: minor visual refinement; address when capacity allows.

## Output

A single prioritised fix list grouped by priority level. Each item includes:

- Issue: what is wrong.
- Dimension: which critique area it belongs to (Hierarchy / Brand / Composition / Typography / Colour / Affordance / Density).
- Fix: the specific change required.

Conclude with a one-paragraph overall assessment noting the strongest and weakest dimension.

This command judges the screen; it does not change it.
Hand the fix list back rather than editing code, and let the user pick what to apply.

---

_Adapted from [Owl-Listener/designer-skills](https://github.com/Owl-Listener/designer-skills) - MIT License. See original repository for full license text._
