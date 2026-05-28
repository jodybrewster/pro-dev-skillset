# Mieruka Lifecycle Notes

## Core Idea

Mieruka is a Storybook-like app that installs directly into a user's git repo as a `.mieruka/` directory — the same way Storybook installs as `.storybook/`. It is a local, in-repo product/design/prototyping surface focused on research-backed UI exploration before implementation.

This repo (`pro-dev-skillset`) is a separate, independent set of Claude Code skills. A user installs the skills from this repo into their Claude Code setup and installs Mieruka into the repo they are actually building. The two systems are independent by design: the skills work without Mieruka and Mieruka works without the skills.

When both are installed in the same working repo, they become symbiotic. Skills can communicate with Mieruka through MCP tools exposed by the Mieruka MCP server, or through file changes written to the `.mieruka/` directory that the Mieruka app observes.

- Skills orchestrate discovery, definition, prototyping, build, validation, and shipping.
- Mieruka stores product context, prototype state, references, screen maps, and implementation drift reports inside `.mieruka/` in the user's repo.
- MCP tools provide the interface between agents and Mieruka, Storybook, browser tools, search, and optional external design tools.

External tools such as Figma, Webflow, and Magicpath can be used through MCP adapters, but Mieruka should be the primary local workspace when available.

## How pro-dev-skillset Connects to Mieruka

`pro-dev-skillset` is experimenting with three upstream workflow frameworks to serve two distinct use cases, and Mieruka is the client-facing surface for both.

**Use case 1: Solo developer building a full application.**
A single developer uses GStack's (`pro-gstack`) persona-driven planning and review workflows alongside Superpowers' (`pro-core`, `pro-quality`) brainstorming, TDD, and debugging skills. GStack handles structured thinking — office hours, CEO/engineering/design review, QA, ship readiness. Superpowers handles execution. Together they give one person the planning and quality leverage of a small team. Mieruka receives workstream updates from these skills and can show the developer a live dashboard of phase, risk, decisions, and drift without them having to read artifacts manually.

**Use case 2: Consulting team delivering for a client.**
A team of consultants uses SPDD's (`pro-spdd`) spec-driven workflow — story decomposition, REASONS canvas, analysis, and prompt-driven generation — to align a client on what is being built before implementation starts. Skills write stories, specs, and canvas artifacts into `.mieruka/` or push updates via Mieruka MCP tools. Mieruka then surfaces these to the client as readable governance: saved stories, approved specs, REASONS canvases, approval gates, and daily progress summaries. The client sees structured evidence of progress without needing to read code or talk to Claude directly.

**The three frameworks are opt-in.** `pro-spdd` and `pro-gstack` are separate plugins. The default skill stack works without them. Mieruka's role as a client-facing surface applies to either approach — it observes `.mieruka/` file changes and MCP calls regardless of which framework drove them.

## Mieruka App

Mieruka should be more than a prototype editor. If it lives beside the app like Storybook and can observe agent work, it can become a live governance and observability surface for clients, designers, strategists, and developers.

The product should provide governance through traceability and evidence, not bureaucracy.

### Client-Facing Governance Surfaces

#### Workstream Dashboard

A dashboard for every active initiative:

```text
Name
Phase
Owner or agent
Risk
Last update
Next action
Open decisions
Approval needed
Ship readiness
```

This answers: "Where is everything?"

#### Decision Register

A durable log of product, design, and technical decisions:

```text
Decision
Reason
Alternatives considered
Impact
Who or what approved it
Linked story/spec/prototype/PR
Date
```

This answers: "Why did this change?"

#### Approval Gates

Approval should happen at meaningful transitions, not for every edit:

```text
Discover -> Define
Define -> Prototype
Prototype -> Build
Validate -> Ship
```

Each gate should show:

```text
What changed
What evidence exists
What risks remain
What happens if approved
```

#### Evidence Board

A client-readable proof panel:

```text
Acceptance criteria
Test runs
Screenshots
Prototype comparisons
Accessibility checks
Visual drift checks
Review findings
Known issues
```

This answers: "How do we know it works?"

#### Scope Ledger

A living scope view:

```text
In scope
Out of scope
Added
Deferred
Removed
Changed since last approval
```

This prevents "I thought we were building X" confusion.

#### Risk Register

