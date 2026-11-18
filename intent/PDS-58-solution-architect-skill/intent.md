---
id: PDS-58
source: idea
kind: idea
breaking: false
status: draft
risk: low
level: 3
created: 2026-11-18T08:16:28-0500
author: the maintainer
---

# Intent: a solution architect skill built from one graded engagement

Author: the maintainer.
Source: idea.
Status: draft.
Created: 2026-11-18.
Related: [security-architect](../../plugins/pro-security/skills/security-architect/SKILL.md), [verification-before-completion](../../plugins/pro-quality/skills/verification-before-completion/SKILL.md), [systematic-debugging](../../plugins/pro-execution/skills/systematic-debugging/SKILL.md), [ADR-0013](../../docs/decisions/0013-plugin-layering.md).

## Problem

The marketplace has no skill for solution architecture work: reading an existing system, finding root causes, designing a target state, proving it with a running slice, specifying a component, planning a rollout and explaining it to an executive.
The nearest skill is `security-architect`, which challenges a finished plan for security and does nothing before that point.

On 2026-11-09 a time-boxed solution architecture engagement was run with Claude Code and Codex side by side in a private repository: a legacy sync service, eight data files treated as protected health information and six deliverables budgeted at 6 to 8 hours.
Both agents were asked to act as a solution architect in plain words.
The request carried no method, so each agent produced documents on demand and the person directing the work had to supply the architect's judgement prompt by prompt.

The person's verdict on the day comes first, because it names the largest gaps:

- The agents went straight to code and documents. No structured discovery came first: nobody was walked through the business goals, the functional needs or the non-functional ones such as scale, availability, security, compliance, operations and cost.
- Build against buy against open source was never researched. No commercial product, managed service or open source project was evaluated, so the design was a build by default.
- The work did not apply the common sense and engineering practice an architect would bring: options weighed before a choice, proven components over custom ones, design before code and a design that can be operated.
- The recommendation was shaped to pass the exercise. It was not the production-quality recommendation a C-suite audience needs, with the option chosen, what it costs, what it risks and what it changes for the business.
- The look of the documents took many rounds. What worked was a short written design spec agreed before the deck was built. One agent's restrained document style was good enough to keep as a default. Matching a client's brand is a regular need and had to be done by hand each time.

The session transcripts show what the person had to ask for because the agent did not offer it:

- A discovery of the current system beyond the code walk: topology, transports, ID formats and data shape, schemas, the customer journey with its touchpoints. The open request for anything else an architect would need to know was made three times.
- A split of every claim into what the code proves, what the data shows and what is inferred. One agent labelled a system with a vendor name that the evidence did not support.
- The agent's coverage of the brief. The person asked whether the deliverables were addressed, whether everything was there and what was missing five times in one afternoon.
- A human review workflow designed as a real asynchronous process with errors, service levels and safeguards. The first design showed it as one box with a threshold.
- The reason a person was needed for a task. The agent assigned hand labelling to the person without explaining the term or why a person had to do it.
- The person's own position. The person said early that they had opinions on the approach and neither agent asked for them, so nearly every design choice was proposed by a model and accepted.

A review of the transcripts at the end of the day named seven things an architect would have done that no prompt asked for and no agent raised:

1. Start from what a mistake costs and let that set thresholds, review rules and rollout gates.
2. Compare options before choosing: patch, buy or build, with the reason each rejected option lost.
3. Size the design: volume, latency, cost, team size and who runs it afterwards, plus what the smaller version would be.
4. Turn unknowns into assumptions written as the question, the answer assumed and what changes if it is wrong.
5. Rank the reported symptoms by harm and pull the cheap, high-harm fix forward of the main design.
6. Have a person touch the data and know one failure case in detail.
7. Reduce the design to one diagram, one worked example and the few decisions needed from the sponsor.

The same review found the order of work was wrong.
The running slice, which the brief valued most, started 4 hours 40 minutes into the day.
About a dozen prompts went to theme and branding that nothing scored.
The repository ended with about 92,000 words of HTML, including a 36,000-word design document nobody had read end to end.

The engagement's own error log records 15 agent mistakes, most caught by the second model or by three fresh-context reviews at the end.
They fall into a small number of kinds:

