import { test } from "node:test";
import assert from "node:assert/strict";
import { parseArgs, offersGoldfish, offersReview, ranGoldfish, setStatus, passCount } from "../loop.mjs";

test("parseArgs reads the ref, cap and model", () => {
  assert.deepEqual(parseArgs([]), { ref: null, maxCostUsd: 12, model: "sonnet", inside: false, out: null, egm: true });
  const o = parseArgs(["--ref", "main", "--max-cost-usd", "5", "--model", "opus"]);
  assert.equal(o.ref, "main");
  assert.equal(o.maxCostUsd, 5);
  assert.equal(o.model, "opus");
  assert.equal(parseArgs(["--no-egm"]).egm, false);
  assert.throws(() => parseArgs(["--max-cost-usd", "0"]));
  assert.throws(() => parseArgs(["--nope"]));
});

test("offersGoldfish matches the offer and the missing-egm line only", () => {
  assert.ok(offersGoldfish("pro-egm: review -> /pro-egm:goldfish intent/x/spec.md --stage spec"));
  assert.ok(offersGoldfish("pro-egm needs egm@egm: run /pro-dev install"));
  assert.ok(!offersGoldfish("After a goldfish review, keep the fixes"));
});

test("setStatus flips the Status line and the frontmatter key", () => {
  const t = "---\nstatus: draft\n---\n\nStatus: draft.\nApprover: Sam.\n";
  assert.equal(setStatus(t, "draft", "approved"), "---\nstatus: approved\n---\n\nStatus: approved.\nApprover: Sam.\n");
  assert.equal(setStatus("Status: draft\n", "draft", "accepted"), "Status: accepted.\n");
});

test("passCount reads node --test totals", () => {
  assert.equal(passCount("# tests 9\n# pass 9\n# fail 0"), 9);
  assert.equal(passCount("ℹ tests 5\nℹ pass 5\n"), 5);
  assert.equal(passCount("nothing"), 0);
});

test("offersReview needs the real offer and no install line", () => {
  assert.ok(offersReview("pro-egm: Goldfish review -> /pro-egm:goldfish intent/x/spec.md --stage spec"));
  assert.ok(!offersReview("pro-egm needs egm@egm: run /pro-dev install"));
  assert.ok(!offersReview("/pro-egm:goldfish a/spec.md --stage spec\npro-egm needs egm@egm: run /pro-dev install"));
});

test("ranGoldfish needs the command and its resolve step", () => {
  assert.ok(ranGoldfish('{"skill":"pro-egm:goldfish"} ... python3 \\"/x/scripts/goldfish.py\\" resolve --stage spec'));
  assert.ok(ranGoldfish('pro-egm:goldfish then goldfish.py resolve --stage plan'));
  assert.ok(!ranGoldfish("pro-egm:goldfish offered only"));
});
