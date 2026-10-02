# Report format

Detail for step 5 of [SKILL.md](./SKILL.md).

Two audiences: a human deciding what to fix this week, and the next audit run diffing against this one.
The prose serves the first, the JSON artifact serves the second.

## Findings table

Lead with this. It is the part that gets read.

```
SECURITY FINDINGS
═════════════════
#   Sev    Conf   Status      Category         Finding                          Phase   File:Line
──  ────   ────   ──────      ────────         ───────                          ─────   ─────────
1   CRIT   9/10   VERIFIED    Secrets          AWS key in git history           P1      .env:3
2   CRIT   9/10   VERIFIED    CI/CD            pull_request_target + checkout    P3      .github/workflows/ci.yml:12
3   HIGH   8/10   VERIFIED    Supply chain     postinstall in production dep     P2      package.json:41
4   HIGH   9/10   UNVERIFIED  Integrations     Webhook without signature check   P5      api/webhooks.ts:24
```

Sort by severity, then confidence. If there are no findings, say so in one line and do not pad the report with what you checked - the phase list already says that.

## Per-finding detail

```
## Finding N: <title> - <file>:<line>

- Severity:    CRITICAL | HIGH | MEDIUM
- Confidence:  N/10
- Status:      VERIFIED | UNVERIFIED | TENTATIVE
- Phase:       N - <phase name>
- Category:    Secrets | Supply chain | CI/CD | Infrastructure | Integrations |
               LLM security | Skill supply chain | OWASP A01-A10
- Evidence:    <the verbatim line(s) that motivate this finding>
- Description: <what is wrong>
- Exploit:     <step-by-step path an attacker takes>
- Impact:      <what the attacker gains>
- Fix:         <specific change, with example code>
```

The `Exploit` field is mandatory and it must be steps, not a category name.
"Unauthenticated endpoint" is not an exploit scenario.
"An attacker enumerates order IDs at `/api/orders/:id`, which reads the ID without an ownership check at line 34, returning any customer's shipping address" is.

The `Evidence` field is the pre-emit gate made visible. If it is empty, the finding does not belong in the main report.

## Incident response playbook

Include this inline whenever a leaked credential is found, ordered by urgency:

1. **Revoke** the credential at the provider. Before anything else, including the scrub.
2. **Rotate** - issue a replacement and deploy it.
3. **Scrub history** with `git filter-repo` or BFG Repo-Cleaner.
4. **Force-push** the cleaned history and tell collaborators to re-clone.
5. **Audit the exposure window** - when was it committed, when removed, was the repository ever public, was it in a fork or a CI cache?
6. **Check for abuse** in the provider's audit log across that entire window.

Steps 1 and 6 are the user's to perform. Report them; never execute them.

## Trend tracking

When prior reports exist under `.pro-dev/security/`, compare against the most recent:

```
SECURITY POSTURE TREND
══════════════════════
Compared to <date>:
  Resolved:     N fixed since last audit
  Persistent:   N still open
  New:          N discovered this run
  Direction:    IMPROVING | DEGRADING | STABLE
  Filter stats: N candidates -> M excluded -> K below gate -> J reported
```

Match findings across runs on `fingerprint` - a sha256 of category, file, and normalized title - so a shifted line number does not read as "resolved plus new."

The filter stats line is worth keeping honest. It shows the reader that a short report came from filtering, not from a shallow scan.

## Saved artifact

Write to `.pro-dev/security/<YYYY-MM-DD>-<HHMMSS>.json`.

`.pro-dev/` is created as a self-ignoring directory (it carries its own `.gitignore` containing `*`), matching how the validation handoff in `pro-quality` stores its output. Security reports stay local by default. If the project has configured `.pro-dev/` to be tracked, flag that in the report - these files name your unpatched vulnerabilities.

```json
{
  "version": "1.0.0",
  "date": "ISO-8601 datetime",
  "mode": "daily | comprehensive",
  "scope": "full | infra | code | skills | supply-chain | owasp",
  "diff_mode": false,
  "phases_run": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  "attack_surface": {
    "code": {
      "public_endpoints": 0, "authenticated": 0, "admin": 0, "api": 0,
      "uploads": 0, "integrations": 0, "background_jobs": 0, "websockets": 0
    },
    "infrastructure": {
      "ci_workflows": 0, "webhook_receivers": 0, "container_configs": 0,
      "iac_configs": 0, "deploy_targets": 0, "secret_management": "unknown"
    }
  },
  "findings": [
    {
      "id": 1,
      "severity": "CRITICAL",
      "confidence": 9,
      "status": "VERIFIED",
      "phase": 1,
      "phase_name": "Secrets archaeology",
      "category": "Secrets",
      "fingerprint": "sha256 of category + file + normalized title",
      "title": "",
      "file": "",
      "line": 0,
      "commit": "",
      "evidence": "",
      "description": "",
      "exploit_scenario": "",
      "impact": "",
      "recommendation": "",
      "playbook": "",
      "verification": "independently verified | self-verified"
    }
  ],
  "supply_chain": {
    "direct_deps": 0, "transitive_deps": 0,
    "critical_cves": 0, "high_cves": 0,
    "install_scripts": 0,
    "lockfile_present": true, "lockfile_tracked": true,
    "tools_skipped": []
  },
  "filter_stats": {
    "candidates": 0, "hard_excluded": 0,
    "below_gate": 0, "failed_verification": 0, "reported": 0
  },
  "totals": { "critical": 0, "high": 0, "medium": 0, "tentative": 0 },
  "trend": {
    "prior_report_date": null,
    "resolved": 0, "persistent": 0, "new": 0,
    "direction": "first_run"
  }
}
```

## Remediation roadmap

Close the report by putting the top findings to the user as decisions, one at a time, with a recommendation attached to each:

- **Fix now** - the specific change, with an effort estimate.
- **Mitigate** - a workaround that reduces exposure without the full fix.
- **Accept** - document why, and set a review date.
- **Defer** - into the project's tracker with a security label.

Recommend one per finding. A roadmap that lists options without a recommendation moves the work back to the person who asked for the audit.

## Protection files

Check for `.gitleaks.toml` or `.secretlintrc`. If neither exists, recommend adding one with a starter configuration - it turns phase 1 from a periodic scan into a commit-time gate.
