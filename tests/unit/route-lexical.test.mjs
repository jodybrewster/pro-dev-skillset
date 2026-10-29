import { test } from "node:test";
import assert from "node:assert/strict";
import { stem, tokenize, buildIndex, rank, scoreCase, collisions, allowedSet } from "../route-lexical.mjs";

const catalog = [
  { slug: "test-driven-development", description: "Write a failing test first, then make it pass. Use for new features and bug fixes." },
  { slug: "database-migrations", description: "Plan schema migrations for the database and roll them back safely." },
  { slug: "deploy-previews", description: "Deploy a preview build of the website to hosting." },
];

test("stem joins plural and verb forms", () => {
  assert.equal(stem("tests"), stem("test"));
  assert.equal(stem("migrations"), stem("migration"));
  assert.equal(stem("running"), "run");
  assert.equal(stem("policies"), "policy");
  assert.equal(stem("bus"), "bus");
  assert.equal(stem("css"), "css");
});

test("tokenize lowercases, splits hyphens and drops stopwords", () => {
  assert.deepEqual(tokenize("The Test-Driven loop"), [stem("test"), stem("driven"), stem("loop")]);
  assert.deepEqual(tokenize("to be or not to be"), []);
});

test("rank puts the lexically closest entry first", () => {
  const index = buildIndex(catalog);
  assert.equal(rank(index, "roll back my database schema migration")[0].slug, "database-migrations");
  assert.equal(rank(index, "write a failing test first")[0].slug, "test-driven-development");
  assert.equal(rank(index, "zzz qqq")[0].score, 0);
});

test("scoreCase handles rank 1, top-k, per-case top_k and notOneOf", () => {
  const ranking = [{ slug: "a" }, { slug: "b" }, { slug: "c" }, { slug: "d" }];
  assert.deepEqual(scoreCase({ expect: "a" }, ranking), { hasExpect: true, rank1: true, topK: true, notOneOfFail: false });
  const mid = scoreCase({ expect: ["c"] }, ranking);
  assert.equal(mid.rank1, false);
  assert.equal(mid.topK, true);
  assert.equal(scoreCase({ expect: "d" }, ranking).topK, false);
  assert.equal(scoreCase({ expect: "d", top_k: 4 }, ranking).topK, true);
  const neg = scoreCase({ notOneOf: ["a"] }, ranking);
  assert.equal(neg.hasExpect, false);
  assert.equal(neg.notOneOfFail, true);
  assert.equal(scoreCase({ notOneOf: ["b"] }, ranking).notOneOfFail, false);
});

test("collisions warn at 0.50, fail at 0.75 and honor the allow list", () => {
  const twin = "Review the pull request diff for correctness bugs and report findings with severity";
  const entries = [
    { slug: "one", description: twin },
    { slug: "two", description: twin },
    { slug: "other", description: "Deploy a preview build of the website to hosting" },
  ];
  const index = buildIndex(entries);
  const found = collisions(index);
  assert.equal(found.length, 1);
  assert.equal(found[0].level, "fail");
  assert.ok(found[0].score >= 0.75);
  const allowed = collisions(index, allowedSet([{ a: "two", b: "one", reason: "same text" }]));
  assert.equal(allowed[0].level, "allowed");
  const skipped = collisions(index, new Set(), () => true);
  assert.equal(skipped.length, 0);

  const mid = buildIndex([
    { slug: "x", description: "alpha beta gamma delta epsilon zeta" },
    { slug: "y", description: "alpha beta gamma theta iota kappa" },
    { slug: "z", description: "unrelated words entirely different" },
  ]);
  const m = collisions(mid);
  assert.ok(m.every((p) => p.level === "warn"));
});
