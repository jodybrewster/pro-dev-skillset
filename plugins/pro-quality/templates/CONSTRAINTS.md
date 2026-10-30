# CONSTRAINTS

Read this file before writing code.
Do not weaken it to make a change pass.
If a rule is in the way, fix the code or add a row to Exceptions with an owner and an expiry date.

## Floor

These hold in every change, whatever the numbers below say.
Each one has a name that the floor guard reports.

- silenced-checker: no new `@ts-ignore`, `eslint-disable`, `# noqa`, `# type: ignore` or similar comment that mutes a checker.
- test-made-easier: no new `.skip(`, `.todo(`, `xit(` or `@pytest.mark.skip` in a test.
- test-deleted: no test file is deleted to get to green.
- assertion-removed: no assertion is removed from a test that stays.
- unfinished-work: no new stub (`NotImplementedError`, `todo!()`, "not implemented") and no empty catch block.
- rule-loosened: no threshold in this file moves in the loosening direction and no Floor bullet or numbered row is removed.
- new-exception: no row is added to Exceptions without an owner and an expiry date.
- secrets: no credential, key or token in the diff. Checked by pro-security's push gate and `gitleaks`.

## Enforced with numbers

A row is here only if its check ran and exited 0 when the row was written.
The direction word says which way the number may move: a minimum may only go up and a maximum may only go down.

| Dimension | Rule | Checked by | Runs at |
|-----------|------|------------|---------|
| Types | maximum 0 type errors | `npx tsc --noEmit` | pre-push and CI |
| Lint | maximum 0 lint errors | `npm run lint` | pre-push and CI |
| Coverage | minimum 80% line coverage | `npm test -- --coverage` | CI |
| Bundle | maximum 250 KB for the main bundle | `npm run build` | CI |

## Measured, not yet enforced

A number here has a value today but no check that fails the build.
Direction says which way it should move.

| Metric | Today | Direction |
|--------|-------|-----------|
| Line coverage | 62% | at least 80% |
| Open lint warnings | 14 | at most 0 |

## Exceptions

An exception is a named, owned and dated hole in a rule.
Remove the row when it expires.

| ID | Rule | Path | Reason | Owner | Expires |
|----|------|------|--------|-------|---------|
| EX-1 | silenced-checker | `src/legacy/parser.ts` | Third-party types are wrong until the vendor fix ships | @owner | 2026-12-31 |

Test files: `e2e/**`, `**/*.stories.*`
