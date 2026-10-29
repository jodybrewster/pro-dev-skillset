import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { executionFailure, validateCase, parseGrade } from "../lib/trace.mjs";
import { parseArgs, claudeArgs } from "../behavioral.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const FIXTURES = join(ROOT, "evals", "fixtures");

const line = (o) => JSON.stringify(o);
const call = (id) => line({ type: "assistant", message: { content: [{ type: "tool_use", id, name: "Bash", input: { command: "ls" } }] } });
const answer = (id) => line({ type: "user", message: { content: [{ type: "tool_result", tool_use_id: id, content: "ok" }] } });
const result = (extra = {}) => line({ type: "result", subtype: "success", is_error: false, permission_denials: [], ...extra });
const trace = (...lines) => lines.join("\n");

test("executionFailure accepts a complete successful trace", () => {
  assert.equal(executionFailure(trace(call("a"), answer("a"), result())), null);
});

test("executionFailure rejects a trace with no result", () => {
  assert.match(executionFailure(trace(call("a"), answer("a"))), /no result/);
  assert.match(executionFailure(""), /empty/);
});

test("executionFailure rejects an error result", () => {
  assert.match(executionFailure(trace(result({ is_error: true }))), /is_error/);
  assert.match(executionFailure(trace(result({ subtype: "error_max_turns" }))), /error_max_turns/);
});

test("executionFailure rejects a permission denial", () => {
  const denied = result({ permission_denials: [{ tool_name: "Bash" }] });
  assert.match(executionFailure(trace(call("a"), answer("a"), denied)), /permission denied: Bash/);
});

test("executionFailure rejects a tool call without a result", () => {
  assert.match(executionFailure(trace(call("a"), call("b"), answer("a"), result())), /1 tool call/);
});

const good = () => ({
  skill: "test-driven-development",
  plugin: "pro-execution",
  evals: [{ id: 1, prompt: "p", files: ["test-driven-development"], expectations: ["e"] }],
});

test("validateCase accepts a good case", () => {
  assert.deepEqual(validateCase(good(), FIXTURES, ROOT), []);
});

test("validateCase flags each rule", () => {
  const c = good();
  c.evals = [
    { id: 1, kind: "chat", prompt: "p", files: ["test-driven-development"], expectations: ["e"] },
    { id: 1, prompt: "p", pressure: "hurry", files: ["nope"], expectations: [] },
    { id: 3, prompt: "p", expectations: ["e"] },
    { id: 4, kind: "dialogue", prompt: "p", expectations: ["e"] },
  ];
  const errors = validateCase(c, FIXTURES, ROOT).join("\n");
  assert.match(errors, /kind must be/);
  assert.match(errors, /duplicate id/);
  assert.match(errors, /pressure must be/);
  assert.match(errors, /fixture not found: nope/);
  assert.match(errors, /expectations must be/);
  assert.match(errors, /eval 3: files required/);
  assert.doesNotMatch(errors, /eval 4/);
});

test("validateCase flags an unknown skill", () => {
  const c = good();
  c.skill = "no-such-skill";
  assert.match(validateCase(c, FIXTURES, ROOT).join("\n"), /skill not found/);
});

test("every real case file validates", () => {
  const dir = join(ROOT, "evals", "cases");
  const files = readdirSync(dir).filter((f) => f.endsWith(".json"));
  assert.ok(files.length >= 3);
  for (const f of files) {
    const data = JSON.parse(readFileSync(join(dir, f), "utf8"));
    assert.deepEqual(validateCase(data, FIXTURES, ROOT), [], f);
    assert.equal(data.skill, f.replace(/\.json$/, ""));
  }
});

test("parseGrade extracts valid JSON and rejects bad shapes", () => {
  const ok = 'Here:\n{"expectations":[{"text":"a","passed":true,"evidence":"x {y}"}]}';
  assert.equal(parseGrade(ok, ["a"]).expectations[0].passed, true);
  assert.equal(parseGrade("no json", ["a"]), null);
  assert.equal(parseGrade('{"expectations":[{"text":"a","passed":"yes","evidence":"x"}]}', ["a"]), null);
  assert.equal(parseGrade(ok, ["a", "b"]), null);
});

test("claudeArgs builds both arms", () => {
  const withSkill = claudeArgs({ plugin: "pro-execution", skillText: "S", model: "sonnet", withSkill: true });
  assert.ok(withSkill.includes("--plugin-dir"));
  assert.ok(withSkill.includes("--append-system-prompt"));
  const base = claudeArgs({ plugin: "pro-execution", skillText: "S", model: "sonnet", withSkill: false });
  assert.ok(!base.includes("--plugin-dir"));
  assert.ok(!base.includes("--append-system-prompt"));
  assert.deepEqual(parseArgs(["a", "--baseline", "--model", "haiku"]), { skills: ["a"], dryRun: false, baseline: true, model: "haiku" });
});
