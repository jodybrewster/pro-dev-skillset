import { test } from "node:test";
import assert from "node:assert/strict";
import { formatDuration } from "../src/duration.js";

test("formats seconds only", () => {
  assert.equal(formatDuration(59), "59s");
});

test("formats minutes and seconds", () => {
  assert.equal(formatDuration(125), "2m 5s");
});
