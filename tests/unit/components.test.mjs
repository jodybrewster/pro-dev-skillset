import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { parseTags, hookIds, listComponents, listCaseTags, coverageDiff, WORKFLOW_PLUGINS } from "../lib/components.mjs";

test("parseTags reads an inline array and strips quotes", () => {
  const t = `---\ndescription: x\ntags: [command:review, "agent:reviewer", 'quiet:command:spec']\nmax_turns: 5\n---\nbody`;
  assert.deepEqual(parseTags(t), ["command:review", "agent:reviewer", "quiet:command:spec"]);
});

test("parseTags reads a block list", () => {
  const t = `---\ntags:\n  - skill:a\n  - "hook:b"\nmax_turns: 5\n---\nbody`;
  assert.deepEqual(parseTags(t), ["skill:a", "hook:b"]);
});

test("parseTags returns nothing without tags or frontmatter", () => {
  assert.deepEqual(parseTags("---\ndescription: x\n---\nbody"), []);
  assert.deepEqual(parseTags("no frontmatter"), []);
});

test("hookIds derives script stems and numbered inline ids", () => {
  const hooks = { hooks: {
    PreToolUse: [{ hooks: [{ type: "command", command: 'python3 "${CLAUDE_PLUGIN_ROOT}/scripts/production-gate.py"' }] }],
    Stop: [{ hooks: [
      { type: "command", command: 'node ${CLAUDE_PLUGIN_ROOT}/scripts/plan-sync.mjs' },
      { type: "command", command: "echo hi" },
      { type: "command", command: "echo again" },
    ] }],
  } };
  assert.deepEqual(hookIds(hooks), ["hook:production-gate", "hook:plan-sync", "hook:Stop-inline-1", "hook:Stop-inline-2"]);
});

test("listComponents and listCaseTags read a plugin folder", () => {
  const d = mkdtempSync(join(tmpdir(), "comp-"));
  mkdirSync(join(d, "skills", "s1"), { recursive: true });
  writeFileSync(join(d, "skills", "s1", "SKILL.md"), "x");
  mkdirSync(join(d, "skills", "empty"), { recursive: true });
  mkdirSync(join(d, "commands"));
  writeFileSync(join(d, "commands", "go.md"), "x");
  mkdirSync(join(d, "agents"));
  writeFileSync(join(d, "agents", "bot.md"), "x");
  mkdirSync(join(d, "hooks"));
  writeFileSync(join(d, "hooks", "hooks.json"), JSON.stringify({ hooks: { Stop: [{ hooks: [{ type: "command", command: "python3 ${CLAUDE_PLUGIN_ROOT}/scripts/gate.py" }] }] } }));
  assert.deepEqual(listComponents(d), ["skill:s1", "command:go", "agent:bot", "hook:gate"]);
  mkdirSync(join(d, "evals", "c1"), { recursive: true });
  writeFileSync(join(d, "evals", "c1", "prompt.md"), "---\ntags: [command:go]\n---\nbody");
  mkdirSync(join(d, "evals", "results"), { recursive: true });
  assert.deepEqual(listCaseTags(d, "evals"), ["command:go"]);
});

test("coverageDiff counts a plain tag as covered and a quiet tag as not", () => {
  const comps = ["command:a", "command:b", "agent:c"];
  const { missing, stale } = coverageDiff(comps, ["command:a", "quiet:command:b"], []);
  assert.deepEqual(missing, ["command:b", "agent:c"]);
  assert.deepEqual(stale, []);
});

test("coverageDiff honours the allow list and flags stale entries", () => {
  const comps = ["command:a", "command:b"];
  const { missing, stale } = coverageDiff(comps, ["command:a"], ["command:b", "command:a", "command:gone"]);
  assert.deepEqual(missing, []);
  assert.deepEqual(stale.sort(), ["command:a", "command:gone"]);
});

test("the workflow plugin list is the five named plugins", () => {
  assert.deepEqual(WORKFLOW_PLUGINS, ["pro-ai-sdlc", "pro-egm", "pro-spdd", "pro-speckit", "pro-pdd"]);
});
