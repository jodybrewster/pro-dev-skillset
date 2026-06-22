# Mieruka bridge (optional)

Mieruka is a separate, Storybook-like app that installs into the working repo as `.mieruka/`. This
skill is **independent of it** — everything works with zero Mieruka present. When Mieruka *is* present,
two integration paths are available: the **research tab** (preferred, uses MCP tools) and the
**file-mirror fallback** (plain file I/O when the MCP server isn't running).

Detect-and-degrade is the rule: **check, then use MCP; fall back to file-mirror; never require either.**

## Detection

Mieruka is present iff `.mieruka/` exists at the repo root. The orchestrator checks once at setup
(step 0). If absent, skip everything below — the `.research/<run-id>/` outputs are the only artifacts.

A Serper key may already live in `.mieruka/` config (Mieruka uses Serper too). If `SERPER_API_KEY` is
unset but `.mieruka/` has one, reuse it rather than asking the user for a second key.

## Research tab (MCP path — preferred)

Mieruka ships a **Research tab** that surfaces research threads as a chat-like UI. When the Mieruka
MCP server is running (registered as `mieruka` in Claude Code's MCP config), Claude agents can drive
threads directly without touching the file system.

### Thread lifecycle

Threads live at `docs/research/<id>/thread.json` (relative to the project root). A thread has:

```json
{
  "id": "20260606-143022-acme-competitor-analysis",
  "title": "Acme competitor analysis",
  "status": "pending",
  "createdAt": "2026-06-06T14:30:22Z",
  "updatedAt": "2026-06-06T14:30:22Z",
  "messages": [
    { "role": "user", "content": "Research Acme's top 3 competitors", "timestamp": "..." }
  ]
}
```

**Status values:** `pending` → `running` → `complete` (or `error`).

The UI creates a thread with `status: "pending"` when the user submits a question. The lead-research
agent picks it up, runs the research, and writes back via MCP tools. The UI watches for changes via
SSE and updates in real time.

### MCP tools

| Tool | When to use |
|------|-------------|
| `list_research_threads` | Find pending threads to work on; check run status |
| `get_research_thread` | Read full thread including all messages |
| `update_research_thread` | Set status, add assistant messages, rename thread |

`update_research_thread` accepts:
- `id` (required)
- `status`: `"pending" \| "running" \| "complete" \| "error"`
- `title`: override the auto-generated title
- `assistant_message`: append one assistant message to the thread

### Suggested agent workflow with the research tab

0. **Detect:** call `list_research_threads` and check for `status: "pending"` entries.
1. **Claim:** `update_research_thread({ id, status: "running" })`.
2. **Run research** as described in `SKILL.md` §1–§3 (plan, dispatch, retrieval). Evidence goes to
   `.research/<run-id>/` as usual.
3. **Stream progress** (optional but encouraged): call `update_research_thread` with
   `assistant_message` for milestone updates so the user sees live progress in the chat view.
4. **Deliver:** `update_research_thread({ id, status: "complete", assistant_message: "<synthesized report>" })`.
   For lead runs, include the lead profiles in the message or as a reference to `report.md`.
5. **Mirror (lead runs):** also write `.mieruka/workstreams/<date>-lead-research-<slug>/` as described
   below, so the governance surface picks up the run alongside the chat view.

### Watching for pending threads (autonomous mode)

If the user asks the agent to "watch for research requests" or "stay on research":

```
while (pending threads exist):
  for each pending thread:
    claim → run → deliver
  sleep 30s
  re-check
```

A Mieruka `/research-watch` command (when the mieruka plugin is installed) automates this loop.

## File-mirror fallback (no MCP server)

When the Mieruka MCP server is unavailable (headless, CI, dev server not running), write the
workstream file-mirror instead. The UI's file watcher will pick up changes.

**Mirror path:** `.mieruka/workstreams/<YYYY-MM-DD>-<slug>/`

```
.mieruka/workstreams/2026-06-06-lead-research-acme/
  status.json        # run state + entity list + band counts
  leads.md           # human-readable: per-entity section — score, signals, citations
  leads.json         # array of lead_profile.json objects
```

`status.json` shape:
```json
{
  "objective": "Score these 12 accounts against our ICP",
  "run_id": "run-20260606-100000-acme-batch",
  "effort_tier": "broad-sweep",
  "entities": ["Acme", "Globex"],
  "counts": {"sources": 41, "claims": 88, "verified": 79, "leads": 12},
  "bands": {"hot": 3, "warm": 5, "nurture": 3, "disqualify": 1},
  "updated_at": "2026-06-06T10:30:00Z"
}
```

Write the mirror at the **end** of a run (after verify + score), and update `status.json` mid-run
for long runs. This is plain file I/O — no MCP dependency.

## Choosing the path

| Condition | Use |
|-----------|-----|
| Mieruka MCP server running + `list_research_threads` responds | MCP research tab tools |
| MCP unavailable but `.mieruka/` exists | File-mirror to `.mieruka/workstreams/` |
| No `.mieruka/` | Skip mirror entirely — `.research/<run-id>/` is the only output |
