import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const script = join(here, 'audit.mjs');
const planted = join(here, 'fixtures', 'planted');
const clean = join(here, 'fixtures', 'clean');

function run(target, ...args) {
  return spawnSync(process.execPath, [script, target, ...args], { encoding: 'utf8' });
}

function findings(target) {
  const r = run(target, '--json');
  return JSON.parse(r.stdout).findings;
}

const expected = [
  ['node-integration', 'main.js', 8],
  ['context-isolation-off', 'main.js', 9],
  ['sandbox-off', 'main.js', 10],
  ['web-security-off', 'main.js', 11],
  ['insecure-content', 'main.js', 12],
  ['remote-module', 'main.js', 13],
  ['no-window-open-handler', 'main.js', 5],
  ['no-will-navigate', 'main.js', 5],
  ['open-external-unchecked', 'main.js', 20],
  ['no-csp', 'index.html', 1],
  ['no-fuses', 'forge.config.js', 1],
];

for (const [rule, file, line] of expected) {
  test(`planted fixture: ${rule} at ${file}:${line}`, () => {
    const hit = findings(planted).find((f) => f.rule === rule);
    assert.ok(hit, `rule ${rule} not found`);
    assert.equal(hit.file, file);
    assert.equal(hit.line, line);
    assert.ok(['high', 'medium', 'low'].includes(hit.severity));
    assert.ok(hit.message && hit.fix);
  });
}

test('planted fixture: exit code 1 and human output groups by severity', () => {
  const r = run(planted);
  assert.equal(r.status, 1);
  assert.match(r.stdout, /HIGH/);
  assert.match(r.stdout, /MEDIUM/);
});

test('clean fixture: zero findings and exit 0', () => {
  const r = run(clean, '--json');
  assert.equal(r.status, 0);
  assert.deepEqual(JSON.parse(r.stdout).findings, []);
  assert.equal(run(clean).status, 0);
});

test('--json output parses with a summary', () => {
  const out = JSON.parse(run(planted, '--json').stdout);
  assert.ok(Array.isArray(out.findings));
  assert.equal(out.summary.total, out.findings.length);
});

test('inspect-fuse-on when EnableNodeCliInspectArguments is true', () => {
  const dir = mkdtempSync(join(tmpdir(), 'audit-fuse-'));
  try {
    writeFileSync(join(dir, 'package.json'), '{"devDependencies":{"electron":"*"}}\n');
    writeFileSync(
      join(dir, 'forge.config.js'),
      "const { FusesPlugin } = require('@electron-forge/plugin-fuses');\nmodule.exports = { plugins: [new FusesPlugin({\n  [FuseV1Options.EnableNodeCliInspectArguments]: true,\n})] };\n",
    );
    const hit = findings(dir).find((f) => f.rule === 'inspect-fuse-on');
    assert.ok(hit);
    assert.equal(hit.file, 'forge.config.js');
    assert.equal(hit.line, 3);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('skips node_modules and does not flag non-Electron projects', () => {
  const dir = mkdtempSync(join(tmpdir(), 'audit-skip-'));
  try {
    writeFileSync(join(dir, 'package.json'), '{"name":"web"}\n');
    writeFileSync(join(dir, 'a.js'), 'const x = { nodeIntegration: true };\n');
    assert.equal(run(dir).status, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
