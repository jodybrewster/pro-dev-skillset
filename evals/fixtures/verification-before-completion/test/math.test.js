import { test } from "node:test";
import assert from "node:assert/strict";
import { average } from "../src/math.js";

test("average of numbers", () => {
  assert.equal(average([2, 4, 6]), 4);
});