Keep risk tracking practical:

```text
Risk
Likelihood
Impact
Mitigation
Owner
Status
```

Example risks:

- Prototype depends on untested MCP screenshot capture.
- Collection permissions are deferred and may affect team rollout.
- Visual drift is acceptable on desktop but needs mobile review.

#### Change Diff

Show diffs between versions of story, spec, prototype, or plan:

```text
Spec v2 changed:
- Added multi-select tagging
- Removed nested collections
- Changed success metric from 60 seconds to 30 seconds
```

This gives clients understandable change control without freezing the process.

#### Traceability Map

Show the path from idea to shipped code:

```text
Idea
  -> Story
    -> Spec requirement
      -> Prototype screen
        -> Plan task
          -> Commit / PR
            -> Test / verification
              -> Release
```

This is the audit trail.

#### Prototype-To-Build Drift Report

Since Mieruka is visual, this should be a core feature:

```text
Screen: Moodboard editor
Status: Acceptable drift
Differences:
- Sidebar width +16px
- Button label changed
- Empty-state illustration omitted
Decision: Approved by client on 2026-05-26
```

This gives designers and clients confidence that implementation did not silently wander away from intent.

#### Agent Activity Timeline

Clients should not see raw logs by default. They need summarized observability:

```text
10:12 Research Lead created 3 story options
10:31 Client approved Story 2
11:04 Prototype Lead generated first screen set
11:28 Design review requested sidebar changes
12:15 Implementation agent updated collection model
12:43 Verification passed 18/20 checks
```

Technical users can drill down when needed.

#### Open Questions / Decisions Needed

A dedicated client-action surface:

```text
Needs decision:
- Should references belong to multiple collections?
- Is mobile v1 required?
- Is Webflow export in scope?
```

This keeps work moving.

#### Readiness Checklist

Avoid fake scores. Use checklist rollups:

```text
Story approved: yes
Spec stable enough: yes
Prototype approved: yes
Plan exists: yes
Tests pass: yes
Visual drift accepted: pending
Known blockers: none
Ship ready: no
```

#### Budget And Effort Burn

If agent work is hourly or overnight, track:

```text
Agent hours
Tool/API spend
Human review time
Iterations by phase
Rework caused by spec/prototype drift
```

This is governance clients and executives understand.

#### Compliance And Security Panel

For serious clients or regulated work:

```text
Secrets scan
Dependency audit
Auth/privacy review
Accessibility review
Data handling notes
PII touched?
External APIs used?
```

Surface this when relevant rather than making every workstream carry the weight.

#### Release Record

For every shipped feature:

```text
What shipped
Why it shipped
What changed since approval
Verification evidence
Known limitations
Rollback plan
Follow-up items
```

### Audience Modes

Mieruka should expose different levels of detail:

```text
Executive View:
Status, risks, approvals, readiness

Product View:
Stories, scope, decisions, prototype, open questions

Engineering View:
Plan, commits, tests, drift, MCP/tool logs
```

This keeps governance useful without forcing every audience into the same process view.

## Public Lifecycle

Expose a simple lifecycle to humans:

```text
Discover -> Define -> Prototype -> Build -> Validate -> Ship
```

Do not expose every internal agent artifact as a product phase. Clients need governance and confidence. Designers and strategists need room to explore. Developers need enough structure to know where code can go.

Internal mapping:

```text
Discover = idea + user stories + optional research
Define = spec
Prototype = Mieruka prototype + prototype handoff
Build = plan + implementation
Validate = verification + review
Ship = release + optional lessons
```

The discovery side is intentionally loose:

```text
idea -> user stories/research -> spec/prototype -> plan
```

More explicitly:

```text
idea -> (user stories <-> research) -> (spec <-> prototype) -> plan
```

The delivery side is stricter:

```text
plan -> build -> verify -> review -> build/verify/review refinement -> ship
```

Small changes can skip optional research or prototype work:

```text
idea -> user stories -> spec -> plan
```

or:

```text
spec -> plan
```

For user-facing UI work, prototype should be expected unless the change is trivial.

## What Governance Means Here

Governance should not mean frozen PRDs or heavyweight ceremony. Agentic development makes building cheaper and faster, so the main risk is not cost of iteration. The risk is rapid drift: agents producing incoherent, unreviewable, or misaligned work.

