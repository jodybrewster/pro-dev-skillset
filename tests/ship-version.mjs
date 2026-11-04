#!/usr/bin/env node
// Behaviour test for pro-ship's release version subcommands (intent/2026-11-03-release-versioning).
// Every case drives ship.py as a subprocess in a throwaway git repo under the OS temp dir.
// `git tag` and `git push` run through a PATH stub that fails the test if ship.py ever calls them.
//
//   node tests/ship-version.mjs
//
// Also exported as runShipVersionCases() for tests/check.mjs.

import { mkdtempSync, mkdirSync, writeFileSync, rmSync, realpathSync, chmodSync, symlinkSync, readFileSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SHIP = join(ROOT, "plugins", "pro-ship", "scripts", "ship.py");
const LIB_BLOCK = (extra = "") => `# x\n\n## Ship\n\n\`\`\`yaml\ntargets:\n  - id: library\n    kind: tag-release\n${extra}\`\`\`\n`;
const intent = ({ kind = "idea", breaking = "false", title = "A change" } = {}) =>
  `---\nsource: idea\nkind: ${kind}\n${breaking === null ? "" : `breaking: ${breaking}\n`}status: accepted\n---\n\n# Intent: ${title}\n\n## Problem\n\nx\n`;

export function runShipVersionCases() {
  const out = { skipped: null, results: [] };
  if (spawnSync("python3", ["--version"], { stdio: "ignore" }).error) return { ...out, skipped: "python3 not found on PATH" };
  if (spawnSync("git", ["--version"], { stdio: "ignore" }).error) return { ...out, skipped: "git not found on PATH" };

  const sandbox = realpathSync(mkdtempSync(join(tmpdir(), "ship-version-")));
  const env = {
    ...process.env, HOME: join(sandbox, "home"), PYTHONDONTWRITEBYTECODE: "1",
    GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_SYSTEM: "/dev/null",
    GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@example.com", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@example.com",
  };
  mkdirSync(env.HOME, { recursive: true });
  const realGit = spawnSync("which", ["git"], { encoding: "utf8" }).stdout.trim();
  const stubBin = join(sandbox, "bin");
  const log = join(sandbox, "forbidden.log");
  mkdirSync(stubBin, { recursive: true });
  // `git tag --list` is how ship.py reads tags; creating a tag or pushing is what must never happen.
  writeFileSync(join(stubBin, "git"), `#!/bin/sh
case "$1" in
  push) echo "$*" >> "${log}"; exit 9 ;;
  tag) case " $* " in *" --list "*|*" -l "*) ;; *) echo "$*" >> "${log}"; exit 9 ;; esac ;;
esac
exec "${realGit}" "$@"
`);
  chmodSync(join(stubBin, "git"), 0o755);

  let n = 0;
  const add = (id, expect, ok, reason = "") => out.results.push({ id, expect, ok: !!ok, reason: ok ? "" : String(reason).slice(0, 700) });
  const git = (cwd, ...args) => spawnSync(realGit, args, { cwd, encoding: "utf8", env });
  const put = (repo, files) => {
    for (const [p, c] of Object.entries(files)) {
      mkdirSync(dirname(join(repo, p)), { recursive: true });
      writeFileSync(join(repo, p), c);
    }
  };
  const commit = (repo, msg, files = {}) => {
    put(repo, files);
    git(repo, "add", "-A");
    git(repo, "commit", "-q", "--allow-empty", "-m", msg);
    return git(repo, "rev-parse", "HEAD").stdout.trim();
  };
  const mkrepo = (files = { "CLAUDE.md": LIB_BLOCK() }) => {
    const repo = join(sandbox, `repo${++n}`);
    mkdirSync(repo, { recursive: true });
    git(repo, "init", "-q", "-b", "main");
    commit(repo, "init", { ".gitkeep": "", ...files });
    return repo;
  };
  const ship = (repo, args, extraEnv = {}) => {
    const r = spawnSync("python3", [SHIP, ...args], {
      cwd: repo, encoding: "utf8", timeout: 60000,
      env: { ...env, PATH: `${stubBin}:${process.env.PATH}`, ...extraEnv },
    });
    let json = null;
    try { json = JSON.parse(r.stdout); } catch { /* not JSON */ }
    return { status: r.status, stdout: r.stdout || "", stderr: r.stderr || "", json };
  };
  const show = (r) => r.stdout + r.stderr;
  // A squash merge of a build: code and the intent folder in one commit.
  const build = (repo, slug, opts = {}) => commit(repo, `${slug} (#1)`, {
    [`intent/2026-01-05-${slug}/intent.md`]: intent(opts),
    [`src/${slug}.js`]: "x\n",
  });

  try {
    proposalCases();
    severityCases();
    tagNameCases();
    textCases();
    firstReleaseCases();
    commitCases();
    changelogCases();
    add("all/no git tag or git push ran", "no forbidden calls", !existsSync(log), existsSync(log) ? readFileSync(log, "utf8") : "");
  } finally {
    rmSync(sandbox, { recursive: true, force: true });
  }
  return out;

  // R1, R2, R4, AC2, AC3, AC4.
  function proposalCases() {
    let repo = mkrepo();
    git(repo, "tag", "v1.0.0");
    build(repo, "sort", { title: "Sort by title" });
    build(repo, "due", { title: "Due dates" });
    build(repo, "trim", { kind: "bug", title: "Trimmed titles" });
    const head = git(repo, "rev-parse", "HEAD").stdout.trim();
    let r = ship(repo, ["version"]);
    add("version/AC2 two features and one fix is minor", "v1.1.0 and its sentence",
      r.status === 0 && r.json.state === "proposal" && r.json.bump === "minor" && r.json.next === "1.1.0" && r.json.tag === "v1.1.0"
        && r.json.last_tag === "v1.0.0" && r.json.counts.feature === 2 && r.json.counts.fix === 1 && r.json.question === null
        && r.json.sentence === "v1.1.0 (minor): two features and one fix since v1.0.0", show(r));
    add("version/the tag command is built by ship.py for HEAD", "git tag -a with the real sha", r.json?.tag_command === `git tag -a v1.1.0 ${head} -m 'Release 1.1.0'`, show(r));
    add("version/changes carry their subject, kind and source", "three intents", r.json?.changes.length === 3 && r.json.changes[0].subject === "Sort by title"
      && r.json.changes[2].kind === "fix" && r.json.changes[0].source === "intent" && r.json.changes[0].intent === "2026-01-05-sort", show(r));

    build(repo, "gone", { breaking: "true", title: "Remove the old API" });
    r = ship(repo, ["version"]);
    add("version/AC3 a breaking intent is major", "2.0.0", r.json?.bump === "major" && r.json.next === "2.0.0" && r.json.counts.breaking === 1 && r.json.next_if_not_breaking === null, show(r));

    repo = mkrepo();
    git(repo, "tag", "v1.0.0");
    build(repo, "a");
    build(repo, "b", { breaking: null, title: "Old intent" });
    r = ship(repo, ["version"]);
    add("version/AC3 no breaking line assumes breaking and asks", "2.0.0, 1.1.0 and a question",
      r.json?.next === "2.0.0" && r.json.next_if_not_breaking === "1.1.0" && r.json.counts.unknown === 1 && /Old intent/.test(r.json.question) && /2\.0\.0/.test(r.json.question) && /1\.1\.0/.test(r.json.question), show(r));
    add("version/no tag command while the answer is pending", "null", r.json?.tag_command === null, show(r));

    repo = mkrepo();
    git(repo, "tag", "v0.4.2");
    build(repo, "x", { breaking: "true" });
    r = ship(repo, ["version"]);
    add("version/AC4 breaking at 0.x bumps minor", "0.5.0 and a reason", r.json?.next === "0.5.0" && r.json.bump === "minor" && r.json.reasons.some((s) => /0\.x/.test(s)), show(r));

    repo = mkrepo();
    git(repo, "tag", "v1.2.3");
    r = ship(repo, ["version"]);
    add("version/an empty range is nothing", "state nothing and no version", r.json?.state === "nothing" && r.json.next === null && r.json.tag_command === null, show(r));

    repo = mkrepo();
    git(repo, "tag", "v1.0.0");
    commit(repo, "intent: later", { "intent/2026-01-06-later/intent.md": intent({ breaking: "true" }) });
    r = ship(repo, ["version"]);
    add("version/R3 an intent touched in the range counts, with a note when nothing builds it", "major and a note",
      r.json?.next === "2.0.0" && r.json.notes.some((s) => /no commit there changes anything/.test(s)), show(r));
    commit(repo, "fix: drop old API", { "src/a.js": "1\n" });
    r = ship(repo, ["version"]);
    add("version/a breaking intent stays breaking when its build commit is separate", "major", r.json?.next === "2.0.0" && r.json.counts.breaking === 1, show(r));

    // A merge commit counts as one change.
    repo = mkrepo();
    git(repo, "tag", "v1.0.0");
    git(repo, "checkout", "-q", "-b", "work");
    commit(repo, "step 1 no prefix", { "src/a.js": "1\n" });
    commit(repo, "done", { "intent/2026-01-05-m/intent.md": intent({ kind: "bug" }) });
    git(repo, "checkout", "-q", "main");
    git(repo, "merge", "-q", "--no-ff", "-m", "Merge work", "work");
    r = ship(repo, ["version"]);
    add("version/a merge commit is one change under its intent", "one fix, patch", r.json?.next === "1.0.1" && r.json.changes.length === 1 && r.json.counts.fix === 1, show(r));

    const merged = (...subjects) => {
      const m = mkrepo();
      git(m, "tag", "v1.0.0");
      git(m, "checkout", "-q", "-b", "work");
      subjects.forEach((s, i) => commit(m, s, { [`src/${i}.js`]: "1\n" }));
      git(m, "checkout", "-q", "main");
      git(m, "merge", "-q", "--no-ff", "-m", "Merge pull request #3 from a/b", "work");
      return ship(m, ["version"]);
    };
    r = merged("fix: small", "feat!: drop x");
    add("version/a bang on a branch shows through its merge commit", "major", r.json?.next === "2.0.0" && r.json.counts.breaking === 1 && r.json.next_if_not_breaking === null, show(r));
    r = merged("feat: new", "fix: small");
    add("version/a feature on a branch shows through its merge commit", "minor", r.json?.next === "1.1.0" && r.json.counts.feature === 1 && r.json.changes.length === 1, show(r));
    r = merged("no prefix here", "feat!: drop x");
    add("version/a merge with an unknown and a breaking commit does not crash", "major", r.status === 0 && r.json.next === "2.0.0" && r.json.counts.breaking === 1, show(r));
    r = merged("feat: new\n\nFirst paragraph.\n\nBREAKING CHANGE: api moved.");
    add("version/a footer in a branch commit's long body shows through", "major", r.json?.next === "2.0.0" && r.json.counts.breaking === 1, show(r));
    r = merged("no prefix here", "feat: new");
    add("version/an unprefixed branch commit asks, offering the feature number", "2.0.0 or 1.1.0", r.json?.next === "2.0.0" && r.json.next_if_not_breaking === "1.1.0" && r.json.counts.unknown === 1, show(r));

    // The release change itself is not a change.
    repo = mkrepo({ "CLAUDE.md": LIB_BLOCK(), "package.json": '{\n  "name": "t",\n  "version": "1.0.0"\n}\n' });
    git(repo, "tag", "v1.0.0");
    commit(repo, "fix: real", { "a.txt": "1\n" });
    commit(repo, "release 1.0.1 (#9)", { "package.json": '{\n  "name": "t",\n  "version": "1.0.1"\n}\n', "CHANGELOG.md": "## [1.0.1]\n" });
    r = ship(repo, ["version"]);
    add("version/the release change does not count", "one fix and a command for the merged commit",
      r.json?.next === "1.0.1" && r.json.changes.length === 1 && r.json.tag_command?.includes(git(repo, "rev-parse", "HEAD").stdout.trim()), show(r));
    const dep = mkrepo({ "CLAUDE.md": LIB_BLOCK(), "Cargo.toml": '[package]\nname = "t"\nversion = "1.0.0"\n\n[dependencies]\nserde = { version = "1" }\n' });
    git(dep, "tag", "v1.0.0");
    commit(dep, "bump serde", { "Cargo.toml": '[package]\nname = "t"\nversion = "1.0.0"\n\n[dependencies]\nserde = { version = "2" }\n' });
    r = ship(dep, ["version"]);
    add("version/a dependency's version line is a change", "unknown, not a release", r.json?.state === "proposal" && r.json.counts.unknown === 1, show(r));
    const nest = mkrepo({ "CLAUDE.md": LIB_BLOCK(), "package.json": '{\n  "name": "t",\n  "config": {\n    "version": "1"\n  },\n  "version": "1.0.0"\n}\n' });
    git(nest, "tag", "v1.0.0");
    commit(nest, "nested", { "package.json": '{\n  "name": "t",\n  "config": {\n    "version": "2"\n  },\n  "version": "1.0.0"\n}\n' });
    r = ship(nest, ["version"]);
    add("version/a nested version line is a change", "unknown", r.json?.counts.unknown === 1, show(r));
    const body = mkrepo();
    git(body, "tag", "v1.0.0");
    commit(body, "fix: real\n\nodd \u001f intent/2026-01-05-x/intent.md \u001e body", { "a.txt": "1\n" });
    r = ship(body, ["version"]);
    add("version/separators in a commit body shift nothing", "one fix", r.json?.next === "1.0.1" && r.json.changes.length === 1 && r.json.changes[0].source === "commit", show(r));
    const raise = mkrepo();
    git(raise, "tag", "v1.0.0");
    commit(raise, "feat: x", { "intent/2026-01-05-u/intent.md": intent({ kind: "bug", breaking: null }), "src/a.js": "1\n" });
    r = ship(raise, ["version"]);
    add("version/a feat prefix raises the not-breaking number of an unknown intent", "1.1.0", r.json?.next_if_not_breaking === "1.1.0", show(r));
    const own = mkrepo({ "CLAUDE.md": LIB_BLOCK("  - id: other\n    kind: tag-release\n  - id: newlib\n    kind: tag-release\ntag_pattern: \"*--v*\"\n") });
    git(own, "tag", "other--v3.0.0");
    r = ship(own, ["version", "--target", "newlib"]);
    add("version/a target does not take another target's series", "first release of its own", r.json?.state === "first-release" && r.json.tag.startsWith("newlib--v"), show(r));
    commit(repo, "sneaky", { "package.json": '{\n  "name": "t",\n  "version": "1.0.2",\n  "main": "evil.js"\n}\n' });
    r = ship(repo, ["version"]);
    add("version/a manifest change beyond the version line counts", "unknown", r.json?.counts.unknown === 1, show(r));

    // --target picks the tag prefix.
    repo = mkrepo({ "CLAUDE.md": LIB_BLOCK("  - id: other\n    kind: tag-release\ntag_pattern: \"*--v*\"\n") });
    git(repo, "tag", "library--v1.0.0");
    git(repo, "tag", "other--v3.0.0");
    build(repo, "x", { kind: "bug" });
    r = ship(repo, ["version", "--target", "library"]);
    add("version/name--v style follows the target", "library--v1.0.1", r.json?.tag === "library--v1.0.1" && r.json.last_tag === "library--v1.0.0", show(r));
    r = ship(repo, ["version", "--target", "other"]);
    add("version/the other target has its own numbers", "other--v3.0.1", r.json?.tag === "other--v3.0.1", show(r));
    r = ship(repo, ["version", "--target", "$(id)"]);
    add("version/an unknown target is refused", "exit 1", r.status === 1, show(r));
    r = ship(repo, ["version", "--bogus"]);
    add("version/an unknown option is refused", "exit 1", r.status === 1 && /unknown option/.test(r.stderr), show(r));

    // A commit's own mark is not hidden by the intent it touches.
    repo = mkrepo();
    git(repo, "tag", "v1.0.0");
    commit(repo, "intent: old", { "intent/2026-01-05-old/intent.md": intent({ kind: "bug" }) });
    commit(repo, "feat!: remove public export", { "intent/2026-01-05-old/intent.md": intent({ kind: "bug", title: "Other words" }), "src/a.js": "1\n" });
    r = ship(repo, ["version"]);
    add("version/a bang commit is not hidden by a bug intent it touches", "major", r.json?.next === "2.0.0" && r.json.counts.breaking === 1, show(r));
    commit(repo, "fix: later", { "intent/2026-01-05-new/intent.md": intent({ kind: "bug" }), "src/b.js": "1\n" });
    commit(repo, "feat!: again", { "intent/2026-01-05-new/intent.md": intent({ kind: "bug", title: "Again" }), "src/b.js": "2\n" });
    r = ship(repo, ["version"]);
    add("version/a later commit on a seen folder still marks it", "two breaking", r.json?.counts.breaking === 2, show(r));
    repo = mkrepo();
    git(repo, "tag", "v1.0.0");
    commit(repo, "intent: x", { "intent/2026-01-05-x/intent.md": intent({ breaking: "true" }) });
    commit(repo, "fix: tweak", { "src/a.js": "1\n" });
    r = ship(repo, ["version"]);
    add("version/an intent with no build gets a note", "named in notes", r.json?.notes.some((s) => /2026-01-05-x/.test(s) && /no commit there changes anything/.test(s)), show(r));

    // Bare style.
    repo = mkrepo();
    git(repo, "tag", "1.2.3");
    build(repo, "x", { kind: "bug" });
    r = ship(repo, ["version"]);
    add("version/a tag with no v keeps that style", "1.2.4", r.json?.tag === "1.2.4", show(r));

    // A target id that cannot form a tag is refused before any text reaches a prompt.
    for (const id of ["Web", "$(id)"]) {
      repo = mkrepo({ "CLAUDE.md": `## Ship\n\n\`\`\`yaml\ntargets:\n  - id: "${id}"\n    kind: tag-release\ntag_pattern: "*--v*"\n\`\`\`\n` });
      r = ship(repo, ["version"]);
      add(`version/target id ${id} cannot form a tag`, "exit 1 and no echo", r.status === 1 && !r.stderr.includes(id), show(r));
    }
  }

  // The security challenge: the most severe value an intent has had wins.
  function severityCases() {
    let repo = mkrepo();
    git(repo, "tag", "v1.0.0");
    commit(repo, "intent: x", { "intent/2026-01-05-x/intent.md": intent({ breaking: "true", title: "Rewritten" }) });
    build(repo, "y", { kind: "bug" });
    commit(repo, "x build (#2)", { "intent/2026-01-05-x/intent.md": intent({ breaking: "false", title: "Rewritten" }), "src/x.js": "1\n" });
    let r = ship(repo, ["version"]);
    add("severity/breaking stays true after a build rewrites it to false", "major", r.json?.next === "2.0.0" && r.json.counts.breaking === 1, show(r));

    repo = mkrepo();
    git(repo, "tag", "v1.0.0");
    commit(repo, "intent: x", { "intent/2026-01-05-x/intent.md": intent({ kind: "idea" }) });
    commit(repo, "x build (#2)", { "intent/2026-01-05-x/intent.md": intent({ kind: "bug" }), "src/x.js": "1\n" });
    r = ship(repo, ["version"]);
    add("severity/the highest kind wins over a later bug", "minor", r.json?.next === "1.1.0" && r.json.counts.feature === 1, show(r));

    // Similar text in two intents never counts as a rename: one intent's severity stays its own.
    repo = mkrepo();
    git(repo, "tag", "v1.0.0");
    commit(repo, "x (#1)", { "intent/2026-01-05-x/intent.md": intent({ breaking: "true" }), "src/x.js": "1\n" });
    commit(repo, "y (#2)", { "intent/2026-01-05-y/intent.md": intent({ kind: "bug" }), "src/y.js": "1\n" });
    r = ship(repo, ["version"]);
    add("severity/one intent's severity does not bleed into a similar one", "one breaking and one fix", r.json?.counts.breaking === 1 && r.json.counts.fix === 1, show(r));
  }

  // The second blocking item: tag names are shell input.
  function tagNameCases() {
    let repo = mkrepo();
    git(repo, "tag", "v1.0.0");
    const badNames = ["v9.9.9$(touch${IFS}pwned)", "`id`--v1.0.0", "evil$(id)--v8.0.0", "a#b--v7.0.0", "a&b--v6.0.0", "v5.0.0-rc.1"];
    for (const bad of badNames) git(repo, "tag", bad);
    add("tags/git accepts every hostile name the next cases use", "all tags exist", git(repo, "tag", "--list").stdout.split("\n").filter((t) => badNames.includes(t)).length === badNames.length, git(repo, "tag", "--list").stdout);
    build(repo, "x", { kind: "bug" });
    let r = ship(repo, ["version"]);
    const blob = JSON.stringify({ c: r.json?.tag_command, t: r.json?.last_tag, g: r.json?.tag, s: r.json?.sentence });
    add("tags/an invalid name is not a release tag", "last tag stays v1.0.0", r.json?.last_tag === "v1.0.0" && r.json.next === "1.0.1", show(r));
    add("tags/an invalid name never reaches the command or the sentence", "no shell characters", !/[$`#&]/.test(blob), blob);
    add("tags/an invalid name is named in notes", "a note", r.json?.notes.some((s) => /not a release tag/.test(s)), show(r));

    repo = mkrepo();
    git(repo, "tag", "v1.0.0");
    commit(repo, "fix: later", { "a.txt": "1\n" });
    git(repo, "tag", "v0.0.1");
    commit(repo, "fix: more", { "a.txt": "2\n" });
    r = ship(repo, ["version"]);
    add("tags/a later lightweight v0.0.1 does not become the last tag", "v1.0.0", r.json?.last_tag === "v1.0.0" && r.json.next === "1.0.1", show(r));
    r = ship(repo, ["scope"]);
    add("tags/scope uses the highest version too", "the base is v1.0.0's commit", r.json?.base === git(repo, "rev-parse", "v1.0.0^{commit}").stdout.trim(), show(r));

    for (const low of ["0.0.1", "x@0.0.1"]) {
      repo = mkrepo();
      git(repo, "tag", "v1.0.0");
      const start = git(repo, "rev-parse", "HEAD").stdout.trim();
      commit(repo, "fix: backdoor", { "a.txt": "1\n" });
      git(repo, "tag", low);
      commit(repo, "fix: more", { "a.txt": "2\n" });
      r = ship(repo, ["scope"]);
      add(`tags/a later ${low} does not move the review range`, "the base stays v1.0.0 and is named", r.json?.base === start && r.json.base_tag === "v1.0.0", show(r));
      r = ship(repo, ["version"]);
      add(`tags/a later ${low} does not move the proposal`, "1.0.1 after v1.0.0", r.json?.last_tag === "v1.0.0" && r.json.next === "1.0.1" && r.json.tag === "v1.0.1", show(r));
    }
    repo = mkrepo();
    git(repo, "tag", "v1.0.0");
    git(repo, "tag", "1.0.1");
    commit(repo, "fix: a", { "a.txt": "1\n" });
    r = ship(repo, ["version"]);
    add("tags/v and no v are one series", "1.0.2 keeps the style of the highest", r.json?.last_tag === "1.0.1" && r.json.tag === "1.0.2", show(r));

    // A remote-only tag at the next number refuses; a bare repo stands in for origin.
    repo = mkrepo();
    git(repo, "tag", "v1.0.0");
    const bare = join(sandbox, `bare${++n}.git`);
    git(sandbox, "init", "-q", "--bare", bare);
    git(repo, "remote", "add", "origin", bare);
    git(repo, "push", "-q", "origin", "main", "v1.0.0");
    const side = commit(repo, "fix: elsewhere", { "b.txt": "1\n" });
    git(repo, "update-ref", "refs/remotes/x", side);
    git(repo, "push", "-q", "origin", `${side}:refs/tags/v1.0.1`);
    r = ship(repo, ["version"]);
    add("tags/a next that collides with a remote tag refuses", "exit 1 naming the tag", r.status === 1 && /v1\.0\.1/.test(r.stderr), show(r));
    git(repo, "remote", "set-url", "origin", join(sandbox, "missing.git"));
    r = ship(repo, ["version"]);
    add("tags/an unreadable remote is a note", "a proposal and a note", r.status === 0 && r.json.next === "1.0.1" && r.json.notes.some((s) => /origin could not be read/.test(s)), show(r));
  }

  // The security challenge: repo text is data on its way to a prompt.
  function textCases() {
    const repo = mkrepo();
    git(repo, "tag", "v1.0.0");
    commit(repo, "fix: real\u001b[31m red\u001b[0m\u0007 bell", { "a.txt": "1\n" });
    commit(repo, `feat: ${"long ".repeat(100)}`, { "a.txt": "2\n" });
    commit(repo, "bad folder", { "intent/not-a-date/intent.md": intent(), "b.txt": "1\n" });
    const r = ship(repo, ["version"]);
    const subjects = (r.json?.changes || []).map((c) => c.subject);
    add("text/escapes and control characters are stripped", "no escape left", subjects[0] === "fix: real red bell" && !/[\u0000-\u001f]/.test(r.stdout.replace(/\n/g, "")), JSON.stringify(subjects));
    add("text/a long subject is capped", "200 or fewer", subjects[1]?.length <= 200, String(subjects[1]?.length));
    add("text/a bad intent folder is skipped and named", "a note", r.json?.notes.some((s) => /invalid name: not-a-date/.test(s)), show(r));
  }

  // R6 to R8, AC1.
  function firstReleaseCases() {
    const manifests = {
      "package.json": JSON.stringify({ name: "tiny-tasks", version: "1.0.0" }),
      "pyproject.toml": "[project]\nname = \"tiny-tasks\"\nversion = \"1.0.0\"\n",
      "Cargo.toml": "[package]\nname = \"tiny-tasks\"\nversion = \"1.0.0\"\n",
    };
    for (const [file, text] of Object.entries(manifests)) {
      const repo = mkrepo({ "CLAUDE.md": LIB_BLOCK(), [file]: text });
      const before = commit(repo, "Add task list", { "src/a.js": "1\n" });
      build(repo, "x");
      const r = ship(repo, ["version"]);
      add(`first/AC1 ${file} gives first-release and the commit before the first intent`, "the candidate and a question",
        r.status === 0 && r.json.state === "first-release" && r.json.declared.version === "1.0.0" && r.json.declared.file === file
          && r.json.base_candidate?.sha === before && r.json.next === "1.0.0" && r.json.tag === "v1.0.0"
          && r.json.tag_command === `git tag -a v1.0.0 ${before} -m 'Release 1.0.0'`, show(r));
      add(`first/AC1 ${file} question names the words, the short sha and no bare full hash`, "tiny-tasks says 1.0.0",
        /^tiny-tasks says 1\.0\.0\./.test(r.json?.question || "") && /Add task list/.test(r.json.question) && r.json.question.includes(before.slice(0, 7)) && !r.json.question.includes(before), show(r));
    }

    let repo = mkrepo({ "CLAUDE.md": LIB_BLOCK(), "package.json": JSON.stringify({ name: "t", version: "2.0.0" }) });
    commit(repo, "older", { "package.json": JSON.stringify({ name: "t", version: "1.0.0" }) });
    build(repo, "x");
    commit(repo, "bump", { "package.json": JSON.stringify({ name: "t", version: "2.0.0" }) });
    let r = ship(repo, ["version"]);
    add("first/R7 a candidate that does not hold the version asks to pick", "no candidate and a question",
      r.json?.state === "first-release" && r.json.base_candidate === null && r.json.tag_command === null && /Which commit/.test(r.json.question), show(r));

    repo = mkrepo({ "CLAUDE.md": LIB_BLOCK(), "package.json": JSON.stringify({ name: "t", version: "1.5.0" }) });
    commit(repo, "more", { "a.txt": "1\n" });
    r = ship(repo, ["version"]);
    add("first/R7 no intent folder picks the newest commit holding the version", "HEAD", r.json?.base_candidate?.sha === git(repo, "rev-parse", "HEAD").stdout.trim(), show(r));

    repo = mkrepo();
    r = ship(repo, ["version"]);
    add("first/R8 no manifest and no tag proposes v0.1.0", "v0.1.0", r.json?.state === "first-release" && r.json.tag === "v0.1.0" && /No earlier release/.test(r.json.question), show(r));

    repo = mkrepo({ "CLAUDE.md": LIB_BLOCK(), "package.json": JSON.stringify({ name: "t", version: "1.0.0$(id)" }) });
    r = ship(repo, ["version"]);
    add("first/a declared version that is not X.Y.Z stays out", "v0.1.0 and no raw text",
      r.json?.tag === "v0.1.0" && r.json.declared.version === null && r.json.declared.valid === false && !r.stdout.includes("$(id)") && r.json.notes.some((s) => /not X\.Y\.Z/.test(s)), show(r));

    repo = mkrepo({ "CLAUDE.md": LIB_BLOCK(), "package.json": JSON.stringify({ name: "t", version: "\uff11.\uff12.\uff13" }) });
    r = ship(repo, ["version"]);
    add("first/a version in look-alike digits is not X.Y.Z", "v0.1.0", r.json?.tag === "v0.1.0" && r.json.declared.valid === false, show(r));

    repo = mkrepo();
    symlinkSync("/etc/hosts", join(repo, "package.json"));
    git(repo, "add", "-A");
    git(repo, "commit", "-q", "-m", "link");
    r = ship(repo, ["version"]);
    add("first/a symlinked manifest is not read", "a note and v0.1.0", r.json?.tag === "v0.1.0" && r.json.notes.some((s) => /symlink/.test(s)), show(r));

    repo = mkrepo();
    const base = commit(repo, "base", { "a.txt": "1\n" });
    commit(repo, "feat: thing", { "a.txt": "2\n" });
    r = ship(repo, ["version", "--base", base]);
    add("first/--base gives a proposal over that range", "one feature since the base", r.json?.state === "proposal" && r.json.counts.feature === 1, show(r));
    add("first/the sentence never holds a full hash", "a short sha", r.json?.sentence.includes(base.slice(0, 7)) && !r.json.sentence.includes(base), show(r));
  }

  // R3 as amended by the security challenge.
  function commitCases() {
    const one = (subject, body = "") => {
      const repo = mkrepo();
      git(repo, "tag", "v1.0.0");
      commit(repo, body ? `${subject}\n\n${body}` : subject, { "a.txt": "1\n" });
      return ship(repo, ["version"]);
    };
    let r = one("feat: new");
    add("commit/feat is minor", "1.1.0", r.json?.next === "1.1.0" && r.json.changes[0].source === "commit", show(r));
    r = one("fix: bug");
    add("commit/fix is patch", "1.0.1", r.json?.next === "1.0.1", show(r));
    r = one("feat!: changed");
    add("commit/a bang is breaking", "2.0.0", r.json?.next === "2.0.0", show(r));
    r = one("fix: bug", "BREAKING CHANGE: the api moved");
    add("commit/a BREAKING CHANGE footer is breaking", "2.0.0", r.json?.next === "2.0.0", show(r));
    for (const s of ["refactor: remove the export", "docs: typo", "revert: feat: add x", "chore: bump"]) {
      r = one(s);
      add(`commit/${s} says nothing, so it is unknown`, "asks", r.json?.counts.unknown === 1 && r.json.next === "2.0.0" && r.json.unclassified[0] === s, show(r));
    }
    r = one("removed the export");
    add("commit/no prefix counts as unknown, assumes breaking and asks", "2.0.0, 1.0.1 and a question",
      r.json?.next === "2.0.0" && r.json.next_if_not_breaking === "1.0.1" && r.json.counts.unknown === 1 && r.json.unclassified[0] === "removed the export" && /removed the export/.test(r.json.question), show(r));
  }

  // R10.
  function changelogCases() {
    const mode = (files) => ship(mkrepo({ "CLAUDE.md": LIB_BLOCK(), ...files }), ["changelog"]);
    let r = mode({});
    add("changelog/no file is none", "none", r.json?.mode === "none" && r.json.path === null, show(r));
    r = mode({ "CHANGELOG.md": "# Changelog\n\n## [Unreleased]\n\n### Added\n\n- Sort by title\n\n### Fixed\n\n- Trim\n\n## [1.0.0] - 2026-01-01\n\n- Old\n" });
    add("changelog/an Unreleased heading is manual with its lines and groups", "manual", r.json?.mode === "manual" && r.json.groups.join() === "Added,Fixed" && r.json.unreleased.join() === "- Sort by title,- Trim", show(r));
    r = mode({ "CHANGELOG.md": "# Changelog\n\n## [1.0.0]\n\n- Old\n" });
    add("changelog/a file with no Unreleased heading is none", "none", r.json?.mode === "none", show(r));
    for (const [why, files] of Object.entries({
      ".changeset/": { ".changeset/config.json": "{}" },
      "release-please-config.json": { "release-please-config.json": "{}" },
      "cliff.toml": { "cliff.toml": "" },
      ".releaserc.json": { ".releaserc.json": "{}" },
      "a release workflow": { ".github/workflows/rel.yml": "on: push\njobs:\n  a:\n    steps:\n      - uses: googleapis/release-please-action@v4\n" },
      "the first line": { "CHANGELOG.md": "<!-- generated, do not edit -->\n\n## [Unreleased]\n" },
    })) {
      r = mode(files);
      add(`changelog/AC5 ${why} reads generated`, "generated", r.json?.mode === "generated", show(r));
    }
    const repo = mkrepo({ "CLAUDE.md": LIB_BLOCK("changelog: none\n"), "CHANGELOG.md": "## [Unreleased]\n", "cliff.toml": "" });
    r = ship(repo, ["changelog"]);
    add("changelog/the Ship block key wins", "none", r.json?.mode === "none" && /Ship block/.test(r.json.why), show(r));
    const bad = mkrepo({ "CLAUDE.md": LIB_BLOCK("changelog: weird\n") });
    r = ship(bad, ["changelog"]);
    add("changelog/a bad key is refused", "exit 1", r.status === 1, show(r));
    const linked = mkrepo();
    symlinkSync("/etc/hosts", join(linked, "CHANGELOG.md"));
    r = ship(linked, ["changelog"]);
    add("changelog/a symlinked changelog is not read and says so", "none, no path and a reason", r.json?.mode === "none" && r.json.path === null && /symlink/.test(r.json.why), show(r));
    r = ship(mkrepo({ "CLAUDE.md": LIB_BLOCK(), "CHANGELOG.md": "## [Unreleased]\n\n- ship 2.0.0\u001b[31m now\n" }), ["changelog"]);
    add("changelog/lines come out clean", "no escape", r.json?.unreleased[0] === "- ship 2.0.0 now", show(r));
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { skipped, results } = runShipVersionCases();
  if (skipped) { console.log(`skipped: ${skipped}`); process.exit(0); }
  let bad = 0;
  for (const r of results) { if (!r.ok) { bad++; console.log(`FAIL ${r.id}: expected ${r.expect} - ${r.reason}`); } }
  console.log(`${results.length - bad}/${results.length} ship version cases passed`);
  process.exit(bad ? 1 : 0);
}
