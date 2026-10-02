# Scan phases

Detail for step 3 of [SKILL.md](./SKILL.md).
Each phase lists what to look for, how to rate severity, and the false positives specific to that phase.
The global filter in [false-positives.md](./false-positives.md) runs after all of them.

The patterns below describe **what** to search for. Use your file-search tooling rather than pasting shell into a terminal, and do not truncate results.

## Attack surface census

Run this before the phases and print the map.

```
ATTACK SURFACE
══════════════
CODE
  Public endpoints:      N (unauthenticated)
  Authenticated:         N
  Admin-only:            N
  API endpoints:         N (machine-to-machine)
  File upload points:    N
  External integrations: N
  Background jobs:       N (async surface, often unguarded)
  WebSocket channels:    N

INFRASTRUCTURE
  CI/CD workflows:       N
  Webhook receivers:     N
  Container configs:     N
  IaC configs:           N
  Deploy targets:        N
  Secret management:     [env vars | KMS | vault | unknown]
```

Code surface comes from searching for route definitions, auth middleware, upload handlers, admin routes, webhook handlers, job definitions, and socket channels, scoped to the stack detected in step 1.

Infrastructure surface comes from the filesystem: workflow files under `.github/workflows` plus `.gitlab-ci.yml`, `Dockerfile*` and `docker-compose*.yml`, `*.tf` / `*.tfvars` / `kustomization.yaml`, and any `.env*` present.

## Phase 1 - Secrets archaeology

Search git history, not just the working tree. A rotated key still leaked.

**History.** Search all commits for known credential prefixes: `AKIA` (AWS), `sk-` and `sk_live_` (OpenAI, Stripe), `ghp_` / `gho_` / `github_pat_` (GitHub), `xoxb-` / `xoxp-` / `xapp-` (Slack). Also search config and env file types for `password`, `secret`, `token`, `api_key` additions.

**Working tree.** Find `.env` files tracked by git, excluding `.example`, `.sample`, and `.template` variants. Confirm `.env` is actually gitignored.

**CI configs.** Look for literal `password:`, `token:`, `secret:`, `api_key:` values in workflow files that do not route through a secret store.

**Severity.** CRITICAL for a live secret pattern in history. HIGH for `.env` tracked by git, or inline credentials in CI. MEDIUM for suspicious values in `.env.example`.

**Phase FPs.** Placeholders (`your_`, `changeme`, `TODO`, `xxx`) are excluded. Test fixtures are excluded unless the same value appears in non-test code. A rotated secret is still a finding - it was exposed. `.env.local` being gitignored is expected, not a finding.

**Diff mode.** Limit history scanning to commits on the current branch.

## Phase 2 - Dependency supply chain

Goes past a vulnerability count into actual supply chain risk.

Detect the package manager from lockfiles and manifests, then run whichever audit tool is installed. A missing tool is **not a finding** - note it as `SKIPPED - tool not installed` with the install command and continue.

Beyond CVEs, check:

- **Install scripts in production dependencies.** `preinstall`, `postinstall`, and `install` hooks are a live supply chain attack vector.
- **Lockfile integrity.** The lockfile must exist and be tracked by git.
- **Abandoned packages.** Direct dependencies with no release in years and known unpatched advisories.

**Severity.** CRITICAL for high/critical CVEs in direct dependencies. HIGH for install scripts in production dependencies, or a missing lockfile in an application repo. MEDIUM for abandoned packages, medium CVEs, or an untracked lockfile.

**Phase FPs.** Dev-dependency CVEs cap at MEDIUM. `node-gyp` and `cmake` install scripts are expected build tooling - MEDIUM, not HIGH. Advisories with no fix available and no known exploit are excluded. A missing lockfile in a **library** repo is correct practice, not a finding.

## Phase 3 - CI/CD pipeline

Who can modify the pipeline, and what secrets does it hold?

For each workflow file:

- **`pull_request_target` combined with a checkout of PR code.** Fork pull requests execute with write permissions and secret access. This is the highest-value CI finding.
- **Script injection.** `${{ github.event.*.title }}`, `.body`, `.head_ref` and similar interpolated directly into a `run:` block. Attacker-controlled text becomes shell.
- **Unpinned third-party actions.** `uses:` without a commit SHA means the tag can be moved under you.
- **Secrets as environment variables** rather than scoped `with:` inputs, where they can surface in logs.
- **CODEOWNERS coverage** on workflow files themselves.

