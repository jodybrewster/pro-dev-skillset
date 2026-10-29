import { test } from "node:test";
import assert from "node:assert/strict";
import { summary } from "../src/report.js";

test("summary prints the sum", () => {
  assert.equal(summary([1, 2, 3]), "Sum: 6");
});
