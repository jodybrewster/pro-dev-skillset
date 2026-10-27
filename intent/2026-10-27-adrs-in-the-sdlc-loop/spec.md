# Spec: ADRs in the SDLC loop

Built from `intent.md` in this folder.
Each statement is checkable with a grep, a file or a command.

## Statements

- S1. `plugins/pro-ai-sdlc/commands/intent.md` tells the interviewer to watch for an idea that is large or spans more than one shippable change, to offer once to split it into separate intents (writing one folder each when the person agrees) and to record `Likely needs an ADR: <the decision at stake>` under Open questions when the idea sets a rule other work must follow or would be expensive to reverse. It does not write an ADR itself.
- S2. `plugins/pro-ai-sdlc/templates/spec.md` has an `ADR needed:` line (`yes` or `no`, with a one-line reason) in the Flagged concerns section.
- S3. `plugins/pro-ai-sdlc/commands/spec.md`, when the answer is yes, asks only what the ADR still lacks beyond the spec (at most what would make the person reverse the decision and what must stay true afterwards), writes the ADR from `templates/adr.md` with `Status: proposed`, numbered after the highest existing one, links it from the spec and commits it in the same commit as the spec. A "Likely needs an ADR" line in the intent is carried into this decision.
- S4. ADR location, used by both `/spec` and `/adr`: `docs/adr/` if it exists, else `docs/decisions/` if it exists, else a new `docs/adr/`. When that folder has a `README.md` with an index table, a row is added.
- S5. `plugins/pro-ai-sdlc/templates/adr.md` exists with number and title, Status (proposed, accepted, superseded by NNNN), Date, Decided by, Source (intent folder, commit or conversation), Context, Decision, Consequences, Alternatives considered and Where it is enforced. One sentence per line.
- S6. `plugins/pro-ai-sdlc/commands/adr.md` exists: a standalone interview for a decision with no change behind it (context, options, decision, consequences, what would reverse it), one question at a time. It writes the ADR per S4 and S5 with status `accepted` once the person confirms, updates the index and commits that file and the index only. When the person says it replaces an earlier ADR, the old one's status line becomes `superseded by NNNN` in the same commit.
- S7. `plugins/pro-ai-sdlc/templates/plan.md` has a `## Done` section before Departures: the build commit, the checks run with their real results, one pass or fail line per spec acceptance criterion and the person's sign-off in their words. Its guidance says the sign-off moves intent and spec `status` to `accepted` and any `proposed` ADR from this change to `accepted`.
- S8. `plugins/pro-ai-sdlc/README.md` lists `/adr` in the loop table and the new template, and says where ADRs come from (flagged at intent, drafted at spec, accepted at Done, standalone through `/adr`).
- S9. Version-bump law: pro-ai-sdlc 0.1.0 to 0.2.0 in `.claude-plugin/plugin.json`, `.codex-plugin/plugin.json` and its marketplace entry; pro-starter patch-bumped in its manifests and entry because it depends on pro-ai-sdlc; `metadata.version` minor-bumped.
- S10. Codex parity holds for the new command per `docs/codex-parity.md`.
- S11. `node tests/check.mjs && node tests/eval.mjs --dry`, `claude plugin validate . --strict` and the per-plugin strict loop all pass.

## Flagged concerns

ADR needed: yes, this changes how every repo using the plugin records decisions; recorded as the next ADR in `docs/decisions/`.
No conflicts with the three laws found; S9 and S10 apply them.
