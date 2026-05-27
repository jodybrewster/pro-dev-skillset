# gstack-investigate Workflow

This is a harness-neutral adapter for upstream GStack workflow `investigate`.

- Upstream source: `../../upstream/gstack/investigate/SKILL.md`
- Local command: `/gstack-investigate`
- Local skill: `gstack-investigate`

## How to Run

1. Read the upstream source file listed above. Treat it as reference material for the specialist role, decision process, review checklist, and expected deliverables.
2. Ignore upstream runtime bootstrap sections that install or call native GStack infrastructure. This plugin vendors upstream for comparison, not as a live GStack runtime installer.
3. Adapt host-specific tool names to available capabilities in the current session. Use normal repo reads/searches, direct user questions, local browser tools, or subagents only when those capabilities are available.
4. Preserve the workflow's core value: persona, review posture, quality bar, artifact shape, and stop/approval points.
5. If the upstream workflow requires unavailable infrastructure, continue with the markdown/process parts and clearly state which native GStack capability was skipped.

## Runtime Boundaries

Do not run these upstream behaviors unless explicitly requested by the user:

- native GStack install/setup or upgrade flows
- telemetry or analytics writes
- gbrain/cloud sync or Supabase provisioning
- browser daemon startup, tunnel creation, or cookie import flows
- hook installation or shell preamble execution
- automatic commits, pushes, PR creation, deploys, or branch changes without explicit user approval

## Output

Produce the same class of artifact the upstream workflow asks for, but scoped to this repo and this conversation. Prefer concise summaries plus concrete next actions, file paths, tests, and evidence where relevant.
