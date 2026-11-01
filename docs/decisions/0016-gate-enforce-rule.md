# ADR-0016: A gate moves from warn to enforce only on a written record of warn-mode evidence

Date: 2026-10-30

## Status

proposed

Decided by: the maintainer.
Source: intent/2026-10-30-p0-hardening/.

## Context

The P0 review stack shipped four gates: the floor guard, the pr-gate, the merge gate and the push gate.
Each plan said a gate stays in warn mode until its known limits are closed and a week of real use has been read.
None said what that week has to show, who reads it or how a gate goes back so the switch risked being made on a feeling.
A gate that enforces too early denies good work in every repo that installs it and an agent under a denial looks for a way around the gate.
A gate that never enforces is a log nobody reads.
Every future gate will face the same question.

## Decision

Every gate ships in warn mode and its plugin default stays warn.
A gate moves to enforce only when all of these hold:

- Its row in `docs/enforce-mode.md` lists no open blocker; each known limit is closed or accepted there with a reason and an owner.
- It has run in warn mode for at least seven days in two repos (this marketplace and one app repo that installs the starter), counted from the day its current version is installed in both.
- The `warn.log` lines for that gate over the period show every finding either correct or caused by a bug since fixed and none the maintainer would have overridden.
- The gate's own extra conditions in `docs/enforce-mode.md` hold: for the merge gate and the pr-gate no `could-not-run` line caused by the gate's own limits; for the floor guard the ADR-0010 revisit trigger.

A gate with no logged line in the period was not exercised and stays in warn until it has been.
An agent prepares the summary from `warn.log`; the maintainer alone makes the call, per gate: enforce, stay in warn or loosen a rule first.
The call is written in a decision record from the template in `docs/enforce-mode.md`, with the counts behind it.
The switch is a `mode.<gate>` file holding `enforce` in the guard folder of each machine, never a change to the plugin default.
A false denial in enforce mode sends that gate back to warn the same day with a line in its decision record.
The gate then starts a new period after the fix.
The push gate has no warn mode; the same record judges whether its deny-once behavior stays, using its gated-diff count.

## Consequences

The switch to enforce becomes a dated decision with numbers behind it and a reader can see why each gate is where it is.
Moving a gate costs at least a week after its last fix, which slows down tightening.
A gate that rarely fires (the merge gate on a quiet repo) can wait longer than a week for its first line.
The mode stays per machine so a second person's machine starts in warn until they opt in.
What must stay true: the plugin default is warn, `could not run` never reads as clean and only the maintainer makes the call.
Reverse this decision if the evidence period keeps a gate in warn while real harm gets through it or if enforce mode moves into a repo ruleset where a per-machine file no longer applies.

## Alternatives considered

- Switching on a fixed date after release: ignores whether the log shows false alarms.
- A finding-count threshold with no human read: a count says nothing about whether the findings were right.
- Shipping enforce as the plugin default once ready: switches every consumer at once with no chance to opt out quietly.
- One decision for all gates together: holds a ready gate back for the slowest one.

## Where it is enforced

- `docs/enforce-mode.md`, which holds the blocker list, the evidence criteria per gate, the summary commands and the record template.
- The decision record of each review, first `intent/2026-10-30-p0-hardening/enforce-decision.md`.
- The default `warn` in the mode lookup of `floor-guard.py`, `pr-gate.py`, `merge-gate.py` and `guard.py`.
- Not enforced by any check: the switch is a file on a machine and the rule is followed by hand.