- Numbers that were wrong or mislabelled: a headline count whose label described a narrower set, a figure off by a factor of twenty from rounding, a count that treated nicknames as different people. Each was caught by printing rows or by a second reader.
- Claims ahead of the evidence: a slice called the reference implementation before it existed, match scores described as calibrated probabilities, an assumption reported as a finding in the summary, a confidence interval printed over a sample that was not random.
- Trust in the supplied harness: the first counts came from a replay that ran events in an order production never would.
- Artifacts that disagreed with each other because separate subagents wrote them from separate briefs: a safeguard promised in the rollout and absent from the code, a build specification missing a constraint the prototype enforced, two documents describing different first phases.
- Sensitive data handled as sensitive in words only: rows from the data files quoted in design pages, tests and a transcript described as redacted. The project's own writing skill told agents the identifiers could be used as examples.
- A hand-rolled matcher chosen over a proven record linkage library in one line, for the sake of zero dependencies.
- Decoration and colour that carried no meaning or erased it, found only because every diagram was rendered and looked at.

The fresh-context design challenge then found two blocking gaps and 17 required changes that the authoring sessions had missed, among them: nothing stated who authorizes a result view, a feature flag that failed into the blocking path, inbound feeds trusted unevenly and no recovery path for human decisions after a restore.

