---
name: clarifying-specs
description: Use after writing-feature-specs and before writing-plans to interrogate an existing spec for ambiguities. Asks up to 5 targeted clarification questions and writes answers back into the spec file.
---

# Clarifying Specs

## Overview

Read an existing feature specification, scan it systematically for ambiguities and gaps, then ask the author up to **5 targeted clarification questions** — one at a time. After each answer, update the spec file immediately. The result is a tighter, more testable spec that reduces downstream rework during planning and implementation.

**Announce at start:** "I'm using the clarifying-specs skill to interrogate the feature specification."

**This skill expects:** An existing spec file. If no spec exists, use `writing-feature-specs` first.

**This skill ends** when all critical ambiguities are resolved or the 5-question quota is reached. Next step: `writing-plans`.

---

## When to Use

- After `writing-feature-specs` produces a first draft
- Before handing a spec to `writing-plans`
- When a spec has been open for review and has unresolved comments
- When a specification uses vague adjectives, missing scope boundaries, or `[NEEDS CLARIFICATION]` markers

**Skip if:** The user explicitly says they're doing an exploratory spike — proceed but warn that rework risk increases.

---

## Process

### Step 1 — Load the Spec

Read the spec file. Ask the user for the path if not clear from context.

### Step 2 — Ambiguity Scan

Systematically check each category below. Mark status: **Clear** / **Partial** / **Missing**.

**Functional Scope & Behavior**
- Core user goals and success criteria
- Explicit out-of-scope declarations
- User roles / personas differentiation

**Domain & Data Model**
- Entities, attributes, relationships
- Identity and uniqueness rules
- Lifecycle / state transitions
- Data volume / scale assumptions

**Interaction & UX Flow**
- Critical user journeys / sequences
- Error, empty, and loading states
- Accessibility or localization requirements

**Non-Functional Quality Attributes**
- Performance (latency, throughput targets)
- Scalability (horizontal/vertical, limits)
- Reliability and availability (uptime, recovery expectations)
- Observability (logging, metrics, tracing signals)
- Security and privacy (auth, data protection, threat assumptions)
- Compliance / regulatory constraints

**Integration & External Dependencies**
- External services/APIs and their failure modes
- Data import/export formats
- Protocol / versioning assumptions

**Edge Cases & Failure Handling**
- Negative scenarios
- Rate limiting / throttling
- Conflict resolution (e.g., concurrent edits)

**Constraints & Tradeoffs**
- Technical constraints (language, storage, hosting)
- Explicit tradeoffs or rejected alternatives

**Terminology & Consistency**
- Canonical glossary terms
- Avoided synonyms / deprecated terms

**Completion Signals**
- Acceptance criteria testability
- Measurable Definition of Done indicators

**Placeholders**
- TODO markers / unresolved decisions
- Vague adjectives ("robust", "intuitive") lacking quantification

### Step 3 — Build Question Queue (internal)

From categories with Partial or Missing status, build a prioritized list of candidate questions. Select at most **5** by impact:

- Only include questions whose answers materially affect architecture, data modeling, UX behavior, security posture, or test design
- Prioritize: high impact × high uncertainty first
- Skip: questions already answered in the spec, stylistic preferences, implementation-phase details
- Skip: questions about data retention (use industry standard), default auth (OAuth2 for web), performance defaults (standard web targets)
- Do NOT reveal the full queue to the user

### Step 4 — Sequential Questioning (interactive)

Present exactly **one question at a time**.

**For multiple-choice questions:**

Analyze all options and identify the best one based on best practices, risk reduction, and alignment with project goals. Lead with your recommendation:

> **Recommended:** Option [X] — [1–2 sentence rationale]

Then render options as a table:

| Option | Description |
|--------|-------------|
| A | [Option A] |
| B | [Option B] |
| Short | Provide your own short answer (≤5 words) |

> "You can reply with the letter (e.g., "A"), say "yes" to accept the recommendation, or provide your own short answer."

**For open-ended questions:**

> **Suggested:** [Your proposed answer] — [brief rationale]
> Format: Short answer (≤5 words). Say "yes" to accept, or provide your own.

**After each answer:**
- If user says "yes", "recommended", or "suggested" — use your stated recommendation as the answer
- Record the answer in working memory immediately
- Do NOT advance to the next question until the current one is clearly resolved

**Stop asking when:**
- All critical ambiguities resolved (remaining questions would be low value)
- User signals completion ("done", "good", "no more", "proceed")
- You reach 5 asked questions

### Step 5 — Incremental Spec Updates (after EACH answer)

After each accepted answer, update the spec file immediately:

1. **Add a Clarifications section** (if not present) just after the spec header or first overview section:

   ```markdown
   ## Clarifications

   ### Session YYYY-MM-DD

   - Q: [question] → A: [answer]
   ```

2. **Apply the clarification to the relevant section:**
   - Functional ambiguity → update Functional Requirements
   - User roles / actors → update User Stories section
   - Data shape → update Key Entities / Data Model
   - Non-functional constraint → add/update measurable outcome in Success Criteria
   - Edge case → add bullet under Edge Cases
   - Terminology → normalize the term across the entire spec

3. **Replace stale text** — if the clarification makes an earlier statement wrong, replace it. Do not leave contradictory text.

4. **Save the spec file after each integration** — atomic overwrite, preserve all other sections.

**Keep insertions minimal and testable** — avoid narrative drift. One clear bullet per clarification.

### Step 6 — Validation (after each write and final pass)

- One bullet per accepted answer in Clarifications — no duplicates
- Total questions asked ≤ 5
- No lingering vague placeholders the answer was meant to resolve
- No contradictory earlier statements remain
- Terminology consistent across all updated sections
- Markdown structure valid; only new headings allowed: `## Clarifications`, `### Session YYYY-MM-DD`

---

## Completion Report

After the questioning loop ends, report to the user:

- Number of questions asked and answered
- Path to updated spec
- Sections touched
- Coverage summary:

| Category | Status |
|----------|--------|
| Functional Scope | Resolved / Clear / Deferred / Outstanding |
| Data Model | ... |
| [etc.] | ... |

- If **Outstanding** or **Deferred** categories remain: recommend whether to proceed to `writing-plans` now or run `clarifying-specs` again after initial planning reveals more constraints.

---

## Edge Cases

**No meaningful ambiguities found:** Report "No critical ambiguities detected. Spec appears ready for planning." Output a compact coverage summary with all categories Clear, then suggest proceeding.

**Spec file missing:** Instruct user to run `writing-feature-specs` first. Do not create a new spec here.

**Quota reached with high-impact unresolved areas:** Flag each under Deferred with a one-line rationale. These surface naturally during `writing-plans`.

**User terminates early** ("stop", "done", "proceed"): Respect immediately. Save any pending updates, then report.

---

## Handoff

After completion:

> "Spec updated at `<path>`. [N] clarifications recorded. Ready to proceed to `writing-plans` to create the implementation plan."

---

> Adapted from [github/spec-kit](https://github.com/github/spec-kit) `templates/commands/clarify.md`.
> Copyright GitHub, Inc. MIT License.