Governance means lightweight traceability:

- What are we trying to build or learn?
- What is the current source of truth?
- Why did the direction change?
- What evidence says this works?
- What is approved to ship?

Govern transitions, not keystrokes.

The key gates are:

- **Coherence gate:** is the story/spec coherent enough to try?
- **Drift gate:** did build/prototype/review change intent, and was the artifact updated?
- **Ship gate:** does the implementation satisfy the current spec, prototype, verification, and known tradeoffs?

Specs, prototypes, and plans are living artifacts. They do not freeze reality. If reality changes:

```text
product intent changed -> update spec/prototype -> update plan -> build
implementation path changed only -> update plan -> build
```

## Workstream Folder

Use one folder per workstream or feature. Humans think in workstreams, not artifact categories.

```text
.mieruka/workstreams/YYYY-MM-DD-feature-slug/
  status.json
  story.md
  research.md
  spec.md
  prototype-handoff.md
  plan.md
  verification.md
  release.md
  artifacts/
    screenshots/
    references/
    exports/
    pages/
```

Required for meaningful work:

- `status.json`
- `story.md`
- `spec.md`
- `plan.md`
- `verification.md`

Optional:

- `research.md` for uncertain, strategic, competitive, visual, or high-risk work.
- `prototype-handoff.md` for UI/UX work or whenever experience needs validation.
- `release.md` when there is a real deploy, client handoff, rollback concern, or release note.

For tiny changes, collapse aggressively. A small bug may only need `status.json`, a short `story.md`, a short `plan.md`, and `verification.md`.

## Artifact Roles

### `status.json`

The current lifecycle state and governance summary.

Example:

```json
{
  "id": "2026-05-26-moodboard-collections",
  "title": "Moodboard Collections",
  "branch": "feature/moodboard-collections",
  "workspace_path": "/Users/jodybrewster/Projects/mieruka",
  "phase": "Build",
  "state": "in_progress",
  "risk": "medium",
  "loop": "delivery",
  "discovery_iteration": 2,
  "delivery_iteration": 1,
  "approval": {
    "story": "approved",
    "spec": "approved",
    "prototype": "approved",
    "ship": "pending"
  },
  "open_questions": 1,
  "blockers": [],
  "current_focus": "Implement collection sidebar and MCP persistence.",
  "next_actions": [
    "Finish collection model tests",
    "Add Storybook states",
    "Run visual drift check"
  ],
  "last_decision": "Keep nested collections out of v1"
}
```

Suggested public phases:

```text
Discover
Define
Prototype
Build
Validate
Ship
Done
Paused
Blocked
Abandoned
```

Suggested states:

```text
not_started
in_progress
in_review
changes_requested
approved
complete
blocked
skipped
```

### `story.md`

The first formal product artifact after an idea. It turns a vague idea into one or more deliverable user stories.

Keep it small and slice by user value.

Example:

```markdown
# Story: Create Moodboard Collections

## Idea
Help users organize visual references before asking Mieruka to generate screens.

## User Story
As a product builder,
I want to create moodboard collections,
So that I can organize references by product area or visual direction.

## Business Value
Collections turn scattered inspiration into reusable design context.

## Scope In
- Create a named collection.
- Add references to a collection.
- View references in a collection.

## Scope Out
- Public sharing.
- Team permissions.
- Nested collections.

## Acceptance Criteria
### AC-001: Create collection
Given I am in a research workspace,
When I create a collection named "Dense dashboards",
Then the collection appears in the moodboard sidebar.
```

Research may happen before, during, or after story creation. The important rule is that the idea converges into stories and/or research-backed findings before planning.

### `research.md`

Optional. Use when the work needs evidence before committing to direction.

Research can use web search, Serper.dev, browser tools, screenshots, Mieruka references, the design-inspiration MCP, and other MCPs.

Research should be focused by stories or open questions. Avoid broad link dumps.

Suggested sections:

```markdown
# Research: Moodboard Collections

## Research Questions
- How do current tools organize visual references?
- What UI patterns make tagging fast?

## Source Log
| Source | Why It Matters | Confidence |
|---|---|---|

## Findings
### Finding 1
Observed / Inferred / Unverified / Design Recommendation

## Opportunities

## Risks And Open Questions

## Product Implications

## Feature Seeds
```

