#!/usr/bin/env node
// Behaviour test for the pro-legal hooks: plan-gate, plan-doc-gate,
// ideation-nudge, release-gate and the shared classifier (legal_surface.py).
//
// check.mjs proves the hooks are wired and the scripts exist. This drives the
// real scripts the way Claude Code does - one process per case, the hook payload
// on stdin - and asserts what they emit. Every case must exit 0 (the hooks fail
// open and never use exit 2); the decision lives in the JSON on stdout.
//
//   node tests/legal-hooks.mjs
//   node tests/legal-hooks.mjs --only=release-gate     # substring filter on case id
//
// Cases within a group share per-session state on purpose (a deny followed by
// the identical retry), so --only is meant for whole groups, not single cases.
// tests/check.mjs imports `runLegalHookCases()`; its result shape matches
// runSecurityHookCases() in tests/security-hooks.mjs, plus `corpus` (the number
// of false-positive corpus cases that ran).
//
// State and plan files live in a temp dir (PRO_DEV_STATE_DIR / PRO_DEV_PLANS_DIR),
// git repos are throwaway. Zero dependencies, no network. Skips cleanly when
// python3 or git is not on PATH.

import { existsSync, mkdtempSync, mkdirSync, writeFileSync, rmSync, realpathSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPTS = join(ROOT, "plugins", "pro-legal", "scripts");
const S = (n) => join(SCRIPTS, n);

const NONE = "none";
const DENY = "deny";
const BLOCK = "block";
const CONTEXT = "context";

const LEGAL_PLAN = "# Plan\n\nScrape LinkedIn profiles to enrich leads and send cold email to them.\n";
const BENIGN_PLAN = "# Plan\n\nRework the footer layout and update the design tokens.\n";

// Ordinary engineering talk from this repo and its neighbours. None may produce a hit.
const BENIGN_CORPUS = [
  "add a PostToolUse hook to pro-data",
  "fork a subagent per plugin",
  "bump the version and update the CHANGELOG",
  "track progress in the task tracker",
  "refactor the session ledger",
  "add children to the tree node",
  "export the helper function",
  "rework design tokens",
  "tune the LLM prompt for the router",
  "subscribe to websocket events",
  "fix the auth session cookie expiry",
  "minor version bump",
  "add a license key check to the installer",
  "spawn a child process to run the formatter",
  "in terms of latency the hook is fine",
  "use named exports and export default for the router module",
  "set up issue tracking in Linear",
  "the forked process exits when the parent dies",
  "call fork() before exec",
  "keep a git fork of the upstream in sync",
  "add a Stop hook that checks stop_hook_active",
  "port the eval harness to the new runner",
  "reduce LLM token usage by trimming the context window",
  "write a SKILL.md for the model-router agent",
  "the HttpOnly session cookie should be rotated on login",
  "wire the subscription to message topics in the event bus",
  "update the README install instructions and run claude plugin validate",
  "add a design token for the card radius",
  "refactor the commit-gate tokenizer to handle quoted ampersands",
  "write a plan for the memory recall hook and the dream timer",
  "set up Playwright e2e tests for the demo app",
  "pass the children prop through the React component",
  "port from main to the release branch",
  "ship a .toml counterpart for each agent for Codex",
  "review the diff and fix the lint errors",
  "dispatch Sonnet subagents in parallel for each plugin edit",
  "add a progress tracking field to the session summary",
  "rename the helper and update the call sites",
  "cache the build hash so the model is not reloaded",
  "the hook returns a decision block with a reason on Stop",
  "replay the event stream to rebuild the projection",
  "the CLI flag overrides the config file",
  "transfer the file across the border of the grid layout",
  "label the PR and request review",
  "data residency of the cache in memory",
  "find strongly connected components with SCC and Tarjan",
  "track the DORA metrics for deploy frequency",
  "Dora from the support team joined the call",
  "the ATT&CK matrix maps to our detection rules",
  "wiretap the HTTP client in the unit test with a spy",
  "ask Pipa to review the layout",
  "the takedown of the staging cluster is scheduled tonight",
  "add an under-16 character limit to the title field",
  "generate a manifest for the build output",
  "the algorithm runs in linear time and files are sorted by name",
  "bot detection in the CI log parser",
  "add a data safety check to the migration script",
  "the age of the cache entry decides eviction",
];


const POSITIVES = [
  ["relicense-agpl", "relicense the project under AGPL", "oss-licensing"],
  ["vendor-in-copy-code", "vendor in the upstream parser and copy code from the other project", "oss-licensing"],
  ["gpl-library", "add GPL-3.0 licensed library", "oss-licensing"],
  ["attribution", "we need attribution for the forked skills", "oss-licensing"],
  ["pii-gdpr", "collect PII and comply with GDPR", "privacy"],
  ["analytics-cookie-banner", "add analytics and a cookie banner with consent", "privacy"],
  ["tracking-pixel", "add a tracking pixel and third-party cookies", "privacy"],
  ["retention-deletion", "data retention and account deletion flow", "privacy"],
  ["sell-user-data", "sell user data to partners", "privacy"],
  ["fine-tune-customer-data", "fine-tune on customer data", "ai"],
  ["ai-content-to-users", "AI-generated answers shown to end users", "ai"],
  ["customer-chatbot", "build a chatbot for customers", "ai"],
  ["voice-clone", "voice clone of the host", "ai"],
  ["face-recognition", "face recognition login", "ai"],
  ["automated-hiring", "automated decisions about hiring", "ai"],
  ["eu-ai-act", "EU AI Act compliance", "ai"],
  ["scrape-crawler-proxies", "scrape the site with a crawler and rotate proxies", "scraping"],
  ["harvest-emails", "harvest emails for lead enrichment", "scraping"],
  ["bypass-rate-limits", "bypass rate limits on the API", "scraping"],
  ["auto-renew-trial", "auto-renew subscription with free trial that converts", "consumer"],
  ["cancellation-dark-patterns", "a cancellation flow with dark patterns", "consumer"],
  ["email-marketing", "email marketing newsletter blasts", "marketing-comms"],
  ["sms-marketing", "SMS marketing and text message campaigns", "marketing-comms"],
  ["children-coppa", "COPPA age verification for under 13 kids app", "children"],
  ["hipaa-phi", "HIPAA health data and PHI", "sensitive-data"],
  ["kyc-credit", "KYC and credit score checks", "sensitive-data"],
  ["export-control", "export control EAR ITAR OFAC sanctions", "export"],
  ["embargo-encryption", "ship encryption to embargoed countries", "export"],
  ["wcag-508", "WCAG and Section 508 compliance", "accessibility"],
  ["eaa", "the European Accessibility Act", "accessibility"],
  ["rename-trademark", "rename the product and check the trademark", "trademark"],
  ["client-ip", "client owns the work for hire IP assignment under the NDA", "client-ip"],
  ["terms-privacy-policy", "update the terms of service and privacy policy", "terms"],
  ["tos-api-terms", "check the ToS of the Stripe API terms", "terms"],
  ["pipeda-canada", "check PIPEDA for the Canadian launch", "privacy"],
  ["quebec-law-25", "Quebec Law 25 privacy officer requirement", "privacy"],
  ["bill-64", "we need to comply with Bill 64", "privacy"],
  ["lgpd-brazil", "LGPD and the ANPD for Brazilian users", "privacy"],
  ["pipl-china", "PIPL consent for Chinese users", "privacy"],
  ["dpdp-india", "India Digital Personal Data Protection Act duties", "privacy"],
  ["appi-japan", "APPI cross-border rules for Japan", "privacy"],
  ["pipa-korea", "Korean PIPA consent rules", "privacy"],
  ["nfadp-swiss", "the revised FADP in Switzerland", "privacy"],
  ["pdpa-popia-kvkk", "PDPA and POPIA and KVKK coverage", "privacy"],
  ["caloppa", "update the CalOPPA privacy policy link", "privacy+terms"],
  ["cipa-session-replay", "CIPA exposure from session replay on the checkout", "privacy"],
  ["wiretap-claims", "chat widget wiretap claims in California", "privacy"],
  ["delete-act-data-broker", "register under the Delete Act as a data broker", "privacy"],
  ["breach-notification", "write the breach notification runbook", "privacy"],
  ["data-residency-laws", "data residency requirements for Indian customers", "privacy"],
  ["cross-border-sccs", "cross-border transfer under standard contractual clauses", "privacy"],
  ["privacy-manifest", "ship the iOS privacy manifest and App Tracking Transparency prompt", "privacy"],
  ["play-data-safety", "fill in the Data safety form and the privacy nutrition label", "privacy"],
  ["ai-basic-act", "AI Basic Act obligations for Korea", "ai"],
  ["ai-content-labels", "AI-generated content label rules in China", "ai"],
  ["algorithm-filing", "algorithm filing and generative AI measures", "ai"],
  ["tdm-opt-out", "honour the TDM opt-out under text and data mining rules", "ai"],
  ["bot-disclosure", "add a bot disclosure to the support widget", "ai"],
  ["under-16-ban", "under-16 social media ban for Australia", "children"],
  ["age-assurance", "age assurance for the new feed", "children"],
  ["casl-spam-act", "CASL in Canada and the Spam Act in Australia", "marketing-comms"],
  ["app-store-guidelines", "check the App Store Review Guidelines and Google Play policy", "terms"],
  ["dmca-agent", "register a DMCA designated agent and a takedown process", "terms"],
  ["section-230-ugc", "Section 230 and user-generated content moderation", "terms"],
  ["clickwrap", "clickwrap not browsewrap at signup", "terms"],
  ["account-deletion-requirement", "account deletion requirement for the app", "privacy+terms"],
  ["invention-assignment", "invention assignment for the contractor", "client-ip"],
  ["cla-dco", "a CLA or the Developer Certificate of Origin for contributors", "client-ip"],
  ["noncompete", "does the noncompete bind the freelancer", "client-ip"],
  ["work-made-for-hire", "work made for hire language in the SOW", "client-ip"],
  ["dmcc-drip", "UK DMCC subscription contracts regime and drip pricing", "consumer"],
  ["nis2-dora", "NIS2 and DORA ICT risk for EU financial customers", "sensitive-data"],
  ["dora-resilience", "Digital Operational Resilience testing", "sensitive-data"],
  ["linkedin-cold-email", "plan: scrape LinkedIn profiles to enrich leads and send cold email", "marketing-comms+scraping"],
];

function run(script, payload, env) {
  const input = typeof payload === "string" ? payload : JSON.stringify(payload);
  return spawnSync("python3", [S(script)], { input, encoding: "utf8", timeout: 30_000, env: { ...process.env, ...env } });
}

function classifyOutput(res) {
  if (res.error) return { actual: `error:${res.error.message}`, detail: "" };
  if (res.status !== 0) return { actual: `exit${res.status}`, detail: res.stderr || "" };
  const out = (res.stdout || "").trim();
  if (!out) return { actual: NONE, detail: "" };
  try {
    const j = JSON.parse(out);
    if (j.hookSpecificOutput?.permissionDecision === "deny") return { actual: DENY, detail: j.hookSpecificOutput.permissionDecisionReason, json: j };
    if (j.decision === "block") return { actual: BLOCK, detail: j.reason, json: j };
    if (j.hookSpecificOutput?.additionalContext) return { actual: CONTEXT, detail: j.hookSpecificOutput.additionalContext, json: j };
    return { actual: "unknown-json", detail: out };
  } catch {
    return { actual: "bad-json", detail: out };
  }
}

function sh(cmd, args, cwd) {
  const r = spawnSync(cmd, args, { cwd, encoding: "utf8", env: { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null" } });
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(" ")} failed: ${r.stderr}`);
  return r.stdout;
}

function write(dir, rel, body) {
  const p = join(dir, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, body);
  return p;
}

function initRepo(base) {
  const dir = realpathSync(mkdtempSync(join(base, "repo-")));
  sh("git", ["init", "-q", "-b", "main"], dir);
  sh("git", ["config", "user.email", "t@example.com"], dir);
  sh("git", ["config", "user.name", "T"], dir);
  sh("git", ["config", "commit.gpgsign", "false"], dir);
  return dir;
}

const MIT_TEXT = "MIT License\n\nPermission is hereby granted, free of charge, to any person obtaining a copy.\n";
const pkgJson = (extra = {}, deps = {}) => JSON.stringify({ name: "demo", version: "1.0.0", license: "MIT", ...extra, dependencies: deps }, null, 2) + "\n";

// A repo that passes release hygiene: LICENSE, package.json with a license, tagged v0.1.0.
function makeReleaseRepo(base, { tag = true, license = true, pkgLicense = true } = {}) {
  const dir = initRepo(base);
  write(dir, "README.txt", "base\n");
  write(dir, "style.css", "a { color: red; }\n");
  if (license) write(dir, "LICENSE", MIT_TEXT);
  write(dir, "package.json", pkgLicense ? pkgJson() : JSON.stringify({ name: "demo", version: "1.0.0", dependencies: {} }, null, 2) + "\n");
  sh("git", ["add", "."], dir);
  sh("git", ["commit", "-q", "-m", "base"], dir);
  if (tag) sh("git", ["tag", "v0.1.0"], dir);
  return dir;
}

function commitAll(dir, msg = "change") {
  sh("git", ["add", "."], dir);
  sh("git", ["commit", "-q", "-m", msg], dir);
}

const POSTHOG_CODE = 'import posthog from "posthog-js";\nposthog.init("key");\n';

export function runLegalHookCases({ only = null } = {}) {
  const out = { skipped: null, selected: [], results: [], corpus: 0 };
  for (const bin of ["python3", "git"]) {
    if (spawnSync(bin, ["--version"], { stdio: "ignore" }).error) return { ...out, skipped: `${bin} not found on PATH` };
  }
  for (const f of ["legal_surface.py", "plan-gate.py", "plan-doc-gate.py", "ideation-nudge.py", "release-gate.py"]) {
    if (!existsSync(S(f))) return { ...out, skipped: `${S(f)} not found` };
  }

  const tmp = realpathSync(mkdtempSync(join(tmpdir(), "legal-hooks-")));
  const stateDir = join(tmp, "state");
  const plansDir = join(tmp, "plans");
  mkdirSync(plansDir, { recursive: true });
  const env = { PRO_DEV_STATE_DIR: stateDir, PRO_DEV_PLANS_DIR: plansDir };
  const cases = [];
  const add = (id, expect, fn) => cases.push({ id, expect, fn });
  const reasonHas = (r, ...res) => {
    const c = classifyOutput(r);
    const missing = res.filter((re) => !re.test(c.detail));
    return missing.length ? { status: r.status, stdout: "", stderr: `reason missing ${missing.join(" ")}: ${c.detail}` } : r;
  };

  // ── classifier: prose ──────────────────────────────────────────────────
  const classify = (text, flag) => {
    const r = spawnSync("python3", [S("legal_surface.py"), ...(flag ? [flag] : [])], { input: text, encoding: "utf8" });
    return { status: r.status, actual: (r.stdout || "").trim().split("\n").filter(Boolean).join("+") || NONE, detail: r.stderr };
  };
  for (const [id, input, expect] of POSITIVES) add(`classifier/${id}`, expect, () => classify(input));
  BENIGN_CORPUS.forEach((input, i) => {
    add(`classifier/benign-${String(i + 1).padStart(2, "0")}`, NONE, () => classify(input));
  });
  out.corpus = BENIGN_CORPUS.length;
  add("classifier/benign-acronym-case-sensitive", NONE, () => classify("I can hear it near the ear, and the ada lovelace talk was good"));
  add("classifier/empty", NONE, () => classify(""));

  // ── classifier: diffs ──────────────────────────────────────────────────
  const dcls = (id, diff, expect) => add(`classifier/diff-${id}`, expect, () => classify(diff, "--diff"));
  const mk = (path, added, mode = "") =>
    `diff --git a/${path} b/${path}\n${mode}--- ${mode ? "/dev/null" : "a/" + path}\n+++ b/${path}\n@@ -1 +1,${added.length + 1} @@\n${added.map((l) => "+" + l).join("\n")}\n`;
  dcls("empty", "", NONE);
  dcls("css-only", mk("style.css", ["a { color: blue; }"]), NONE);
  dcls("version-bump", 'diff --git a/package.json b/package.json\n--- a/package.json\n+++ b/package.json\n@@ -1,3 +1,3 @@\n {\n-  "version": "1.0.0",\n+  "version": "1.0.1",\n   "name": "x"\n', NONE);
  dcls("new-dep-without-root-is-silent", 'diff --git a/package.json b/package.json\n--- a/package.json\n+++ b/package.json\n@@ -5,3 +5,4 @@\n   "dependencies": {\n+    "left-pad": "^1.3.0",\n     "react": "^18.0.0"\n', NONE);
  dcls("license-file-change", mk("LICENSE", ["GNU Affero General Public License"]), "oss-licensing");
  dcls("license-file-in-plugin", mk("plugins/x/LICENSE", ["MIT License"]), "oss-licensing");
  dcls("notice-file", mk("NOTICE.txt", ["bundled software"]), "oss-licensing");
  dcls("license-key-module-is-not-a-license-file", mk("src/license-key.ts", ["export const k = 1;"]), NONE);
  dcls("vendor-addition", mk("vendor/lib/a.js", ["x"], "new file mode 100644\n"), "oss-licensing");
  dcls("third-party-addition", mk("third_party/b/c.c", ["x"], "new file mode 100644\n"), "oss-licensing");
  dcls("vendor-edit-without-new", mk("vendor/lib/a.js", ["x"]), NONE);
  dcls("spdx-gpl-header", mk("src/a.ts", ["// SPDX-License-Identifier: GPL-3.0-only"]), "oss-licensing");
  dcls("spdx-lgpl-header", mk("src/a.ts", ["// SPDX-License-Identifier: LGPL-2.1"]), "oss-licensing");
  dcls("spdx-mit-header", mk("src/a.ts", ["// SPDX-License-Identifier: MIT"]), NONE);
  dcls("gnu-text-in-doc-is-silent", mk("docs/third-party.md", ["GNU Lesser General Public License"]), NONE);
  dcls("gnu-text-in-skill-reference-is-silent", mk("plugins/pro-legal/skills/software-counsel/legal-landscape.md", ["- GNU Affero General Public License v3"]), NONE);
  dcls("spdx-gpl-in-doc", mk("docs/snippet.md", ["<!-- SPDX-License-Identifier: GPL-2.0-or-later -->"]), "oss-licensing");
  dcls("gnu-text-in-source", mk("src/vendored.c", ["/* This program is free software under the GNU General Public License */"]), "oss-licensing");
  dcls("sspl-text", mk("src/b.ts", ["// Server Side Public License"]), "oss-licensing");
  dcls("bsl-text", mk("src/b.ts", ["// Business Source License 1.1"]), "oss-licensing");
  dcls("md-about-analytics-is-silent", mk("README.md", ["we use posthog and mixpanel and nodemailer"]), NONE);
  dcls("posthog", mk("src/track.ts", ['import posthog from "posthog-js";']), "privacy");
  dcls("gtag", mk("src/a.ts", ["gtag('event', 'x');"]), "privacy");
  dcls("segment", mk("src/a.ts", ['import { AnalyticsBrowser } from "@segment/analytics-next";']), "privacy");
  dcls("privacy-page-path", mk("app/privacy/page.tsx", ["export default function P() { return null; }"]), "privacy");
  dcls("cookie-consent-path", mk("src/cookie-consent.tsx", ["x"]), "privacy");
  dcls("analytics-module-path", mk("src/lib/analytics.ts", ["x"]), "privacy");
  dcls("issue-tracking-module-is-silent", mk("src/issue-tracking.ts", ["x"]), NONE);
  dcls("terms-page-path", mk("app/terms-of-service/page.tsx", ["x"]), "terms");
  dcls("legal-dir-path", mk("src/legal/notice.tsx", ["x"]), "terms");
  dcls("nodemailer", mk("src/mail.ts", ['import nodemailer from "nodemailer";']), "marketing-comms");
  dcls("sendgrid", mk("src/mail.ts", ['import sg from "@sendgrid/mail";']), "marketing-comms");
  dcls("resend-import", mk("src/mail.ts", ['import { Resend } from "resend";']), "marketing-comms");
  dcls("resend-the-request-is-silent", mk("src/net.ts", ["// resend the request on failure"]), NONE);
  dcls("twilio-messages-create", mk("src/sms.ts", ['const twilio = require("twilio")(a, b);', "twilio.messages.create({ to, from, body });"]), "marketing-comms");
  dcls("anthropic-messages-create-is-silent", mk("src/llm.ts", ["const r = await client.messages.create({ model, max_tokens: 10 });"]), NONE);
  dcls("stripe-subscriptions", mk("src/bill.ts", ["await stripe.subscriptions.create({ customer });"]), "consumer");
  dcls("trial-period-days", mk("src/bill.ts", ["trial_period_days: 14,"]), "consumer");
  dcls("face-api", mk("src/f.ts", ['import * as faceapi from "face-api.js";']), "ai+sensitive-data");
  dcls("linkedin-profile-url", mk("src/s.ts", ['const u = "https://www.linkedin.com/in/someone";']), "scraping");
  dcls("stealth-plugin", mk("src/s.ts", ['import s from "puppeteer-extra-plugin-stealth";']), "scraping");
  dcls("rrweb-session-replay", mk("src/replay.ts", ['import { record } from "rrweb";']), "privacy");
  dcls("logrocket", mk("src/replay.ts", ['import LogRocket from "logrocket";']), "privacy");
  dcls("fullstory-scoped", mk("src/fs.ts", ['import * as FullStory from "@fullstory/browser";']), "privacy");
  dcls("smartlook-mouseflow", mk("src/r.ts", ['smartlook("init", key); // mouseflow too']), "privacy");
  dcls("intercom-sdk-import", mk("src/chat.ts", ['import Intercom from "@intercom/messenger-js-sdk";']), "privacy");
  dcls("intercom-call", mk("src/chat.ts", ['window.Intercom("boot", { app_id });', "intercom('boot');"]), "privacy");
  dcls("crisp-chat", mk("src/chat.ts", ['s.src = "https://client.crisp.chat/l.js";']), "privacy");
  dcls("drift-com", mk("src/chat.ts", ['s.src = "https://js.driftt.com/include/x.js"; // drift.com widget']), "privacy");
  dcls("replay-sdk-in-doc-is-silent", mk("README.md", ["we considered rrweb and logrocket"]), NONE);
  dcls("replay-word-is-silent", mk("src/stream.ts", ["// replay the event stream from offset 0"]), NONE);
  dcls("ios-privacy-manifest-path", mk("ios/App/PrivacyInfo.xcprivacy", ["<plist/>"]), "privacy");
  dcls("ios-tracking-usage-description", mk("ios/App/Info.plist", ["<key>NSUserTrackingUsageDescription</key>"]), "privacy");
  dcls("ios-att-manager", mk("ios/App/Track.swift", ["ATTrackingManager.requestTrackingAuthorization { _ in }"]), "privacy");
  dcls("android-advertising-id", mk("android/app/Ads.kt", ["val info = AdvertisingIdClient.getAdvertisingIdInfo(ctx)"]), "privacy");
  dcls("android-ad-id-permission", mk("android/app/src/main/AndroidManifest.xml", ['<uses-permission android:name="com.google.android.gms.permission.AD_ID"/>']), "privacy");
  dcls("deleted-license-is-silent", "diff --git a/LICENSE b/LICENSE\ndeleted file mode 100644\n--- a/LICENSE\n+++ /dev/null\n@@ -1 +0,0 @@\n-MIT\n", NONE);

  // ── plan-gate ──────────────────────────────────────────────────────────
  const planPayload = (sid, toolInput) => ({ session_id: sid, cwd: tmp, hook_event_name: "PreToolUse", tool_name: "ExitPlanMode", tool_input: toolInput });
  const pg = (sid, toolInput) => run("plan-gate.py", planPayload(sid, toolInput), env);
  add("plan-gate/benign-plan-passes", NONE, () => pg("pg1", { plan: BENIGN_PLAN }));
  add("plan-gate/legal-plan-denied", DENY, () => pg("pg2", { plan: LEGAL_PLAN }));
  add("plan-gate/reason-names-categories-agent-and-parallel-note", DENY, () => {
    const r = pg("pg2b", { plan: LEGAL_PLAN });
    return reasonHas(r, /scraping/, /software-counsel/, /## Legal review/, /plan mode/,
      /dispatch `security-architect` and `software-counsel` in parallel in one turn/);
  });
  add("plan-gate/plan-with-section-passes", NONE, () => pg("pg3", { plan: `${LEGAL_PLAN}\n## Legal review\n\nBlocking: none.\n` }));
  add("plan-gate/heading-is-case-insensitive", NONE, () => pg("pg3b", { plan: `${LEGAL_PLAN}\n## legal review\n\nfine\n` }));
  add("plan-gate/two-denials-then-escape-hatch", DENY, () => pg("pg4", { plan: LEGAL_PLAN }));
  add("plan-gate/two-denials-then-escape-hatch#2", DENY, () => pg("pg4", { plan: LEGAL_PLAN }));
  add("plan-gate/two-denials-then-escape-hatch#3", NONE, () => pg("pg4", { plan: LEGAL_PLAN }));
  const planFile = write(tmp, "elsewhere/my-plan.md", LEGAL_PLAN);
  add("plan-gate/reads-planFilePath", DENY, () => pg("pg5", { planFilePath: planFile }));
  add("plan-gate/no-plan-anywhere-passes", NONE, () => pg("pg6", {}));
  const transcript = (name, entries) => write(tmp, `transcripts/${name}.jsonl`, entries.map((e) => JSON.stringify(e)).join("\n") + "\n");
  const attachment = (planPath) => ({ type: "attachment", attachment: { type: "plan_mode", planFilePath: planPath } });
  const writeUse = (fp, content) => ({ type: "assistant", message: { content: [{ type: "tool_use", name: "Write", input: { file_path: fp, content } }] } });
  const pgT = (sid, tPath) => run("plan-gate.py", { ...planPayload(sid, {}), transcript_path: tPath }, env);
  add("plan-gate/transcript-attachment-plan-on-disk", DENY, () => {
    const plan = write(tmp, ".claude/plans/session-plan.md", LEGAL_PLAN);
    return pgT("pg7", transcript("t7", [attachment(plan)]));
  });
  add("plan-gate/transcript-benign-plan-passes", NONE, () => {
    const plan = write(tmp, ".claude/plans/benign-plan.md", BENIGN_PLAN);
    return pgT("pg7b", transcript("t7b", [attachment(plan), writeUse(plan, BENIGN_PLAN)]));
  });
  add("plan-gate/transcript-blocked-write-uses-content", DENY, () => {
    const missing = join(tmp, ".claude/plans/never-written.md");
    return pgT("pg7c", transcript("t7c", [attachment(missing), writeUse(missing, LEGAL_PLAN)]));
  });
  add("plan-gate/transcript-project-plan-doc", DENY, () => {
    const plan = write(tmp, "docs/plans/2026-10-02-leads.md", LEGAL_PLAN);
    return pgT("pg7d", transcript("t7d", [writeUse(plan, LEGAL_PLAN)]));
  });
  const SECTION_PLAN = `${LEGAL_PLAN}\n## Legal review\n\nVerdict: proceed\n`;
  const agentUse = (type) => ({ type: "assistant", message: { content: [{ type: "tool_use", name: "Agent", input: { subagent_type: type, prompt: "plan mode" } }] } });
  const taskUse = (type) => ({ type: "assistant", message: { content: [{ type: "tool_use", name: "Task", input: { subagent_type: type, prompt: "plan mode" } }] } });
  const skillUse = (skill) => ({ type: "assistant", message: { content: [{ type: "tool_use", name: "Skill", input: { skill } }] } });
  add("plan-gate/self-written-section-denied", DENY, () => {
    const plan = write(tmp, ".claude/plans/self-review.md", SECTION_PLAN);
    const r = pgT("pg9", transcript("t9", [attachment(plan), writeUse(plan, SECTION_PLAN)]));
    return reasonHas(r, /does not count/);
  });
  add("plan-gate/section-after-counsel-agent-passes", NONE, () => {
    const plan = write(tmp, ".claude/plans/agent-review.md", SECTION_PLAN);
    return pgT("pg10", transcript("t10", [attachment(plan), agentUse("pro-legal:software-counsel"), writeUse(plan, SECTION_PLAN)]));
  });
  add("plan-gate/section-after-counsel-task-passes", NONE, () => {
    const plan = write(tmp, ".claude/plans/task-review.md", SECTION_PLAN);
    return pgT("pg10b", transcript("t10b", [attachment(plan), taskUse("software-counsel"), writeUse(plan, SECTION_PLAN)]));
  });
  add("plan-gate/section-after-counsel-skill-passes", NONE, () => {
    const plan = write(tmp, ".claude/plans/skill-review.md", SECTION_PLAN);
    return pgT("pg11", transcript("t11", [attachment(plan), skillUse("pro-legal:software-counsel"), writeUse(plan, SECTION_PLAN)]));
  });
  add("plan-gate/section-after-legal-review-skill-passes", NONE, () => {
    const plan = write(tmp, ".claude/plans/lr-review.md", SECTION_PLAN);
    return pgT("pg11b", transcript("t11b", [attachment(plan), skillUse("pro-legal:legal-review"), writeUse(plan, SECTION_PLAN)]));
  });
  add("plan-gate/unrelated-agent-does-not-count", DENY, () => {
    const plan = write(tmp, ".claude/plans/explore-review.md", SECTION_PLAN);
    return pgT("pg12", transcript("t12", [attachment(plan), agentUse("Explore"), writeUse(plan, SECTION_PLAN)]));
  });
  add("plan-gate/security-architect-does-not-count", DENY, () => {
    const plan = write(tmp, ".claude/plans/sec-review.md", SECTION_PLAN);
    return pgT("pg12b", transcript("t12b", [attachment(plan), agentUse("pro-security:security-architect"), writeUse(plan, SECTION_PLAN)]));
  });
  add("plan-gate/other-sessions-plan-files-ignored", NONE, () => {
    write(plansDir, "someone-elses-plan.md", LEGAL_PLAN);
    return pgT("pg8", transcript("t8", [{ type: "user", message: { content: [{ type: "text", text: "plan the footer" }] } }]));
  });
  add("plan-gate/malformed-stdin-passes", NONE, () => run("plan-gate.py", "{not json", env));
  add("plan-gate/non-object-payload-passes", NONE, () => run("plan-gate.py", "[1,2]", env));

  // ── plan-doc-gate ──────────────────────────────────────────────────────
  const docRepo = initRepo(tmp);
  const docPayload = (sid, file) => ({ session_id: sid, cwd: docRepo, hook_event_name: "PostToolUse", tool_name: "Write", tool_input: { file_path: file } });
  const pd = (sid, file) => run("plan-doc-gate.py", docPayload(sid, file), env);
  const planDoc = write(docRepo, "docs/plans/x.md", LEGAL_PLAN);
  add("plan-doc-gate/legal-plan-blocks", BLOCK, () => {
    const r = pd("pd1", planDoc);
    return reasonHas(r, /legal surface/, /software-counsel/, /## Legal review/, /in parallel in one turn/);
  });
  add("plan-doc-gate/second-time-passes", NONE, () => pd("pd1", planDoc));
  add("plan-doc-gate/different-file-blocks-again", BLOCK, () => pd("pd1", write(docRepo, "docs/superpowers/specs/y.md", LEGAL_PLAN)));
  add("plan-doc-gate/spdd-prompt-blocks", BLOCK, () => pd("pd1b", write(docRepo, "spdd/prompt/z.md", LEGAL_PLAN)));
  add("plan-doc-gate/non-plan-path-passes", NONE, () => pd("pd2", write(docRepo, "docs/notes.md", LEGAL_PLAN)));
  add("plan-doc-gate/plan-with-section-passes", NONE, () => pd("pd3", write(docRepo, "docs/plans/ok.md", `${LEGAL_PLAN}\n## Legal review\nfine\n`)));
  const pdT = (sid, file, tPath) => run("plan-doc-gate.py", { ...docPayload(sid, file), transcript_path: tPath }, env);
  add("plan-doc-gate/self-written-section-blocks", BLOCK, () => {
    const f = write(docRepo, "docs/plans/self.md", SECTION_PLAN);
    return pdT("pd7", f, transcript("t13", [writeUse(f, SECTION_PLAN)]));
  });
  add("plan-doc-gate/section-after-counsel-passes", NONE, () => {
    const f = write(docRepo, "docs/plans/reviewed.md", SECTION_PLAN);
    return pdT("pd8", f, transcript("t14", [agentUse("pro-legal:software-counsel"), writeUse(f, SECTION_PLAN)]));
  });
  add("plan-doc-gate/benign-plan-passes", NONE, () => pd("pd4", write(docRepo, "docs/plans/benign.md", BENIGN_PLAN)));
  add("plan-doc-gate/claude-plans-dir-blocks", BLOCK, () => pd("pd5", write(plansDir, "fresh.md", LEGAL_PLAN)));
  add("plan-doc-gate/missing-file-passes", NONE, () => pd("pd6", join(docRepo, "docs/plans/missing.md")));
  add("plan-doc-gate/malformed-stdin-passes", NONE, () => run("plan-doc-gate.py", "", env));

  // ── ideation-nudge ─────────────────────────────────────────────────────
  const nudge = (sid, prompt) => run("ideation-nudge.py", { session_id: sid, cwd: tmp, hook_event_name: "UserPromptSubmit", prompt }, env);
  add("ideation-nudge/scrape-plan-nudges", CONTEXT, () => {
    const r = nudge("in1", "let's plan a feature that scrapes LinkedIn to enrich leads");
    return reasonHas(r, /^Legal note/, /scraping/, /software-counsel/, /## Legal review/);
  });
  add("ideation-nudge/same-topic-silent-second-time", NONE, () => nudge("in1", "let's plan a feature that scrapes LinkedIn to enrich leads"));
  add("ideation-nudge/new-topic-nudges-again", CONTEXT, () => nudge("in1", "how should we design the cookie banner and consent flow"));
  add("ideation-nudge/benign-plan-silent", NONE, () => nudge("in2", "plan the footer layout"));
  add("ideation-nudge/repo-talk-plan-silent", NONE, () => nudge("in2b", "plan how to fork a subagent per plugin and bump the minor version"));
  add("ideation-nudge/not-planning-silent", NONE, () => nudge("in3", "fix the scraper timeout"));
  add("ideation-nudge/slash-command-silent", NONE, () => nudge("in4", "/commit the cold email plan"));
  add("ideation-nudge/slash-plan-nudges", CONTEXT, () => nudge("in5", "/plan collect PII for a marketing list"));
  add("ideation-nudge/llm-token-design-silent", NONE, () => nudge("in6", "design a token budget for the context window"));
  add("ideation-nudge/malformed-stdin-passes", NONE, () => run("ideation-nudge.py", "garbage", env));

  // ── release-gate ───────────────────────────────────────────────────────
  const rg = (sid, cwd, command) => run("release-gate.py", { session_id: sid, cwd, hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: { command } }, env);

  const t1 = makeReleaseRepo(tmp);
  write(t1, "src/track.ts", POSTHOG_CODE);
  commitAll(t1, "add tracking");
  add("release-gate/tag-with-analytics-denied", DENY, () =>
    reasonHas(rg("rg1", t1, "git tag v0.2.0"), /kind: tag/, /privacy/, /src\/track\.ts/, /software-counsel/, /release mode/, /git -C .* diff v0\.1\.0\.\.HEAD/));
  add("release-gate/identical-retry-passes", NONE, () => rg("rg1", t1, "git tag v0.2.0"));
  add("release-gate/other-session-denied-again", DENY, () => rg("rg1-other", t1, "git tag v0.2.0"));
  add("release-gate/tag-annotated-denied", DENY, () => rg("rg1b", t1, 'git tag -a v0.2.0 -m "release it"'));
  add("release-gate/tag-signed-denied", DENY, () => rg("rg1c", t1, "git tag -s v0.2.0 -m x"));
  add("release-gate/git-tag-bare-list-passes", NONE, () => rg("rg1d", t1, "git tag"));
  add("release-gate/git-tag-l-passes", NONE, () => rg("rg1e", t1, "git tag -l"));
  add("release-gate/git-tag-list-pattern-passes", NONE, () => rg("rg1f", t1, "git tag --list 'v*'"));
  add("release-gate/git-tag-d-passes", NONE, () => rg("rg1g", t1, "git tag -d v0.1.0"));
  add("release-gate/git-tag-delete-passes", NONE, () => rg("rg1h", t1, "git tag --delete v0.1.0"));
  add("release-gate/git-tag-contains-passes", NONE, () => rg("rg1i", t1, "git tag --contains HEAD"));
  add("release-gate/git-tag-sort-passes", NONE, () => rg("rg1j", t1, "git tag --sort=-v:refname"));
  add("release-gate/chain-with-C-denied", DENY, () => rg("rg1k", tmp, `cd /nonexistent; FOO=1 git -C ${t1} tag v0.3.0 && echo done`));
  add("release-gate/gh-release-create-denied", DENY, () =>
    reasonHas(rg("rg2", t1, 'gh release create v0.2.0 --notes "x"'), /kind: release/));
  add("release-gate/npm-publish-denied", DENY, () =>
    reasonHas(rg("rg3", t1, "npm publish --access public"), /kind: publish/));
  add("release-gate/pnpm-publish-denied", DENY, () => rg("rg3b", t1, "pnpm publish --no-git-checks"));
  add("release-gate/yarn-npm-publish-denied", DENY, () => rg("rg3c", t1, "yarn npm publish"));
  add("release-gate/cargo-publish-denied", DENY, () => rg("rg3d", t1, "cargo publish"));
  add("release-gate/twine-upload-denied", DENY, () => rg("rg3e", t1, "twine upload dist/*"));
  add("release-gate/gem-push-denied", DENY, () => rg("rg3f", t1, "gem push foo-1.0.gem"));
  add("release-gate/npm-run-publish-script-passes", NONE, () => rg("rg3g", t1, "npm run publish"));
  add("release-gate/npm-install-passes", NONE, () => rg("rg3h", t1, "npm install left-pad"));
  add("release-gate/vercel-prod-denied", DENY, () =>
    reasonHas(rg("rg4", t1, "vercel --prod"), /kind: deploy/));
  add("release-gate/npx-vercel-deploy-prod-denied", DENY, () => rg("rg4b", t1, "npx vercel deploy --prod"));
  add("release-gate/fly-deploy-denied", DENY, () => rg("rg4c", t1, "fly deploy"));
  add("release-gate/firebase-deploy-denied", DENY, () => rg("rg4d", t1, "firebase deploy --only hosting"));
  add("release-gate/netlify-deploy-prod-denied", DENY, () => rg("rg4e", t1, "netlify deploy --prod"));
  add("release-gate/vercel-preview-passes", NONE, () => rg("rg4f", t1, "vercel"));
  add("release-gate/netlify-deploy-draft-passes", NONE, () => rg("rg4g", t1, "netlify deploy"));

  const t2 = makeReleaseRepo(tmp);
  write(t2, "style.css", "a { color: blue; }\n");
  commitAll(t2, "css");
  add("release-gate/clean-tag-passes", NONE, () => rg("rg5", t2, "git tag v0.2.0"));
  add("release-gate/clean-publish-passes", NONE, () => rg("rg5b", t2, "npm publish"));
  add("release-gate/clean-deploy-passes", NONE, () => rg("rg5c", t2, "vercel --prod"));

  const t3 = makeReleaseRepo(tmp);
  write(t3, "notes.md", "# Notes\n\nWe use posthog, scrape LinkedIn and send cold email under GDPR.\n");
  commitAll(t3, "docs");
  add("release-gate/markdown-only-tag-passes", NONE, () => rg("rg6", t3, "git tag v0.2.0"));

  // first release: no tag yet, whole tree is the diff
  const f1 = makeReleaseRepo(tmp, { tag: false, license: false });
  add("release-gate/first-release-without-license-hygiene-denied", DENY, () =>
    reasonHas(rg("rg7", f1, "git tag v1.0.0"), /release-hygiene/, /no LICENSE or COPYING file/, /kind: tag/, /git -C .* diff [0-9a-f]{40}\.\.HEAD/));
  add("release-gate/first-release-hygiene-retry-passes", NONE, () => rg("rg7", f1, "git tag v1.0.0"));
  add("release-gate/hygiene-applies-to-publish", DENY, () => reasonHas(rg("rg7b", f1, "npm publish"), /release-hygiene/));
  add("release-gate/hygiene-skips-deploy", NONE, () => rg("rg7c", f1, "vercel --prod"));
  const f2 = makeReleaseRepo(tmp, { tag: false, pkgLicense: false });
  add("release-gate/package-json-without-license-denied", DENY, () =>
    reasonHas(rg("rg8", f2, "git tag v1.0.0"), /package\.json has no license field/));
  const f3 = makeReleaseRepo(tmp, { tag: false });
  // The empty-tree base makes LICENSE an addition, so a first release reviews the license choice once.
  add("release-gate/first-release-with-license-reviews-license-file-only", DENY, () => {
    const r = rg("rg9", f3, "git tag v1.0.0");
    const c = classifyOutput(r);
    return /oss-licensing/.test(c.detail) && !/release-hygiene/.test(c.detail) ? r : { status: r.status, stdout: "", stderr: `unexpected reason: ${c.detail}` };
  });
  const f4 = makeReleaseRepo(tmp, { license: false });
  write(f4, "COPYING", "copying terms\n");
  commitAll(f4, "copying");
  // COPYING is a license-file change in the diff, but the hygiene check sees it at the root.
  add("release-gate/copying-file-satisfies-hygiene", DENY, () => {
    const r = rg("rg10", f4, "git tag v0.2.0");
    const c = classifyOutput(r);
    return /release-hygiene/.test(c.detail) ? { status: r.status, stdout: "", stderr: `hygiene fired despite COPYING: ${c.detail}` } : r;
  });

  // pr
  const p1 = makeReleaseRepo(tmp, { license: false });
  sh("git", ["checkout", "-q", "-b", "feat/track"], p1);
  write(p1, "src/track.ts", POSTHOG_CODE);
  commitAll(p1, "track");
  add("release-gate/pr-create-with-analytics-denied", DENY, () =>
    reasonHas(rg("rg11", p1, 'gh pr create --title "Track" --body "x"'), /kind: pr/, /git -C .* diff main\.\.\.HEAD/));
  add("release-gate/pr-create-retry-passes", NONE, () => rg("rg11", p1, 'gh pr create --title "Track" --body "x"'));
  const p2 = makeReleaseRepo(tmp, { license: false });
  sh("git", ["checkout", "-q", "-b", "feat/css"], p2);
  write(p2, "style.css", "a { color: pink; }\n");
  commitAll(p2, "css");
  add("release-gate/pr-create-css-only-passes-even-without-license", NONE, () => rg("rg12", p2, "gh pr create --fill"));
  add("release-gate/pr-create-on-main-passes", NONE, () => {
    sh("git", ["checkout", "-q", "main"], p2);
    return rg("rg12b", p2, "gh pr create --fill");
  });

  // dependency licenses, resolved from a fixture node_modules
  const depRepo = (license, { installed = true, extra = null } = {}) => {
    const dir = makeReleaseRepo(tmp);
    if (installed) write(dir, "node_modules/somepkg/package.json", JSON.stringify({ name: "somepkg", version: "1.0.0", ...(extra ?? { license }) }));
    write(dir, "package.json", pkgJson({}, { somepkg: "^1.0.0" }));
    return dir;
  };
  const d1 = depRepo("AGPL-3.0");
  sh("git", ["add", "package.json"], d1);
  add("release-gate/commit-deps-agpl-dependency-denied", DENY, () =>
    reasonHas(rg("rg13", d1, 'git commit -m "add somepkg"'), /kind: commit-deps/, /dependency-license/, /somepkg \(AGPL-3\.0\)/, /diff --cached/));
  add("release-gate/commit-deps-retry-passes", NONE, () => rg("rg13", d1, 'git commit -m "add somepkg"'));
  const d2 = depRepo("MIT");
  sh("git", ["add", "package.json"], d2);
  add("release-gate/commit-deps-mit-dependency-passes", NONE, () => rg("rg14", d2, 'git commit -m "add somepkg"'));
  const d3 = depRepo(null, { installed: false });
  sh("git", ["add", "package.json"], d3);
  add("release-gate/commit-deps-unresolvable-license-passes", NONE, () => rg("rg15", d3, 'git commit -m "add somepkg"'));
  const d4 = depRepo("(MIT OR GPL-3.0)");
  sh("git", ["add", "package.json"], d4);
  add("release-gate/commit-deps-dual-license-with-mit-passes", NONE, () => rg("rg16", d4, 'git commit -m "add somepkg"'));
  const d5 = depRepo("UNLICENSED");
  sh("git", ["add", "package.json"], d5);
  add("release-gate/commit-deps-unlicensed-denied", DENY, () => rg("rg17", d5, 'git commit -m "add somepkg"'));
  const d6 = depRepo(null, { extra: { license: "SEE LICENSE IN LICENSE.md" } });
  sh("git", ["add", "package.json"], d6);
  add("release-gate/commit-deps-see-license-in-denied", DENY, () => rg("rg18", d6, 'git commit -m "add somepkg"'));
  const d7 = depRepo(null, { extra: { licenses: [{ type: "LGPL-2.1" }] } });
  sh("git", ["add", "package.json"], d7);
  add("release-gate/commit-deps-legacy-licenses-array-lgpl-denied", DENY, () => rg("rg19", d7, 'git commit -m "add somepkg"'));
  const d8 = depRepo("CC-BY-NC-4.0");
  sh("git", ["add", "package.json"], d8);
  add("release-gate/commit-deps-noncommercial-denied", DENY, () => rg("rg20", d8, 'git commit -m "add somepkg"'));
  const d9 = depRepo("AGPL-3.0");
  commitAll(d9, "add somepkg");
  add("release-gate/publish-with-agpl-dependency-denied", DENY, () =>
    reasonHas(rg("rg21", d9, "npm publish"), /dependency-license/, /somepkg \(AGPL-3\.0\) in package\.json/));

  // other commits stay silent
  const c1 = makeReleaseRepo(tmp);
  write(c1, "src/track.ts", POSTHOG_CODE);
  write(c1, "src/mail.ts", 'import nodemailer from "nodemailer";\n');
  sh("git", ["add", "."], c1);
  add("release-gate/commit-with-analytics-and-mailer-passes", NONE, () => rg("rg22", c1, 'git commit -m "wip"'));
  const c2 = makeReleaseRepo(tmp);
  write(c2, "LICENSE", "GNU Affero General Public License\nVersion 3\n");
  sh("git", ["add", "."], c2);
  add("release-gate/commit-license-change-denied", DENY, () => reasonHas(rg("rg23", c2, 'git commit -m "relicense"'), /oss-licensing/, /LICENSE/));
  const c3 = makeReleaseRepo(tmp);
  write(c3, "src/ported.ts", "// SPDX-License-Identifier: GPL-2.0-or-later\nexport const x = 1;\n");
  sh("git", ["add", "."], c3);
  add("release-gate/commit-vendored-gpl-header-denied", DENY, () => rg("rg24", c3, 'git commit -m "port it"'));
  const c4 = makeReleaseRepo(tmp);
  write(c4, "style.css", "a { color: green; }\n");
  sh("git", ["add", "."], c4);
  add("release-gate/commit-css-only-passes", NONE, () => rg("rg25", c4, 'git commit -m "css"'));
  const c5 = makeReleaseRepo(tmp);
  write(c5, "src/ported.ts", "// SPDX-License-Identifier: GPL-2.0-or-later\nexport const x = 1;\n");
  add("release-gate/commit-without-a-ignores-unstaged", NONE, () => rg("rg26", c5, 'git commit -m "x"'));
  add("release-gate/commit-am-ignores-untracked", NONE, () => rg("rg26b", c5, 'git commit -am "x"'));

  // oversize diff: only the file list is judged
  const big = makeReleaseRepo(tmp);
  write(big, "data/blob.bin", "x".repeat(9 * 1024 * 1024) + "\n");
  write(big, "app/privacy/page.tsx", "export default 1;\n");
  commitAll(big, "big");
  add("release-gate/oversize-diff-judges-file-list", DENY, () => reasonHas(rg("rg27", big, "git tag v0.2.0"), /privacy/, /over 8 MB/));
  const big2 = makeReleaseRepo(tmp);
  write(big2, "data/blob.bin", "x".repeat(9 * 1024 * 1024) + "\n");
  commitAll(big2, "big");
  add("release-gate/oversize-clean-file-list-passes", NONE, () => rg("rg28", big2, "git tag v0.2.0"));

  const nonGit = realpathSync(mkdtempSync(join(tmp, "nongit-")));
  add("release-gate/non-git-cwd-passes", NONE, () => rg("rg29", nonGit, "git tag v1"));
  add("release-gate/git-status-passes", NONE, () => rg("rg30", t1, "git status"));
  add("release-gate/git-log-with-release-word-passes", NONE, () => rg("rg31", t1, 'git log --grep="release"'));
  add("release-gate/malformed-stdin-passes", NONE, () => run("release-gate.py", "{", env));
  add("release-gate/empty-command-passes", NONE, () => rg("rg32", t1, ""));

  const selected = only ? cases.filter((c) => c.id.includes(only)) : cases;
  out.selected = selected;
  if (only) out.corpus = selected.filter((c) => c.id.startsWith("classifier/benign-")).length;
  for (const c of selected) {
    const r = c.fn();
    let status, actual, detail;
    if (r.actual !== undefined) ({ status, actual, detail } = r);
    else {
      status = r.error ? -1 : r.status;
      ({ actual, detail } = classifyOutput(r));
      if (r.stderr && !detail) detail = r.stderr.trim();
    }
    out.results.push({ id: c.id, expect: c.expect, status, actual, reason: (detail || "").replace(/\s+/g, " ").slice(0, 200), ok: actual === c.expect && status === 0 });
  }
  try { rmSync(tmp, { recursive: true, force: true }); } catch {}
  return out;
}

function main() {
  const onlyArg = process.argv.slice(2).find((a) => a.startsWith("--only="));
  const only = onlyArg ? onlyArg.slice("--only=".length) : null;
  const { skipped, selected, results, corpus } = runLegalHookCases({ only });
  if (skipped) {
    console.log(`- legal hooks test skipped - ${skipped}`);
    process.exit(0);
  }
  if (selected.length === 0) {
    console.error(`no cases match --only=${only}`);
    process.exit(2);
  }
  const width = Math.max(...results.map((c) => c.id.length));
  let failed = 0;
  for (const r of results) {
    if (!r.ok) failed++;
    console.log(`${r.ok ? "ok " : "FAIL"} ${r.id.padEnd(width)}  expect=${r.expect.padEnd(7)} got=${String(r.actual).padEnd(7)} exit=${r.status}  ${r.ok ? "" : r.reason || "-"}`);
  }
  const groups = {};
  for (const r of results) {
    const g = r.id.split("/")[0];
    groups[g] = (groups[g] ?? 0) + 1;
  }
  const mustAct = results.filter((c) => c.expect !== NONE).length;
  console.log(`\n${Object.entries(groups).map(([g, n]) => `${g}: ${n}`).join(", ")}`);
  console.log(`false-positive corpus cases run: ${corpus}`);
  console.log(`${failed ? "FAIL" : "ok"} ${results.length} cases (${mustAct} must act, ${results.length - mustAct} must stay quiet) - ${failed} failures`);
  process.exit(failed ? 1 : 0);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
