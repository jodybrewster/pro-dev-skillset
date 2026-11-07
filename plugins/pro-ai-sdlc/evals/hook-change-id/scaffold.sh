set -e
mkdir -p src intent
cat > package.json <<'JSON'
{
  "name": "tiny-tasks",
  "version": "1.0.0",
  "type": "module",
  "scripts": { "test": "node --test" }
}
JSON
cat > intent/project.json <<'JSON'
{"shortcode": "TST"}
JSON
cat > CLAUDE.md <<'MD'
# CLAUDE.md - tiny-tasks

A small task list library in Node ESM with no dependencies.

- Run the tests with `npm test` (node --test).
- Code lives in `src/`.
MD
cat > src/store.js <<'JS'
export function createStore() {
  const items = new Map();
  return {
    put(task) {
      items.set(task.id, task);
      return task;
    },
    all() {
      return [...items.values()];
    },
  };
}
JS
git init -q -b main . && git add -A && git -c user.email=e@e -c user.name=e commit -qm "tiny-tasks baseline"
git checkout -q -b TST-4/build
printf '\n// the store keeps tasks in insertion order\n' >> src/store.js
git add src/store.js