**Severity.** CRITICAL for `pull_request_target` plus PR-ref checkout, or script injection from event text. HIGH for unpinned third-party actions, or secrets exposed as env vars without masking. MEDIUM for missing CODEOWNERS on workflow files.

**Phase FPs.** First-party `actions/*` unpinned is MEDIUM, not HIGH. `pull_request_target` **without** a PR ref checkout is safe. Secrets passed in `with:` blocks rather than `env:`/`run:` are handled by the runtime. Archived or disabled workflows are excluded.

## Phase 4 - Infrastructure shadow surface

**Containers.** Missing `USER` directive (runs as root), secrets passed via `ARG`, `.env` copied into the image, ports exposed without documented purpose.

**Config credentials.** Database connection strings (`postgres://`, `mysql://`, `mongodb://`, `redis://`) in committed config, excluding localhost, `127.0.0.1`, and example hosts. Also check whether staging or dev configs point at production.

**IaC.** Terraform with `"*"` in IAM actions or resources, or hardcoded secrets in `.tf` / `.tfvars`. Kubernetes manifests with `privileged: true`, `hostNetwork`, or `hostPID`.

**Severity.** CRITICAL for a production database URL with credentials in committed config, wildcard IAM on sensitive resources, or secrets baked into an image. HIGH for root containers in production, staging holding production database access, or privileged pods. MEDIUM for a missing `USER` directive or undocumented exposed ports.

**Phase FPs.** `docker-compose.yml` for local development against localhost is not a finding. Terraform `"*"` inside read-only `data` sources is excluded. Manifests under `test/`, `dev/`, or `local/` using localhost networking are excluded. `Dockerfile.dev` and `Dockerfile.local` are excluded unless a production deploy config references them.

## Phase 5 - Webhooks and integrations

Inbound endpoints that accept anything from anyone.

**Signature verification.** Find route handlers matching webhook, hook, or callback patterns. For each, check whether signature verification exists anywhere in the chain - look for `hmac`, `verify`, `digest`, `x-hub-signature`, `stripe-signature`, `svix`. A webhook route with no verification anywhere in its middleware chain is a finding.

**TLS verification disabled.** `rejectUnauthorized: false`, `verify=False`, `VERIFY_NONE`, `InsecureSkipVerify`, `NODE_TLS_REJECT_UNAUTHORIZED=0`.

**OAuth scopes.** Configurations requesting far more than the integration uses.

**Verification is code-tracing only.** Trace the handler through its router, middleware stack, and any gateway config. Never send an actual HTTP request to a webhook endpoint under audit.

**Severity.** CRITICAL for a webhook with no signature verification anywhere. HIGH for TLS verification disabled in production code paths, or excessive OAuth scopes. MEDIUM for undocumented outbound data flows to third parties.

**Phase FPs.** TLS checks disabled in test code are excluded. Internal service-to-service webhooks on a private network cap at MEDIUM. A gateway that verifies signatures upstream clears the finding, but you need evidence of it - a claim in a README does not count.

## Phase 6 - LLM and AI security

A newer attack class, and one most scanners miss entirely.

- **Prompt injection reach.** Does user-controlled content get interpolated into a **system** prompt or a tool schema? Trace the data flow; do not guess from proximity.
- **Unsanitized model output.** Model responses rendered through `dangerouslySetInnerHTML`, `v-html`, `innerHTML`, `.html()`, or `raw()`.
- **Tool calls without validation.** Tool and function-call results executed without checking arguments against a schema or allowlist.
- **Model API keys in code** rather than environment or a secret store.
- **Eval of model output.** `eval()`, `exec()`, `Function()`, `new Function` applied to a model response.
- **RAG poisoning.** Can an externally-controlled document reach the model through retrieval and change its behavior?
- **Cost amplification.** Can an unauthenticated user trigger unbounded model calls?

**Severity.** CRITICAL for user input reaching a system prompt, model output rendered as HTML, or eval of model output. HIGH for missing tool-call validation or an exposed model API key. MEDIUM for unbounded call volume or retrieval without input validation.

