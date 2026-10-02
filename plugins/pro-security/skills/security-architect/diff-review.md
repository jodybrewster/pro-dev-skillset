# Diff review procedure

Use this when code exists.
The input is a diff, a branch, a commit range, a PR or staged changes.
The goal is to catch security problems before they are committed.

## 1. Get the diff

- Staged changes: `git diff --cached`.
- Working tree: `git diff` plus untracked files from `git status`.
- Branch: `git diff $(git merge-base HEAD <base>)...HEAD`, where `<base>` is the default branch.
- Range or PR: the range or the PR's base and head as given.

Read each changed file in full, not only the hunks.
Then read enough callers, middleware, route registration and schema to know what actually reaches each changed line.
A hunk read alone misses both the control that already exists and the one that is missing.

## 2. Ask the design question first

Before reading line by line, decide two things.

- Does the change match its stated intent, or does it do more than it says?
- Does it widen the attack surface: a new endpoint, a new input, a new privilege, a new dependency, a new external call, a new place secrets or personal data flow?

A change that adds surface needs the controls to arrive in the same change.
If a new endpoint lands with no authorization check, that is a finding even when every line is clean.

## 3. Run the code checklist on the changed lines

- Input validation at trust boundaries: request bodies, query strings, headers, file names, webhook payloads, anything from another service.
- Authentication and authorization bypass: missing checks, checks in the UI only, object access without an ownership test, tenant taken from the request.
- Injection beyond SQL: shell, template, path traversal, header and log injection, regex built from input, prompt injection into an LLM.
- Crypto misuse: hand-rolled schemes, weak or reused IVs, `Math.random` for tokens, unsalted or fast password hashing, non-constant-time comparison of secrets.
- Secrets exposure: keys in code, config, fixtures or logs, secrets in client bundles, tokens in URLs.
- XSS escape hatches: raw HTML insertion, disabled escaping, unsanitized markdown or URLs rendered as links.
- Deserialization of untrusted data, including YAML and pickle style loaders.
- SSRF and open redirects on user-supplied URLs.
- Race conditions on balance, quota or one-time-token checks.
- New dependencies, install scripts, pinned versus floating versions, and CI changes that widen what a pull request can reach.

Use the OWASP and STRIDE material in [../security-audit/phases.md](../security-audit/phases.md) where a category applies.
Scope everything to the changed lines and the paths that reach them.
Pre-existing problems in untouched code are out of scope unless the change makes them reachable.

## 4. Filter

Apply [../security-audit/false-positives.md](../security-audit/false-positives.md): the hard exclusions, the precedents and the pre-emit gate.

- Report findings at confidence 8 and above.
- List confidence 5 to 7 in a short "worth a second look" section, each with the one fact that would settle it.
- Drop everything below 5.
- A finding you cannot quote from the code is unverified and goes no higher than 5.

## 5. Write each finding

For every reported finding:

- Severity: critical, high, medium or low.
- Confidence: N/10.
- Location: `file:line`.
- Evidence: the quoted line or lines.
- Exploit scenario: numbered steps from attacker input to impact.
- Fix: the smallest change that closes it.

Optionally dispatch the `security-auditor` subagent for each finding to verify it independently.
Give it only the file, the line and the false-positive rules.
When subagents are not available, re-read the code with a skeptic's eye and mark the finding "self-verified".

## 6. Verdict

End with one of:

- Safe to commit: nothing at 8 or above.
- Fix before commit: list the findings that must change, in priority order.

Keep the report short.
Do not add a disclaimer block.
For a broader posture check, point to `/security-audit`.
