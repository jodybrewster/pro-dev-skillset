import { test } from "node:test";
import assert from "node:assert/strict";
import { loadConfig } from "../src/config.js";

test("loadConfig parses key=value lines", () => {
  assert.deepEqual(loadConfig("port=8080"), { port: "8080" });
});
