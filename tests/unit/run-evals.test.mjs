import { test } from "node:test";
import assert from "node:assert/strict";
import { parseArgs, chooseFlags, buildArgs, summarize, formatTable } from "../run-evals.mjs";

test("parseArgs applies defaults and reads flags and plugin names", () => {
  assert.deepEqual(parseArgs([]), { plugins: [], sdlc: false, runs: 3, model: "sonnet", maxCostUsd: 10, dryRun: false, jobs: 4, includeGit: false, docker: false });
  const o = parseArgs(["pro-ai-sdlc", "--runs", "1", "--model", "haiku", "--max-cost-usd", "2.5", "--dry-run", "--sdlc"]);
  assert.equal(o.runs, 1);
  assert.equal(o.model, "haiku");
  assert.equal(o.maxCostUsd, 2.5);
  assert.equal(o.dryRun, true);
  assert.equal(o.sdlc, true);
  assert.deepEqual(o.plugins, ["pro-ai-sdlc"]);
  assert.equal(parseArgs(["--docker"]).docker, true);
  assert.throws(() => parseArgs(["--nope"]));
});

test("chooseFlags adds scaffold and tools only when a case needs them", () => {
  assert.deepEqual(chooseFlags([{ scaffold: false, tools: ["Read", "Skill"] }]), []);
  assert.deepEqual(chooseFlags([{ scaffold: false, tools: ["Write"] }]), ["--allow-tools", "Bash", "Write", "Edit"]);
  assert.deepEqual(chooseFlags([{ scaffold: true, tools: [] }]), ["--scaffold", "--allow-tools", "Bash", "Write", "Edit"]);
});

test("buildArgs passes the fixed flags and the remaining budget", () => {
  const a = buildArgs("/p/x", [], { model: "sonnet", runs: 3, remaining: 7.5, jsonPath: "/t/x.json" });
  assert.deepEqual(a, ["plugin", "eval", "/p/x", "--threshold", "0", "--no-publish", "--trust-plugin", "--model", "sonnet", "--runs", "3", "-j", "4", "--max-cost-usd", "7.5", "--json", "/t/x.json"]);
});

const g = (name, passed, scored = true) => ({ name, passed, scored });
const result = {
  costUsd: 1.2,
  cases: [
    {
      name: "review-finds-bug",
      graders: [{ name: "reply", type: "regex" }],
      aggregates: { delta: 0.5 },
      arms: {
        with: [{ graders: [g("reply", true)] }, { graders: [g("reply", true)] }, { graders: [g("reply", false)] }],
        without: [{ graders: [g("reply", false)] }, { graders: [g("reply", false)] }, { graders: [g("reply", true)] }],
      },
    },
    {
      name: "spec-fires",
      graders: [{ name: "fired", type: "tool_used" }],
      aggregates: { delta: 0 },
      arms: {
        with: [{ graders: [g("fired", true, false)] }, { graders: [g("fired", false, false)] }],
        without: [{ graders: [g("fired", false, false)] }, { graders: [g("fired", false, false)] }],
      },
    },
  ],
};

test("summarize counts passes of scored graders and fired runs", () => {
  const rows = summarize(result, { "review-finds-bug": ["command:review", "agent:reviewer"], "spec-fires": ["command:spec"] });
  assert.deepEqual(rows[0], { component: "command:review, agent:reviewer", name: "review-finds-bug", with: "2/3", without: "1/3", delta: "+0.50" });
  assert.deepEqual(rows[1], { component: "command:spec", name: "spec-fires", with: "fired 1/2", without: "-", delta: "-" });
});

test("formatTable aligns columns under a header", () => {
  const out = formatTable(summarize(result, {})).split("\n");
  assert.match(out[0], /^component\s+case\s+with\s+without\s+delta$/);
  assert.match(out[2], /review-finds-bug\s+2\/3\s+1\/3\s+\+0\.50$/);
});

test("selectRunnable skips needs:git cases on macOS and picks tags only kept cases carry", async () => {
  const { selectRunnable } = await import("../run-evals.mjs");
  const cases = [
    { name: "spec", tags: ["command:spec", "needs:git"] },
    { name: "quiet", tags: ["quiet:command:spec"] },
    { name: "both", tags: ["command:spec"] },
  ];
  const mac = selectRunnable(cases, { platform: "darwin" });
  assert.deepEqual(mac.skipped, ["spec"]);
  assert.deepEqual(mac.tags, ["quiet:command:spec"]);
  assert.deepEqual(mac.unreachable, ["both"]);
  assert.equal(selectRunnable(cases, { platform: "linux" }).tags, null);
  assert.equal(selectRunnable(cases, { platform: "darwin", includeGit: true }).skipped.length, 0);
});

test("dockerArgs builds the image and reruns the runner inside without --docker", async () => {
  const { dockerArgs } = await import("../run-evals.mjs");
  const { build, run } = dockerArgs(["--sdlc", "--docker", "--runs", "1"], "/r");
  assert.deepEqual(build, ["build", "-q", "-t", "pro-dev-evals", "/r/tests/docker"]);
  assert.ok(run.includes("--privileged"));
  assert.deepEqual(run.slice(run.indexOf("-v"), run.indexOf("-v") + 2), ["-v", "/r:/repo"]);
  assert.deepEqual(run.slice(-5), ["node", "tests/run-evals.mjs", "--sdlc", "--runs", "1"]);
});