A survey of the public skill ecosystem in November 2026 found no community-standard solution architect skill to adopt instead.
Adoption concentrates in three places: design-before-code workflow skills (obra/superpowers `brainstorming` and `writing-plans`, mattpocock/skills), narrow architecture primitives (wshobson/agents `architecture-patterns`, `architecture-decision-records` and its C4 plugin, the `architecture` and `system-design` skills in Anthropic's engineering plugin) and vendor skills (the `aws-well-architected-review` skill in Agent Toolkit for AWS, `deploy-on-aws` in awslabs/agent-plugins for pricing and diagrams).
Skills actually named solution architect or senior architect are many, near-duplicate and little used.
No widely adopted bundle runs requirements, options, decision records, diagrams, a framework review and cost as one pipeline.
The gaps the survey names match the engagement: non-functional requirement elicitation, option and trade-off matrices that carry cost, deliverables an executive can read, decision records and diagrams kept current across runs, plus evals that show the skill beats the baseline.

None of this is specific to that engagement.
It is the gap between writing architecture documents and doing an architect's job.
It will repeat on the next engagement unless the method lives in a skill.

## Proposed outcome

A person who asks an agent to act as a solution architect, to diagnose a system, to design a target state or to work a case study gets the method without having to prompt for each part of it.

The agent opens by reading and reporting, with no changes made: what is being asked, the deliverables, what is being judged and the budget.
No code is written until discovery, the options and the recommendation direction are on the page and the person has seen them.

Discovery is a structured interview with the person, one topic at a time, that the agent prepares for by reading everything supplied first so it only asks what the material does not answer.
It covers the business side (goals, sponsor, who is harmed today, money, deadlines, what success means), the functional side (actors, journeys, systems, data, integrations) and the non-functional side (volume, latency, availability, security, privacy and compliance, operability, team and budget).
A question the person cannot or will not answer becomes a stated assumption, so a short time box never blocks the work.

The agent then researches the options in depth before recommending: patch what exists, buy a commercial product or managed service, adopt an open source project or build.
The research names real candidates with current sources, compares them on fit, cost, risk, lock-in, maturity, licence and the effort to run them.
It says why each rejected option lost.

The recommendation is written for production and for an executive reader: the option chosen, why, cost and time in ranges, the main risks, what changes for the business and the decisions needed.
A prototype or exercise slice is presented as proof for that recommendation and its shortcuts are listed against the production design, so the two are never confused.
Engineering practice is applied without being asked: a proven library or service for a solved problem, tests with the slice, interfaces and failure behaviour defined before code, observability, security and rollback considered in the design.
It keeps a trace of the brief's requirements against the artifacts and shows the coverage at each checkpoint without being asked.
It proposes an order of work that puts the runnable proof early and leaves presentation to the end.

Before any design it asks for the person's own position and records it.
Each design decision that matters is put to the person as options with trade-offs and a recommendation, including patch, buy or build and library against custom.
A decision the person does not answer is listed as open and never becomes the default in silence.

The current-state discovery arrives complete on the first pass: flows, topology, transports, identifiers, data shape, schemas, the user journey and the reported symptoms ranked by harm.
Every claim carries its strength: read from the code, observed in the data, inferred or unknown.
Every number comes from a script that can be run again, has a label that matches what was counted and was checked by printing rows.
The supplied code and data are treated as read-only evidence.
A harness that orders or filters events differently from production is called out.

The design starts from the cost of each kind of mistake and derives thresholds, review rules and gates from it.
It is sized to stated volume, latency, cost and staffing.
It names the smaller version.
Unknowns appear as a table of question, assumption and what changes if wrong.
A step done by a person is a designed workflow with a lifecycle, service levels, error handling and safeguards.
Asynchronous paths state their ordering, idempotency, failure direction and recovery.
Who is authorized to see what is stated on its own and does not follow from a merge or a join.

When the material is sensitive the agent never copies a value from the data into a document, test, example or log, uses invented records for illustration and checks a redaction by scanning for the source values.

Artifacts written by separate subagents share one list of decisions and constraints.
They are reconciled against each other before any of them is called done.
A document is no larger than what the person can read and defend.
An artifact nobody asked for is offered before it is written.

Documents and decks come out in one consistent look without prompting.
The default is a restrained style: a white printable page, a system sans-serif stack, light heading weights, small uppercase section labels, thin grey rules, one accent colour used sparingly and inline SVG diagrams in a standalone HTML file.
When the work is for a named organisation the agent derives that organisation's palette, type and marks from its public material or supplied assets.
It writes them down as a short design spec with the audience, story, format and limits.
The spec is agreed before any page or slide is produced.
Colour keeps one meaning throughout, with the failure colour reserved for failures.

Before the work is called finished the agent has rendered and looked at every diagram, run a fresh-context challenge of the design, a code review of the slice and a security pass.
It has listed what remains unverified.
It ends with the one diagram, one worked example and the decisions needed from the sponsor.

The skill is a thin orchestrator.
It owns the order of work, the discovery interview, the options evaluation, the recommendation and the checks.
For patterns, decision records, C4 diagrams, a cloud framework review and cost estimates it calls an installed companion skill when one is present and falls back to its own short procedure when none is.
Decision records and the diagram model live in the repository being worked on and are updated when the design changes, so a later session starts from them.

## Affected users and systems

- One existing domain plugin gains the skill, its routing cases and a version bump in both manifests and the marketplace entry.
- `security-architect`, `security-audit`, `requesting-code-review`, `verification-before-completion`, `systematic-debugging`, `subagent-driven-development` and `documentation-and-adrs`: referenced by the new skill at the step each already covers. None is edited.
- `tests/cases/`: routing cases for the new skill, plus cases that keep "challenge my design for security" on `security-architect`.
- Codex: the skill loads there under the Codex parity law.
- `/research` and the research skills: called for the options evaluation. None is edited.
- Any user of the marketplace who does design, diagnosis or migration planning.

## Constraints

- The skill is general. It names no company, brief, vendor, dataset or person from the engagement that produced the evidence. No value from that engagement's data appears anywhere in this repository.
- It carries method and checks first. The only presentation assets it ships are the default theme and the design spec outline; no per-deliverable document templates.
- The default theme is original to this repository and names no client. A client's brand is applied per engagement from that client's material and is never stored in the plugin.
- Research uses the marketplace's existing research command and skills where installed and cites sources with dates. Product facts, prices and licences are never stated from memory.
- It hands off to existing skills instead of restating them: security challenge, code review, verification, debugging and ADRs. `brainstorming` and `writing-plans` in `pro-pdd` already carry the design-first gate and are reused, not copied.
- External skills are optional companions listed in the engine registry, never hard dependencies on another marketplace. The skill works with none of them installed.
- A companion is a supply-chain decision: each one is read before it is listed, pinned to a commit and checked against the registry's audit results. One popular architecture skill fails one of three auditors there.
- Cloud and vendor content stays in the vendor's own skill. The orchestrator is cloud-neutral and calls the vendor skill for the framework review, pricing and icon diagrams.
- The interview is with the person directing the work, not with their client. Reading and reporting come first, questions come one at a time and the person can end the interview at any point; what is left becomes stated assumptions.
- Code before discovery and options is a rule violation the skill names, with one exception: a read-only script that measures the existing system.
- It prefers a proven library for a solved problem, even in a prototype. Zero dependencies is a weak reason.
- Regulatory content stays out of the skill body. A compliance lens is a pointer to `security-architect` and to counsel.
- The description must not pull routing away from `security-architect`, `brainstorming` or `writing-plans`; the keyless routing gate stays at or above its threshold.
- The version-bump law and Codex parity apply.
- The body stays short enough to load whole; longer procedures go in sidecar files read on demand.

## Out of scope

- A solution architect subagent or a slash command. The skill comes first; an agent is a later intent if the fresh-context pass needs one of its own.
- A full design system, slide framework or per-client theme library.
- Domain packs for identity resolution, health data or any one industry.
- Reference architectures for agentic AI on AWS or any other cloud. The survey names this as an unfilled gap; it is a separate intent that would sit on top of this skill.
- Formal document templates for a solution architecture document, high-level design or proposal response.
- Changes to `security-architect` or to the review skills.
- Coaching the person on how to direct agents or present to a panel.

## Success looks like

- A prompt such as "act as a solution architect and tell me how to approach this brief" routes to the skill at rank 1 in the keyless gate, while "poke holes in my design for security" still routes to `security-architect`.
- A behavioral case built from an invented brief with a small legacy codebase and synthetic data shows the agent, with the skill and no further prompting, doing these things that the baseline run without the skill does not: reporting the deliverables and the order of work before changing anything, running the discovery interview across business, functional and non-functional topics, asking for the person's position, writing no code before the options are presented, comparing patch, buy, open source and build with named candidates and cited sources, separating the production recommendation from the prototype, labelling claim strength, producing the assumption table with the "if wrong" column and proposing the runnable slice before the long documents.
- Replayed against the 15 recorded mistakes, each one maps to a rule in the skill that would have prevented it or a check that would have caught it before a second model did. A mistake with no matching rule is listed with the reason.
- A document produced with no styling instruction comes out in the default theme. Given an organisation's name and site, the agent writes the design spec first and the resulting page uses that organisation's palette.
- `node tests/check.mjs`, the routing gate and the strict validates stay green.

## Open questions

- Which plugin holds it. ADR-0013 says the narrowest layer whose every user would want it, which points at the software domain: `pro-execution` or `pro-quality` today. A new `pro-architecture` plugin is not justified by one skill. `/spec` decides.
- The name: `solution-architect` matches `security-architect` and the words people type. `/spec` confirms it against the routing gate.
- Which companions make the first list. The survey's candidates are Anthropic's engineering plugin, the wshobson pattern, decision record and C4 pieces, the AWS Well-Architected review and the AWS pricing and diagram plugin. Each needs the read, the pin and a licence row before it is listed.
- Whether the non-functional interview uses quality attribute scenarios in the ATAM style or a plainer checklist.
- Whether an A/B eval against the baseline model is a merge requirement for this skill, as the survey suggests, or follows once PDS-57 session grading exists.
- Whether the theme and design spec live inside this skill as sidecar files or in a companion document-writer skill that this one calls. Two skills may mean two intents.
- How deep the options research goes by default and what it may spend, since deep research costs tokens and time. The person sets the cap.
- Whether one skill covers both the full engagement and a single request such as "document the current system", or whether modes with sidecar files serve better, as `security-architect` does with challenge and diff.
- Whether the fresh-context design challenge is a general architecture challenge the new skill owns or stays the security one with a wider brief.
- The engagement's reviewers have not given their feedback yet. The skill should be revised once they have. That revision is its own change.

## Evidence

All from a private repository and not copied here: the verdict of the person who directed the work, given on 2026-11-18, the engagement's AI log with its 15 numbered mistakes and how each was caught, the agentic reviews file of 2026-11-09 (4 code defects, 10 security findings, 2 blocking and 17 required design changes), 13 exported session transcripts from both agents, the deck design spec and the project document-writer skill written during the engagement and a memory note of 2026-11-11 on library choice in prototypes.
The ecosystem survey is a research note of November 2026 supplied by the maintainer.
Its install and star counts come from registry snapshots that disagree with each other and none was re-checked here, so no figure from it is quoted above; `/spec` verifies any that the design relies on.
Counts quoted above come from the engagement's files: 4 hours 40 minutes to the first slice, about 92,000 words of HTML, a 36,000-word design document and five coverage questions in the main session.
