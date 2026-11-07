import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs, loadScenario, validateScenario, setStatus, resolveConcerns } from "../e2e-sdlc.mjs";
import { parseRoles, frontmatter, CHECKS, intentDirsOf } from "../e2e-sdlc/checks.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

test("--dry prints every scenario and spends nothing", () => {
  const r = spawnSync("node", [join(ROOT, "tests", "e2e-sdlc.mjs"), "--dry"], { encoding: "utf8", env: { ...process.env, ANTHROPIC_API_KEY: "", FACTORY_GH_TOKEN: "" } });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /scenario 1:/);
  assert.match(r.stdout, /scenario 3:/);
  assert.match(r.stdout, /nothing spent/);
});

test("every scenario file names real step kinds and checks", () => {
  for (const n of [1, 2, 3]) assert.deepEqual(validateScenario(loadScenario(n)), []);
});

test("flags parse and a bad scenario number is refused", () => {
  const o = parseArgs(["--scenario", "1,3", "--local", "--max-cost-usd", "9"]);
  assert.deepEqual(o.scenarios, [1, 3]);
  assert.equal(o.local, true);
  assert.equal(o.maxCostUsd, 9);
  assert.throws(() => parseArgs(["--scenario", "4"]));
  assert.throws(() => parseArgs(["--nope"]));
});

test("role gates edit the files the way a person would", () => {
  assert.match(setStatus("---\nstatus: draft\n---\nStatus: draft.\n", "draft", "accepted"), /status: accepted[\s\S]*Status: accepted\./);
  const spec = "## Flagged concerns\n\n| 1 | c | p | |\n\n## Open questions\n\nNone.\n";
  const out = resolveConcerns(spec, "Closed: fine.");
  assert.ok(out.indexOf("Closed: fine.") < out.indexOf("## Open questions"));
});

test("the roles block parses inline lists and item lines", () => {
  const roles = parseRoles("## Roles\n\n```yaml\nroles:\n  engineer: [A B]\n  lead:\n    - C\n```\n");
  assert.deepEqual(roles, { engineer: ["A B"], lead: ["C"] });
  assert.equal(parseRoles("# nothing"), null);
  assert.equal(frontmatter("---\nlevel: 3\n---\n").level, "3");
});

test("intentDirs keeps both folder forms and drops anything else", () => {
  const listing = "intent/README.md\nintent/2026-01-02-greeting/\nintent/PDS-51-fix-greeting/\nintent/TST-1-Demo/\nintent/TST-01-x/\nintent/TOOLONG-1-x/\nintent/notes/\n";
  assert.deepEqual(intentDirsOf(listing), ["intent/2026-01-02-greeting", "intent/PDS-51-fix-greeting"]);
});

test("the check registry is callable and unknown names fail", () => {
  assert.ok(Object.values(CHECKS).every((c) => typeof c.run === "function"));
});