**Phase FPs.** User content in the **user-message** position of a conversation is not prompt injection - that is the design. Only flag when user content crosses into system prompts, tool schemas, or function-calling context.

## Phase 7 - Agent-skill supply chain

Installed agent skills are executable prompt code running with your tool permissions. Published research into skill marketplaces has repeatedly found a meaningful share carrying security flaws, and a smaller share outright malicious. Treat them as dependencies.

**Repo-local (automatic).** Scan skill files in the project's own skills directories for:

- Network exfiltration: `curl`, `wget`, `fetch` to unfamiliar hosts, especially near credential variables.
- Credential access: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, broad `process.env` or `os.environ` reads.
- Prompt injection: `ignore previous`, `disregard your instructions`, `system override`, `forget your instructions`.

**Global (requires permission).** Scanning globally installed skills and user settings reads files outside the repository. Ask first, in one question, and proceed repo-local if declined.

**Severity.** CRITICAL for credential exfiltration or prompt injection inside a skill file. HIGH for suspicious network calls or overly broad tool permissions. MEDIUM for skills from unverified sources with no review trail.

**Phase FPs.** A skill using `curl` to install a documented tool or hit a health endpoint needs context - flag it only when the destination is suspicious or the command carries credentials. Skills belonging to a marketplace the user deliberately installed are lower risk, but not automatically exempt; judge by behavior, not by source.

## Phase 8 - OWASP Top 10

Scope file types to the stack detected in step 1.

**A01 Broken access control.** Routes with authorization skipped or absent. Direct object references taken from request parameters. Can user A read user B's records by changing an ID? Is there horizontal or vertical privilege escalation?

**A02 Cryptographic failures.** MD5, SHA1, DES, ECB mode. Hardcoded keys. Sensitive data unencrypted at rest or in transit.

**A03 Injection.** SQL through string interpolation into raw queries. Command injection via `system`, `exec`, `spawn`, `popen`. Template injection and `eval`. Prompt injection is covered in phase 6.

**A04 Insecure design.** Rate limits on authentication endpoints. Account lockout after repeated failures. Business rules enforced server-side rather than in the client.

**A05 Security misconfiguration.** Wildcard CORS origins in production. Missing CSP. Debug mode or verbose error pages shipping to production.

**A06 Vulnerable components.** Covered by phase 2; do not duplicate findings here.

**A07 Authentication failures.** Session creation, storage, and invalidation. Password policy and breach checking. MFA availability and whether it is enforced for admin. JWT expiry and refresh rotation.

**A08 Integrity failures.** Pipeline protection is phase 3. Here: deserialization of untrusted input, and integrity checks on data pulled from external sources.

**A09 Logging and monitoring failures.** Are authentication events, authorization denials, and administrative actions recorded? Are those logs protected from tampering?

**A10 SSRF.** URLs constructed from user input. Whether internal services are reachable through a user-controlled URL. Allowlist enforcement on outbound requests.

## Phase 9 - STRIDE threat model

For each major component from step 1:

```
COMPONENT: <name>
  Spoofing:               Can an attacker impersonate a user or service?
  Tampering:              Can data be modified in transit or at rest?
  Repudiation:            Can an action be denied? Is there an audit trail?
  Information disclosure: What leaks, and to whom?
  Denial of service:      Can it be overwhelmed, and what depends on it?
  Elevation of privilege: Can a user reach something they should not?
```

Answer per component with a concrete yes/no and the reason. An unanswered row means the component was not actually modeled.

## Phase 10 - Data classification

```
RESTRICTED (breach = legal liability)
  Credentials:  where stored, how protected
  Payment data: where stored, compliance posture
  Personal data: what types, where stored, retention policy

CONFIDENTIAL (breach = business damage)
  API keys:     where stored, rotation policy
  Business logic: trade secrets in code
  Behavioral data: analytics and tracking

INTERNAL (breach = embarrassment)
  Logs:         what they contain, who can read them
  Config:       what surfaces in error messages

PUBLIC
  Documentation, marketing, public API surface
```

The value here is the mismatch: restricted data sitting in an internal-grade store, or personal data with no stated retention policy.
