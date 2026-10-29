import { test } from "node:test";
import assert from "node:assert/strict";
import { coverageProblems } from "../lib/coverage.mjs";

const skills = ["p/alpha", "p/beta", "q/gamma"];

test("covered and listed skills pass", () => {
  assert.deepEqual(coverageProblems(skills, new Set(["alpha", "beta"]), ["q/gamma"]), []);
});

test("an uncovered skill that is not listed fails", () => {
  const out = coverageProblems(skills, new Set(["alpha"]), ["q/gamma"]);
  assert.equal(out.length, 1);
  assert.match(out[0], /p\/beta/);
});

test("a listed skill that now has a case is stale", () => {
  const out = coverageProblems(skills, new Set(["alpha", "beta", "gamma"]), ["q/gamma"]);
  assert.equal(out.length, 1);
  assert.match(out[0], /q\/gamma.*stale/);
});

test("a listed skill that no longer exists is stale", () => {
  const out = coverageProblems(skills, new Set(["alpha", "beta", "gamma"]), ["p/gone"]);
  assert.equal(out.length, 1);
  assert.match(out[0], /p\/gone.*no such skill/);
});
