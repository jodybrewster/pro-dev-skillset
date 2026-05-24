---
name: writing-feature-specs
description: Use when you need to turn a feature description into a structured PRD / feature specification before implementation planning begins. Produces user stories, acceptance criteria, functional requirements, and success criteria — not an implementation plan.
---

# Writing Feature Specs

## Overview

Transform a natural language feature description into a complete, structured feature specification. The output is a technology-agnostic PRD written for human reviewers — it defines WHAT and WHY, not HOW.

**Announce at start:** "I'm using the writing-feature-specs skill to create the feature specification."

**Save specs to:** `docs/specs/YYYY-MM-DD-<feature-name>-spec.md`
(User preferences for spec location override this default.)

**This skill ends** when the spec is written, reviewed, and saved. It does NOT produce an implementation plan. For that, use `writing-plans` next.

---

## Before You Begin

Read any existing project docs, recent commits, or context files. Understand the domain before generating requirements.

---

## The Spec Document Structure

Every feature spec MUST contain these sections (remove any that genuinely don't apply; never leave them as "N/A"):

### 1. Header

```markdown
# Feature Specification: [FEATURE NAME]

**Created**: [DATE]
**Status**: Draft | In Review | Approved
**Input**: [One-sentence summary of the originating request]
```

### 2. User Scenarios & Testing (mandatory)

User stories ordered by priority. Each story must be **independently testable** — if you implement only P1, you have a viable MVP.

For each story:
- **Given / When / Then** acceptance scenarios
- **Why this priority** — business value rationale
- **Independent Test** — how to validate it in isolation

Mark priorities P1 (most critical), P2, P3, etc. Limit to 3–5 stories for a well-scoped feature.

**Edge Cases:** What happens at boundary conditions or error scenarios? List them explicitly.

### 3. Functional Requirements (mandatory)

- `FR-001`: System MUST [specific capability]
- `FR-002`: Users MUST be able to [key interaction]
- Mark unclear requirements: `FR-003`: System MUST [X] `[NEEDS CLARIFICATION: specific question]`

Include **Key Entities** if the feature involves data: name, key attributes, relationships (no implementation detail).

### 4. Success Criteria (mandatory)

Measurable, technology-agnostic outcomes:
- `SC-001`: [Metric — time, percentage, volume, satisfaction rate]
- `SC-002`: ...

Good: "Users can complete checkout in under 3 minutes."
Bad: "API latency under 200ms" (implementation detail).

### 5. Assumptions

Record reasonable defaults chosen when the description didn't specify:
- Target users / personas
- Scope boundaries (what's explicitly out of scope for v1)
- Dependencies on existing systems

---

## Generation Process

Given the feature description (`$ARGUMENTS`):

1. **Extract key concepts** — actors, actions, data, constraints

2. **Fill in with informed defaults** — use industry standards and common patterns for anything unspecified. Document defaults in Assumptions.

3. **Mark critical ambiguities only** — use `[NEEDS CLARIFICATION: specific question]` sparingly:
   - Maximum **3** markers total
   - Only for decisions that significantly impact scope, security, or user experience
   - Only when no reasonable default exists
   - Prioritize: scope > security/privacy > UX > technical details
   - Do NOT ask about: data retention (use industry standard), performance targets (use web defaults), auth method (use OAuth2 for web apps), error handling (use friendly messages)

4. **Write User Scenarios first** — they anchor every requirement

5. **Derive Functional Requirements** from the scenarios — each must be testable

6. **Define Success Criteria** — measurable, stakeholder-language, no tech stack

7. **Record Assumptions** — capture every default choice made

---

## Handling NEEDS CLARIFICATION Markers

If the spec contains `[NEEDS CLARIFICATION]` markers, present them to the user as structured questions BEFORE saving:

For each question (max 3), use this format:

```markdown
## Question [N]: [Topic]

**Context**: [Quote the relevant spec section]

**What we need to know**: [The specific question]

**Suggested Answers**:

| Option | Answer | Implications |
|--------|--------|--------------|
| A      | [First option] | [What this means for the feature] |
| B      | [Second option] | [What this means for the feature] |
| Custom | Provide your own answer | — |

**Your choice**: _[Wait for user response]_
```

Present all questions together. Wait for user responses. Then update the spec, replacing each marker with the resolved answer. Re-run quality check after.

---

## Quality Checklist (run before saving)

After drafting the spec, validate against each item. Fix inline — do not re-review after fixing:

**Content Quality**
- [ ] No implementation details (no languages, frameworks, APIs, database names)
- [ ] Focused on user value and business needs
- [ ] Readable by a non-technical stakeholder

**Requirement Completeness**
- [ ] No unresolved `[NEEDS CLARIFICATION]` markers
- [ ] Every requirement is testable and unambiguous
- [ ] Success criteria are measurable and technology-agnostic
- [ ] All acceptance scenarios are defined
- [ ] Edge cases identified
- [ ] Scope clearly bounded (what's in and out)
- [ ] Assumptions documented

**Feature Readiness**
- [ ] All functional requirements have clear acceptance criteria
- [ ] User scenarios cover the primary flows
- [ ] No speculative "nice to have" features without a user story

---

## Writing Style Rules

- Write for business stakeholders, not developers
- Use precise language: "Users MUST be able to X" not "the system should support X somehow"
- Avoid vague adjectives ("robust", "intuitive", "fast") — quantify them or remove them
- One requirement per line — never combine two requirements in one bullet
- Success criteria must include a number or rate: time, percentage, count, ratio

---

## Self-Review

After writing the complete spec, check it with fresh eyes:

1. **Placeholder scan** — any "TBD", "TODO", or vague sections? Fix them.
2. **Implementation leak check** — any mention of frameworks, databases, or code structure? Remove them.
3. **Testability check** — can you write a test for every acceptance scenario without knowing the implementation? If not, the scenario needs more precision.
4. **Scope check** — is this one cohesive feature, or multiple independent subsystems that each deserve their own spec?

---

## Handoff

After saving, confirm with the user:

> "Feature spec written to `<path>`. Please review it — let me know if anything needs adjusting. When you're ready, use the `writing-plans` skill to create the implementation plan, or `clarifying-specs` to interrogate the spec further before planning."

---

> Adapted from [github/spec-kit](https://github.com/github/spec-kit) `templates/commands/specify.md` and `templates/spec-template.md`.
> Copyright GitHub, Inc. MIT License.
