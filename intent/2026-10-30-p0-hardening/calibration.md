Generated 2026-10-30 by calibrate.py --sweep against risk-classify.py at commit bb50b24.
Proposed values, all unchanged: files_medium 10, files_high 30, lines_medium 300, lines_high 1000, areas_medium 3, no_test_lines 50.

# Risk classifier calibration, PRs #60 to #89

Thresholds in use: files_medium=10, files_high=30, lines_medium=300, lines_high=1000, areas_medium=3, no_test_lines=50

| PR | Title | Tier | Signals | Files | Lines | Areas |
|---|---|---|---|---|---|---|
| 60 | fix(pro-quality): quiet validation hook - repo-only, nudge by default (0.10.0) | high | declared-risk, hook-scripts | 4 | 189 | 2 |
| 61 | docs(intent): quiet validation hook done and accepted | low | none | 0 | 0 | 0 |
| 62 | docs(intent): pro-dev simplify umbrella and intents B to F | low | none | 0 | 0 | 0 |
| 63 | feat(pro-ai-sdlc): /execute builds an approved plan in its own worktree (0.3.0) | low | none | 6 | 191 | 3 |
| 64 | docs(intent): umbrella item F done in PR 63 | low | none | 0 | 0 | 0 |
| 65 | feat(pro-core): one /pro-dev command for setup and updates (1.51.0) | high | areas, declared-risk, hook-scripts, legal-oss-licensing, size | 25 | 1989 | 11 |
| 66 | feat(pro-egm): goldfish review at /spec and /plan through EGM (1.52.0) | high | areas, declared-risk, size | 18 | 1572 | 7 |
| 67 | fix(pro-egm): follow EGM's review-loop skill file instead of calling it (1.52.1) | medium | areas | 8 | 80 | 4 |
| 68 | feat(pro-ship): Vercel deploy bridge, React and Vercel bridges, pinned guidelines lint (1.53.0) | medium | areas, legal-oss-licensing, size | 15 | 337 | 7 |
| 69 | fix(pro-core): swap-starter leaves disabled installs alone (1.53.1) | medium | declared-risk | 5 | 17 | 3 |
| 70 | feat(pro-core): per-plugin installers through pro-core (1.54.0) | medium | areas, size | 24 | 950 | 10 |
| 71 | feat(pro-speckit): GitHub spec-kit as an opt-in method, pinned uv-tool engine (1.55.0) | medium | areas, size | 12 | 968 | 6 |
| 72 | docs: spec methods compared on their own page | low | none | 0 | 0 | 0 |
| 73 | feat(pro-dev-starter): pro-pdd is the default, pro-ai-sdlc is opt-in (1.56.0) | medium | areas | 4 | 22 | 4 |
| 74 | docs: workflow lane diagram on the spec methods page | low | none | 0 | 0 | 0 |
| 75 | feat(evals): keyless routing gate in CI, behavioral and plugin evals (1.57.0) | high | areas, assertion-removed, declared-risk, security-ci-infra, size, workflows | 21 | 167 | 7 |
| 76 | fix(pro-quality): PR quality gate fires on gh pr create (0.11.1) | high | hook-scripts | 5 | 234 | 2 |
| 77 | feat(pro-execution, pro-quality): four discipline skills name what they cover (1.58.0) | medium | declared-risk, no-test-change | 7 | 64 | 3 |
| 78 | feat(evals): component coverage, a runner and evals for pro-ai-sdlc and pro-egm (1.59.0) | high | declared-risk, size | 39 | 2747 | 3 |
| 79 | fix(pro-ai-sdlc): commands load without every policy file; evals run in Docker (1.59.1) | medium | areas, size | 23 | 49 | 4 |
| 80 | docs: roadmap; pro-ship-scope dropped, specialist-agents parked, three intents marked done | low | none | 0 | 0 | 0 |
| 81 | constraint-floor: intent, spec, plan and ADR-0010 | high | declared-risk, hook-scripts, legal-oss-licensing, size | 9 | 935 | 3 |
| 82 | review-policy: intent, spec and plan | medium | declared-risk | 4 | 40 | 2 |
| 83 | code-reviewer: intent, spec and plan | low | none | 0 | 0 | 0 |
| 84 | pr-gate: intent and spec | low | none | 0 | 0 | 0 |
| 85 | risk-tiers: intent and spec | low | none | 0 | 0 | 0 |
| 86 | docs: ADR-0011 plugin layering by audience | low | none | 0 | 0 | 0 |
| 87 | code-reviewer: a fresh-context code-reviewer agent and the four-field handoff | high | declared-risk, hook-scripts, legal-oss-licensing | 8 | 179 | 3 |
| 88 | risk-tiers: risk classifier, approval tiers and a merge gate | high | declared-risk, hook-scripts, size | 10 | 1441 | 3 |
| 89 | pr-gate: pr-check, the gate stamp and a stamp hook on gh pr create | high | areas, declared-risk, hook-scripts, size | 17 | 1775 | 5 |

30 PRs: 11 low, 9 medium and 10 high.

## Sweep, one threshold at a time

| Threshold | Value | Tier-neutral range | First value outside it, PRs that move |
|---|---|---|---|
| files_medium | 10 | 6 and up | 5: #63 low to medium |
| files_high | 30 | 24 and up | 23: #70 medium to high |
| lines_medium | 300 | 191 and up | 190: #63 low to medium |
| lines_high | 1000 | 968 and up | 967: #71 medium to high |
| areas_medium | 3 | 3 to 3 | 2: #63 low to medium; 4: #67 medium to low, #73 medium to low |
| no_test_lines | 50 | 0 or less to 56 | 57: #77 medium to low |

## Reading the sweep

Each range is the run of whole-number values around the default that moves no PR's tier, with the other five thresholds at their defaults.
"And up" means no value above the default moved a PR in the values tried, which reach one past the largest figure observed.
"Or less" means the same downward to the lowest value tried.
`no_test_lines` counts source lines added in PRs that change no test file, which is why #77 (56 such lines) sets its upper end and not its 64 total lines.
`areas_medium` is the only constant the data pins to one value: 2 moves #63 up to medium and 4 moves #67 and #73 down to low.

Rows for Jody to judge: #78 (39 files, 2747 lines, declared low) is high on size alone and drops to medium only if both `files_high` and `lines_high` rise past it; #67 and #73 are medium on areas alone (small fixes across two plugins plus the marketplace file).
