# What this repo is and what it is testing

Moved from `CLAUDE.md`, which keeps the short version.

## What this repo is

A user installs skills from this repo once, and those skills become available in every project they work on.
The skills are independent - they work in any repo without requiring any other tool.

## How it relates to Mieruka

Mieruka is a separate Storybook-like app that installs into a user's target repo as `.mieruka/` (similar to how Storybook installs as `.storybook/`).
If a user has both `pro-dev-skillset` skills installed in Claude Code and Mieruka installed in their working repo, the skills can communicate with Mieruka via MCP tools or by writing to the `.mieruka/` directory.
But the two systems are independent by design - skills work without Mieruka, and Mieruka works without these skills.

## Where the content comes from

This repo hosts a private plugin marketplace with 10+ plugins and 20+ skills.
Skills are forked from MIT-licensed upstreams (`obra/superpowers`, `Owl-Listener/designer-skills`, `PaulRBerg/agent-skills`, etc.) with per-file attribution footers.
Manifests, templates, hooks, CI and scripts in this repo are original.
The full list is in [licenses.md](./licenses.md).

The plugins are skills-only by design - historically.
Hooks, commands and agents are now being layered in where deterministic triggering beats description-matching.
See [ADR-0001](./decisions/0001-skills-only-history.md).

## What this repo is experimenting with

This marketplace is actively testing multiple workflow layers - `pro-core`/`pro-execution`/`pro-quality`/`pro-pdd` (Superpowers-derived) and `pro-spdd` (SPDD) - to answer two different real-world questions:

### Use case 1: solo developer building a full application

A single developer uses `pro-pdd` for brainstorming and written plans, `pro-execution` for implementation and `pro-quality` for review and validation.
`pro-security` challenges plans and diffs through the `security-architect`, enforced by hooks during planning and at commit, and adds whole-repo audits through `security-audit`.
The opt-in `pro-legal` has `software-counsel` review plans and releases for legal issues such as licensing, privacy, AI use and client IP.

### Use case 2: consulting team delivering for a client

A team of consultants uses SPDD's structured prompt-driven workflow - story decomposition, REASONS canvas, analysis, prompt-driven generation and code review - to align a client on what is being built before anything is implemented.
The structure gives clients visibility and consultants a shared artifact trail.
The opt-in `pro-legal` helps here too: it flags client IP and licensing questions before a deliverable ships.

### The Mieruka bridge

In both use cases, one of this repo's jobs is to communicate with a Mieruka MCP server running in the client's or developer's working repo.
Skills write workstream status, stories, structured prompts and canvas artifacts to `.mieruka/` or call Mieruka MCP tools directly.
This lets Mieruka surface live progress to clients - saved stories, REASONS canvases, approval gates and daily progress summaries - without requiring them to read code or talk to Claude directly.

The client/team frameworks are opt-in (`pro-spdd` and `pro-pdd` are separate plugins).
`pro-legal` is opt-in too.
The default stack (`pro-core`, `pro-execution`, `pro-quality`, `pro-nextjs`, `pro-astro`, `pro-design`, `pro-motion`, `pro-data`, `pro-testing`, `pro-research`, `pro-security`) works without them.