Artifacts can live under:

```text
artifacts/
  screenshots/
  references/
  pages/
```

### `spec.md`

The current product intent. It says what and why.

It should define:

- problem
- users
- goals
- non-goals
- selected story or stories
- functional requirements
- acceptance criteria
- edge cases
- open questions
- success criteria

It should not describe file changes, task order, or test commands.

For small work, put acceptance criteria, non-goals, and open questions in this file rather than creating separate files.

### `prototype-handoff.md`

Optional for non-UI work, expected for UI work.

Prototype is tool-backed design work. The primary target should be Mieruka's in-repo editor, with optional MCP bridges to Figma, Webflow, Magicpath, or Storybook.

The prototype handoff should include:

- prototype link or Mieruka project ID
- screen list
- screenshots or exports
- key interactions
- design decisions
- component hints
- visual references, if relevant
- implementation notes for developers

Mieruka is the source of truth for local prototype state. External tools are adapters, not dependencies.

### `plan.md`

The current implementation strategy. It says how and in what order.

The plan maps the current spec and prototype handoff onto the actual repo.

It should define:

- files to create or modify
- architecture approach
- task order
- test-first steps
- Storybook states to create
- MCP changes
- data/API changes
- verification gates
- risks and rollback concerns

Structured-Prompt-Driven Development ideas can live inside the plan as an `Agent Brief` section. Do not make `canvas` a separate public lifecycle phase unless a project explicitly needs it.

Suggested `Agent Brief` sections:

```text
Requirements
Entities
Approach
Structure
Operations
Norms
Safeguards
```

If implementation reality changes, update the plan before continuing.

### `verification.md`

Evidence that the implementation matches the current story, spec, prototype, and plan.

Checks can include:

- unit tests
- component tests
- Storybook render checks
- Playwright flows
- accessibility checks
- visual drift against Mieruka prototype
- acceptance criteria checklist
- code review summary

Review does not always need a separate file. Most product/design/code review results can be captured here unless they produce durable decisions.

### `release.md`

Optional until there is something real to ship.

Use it for:

- release notes
- deployment checklist
- rollback plan
- client handoff
- post-ship lessons, if any

Lessons are useful, but not mandatory paperwork. Capture them when something reusable was learned.

## Decision Logs

Every major artifact can include a small decision log.

```markdown
## Decision Log

| Date | Decision | Reason | Impact |
|---|---|---|---|
| 2026-05-26 | No nested collections in v1 | Keeps tagging flow simple | Spec and prototype simplified |
```

This is enough governance for most client work: what changed, why, and what it affected.

## Sample Story, Spec, And Plan

These examples use the same feature so the distinction is clear.

### Sample `story.md`

The story captures user value and scope. It should be readable by clients, strategists, designers, and developers.

```markdown
# Story: Create Moodboard Collections

## Idea
Users need a way to organize visual references before asking Mieruka to generate or refine prototype screens.

## User Story
As a product builder,
I want to create moodboard collections,
So that I can group visual references by product area, UI pattern, or design direction.

## Business Value
Collections turn scattered inspiration into reusable design context. They help agents and humans refer to a named set of examples instead of re-explaining visual direction in chat.

## Scope In
- Create a named collection.
- Rename and delete a collection.
- Add saved references to a collection.
- View references inside a collection.
- Make collection metadata readable by agents.

## Scope Out
- Public sharing.
- Team permissions.
- Nested collections.
- Full design-system extraction from references.

## Acceptance Criteria
### AC-001: Create collection
Given I am in a research workspace,
When I create a collection named "Dense dashboards",
Then the collection appears in the moodboard sidebar.

### AC-002: Add reference
Given a collection exists and I have saved references,
When I add a reference to the collection,
Then the reference appears in that collection.

### AC-003: Agent-readable context
Given a collection contains references,
When an agent reads the workstream context,
Then it can see the collection name, reference IDs, and tags.

## Open Questions
- Should one reference be allowed in multiple collections?
- Should collections have free-form notes in v1?

## Decision Log
| Date | Decision | Reason | Impact |
|---|---|---|---|
| 2026-05-26 | Keep nested collections out of v1 | Reduces hierarchy and editor complexity | Simpler spec and prototype |
```

### Sample `spec.md`

