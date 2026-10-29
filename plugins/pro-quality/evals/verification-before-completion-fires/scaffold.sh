set -e
mkdir -p src test
cat > package.json <<'JSON'
{
  "name": "config-parser",
  "version": "1.0.0",
  "type": "module",
  "scripts": { "test": "node --test" }
}
JSON
cat > src/config.js <<'JS'
export function parseConfig(text) {
  if (!text || text.trim() === '') return {};
  const out = {};
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const [key, value] = trimmed.split('=');
    out[key.trim()] = value.trim();
  }
  return out;
}
JS
cat > test/empty.test.js <<'JS'
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseConfig } from '../src/config.js';

test('empty file returns an empty object', () => {
  assert.deepEqual(parseConfig(''), {});
});
JS
cat > test/values.test.js <<'JS'
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseConfig } from '../src/config.js';

test('parses key=value lines', () => {
  assert.deepEqual(parseConfig('a=1\nb=2'), { a: '1', b: '2' });
});

test('keeps an equals sign inside a value', () => {
  assert.deepEqual(parseConfig('url=http://x/?q=1'), { url: 'http://x/?q=1' });
});
JS
git init -q . && git add -A && git -c user.email=e@e -c user.name=e commit -qm init
