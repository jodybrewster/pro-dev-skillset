import { test } from "node:test";
import assert from "node:assert/strict";
import { orderTotal } from "../src/report.js";

test("total for a single order", () => {
  assert.equal(orderTotal([["pen", 100, 2]]), 220);
});

test("total for a second, separate order", () => {
  assert.equal(orderTotal([["book", 1000, 1]]), 1100);
});
