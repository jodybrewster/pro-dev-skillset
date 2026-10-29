set -e
mkdir -p src test
cat > package.json <<'JSON'
{
  "name": "tiny-tasks",
  "version": "1.0.0",
  "type": "module",
  "scripts": { "test": "node --test" }
}
JSON
cat > CLAUDE.md <<'MD'
# CLAUDE.md - tiny-tasks

A small task list library in Node ESM with no dependencies.

- Run the tests with `npm test` (node --test).
- Code lives in `src/`, tests in `test/`.
- Follow `REVIEW.md` for what a review checks.
- Intents, specs and plans live in `intent/<date>-<slug>/`.
MD
cat > REVIEW.md <<'MD'
# Review

How changes to tiny-tasks are reviewed.
Read the brief under `intent/` first when the change has one.

## Passes

1. Bugs: wrong logic, off-by-one errors, unhandled edge cases.
2. Security: unsafe parsing and data in logs.
3. Compliance: the diff follows the rules below and the spec.

## Rules

- Every exported function in `src/` validates its input and throws a `TypeError` on a bad argument.
- No `console.log` in `src/`; return values or throw.
- A bug fix ships with a test that fails without the fix.

## Severity

A bug or a breach of a rule above is Important and blocks the merge.
Style and naming are nits.

## Output format

List findings most severe first, each with pass, severity, file and line, a one-sentence claim and how it fails.
End with a tally: `important: <n>  nits: <n>  skipped: <n>`.
MD
cat > README.md <<'MD'
# tiny-tasks

A tiny task list. Tasks are plain objects with an id and a title.
The store will recieve each new task and keep it in memory.
MD
cat > src/validate.js <<'JS'
export function assertString(value, name) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new TypeError(`${name} must be a non-empty string`);
  }
}
JS
cat > src/store.js <<'JS'
import { assertString } from './validate.js';

export function createStore() {
  const items = new Map();
  return {
    put(task) {
      assertString(task.id, 'id');
      items.set(task.id, task);
      return task;
    },
    all() {
      return [...items.values()];
    },
  };
}
JS
cat > src/tasks.js <<'JS'
import { assertString } from './validate.js';

let counter = 0;

export function addTask(store, title) {
  assertString(title, 'title');
  counter += 1;
  return store.put({ id: `t${counter}`, title, done: false });
}

export function completeTask(store, id) {
  assertString(id, 'id');
  const task = store.all().find((t) => t.id === id);
  if (!task) throw new TypeError(`no task ${id}`);
  task.done = true;
  return task;
}
JS
cat > src/format.js <<'JS'
export function formatTask(task) {
  if (!task || typeof task !== 'object') throw new TypeError('task must be an object');
  return `${task.done ? '[x]' : '[ ]'} ${task.id} ${task.title}`;
}
JS
cat > src/index.js <<'JS'
import { createStore } from './store.js';
import { addTask, completeTask } from './tasks.js';
import { formatTask } from './format.js';

export function listTasks(store) {
  return store.all().map(formatTask);
}

export { createStore, addTask, completeTask };
JS
cat > test/tasks.test.js <<'JS'
import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore, addTask, completeTask, listTasks } from '../src/index.js';

test('add and list a task', () => {
  const store = createStore();
  addTask(store, 'write docs');
  assert.equal(listTasks(store).length, 1);
});

test('complete a task', () => {
  const store = createStore();
  const t = addTask(store, 'ship');
  assert.equal(completeTask(store, t.id).done, true);
});

test('rejects an empty title', () => {
  assert.throws(() => addTask(createStore(), ''), TypeError);
});
JS
git init -q -b main . && git add -A && git -c user.email=e@e -c user.name=e commit -qm "tiny-tasks baseline"
mkdir -p intent/2026-01-05-due-dates
cat > intent/2026-01-05-due-dates/intent.md <<'MD'
---
source: idea
kind: idea
status: accepted
risk: low
created: 2026-01-05T09:00:00-0500
author: Sam Rivera
---

# Intent: Due dates on tasks

Author: Sam Rivera (platform).
Source: idea.
Status: accepted.
Created: 2026-01-05.

## Problem

People using tiny-tasks cannot say when a task is due, so they cannot tell which tasks are late.
"I keep forgetting what was supposed to be done by Friday."

## Proposed outcome

A task can carry an optional due date.
Someone can ask for the tasks that are overdue as of a given moment.
The task listing shows the due date when a task has one.

## Affected users and systems

Anyone calling the tiny-tasks library.
The files `src/tasks.js`, `src/format.js` and `src/index.js`.

## Constraints

A due date is an ISO 8601 date string such as 2026-02-01.
A malformed due date is rejected with a TypeError, like every other bad input.
No new dependencies.
Existing tasks without a due date keep working unchanged.

## Out of scope

Recurring tasks, reminders and time zones.

## Success looks like

Adding a task with a due date and asking for overdue tasks returns that task once the date has passed.
`npm test` stays green.

## Open questions

Is a task due today overdue today?
Answer from Sam: no, it is overdue the day after.

## Evidence

None.
MD
git add -A && git -c user.email=e@e -c user.name=e commit -qm "intent: due-dates"