The spec defines current product intent. It says what and why, not which files to edit.

```markdown
# Spec: Moodboard Collections

## Problem
Mieruka users can gather visual references, but without named collections those references become difficult to reuse as design context. Agents need a structured way to understand which references belong together and why.

## Users
- Product builders collecting interface inspiration.
- Designers exploring visual directions.
- Agents generating prototypes from selected references.

## Goals
- Users can organize saved references into named collections.
- Users can quickly understand what each collection is for.
- Agents can read collection structure as prototype input.

## Non-Goals
- Public sharing is not included.
- Team permissions are not included.
- Nested collections are not included.
- Automatic design token extraction is not included.

## Functional Requirements
- FR-001: The system MUST allow users to create, rename, and delete collections.
- FR-002: The system MUST allow users to add saved references to a collection.
- FR-003: The system MUST allow users to remove a reference from a collection without deleting the reference globally.
- FR-004: The system MUST persist collection name, description, reference IDs, and tags.
- FR-005: The MCP MUST expose collection metadata to agents.

## UX Requirements
- Collections MUST be visible from the moodboard workspace.
- Empty collections MUST show an empty state with an add-reference action.
- Deleting a collection MUST require confirmation if it contains references.

## Acceptance Criteria
- A user can create a collection and see it immediately in the moodboard sidebar.
- A user can add and remove references from a collection.
- A user can rename a collection.
- A user can delete a collection without deleting its references.
- An agent can request collection metadata through Mieruka MCP.

## Edge Cases
- Creating a collection with a duplicate name is allowed but should be visually disambiguated.
- Deleting a collection with references removes only the collection membership.
- Missing references should be ignored and reported in diagnostics.

## Success Criteria
- A user can create a collection and add a reference in under 30 seconds.
- Prototype generation can target a named collection instead of the entire moodboard.

## Open Questions
- Should references support multiple collection membership in v1?
- Should collection descriptions be required or optional?

## Decision Log
| Date | Decision | Reason | Impact |
|---|---|---|---|
| 2026-05-26 | Collection descriptions are optional | Reduces friction during capture | Prototype needs optional note field |
```

### Sample `plan.md`

The plan defines current implementation strategy. It says how and in what order.

```markdown
# Plan: Moodboard Collections

## Inputs
- Story: `story.md`
- Spec: `spec.md`
- Prototype handoff: `prototype-handoff.md`

## Implementation Approach
Add collections as a first-class moodboard entity. Keep references globally stored and model collection membership separately so deleting a collection does not delete references.

## Files
- Create: `packages/mieruka-core/src/collections.ts`
- Create: `packages/mieruka-core/src/collections.test.ts`
- Modify: `packages/mcp-server/src/tools/index.ts`
- Create: `packages/mcp-server/src/tools/getCollections.ts`
- Create: `packages/mcp-server/src/tools/createCollection.ts`
- Modify: `apps/web/app/moodboard/page.tsx`
- Create: `apps/web/components/collection-sidebar.tsx`
- Create: `apps/web/components/collection-sidebar.stories.tsx`

## Tasks

### Task 1: Add collection model
- Write failing tests for create, rename, delete, add reference, and remove reference.
- Add `Collection` and `CollectionMembership` types.
- Add pure helpers for collection mutations.
- Run the collection unit tests.

### Task 2: Add persistence integration
- Wire collection data into the existing workspace persistence layer.
- Add migration/default handling for workspaces without collections.
- Verify old moodboards still load.

### Task 3: Add MCP tools
- Add `mieruka.getCollections`.
- Add `mieruka.createCollection`.
- Add `mieruka.addReferenceToCollection`.
- Add `mieruka.removeReferenceFromCollection`.
- Add schema validation and error messages.

### Task 4: Build moodboard UI
- Add collection sidebar.
- Add create, rename, delete, and empty states.
- Add reference membership controls.
- Match prototype spacing and interaction notes.

### Task 5: Add Storybook states
- Empty sidebar.
- Collection with references.
- Rename flow.
- Delete confirmation.
- Missing-reference diagnostic state.

### Task 6: Verify
- Run unit tests.
- Run Storybook render checks.
- Run Playwright flow: create collection -> add reference -> rename -> delete.
- Ask Mieruka to compare implementation screenshot against prototype.
- Update `verification.md`.

## Agent Brief
### Requirements
Follow `spec.md` exactly. Do not add nested collections or sharing.

### Entities
Collection, Reference, CollectionMembership.

### Approach
Keep collection membership separate from reference storage.

### Structure
Core model lives in `packages/mieruka-core`; MCP tools wrap core operations; UI consumes MCP/workspace state.

### Operations
Implement test-first by task. Update this plan if file boundaries change.

### Norms
Use existing workspace persistence patterns. Prefer accessible controls and stable Storybook states.

### Safeguards
Do not delete references when deleting collections. Preserve existing moodboards without collection data.

## Verification Gates
- Collection unit tests pass.
- Existing moodboard tests pass.
- Storybook states render.
- Playwright happy path passes.
- Visual drift check is acceptable or documented.

## Decision Log
| Date | Decision | Reason | Impact |
|---|---|---|---|
| 2026-05-26 | Store membership separately | Avoids accidental reference deletion | Adds collection membership helpers |
```

