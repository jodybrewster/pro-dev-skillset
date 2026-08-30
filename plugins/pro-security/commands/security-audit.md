---
description: Run a read-only whole-repository security audit - secrets, supply chain, CI/CD, infrastructure, integrations, LLM surface, OWASP, and STRIDE - with confidence-scored findings and an exploit path for each.
argument-hint: '[--comprehensive] [--infra|--code|--skills|--supply-chain|--owasp|--scope <domain>] [--diff]'
---

Use the `security-audit` skill. Parse `$ARGUMENTS` for mode and scope flags; with no arguments, run the full audit in daily mode at the 8/10 confidence gate.

Work through the skill in order: build the stack mental model, census the attack surface, run the in-scope phases, then filter hard before reporting anything. Every finding needs a quoted line of evidence and a concrete exploit path - dispatch the `security-auditor` subagent to judge each candidate independently before it reaches the report.

This is read-only. Report findings and recommendations; do not edit code, revoke credentials, or send requests to any endpoint under audit.

Save the JSON artifact under `.pro-dev/security/` and end with the disclaimer verbatim.
