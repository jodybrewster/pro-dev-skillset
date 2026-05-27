# pro-gstack Usage

Use `pro-gstack` as an opt-in comparison layer beside `pro-spdd`.

GStack emphasizes role/persona workflows across the product delivery loop:

```text
think -> plan -> build -> review -> test -> ship -> reflect
```

Common starting commands:

```text
/gstack-office-hours          # product interrogation and reframing
/gstack-plan-ceo-review       # founder/strategy review
/gstack-plan-eng-review       # architecture and engineering review
/gstack-plan-design-review    # design review before implementation
/gstack-autoplan              # upstream's combined planning pipeline
```

Common delivery commands:

```text
/gstack-review                # pre-landing code review posture
/gstack-qa-only               # report-only QA posture
/gstack-qa                    # QA and fix posture, with explicit approval for edits
/gstack-cso                   # security review posture
/gstack-ship                  # release/PR posture, with explicit approval for git/network mutations
```

Comparison with SPDD:

```text
pro-spdd    = story -> analysis -> REASONS canvas -> generate -> sync
pro-gstack  = office-hours/personas -> reviewed plan -> review/QA/ship specialists
```

Runtime note:

The vendored upstream repo includes native GStack scripts, browser tooling, gbrain sync, telemetry, hooks, setup, and upgrade flows. The active `pro-gstack` adapters do not run those automatically. Treat them as reference unless the user explicitly asks to install or run native GStack.

