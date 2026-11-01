# Non-reproducible bugs and regressions

Read this from Phase 1 step 2 when a bug will not reproduce on demand or when a regression has a known good commit.

## Cannot reproduce on demand

- **Timing-dependent?**
  - Add timestamps to logs around the suspected area.
  - Try artificial delays (a sleep or timeout) to widen race windows.
  - Run under load or concurrency to raise the odds of a collision.
- **Environment-dependent?**
  - Compare runtime versions, OS and environment variables.
  - Check for differences in data, such as an empty database against a populated one.
  - Try to reproduce in CI, where the environment is clean.
- **State-dependent?**
  - Check for state leaked between tests or requests.
  - Look for globals, singletons and shared caches.
  - Run the failing scenario alone and again after other operations.
- **Truly random?**
  - Add defensive logging at the suspected location.
  - Set up an alert for the specific error signature.
  - Record the conditions observed and revisit when it recurs.

These steps gather evidence.
They are not fixes, so the Iron Law still applies: no fix until the root cause is found.

## Find the commit with git bisect run

Start from a clean tree (commit or stash first).

```bash
git bisect start
git bisect bad                      # the current commit is broken
git bisect good <known-good-sha>    # this commit worked
git bisect run <focused test command>
git bisect reset                    # return to where you started
```

Use the repository's own focused test command, not a guess at one.
The command must exit non-zero only on this bug; exit 125 skips a commit that cannot be tested.
Keep the repro script outside the repo, or have it exit 125 when the test file is missing, since a new test does not exist at older commits.

_Adapted from [agent-skills](https://github.com/addyosmani/agent-skills) (`skills/debugging-and-error-recovery/SKILL.md`) - MIT, Copyright (c) 2025 Addy Osmani._