## Audience Views

### Strategists And Designers

They mostly need:

```text
story -> research -> prototype
```

They care about:

- What opportunity are we exploring?
- Who is this for?
- What did we learn?
- What could this become?
- What does it feel like?
- What options did we consider?

### Developers

They mostly need:

```text
spec -> prototype handoff -> plan -> verification
```

They care about:

- What is in scope?
- Where should this live in code?
- What components, routes, APIs, and tests are needed?
- What can change safely?
- How do we know it is done?

### Clients

They need confidence, not every internal artifact.

Show:

```text
Idea
Exploring
Specified
Prototyped
Planned
In Build
Verified
Approved
Shipped
```

and a decision/status summary:

- What changed?
- Why did it change?
- Who or what approved it?
- What evidence supports it?
- What is still open?

## Commands To Add

Suggested Mieruka/lifecycle commands:

- `/mieruka-start <title>` - create a workstream folder and `status.json`.
- `/mieruka-status` - show active workstreams, phase, blockers, and next action.
- `/story` - turn idea/research into user stories.
- `/research` - create or update focused research notes.
- `/spec` - create or update current product intent.
- `/prototype` - create or update a Mieruka prototype and handoff.
- `/plan` - create or update implementation strategy and agent brief.
- `/build` - execute the current plan.
- `/verify` - run verification gates and update `verification.md`.
- `/review` - run product/design/code review and update `verification.md` or decision logs.
- `/ship` - prepare release, merge, deploy, and update `release.md`.
- `/mieruka-advance` - move phase only if required gates pass.
- `/mieruka-block <reason>` - mark workstream blocked.
- `/mieruka-resume <id>` - read status and relevant artifacts.
- `/mieruka-handoff` - write concise handoff for another agent or session.

## Skills To Add

Suggested skills:

- `using-pro-dev-skillset` - meta-router that selects applicable skills and lifecycle phase.
- `story-lead` - turns ideas/research into deliverable user stories.
- `research-lead` - orchestrates focused research and writes research notes.
- `spec-lead` - creates precise product intent.
- `prototype-lead` - drives Mieruka prototype creation and critique.
- `planning-lead` - maps current spec/prototype to implementation strategy.
- `implementation-lead` - executes plan with TDD and checkpoints.
- `verification-lead` - runs acceptance, test, Storybook, visual, accessibility checks.
- `review-lead` - coordinates product/design/code/security reviews.
- `shipping-lead` - prepares releases, rollback, deployment checks, and release notes.
- `design-drift-check` - compares implementation to prototype.
- `storybook-sync` - keeps Storybook states aligned with Mieruka prototypes.

## Mieruka MCP Tools

Core state tools:

- `mieruka.listWorkstreams`
- `mieruka.getWorkstreamStatus`
- `mieruka.createWorkstream`
- `mieruka.updateWorkstreamStatus`
- `mieruka.advancePhase`
- `mieruka.addBlocker`
- `mieruka.resolveBlocker`
- `mieruka.writeHandoff`

Research tools:

- `mieruka.searchWeb`
- `mieruka.searchImages`
- `mieruka.fetchPage`
- `mieruka.captureScreenshot`
- `mieruka.saveSource`
- `mieruka.saveReference`
- `mieruka.tagReference`
- `mieruka.dedupeReferences`
- `mieruka.createMoodboard`
- `mieruka.extractDesignSignals`

