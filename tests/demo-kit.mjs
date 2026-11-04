#!/usr/bin/env node
// Behaviour test for demo/factory/new-demo.sh and remove-demo.sh. gh, claude and docker are
// stubs on PATH that log every call; HOME and the parent dir are a temp sandbox, and the
// "GitHub" origin is a local bare repo, so nothing touches the network or a real account.
//
//   node tests/demo-kit.mjs
//
// Also exported as runDemoKitCases() for tests/check.mjs.

import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, chmodSync, rmSync, realpathSync, readdirSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const NEW = join(ROOT, "demo", "factory", "new-demo.sh");
const REMOVE = join(ROOT, "demo", "factory", "remove-demo.sh");

// "repo create --push" in the stub points origin at the local bare repo and pushes there.
const GH_STUB = `#!/bin/sh
echo "gh $*" >> "$STUB/calls.log"
case "$1 $2" in
  "api user") echo stub-owner ;;
  "repo view") [ -f "$STUB/gh-exists" ] && exit 0; exit 1 ;;
  "repo create")
    git remote add origin "$STUB/origin.git"
    git push -q origin HEAD ;;
  "api -X") [ "$3" = POST ] && cat > "$STUB/ruleset.json" || cat > "$STUB/protection.json" ;;
esac
exit 0
`;
const LOG_STUB = (n) => `#!/bin/sh
echo "${n} $*" >> "$STUB/calls.log"
exit 0
`;

function run(script, args, env) {
  return spawnSync("sh", [script, ...args], { encoding: "utf8", env, timeout: 60000 });
}

