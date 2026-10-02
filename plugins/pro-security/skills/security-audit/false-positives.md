# False-positive filtering and confidence

Detail for step 4 of [SKILL.md](./SKILL.md).

Most security scanners fail by being noisy, not by missing things.
A report with three real findings gets acted on. The same three buried under twelve theoretical ones gets skimmed and closed.
This file is the filter that keeps the difference.

Apply in order: hard exclusions, then confidence scoring, then the mode gate, then the pre-emit gate, then active verification.

## Hard exclusions

Discard automatically. These are not judgment calls.

1. Denial of service, resource exhaustion, and rate limiting. **Exception:** model cost amplification from phase 6 is financial risk, not DoS - keep it.
2. Secrets stored on disk when otherwise secured (encrypted, correctly permissioned).
3. Memory consumption, CPU exhaustion, file descriptor leaks.
4. Input validation on fields with no security relevance and no proven impact.
5. Workflow issues not triggerable by untrusted input. **Exception:** never discard phase 3 findings - `pull_request_target`, script injection, unpinned actions, and secret exposure are concrete, and that phase exists to surface them.
6. Missing hardening measures. Flag concrete vulnerabilities, not absent best practices. **Exception:** unpinned third-party actions and missing CODEOWNERS on workflow files are concrete risks, not absent hardening.
7. Race conditions and timing attacks without a specific exploitable path.
8. Vulnerabilities inside outdated libraries - phase 2 reports these in aggregate, not as individual findings.
9. Memory safety in memory-safe languages.
10. Files that are only tests or fixtures, and are not imported by non-test code.
11. Log spoofing. Writing unsanitized input to a log is not a vulnerability.
12. SSRF where the attacker controls only the path, not the host or protocol.
13. User content in the user-message position of a model conversation. That is not prompt injection.
14. Regex complexity in code that never processes untrusted input. ReDoS on user-supplied strings is real; ReDoS on a build constant is not.
15. Security concerns raised inside documentation files. **Exception:** skill files are not documentation. They are executable prompt code that steers agent behavior, so phase 7 findings in them are never excluded under this rule.
16. Missing audit logs. Absence of logging is a gap, not a vulnerability.
17. Weak randomness outside security contexts, for example UI element IDs.
18. Secrets committed and removed within the same initial-setup change.
19. Dependency CVEs below CVSS 4.0 with no known exploit.
20. Findings on archived or disabled workflows.

## Precedents

Resolved judgment calls. Follow them rather than relitigating each run.

1. Logging a secret in plaintext is a vulnerability. Logging a URL is not.
2. UUIDs are unguessable. Do not flag missing UUID validation.
3. Environment variables and CLI flags are trusted input.
4. React and Angular escape by default. Flag the escape hatches only.
5. Client-side code does not need authorization checks. That is the server's job.
6. Shell command injection needs a concrete path from untrusted input to the shell.
7. Subtle browser-side vulnerabilities only at very high confidence with a concrete exploit.
8. Notebooks only count when untrusted input can reach the vulnerable cell.
9. Logging non-personal data is not a vulnerability.
10. An untracked lockfile is a finding for application repos, not for library repos.
11. `pull_request_target` without a PR ref checkout is safe.
12. Root containers in a local-development compose file are fine. Root containers in a production Dockerfile or manifest are findings.
13. A framework's documented default protection counts as present without needing an explicit call in application code.

## Confidence calibration

Every finding carries a 1-10 score.

| Score | Meaning | Display |
|---|---|---|
| 9-10 | Verified against specific code. Concrete exploit demonstrated. | Report normally |
| 7-8 | High-confidence pattern match. Very likely correct. | Report normally |
| 5-6 | Moderate. Could be a false positive. | Report with an explicit "verify this" caveat |
| 3-4 | Suspicious pattern, probably fine. | Appendix only, suppressed from the main report |
| 1-2 | Speculation. | Only if severity would be critical |

Daily mode reports 8 and above. Comprehensive mode reports 2 and above, marking anything under 8 as `TENTATIVE`.

Do not round up because a finding feels important. The gate exists precisely for findings that feel important but are not yet evidenced.

## Pre-emit verification gate

Before any finding reaches the report, it must clear this.

**Quote the line that motivates it.** File, line number, and the verbatim text that triggered the finding.

- "Field X does not exist on model Y" requires quoting the body of Y where the field would be.
- "This could return null" requires quoting the initialization.
- "Race between A and B" requires quoting both A and B.

**If you cannot quote it, the finding is unverified.** Force confidence to 4-5 so it drops to the appendix. It still gets recorded so calibration can be audited later, but the user does not see it in the main report. Do not route around this by assigning a speculative 7.

**Framework-generated symbols.** When a symbol comes from a metaclass, descriptor, ORM inner class, decorator, migration history, or generated client, quote the construct that creates it - the schema file, the migration, the decorator - rather than expecting the literal name in a class body. The standard is "I read the source that creates this symbol", not "I searched for the name and did not find it."

This gate exists because it kills a specific, recurring class of false positive: confident claims that something does not exist, made without opening the file where it would be defined.

## Active verification

For each finding past the gate, prove it where proving it is safe.

| Finding type | How to verify | Never |
|---|---|---|
| Secrets | Check the pattern is a real key format - correct prefix, correct length | Test it against the live API |
| Webhooks | Trace the handler through router, middleware, and gateway config | Send an HTTP request to the endpoint |
| SSRF | Trace whether user-controlled URL construction can reach an internal host | Make the request |
| CI/CD | Parse the workflow to confirm `pull_request_target` actually checks out PR code | Trigger the workflow |
| Dependencies | Check whether the vulnerable function is directly imported and called | Execute it |
| LLM surface | Trace whether user input actually reaches system prompt construction | Attempt the injection against production |

Mark each result:

- `VERIFIED` - confirmed by tracing code.
- `UNVERIFIED` - pattern match that could not be confirmed. For dependencies, add: "vulnerable function not directly called; may still be reachable through framework internals or config-driven paths. Manual verification recommended."
- `TENTATIVE` - comprehensive-mode finding below 8/10.

## Variant analysis

Every `VERIFIED` finding triggers a sweep. One confirmed SSRF usually means several.

1. Extract the core pattern from the confirmed finding.
2. Search the codebase for that pattern.
3. Report each hit as its own finding, linked back: "Variant of finding #N."

Skipping this step is the most common way an audit reports the one instance the scan happened to open first.

## Independent verification

The scan that produced a finding is the worst judge of it - it already believes.

Dispatch a fresh subagent per candidate finding, giving it only:

- The file path and line number. Not your reasoning, not your severity, not your description. Anchoring destroys the value of a second opinion.
- The hard exclusions and precedents above.
- The instruction: read the code at this location, judge independently whether a real vulnerability exists, score 1-10, and if below 8, explain why it is not real.

Run them concurrently and discard anything scored below the active mode's gate. The `security-auditor` subagent shipped with this plugin is built for this role.

Where subagents are unavailable, re-read the code deliberately looking for reasons the finding is wrong, and mark it `self-verified - independent check unavailable` so the reader knows the difference.