Prototype tools:

- `mieruka.listProjects`
- `mieruka.createPrototype`
- `mieruka.listScreens`
- `mieruka.createScreen`
- `mieruka.updateScreen`
- `mieruka.generateVariant`
- `mieruka.captureScreen`
- `mieruka.exportPrototype`
- `mieruka.mapElementToComponent`
- `mieruka.getImplementationHints`

Implementation and verification tools:

- `mieruka.readStorybookStories`
- `mieruka.compareToStorybook`
- `mieruka.compareImplementationScreenshot`
- `mieruka.writeVisualDriftReport`

External design tools should be adapters, not the source of truth:

- Figma MCP can import frames and inspect designs.
- Webflow MCP can inspect or publish prototypes.
- Magicpath MCP can import/export generated flows.
- Storybook MCP can inspect implemented component states.

## Repo Strategy

Keep the Mieruka app/MCP repo and the skill marketplace repo (`pro-dev-skillset`) separate. This is already the design — `pro-dev-skillset` is a standalone Claude Code plugin marketplace. Mieruka is a separate app that installs into user repos as `.mieruka/`.

Reason:

- The skills are independently useful without Mieruka. A user can install `pro-dev-skillset` into any project.
- App/MCP code and skill marketplace code have different release cadences.
- Skills should be installable into other repos without requiring Mieruka.
- Plugin versioning needs cleaner semver/tag discipline.
- Product code has UI, auth, database, deployment, migrations.
- Skills have workflows, commands, prompts, and MCP contracts.

Early prototype structure can be monorepo-like:

```text
mieruka/
  apps/web
  packages/mcp-server
  packages/sdk
  packages/storybook-adapter
  docs/mcp-contract.md

mieruka-skills/
  .claude-plugin/marketplace.json
  plugins/pro-mieruka
  plugins/pro-lifecycle
  plugins/pro-design-research
  templates/project-settings.json
```

If everything starts in one repo, keep skill marketplace files clearly separated:

```text
apps/web
packages/mcp-server
skill-marketplace
```

Then split `skill-marketplace` out after the MCP contract stabilizes.

## Positioning

This is still in the spec-driven development family, but it is more specific:

```text
Research-backed, prototype-informed structured prompt development
```

or:

```text
Prototype-informed SPDD
```

The differentiator is that specs are living artifacts informed by stories, optional research, and in-repo prototypes before implementation planning.

## pro-spdd Baseline

`pro-spdd` is an opt-in plugin copied/adapted from OpenSPDD (`gszhangwei/open-spdd`). It is focused only on Structured Prompt-Driven Development artifacts and command workflows.

Canonical SPDD artifact directories:

```text
requirements/
spdd/
  analysis/
  prompt/
scripts/
```

Canonical SPDD commands:

```text
/spdd-story
/spdd-analysis
/spdd-reasons-canvas
/spdd-generate
/spdd-prompt-update
/spdd-sync
/spdd-api-test
/spdd-code-review
/spdd-reverse
```

Mieruka can later index or display these artifacts, but `pro-spdd` itself should stay OpenSPDD-compatible and should not depend on the Mieruka app.

## pro-gstack Comparison Plugin

`pro-gstack` is an opt-in plugin copied/adapted from GStack (`garrytan/gstack`). It is for testing GStack's persona/command operating model beside SPDD, not for changing the default Mieruka lifecycle yet.

How it differs from `pro-spdd`:

```text
pro-spdd    = story -> analysis -> REASONS canvas -> generate -> sync
pro-gstack  = office-hours/personas -> reviewed plan -> review/QA/ship specialists
```

Local command policy:

```text
/gstack-office-hours
/gstack-plan-ceo-review
/gstack-plan-eng-review
/gstack-plan-design-review
/gstack-review
/gstack-qa-only
/gstack-qa
/gstack-cso
/gstack-ship
```

All GStack-derived commands are prefixed as `/gstack-*` so they can be tested without colliding with existing commands like `/spec`, `/review`, `/qa`, or `/ship`.

Mieruka can later observe or display outputs from either approach. For now, `pro-spdd` remains the structured artifact pipeline and `pro-gstack` remains the persona/review/QA/ship comparison layer.