export function runDemoKitCases() {
  const probe = spawnSync("git", ["--version"], { encoding: "utf8" });
  if (probe.status !== 0) return { skipped: "git not available", results: [] };
  const sandbox = realpathSync(mkdtempSync(join(tmpdir(), "demo-kit-")));
  const results = [];
  const add = (id, expect, ok, reason = "") => results.push({ id, expect, ok: !!ok, reason: ok ? "" : reason });
  try {
    const stub = join(sandbox, "stub");
    const bin = join(sandbox, "bin");
    const home = join(sandbox, "home");
    const parent = join(home, "Projects");
    mkdirSync(stub); mkdirSync(bin); mkdirSync(parent, { recursive: true });
    spawnSync("git", ["init", "-q", "--bare", join(stub, "origin.git")]);
    writeFileSync(join(bin, "gh"), GH_STUB);
    writeFileSync(join(bin, "claude"), LOG_STUB("claude"));
    writeFileSync(join(bin, "docker"), LOG_STUB("docker"));
    for (const f of ["gh", "claude", "docker"]) chmodSync(join(bin, f), 0o755);
    const env = { PATH: `${bin}:${process.env.PATH}`, HOME: home, STUB: stub, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1" };
    const calls = () => (existsSync(join(stub, "calls.log")) ? readFileSync(join(stub, "calls.log"), "utf8").split("\n").filter(Boolean) : []);
    const reset = () => rmSync(join(stub, "calls.log"), { force: true });
    const brief = (r) => `${r.status} ${r.stderr}${r.stdout}`.slice(0, 300);

    // name validation
    for (const bad of ["A", "x", "Bad_Name", "a_b", "has space", "a".repeat(42)]) {
      const r = run(NEW, [bad, "--owner", "o", "--dir", parent], env);
      add(`n1 new refuses '${bad.slice(0, 12)}'`, "refused", r.status === 1 && /refusing name/.test(r.stderr), brief(r));
    }
    add("n2 a bad name makes no gh call", "none", calls().length === 0, calls().join("; "));

    // exists on GitHub
    writeFileSync(join(stub, "gh-exists"), "");
    let r = run(NEW, ["demo-one", "--owner", "o", "--dir", parent], env);
    add("n3 new refuses a name that exists on GitHub", "refused", r.status === 1 && /exists on GitHub/.test(r.stderr) && !existsSync(join(parent, "demo-one")), brief(r));
    rmSync(join(stub, "gh-exists"));

    // exists on disk
    mkdirSync(join(parent, "taken"));
    reset();
    r = run(NEW, ["taken", "--owner", "o", "--dir", parent], env);
    add("n4 new refuses a name that exists on disk", "refused", r.status === 1 && /already exists/.test(r.stderr) && !calls().some((c) => c.startsWith("gh repo")), brief(r));

    // a full create
    reset();
    r = run(NEW, ["demo-one", "--owner", "o", "--dir", parent], env);
    const dest = join(parent, "demo-one");
    add("c1 new succeeds", "exit 0", r.status === 0, brief(r));
    const log = calls();
    const order = [
      "gh repo view o/demo-one",
      "gh repo create o/demo-one --private --source . --push",
      "gh api -X PUT repos/o/demo-one/branches/main/protection --input -",
      "gh api -X POST repos/o/demo-one/rulesets --input -",
      "claude plugin install pro-ai-sdlc@pro-dev-skillset --scope local",
      "claude plugin install pro-ship@pro-dev-skillset --scope local",
      "claude plugin install pro-quality@pro-dev-skillset --scope local",
      "claude plugin install pro-security@pro-dev-skillset --scope local",
    ];
    const at = order.map((o) => log.findIndex((c) => c === o));
    add("c2 the gh and claude calls are made in order", "ordered", at.every((i) => i >= 0) && at.every((v, i) => i === 0 || v > at[i - 1]), log.join("\n"));
    const tags = spawnSync("git", ["-C", join(stub, "origin.git"), "tag"], { encoding: "utf8" }).stdout;
    add("c3 v1.0.0 is tagged and pushed", "tag on origin", /v1\.0\.0/.test(tags), tags);
    const prot = existsSync(join(stub, "protection.json")) ? JSON.parse(readFileSync(join(stub, "protection.json"), "utf8")) : {};
    add("c4 protection requires a PR, 0 approvals, admins and check test", "payload", prot.enforce_admins === true && prot.required_pull_request_reviews?.required_approving_review_count === 0 && prot.required_status_checks?.contexts?.[0] === "test", JSON.stringify(prot));
    const rs = existsSync(join(stub, "ruleset.json")) ? JSON.parse(readFileSync(join(stub, "ruleset.json"), "utf8")) : {};
    add("c4b release tags are protected", "active with all three rules", rs.target === "tag" && rs.enforcement === "active" && (rs.rules || []).map((x) => x.type).join() === "creation,update,deletion" && rs.conditions?.ref_name?.include?.[0] === "refs/tags/v*", JSON.stringify(rs));
    const git = (...a) => spawnSync("git", ["-C", dest, ...a], { encoding: "utf8", env }).stdout.trim();
    add("c5 repo-local git user is the fictional one", "Sam Rivera", git("config", "user.name") === "Sam Rivera" && git("config", "user.email") === "sam@example.com", git("config", "user.name"));
    add("c6 every commit is by Sam Rivera", "one author", git("log", "--format=%an <%ae>", "--all") === "Sam Rivera <sam@example.com>", git("log", "--format=%an", "--all"));
    const rev = readFileSync(join(dest, "REVIEW.md"), "utf8");
    add("c7 the roles block is in REVIEW.md", "roles", /## Roles/.test(rev) && /lead: \[Lee Chen\]/.test(rev) && /policy_owner: \[Pat Okafor\]/.test(rev), rev.slice(-200));
    const ciPath = join(dest, ".github", "workflows", "test.yml");
    const ci = existsSync(ciPath) ? readFileSync(ciPath, "utf8") : "";
    add("c8 CI runs npm test with contents read", "workflow", /npm test/.test(ci) && /contents: read/.test(ci) && /pull_request/.test(ci), ci);
    const claudeMd = readFileSync(join(dest, "CLAUDE.md"), "utf8");
    add("c9 the ship block has a tag-release target", "ship", /kind: tag-release/.test(claudeMd) && /tag_pattern: "v\*"/.test(claudeMd), claudeMd.slice(-200));
    add("c9b the ship block has a rollback and a documented use that runs", "both", /rollback:/.test(claudeMd) && /documented_use: "node examples\/use\.js"/.test(claudeMd) && spawnSync("node", ["examples/use.js"], { cwd: dest, encoding: "utf8" }).stdout.trim() === "one task listed", claudeMd.slice(-400));
    add("c9c a changelog with an Unreleased heading", "manual mode", /^## \[Unreleased\]$/m.test(readFileSync(join(dest, "CHANGELOG.md"), "utf8")), "no heading");
    const intents = readdirSync(join(dest, "intent")).filter((n) => /^\d{4}-/.test(n));
    const texts = intents.map((n) => readFileSync(join(dest, "intent", n, "intent.md"), "utf8"));
    add("c10b each intent records kind and breaking", "idea and bug", texts.every((t) => /^breaking: false$/m.test(t)) && texts.some((t) => /^kind: idea$/m.test(t)) && texts.some((t) => /^kind: bug$/m.test(t)), texts[0]?.slice(0, 120));
    add("c10 two accepted level 1 intents with no new-dependency phrase", "two", intents.length === 2 && texts.every((t) => /status: accepted/.test(t) && /level: 1/.test(t) && !/new dependenc/i.test(t) && /author: Sam Rivera/.test(t)), intents.join(","));

    // remove
    reset();
    mkdirSync(join(parent, "other"), { recursive: true });
    spawnSync("git", ["-C", join(parent, "other"), "init", "-q"]);
    spawnSync("git", ["-C", join(parent, "other"), "remote", "add", "origin", "https://github.com/someone/else.git"]);
    r = run(REMOVE, ["other", "--owner", "o", "--dir", parent], env);
    add("r1 remove refuses a mismatched origin", "refused", r.status === 1 && /origin of/.test(r.stderr) && existsSync(join(parent, "other")) && !calls().some((c) => /uninstall|archive/.test(c)), brief(r));
    r = run(REMOVE, ["Bad_Name", "--owner", "o", "--dir", parent], env);
    add("r2 remove refuses a bad name", "refused", r.status === 1 && /refusing name/.test(r.stderr), brief(r));

    spawnSync("git", ["-C", dest, "remote", "set-url", "origin", "https://github.com/o/demo-one.git"]);
    reset();
    r = run(REMOVE, ["demo-one", "--owner", "o", "--dir", parent, "--delete-image"], env);
    const rl = calls();
    add("r3 remove succeeds", "exit 0", r.status === 0, brief(r));
    add("r4 remove uninstalls the four local plugins", "four", ["pro-ai-sdlc", "pro-ship", "pro-quality", "pro-security"].every((p) => rl.includes(`claude plugin uninstall ${p}@pro-dev-skillset --scope local`)), rl.join("\n"));
    add("r5 remove moves the checkout to the Trash", "moved", !existsSync(dest) && existsSync(join(home, ".Trash", `demo-one-${new Date().toLocaleDateString("sv")}`)), brief(r));
    add("r6 remove archives the repo", "archived", rl.includes("gh repo archive o/demo-one -y"), rl.join("\n"));
    add("r7 remove never calls gh repo delete but prints it", "no delete", !rl.some((c) => /^gh repo delete/.test(c)) && /gh repo delete o\/demo-one --yes/.test(r.stdout), rl.join("\n"));
    const code = readFileSync(REMOVE, "utf8").split("\n").filter((l) => !/^\s*(#|echo)/.test(l)).join("\n");
    add("r8 neither script runs kill, pkill or eval", "none", !/\b(kill|pkill|killall|eval)\b/.test(code) && !/\b(kill|pkill|killall|eval)\b/.test(readFileSync(NEW, "utf8").split("\n").filter((l) => !/^\s*(#|echo)/.test(l)).join("\n")), "");
  } finally {
    rmSync(sandbox, { recursive: true, force: true });
  }
  return { skipped: null, results };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { skipped, results } = runDemoKitCases();
  if (skipped) { console.log(`skipped: ${skipped}`); process.exit(0); }
  let bad = 0;
  for (const r of results) { if (!r.ok) { bad++; console.log(`FAIL ${r.id}: expected ${r.expect} - ${r.reason}`); } }
  console.log(`${results.length - bad}/${results.length} demo kit cases passed`);
  process.exit(bad ? 1 : 0);
}
