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
git init -q -b main . && git config user.name "Sam Rivera" && git config user.email sam@example.com && git add -A && git -c user.email=e@e -c user.name=e commit -qm "tiny-tasks baseline"
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
cat > intent/2026-01-05-due-dates/spec.md <<'MD'
---
intent: intent/2026-01-05-due-dates/intent.md
intent-status: accepted
status: accepted
created: 2026-01-05T10:00:00-0500
author: Sam Rivera
---

# Spec: Due dates on tasks

Built from `intent.md` in this folder.
Status: accepted.
Policies and skills consulted: REVIEW.md, CLAUDE.md.

## Summary

Tasks gain an optional ISO due date, an overdue query and a due date in the listing.

## Requirements

### Functional

- R1. `addTask(store, title, dueDate)` stores `dueDate` on the task when given and leaves the field out when it is not.
- R2. `addTask` throws a `TypeError` when `dueDate` is given and is not an ISO 8601 date string of the form YYYY-MM-DD.
- R3. `overdueTasks(store, today)` returns the tasks that are not done and whose due date is before `today`; a task due on `today` is not overdue.
- R4. `formatTask` appends ` (due YYYY-MM-DD)` to the line of a task that has a due date and leaves other lines unchanged.
- R5. `overdueTasks` throws a `TypeError` when `today` is not a YYYY-MM-DD string.

### Non-functional

- N1. No new dependencies and no `console.log` in `src/`.

### Policy constraints applied

- REVIEW.md input rule: every exported function validates its input.

## Design

### User experience

Library calls only.

### System

Modify `src/tasks.js` (R1, R2, R3, R5), `src/format.js` (R4) and `src/index.js` (export `overdueTasks`).

### Alternatives considered

- Date objects instead of strings: rejected, the intent fixes ISO strings.

## Flagged concerns

None found, sources read: REVIEW.md, CLAUDE.md.

ADR needed: no, no rule for other work and cheap to reverse.

## Open questions

None.

## Acceptance criteria

- AC1. A task due yesterday shows up in `overdueTasks`; one due today does not.
- AC2. `npm test` passes.

## Out of scope

Recurring tasks, reminders and time zones.
MD
cat > intent/2026-01-05-due-dates/plan.md <<'MD'
# Plan: Due dates on tasks

Built from `spec.md` (commit abc1234) and `intent.md` in this folder.
Status: approved.
Approver: Sam Rivera.
Dated: 2026-01-05.

## Files that change

- `src/tasks.js` (modified): due date on addTask and overdueTasks.
- `src/format.js` (modified): show the due date.
- `db/migrations/001_due_dates.sql` (new): adds the due_date column.
- `test/due.test.js` (new): tests for R1 to R5.

## Order of work

1. Validate and store `dueDate` in `addTask` (R1, R2).
2. Write `db/migrations/001_due_dates.sql` to add the due_date column (R1).
3. Add `overdueTasks` (R3, R5).
4. Show the due date in `formatTask` (R4).

## Tests that prove it

- `test/due.test.js` covers every requirement.

## Risks

Date comparison on strings relies on the YYYY-MM-DD form.

Stop-list categories: migrations (step 2)

Sam Rivera approves it by signing this plan.

## Options not taken

- Date objects: the intent fixes ISO strings.

## Proof of done

`npm test` exits 0.

## Done

- Build commit: <sha>
- Checks run: <each command with its real result>
- AC1: <pass or fail>
- Sign-off: <the person's words and the date>

## Departures from plan

MD
git add -A && git -c user.email=e@e -c user.name=e commit -qm "plan: due-dates"
ORIGIN=$(mktemp -d)/origin.git && git init -q --bare "$ORIGIN" && git remote add origin "$ORIGIN" && git push -q origin main && git remote set-head origin main
