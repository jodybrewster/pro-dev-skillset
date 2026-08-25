---
name: perception-laws
description: Apply the Gestalt perception laws (proximity, similarity, closure, continuity, common region, figure-ground) plus the Von Restorff effect and visual hierarchy to a layout, so grouping, emphasis, and depth read the way the eye actually sees. Use when asked to apply grouping principles or perception laws, when grouping reads wrong or users misread which items belong together, when you need to decide which element should stand out, or when you want the eye to land in an intended order. For judging a screen rather than fixing it use screen-critique; for concrete spacing, alignment, and density fixes use better-layout; for a type scale use typography-scale.
---

# Perception Laws

How the eye groups, separates, and ranks what it sees. These are the rules a screen is already being judged by, whether or not anyone designed to them, and applying them is usually what turns a layout that works into one that feels refined.

Each law has its own sidecar with the principle, its applications, and its failure modes.

## The laws

- [law-of-proximity.md](law-of-proximity.md) - spatial closeness groups elements more strongly than any other cue. Reach for it when spacing alone has to carry the grouping.
- [law-of-common-region.md](law-of-common-region.md) - a shared container, background, or border groups elements regardless of spacing. Reach for it when the grouping has to survive a tight layout.
- [law-of-similarity.md](law-of-similarity.md) - shared colour, shape, or size signals that elements belong to one category. Reach for it when a relationship has to hold across distance.
- [law-of-continuity.md](law-of-continuity.md) - the eye follows alignment and unbroken paths. Reach for it when sequencing steps, aligning content, or designing carousels and timelines.
- [law-of-closure.md](law-of-closure.md) - the eye completes implied shapes from partial forms. Reach for it when dropping borders or letting negative space suggest structure.
- [law-of-figure-ground.md](law-of-figure-ground.md) - which layer reads as foreground and actionable versus background and context. Reach for it when designing modals, overlays, elevation, and depth.
- [von-restorff-effect.md](von-restorff-effect.md) - the element that differs from its neighbours is the one noticed and remembered. Reach for it when a single action has to dominate.
- [visual-hierarchy.md](visual-hierarchy.md) - size, weight, colour, spacing, and position set the order the eye lands in. Reach for it when composing new work or when nothing on a screen reads as first.

## How to apply them

Name the problem before picking a law. Grouping problems (the wrong things read as belonging together) point at proximity, common region, or similarity. Sequence and flow problems point at continuity. Emphasis problems (nothing stands out, or everything does) point at Von Restorff and visual hierarchy. Depth and layering problems point at figure-ground. Visual-weight problems, where the structure is right but heavy, point at closure.

Pick the one or two laws that address the problem and load only those sidecars. Loading all eight for a single grouping question buries the answer.

Apply the fix, then re-check by squinting at the layout until the detail blurs out. The groups, the reading order, and the single most important element should still be legible when the content is unreadable. If they are not, the law you applied is not the one that was broken.

Two laws can pull against each other: elements close together but styled differently, or a container fighting the spacing inside it. When that happens, decide which signal you want to win and remove the other rather than strengthening both.

---

_Forked from [Owl-Listener/designer-skills](https://github.com/Owl-Listener/designer-skills) - MIT License. See original repository for full license text._
