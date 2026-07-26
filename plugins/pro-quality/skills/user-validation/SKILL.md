---
name: user-validation
description: Use when work has landed and the user needs to check it themselves - produces a validation handoff listing what changed, what was actually verified, and the concrete steps the user should perform on their end. Fires automatically from the Stop hook when a session ends with real changes, and on demand via /validate.
---

# User validation

## Overview

Verification and validation are different jobs.
Verification is yours: you ran the tests, you saw the output.
Validation is the user's: only they can say whether the thing does what they wanted.

This skill produces the handoff between the two.

**Core principle:** the user should never have to read the diff to find out what to check.

A handoff is not a summary of your work.
It is a list of actions the user performs, ordered by what would hurt most if it were wrong.

## When this runs

Automatically, from the `Stop` hook, when a session is about to end and file-mutating work happened that left changes in the working tree.
Conversation-only turns produce nothing.

On demand, via `/validate`, at any point.

## The gate

Before writing a handoff, separate what you know from what you assume:

```
1. What did I actually run this session? (commands + real output)
2. What did I change that I never executed?
3. What can only a human judge - look, feel, wording, product fit?
4. What needs access I do not have - credentials, devices, paid services, prod?

Anything in 2, 3, or 4 belongs to the user. That is the handoff.
```

If you have not run the verification commands yet, run them now.
See [[verification-before-completion]].
Writing "run the tests to confirm" when you could have run them yourself is pushing your job onto the user.

## Output

Two places, same content, different density.

Write the full handoff to `.pro-dev/validation/latest.md`.
That directory is self-ignoring, so it never shows up in a diff or a commit.

Echo a condensed version in chat under `## Validate on your end`.
Chat is for acting on right now; the file is for coming back to.

## Structure

Use these sections in this order.
Skip any section that would be empty rather than padding it.

### What changed

One line per user-visible change, in the user's language.
"Login now rejects expired tokens" not "added `exp` check to `verifyToken()`".
File names belong here only when the file *is* the deliverable.

### What I verified

The commands you ran and what they actually returned.

```
✅ `pnpm test` - 47 passed, 0 failed
✅ `pnpm build` - exit 0
✅ Logged in with an expired token, saw a 401 and the "session expired" banner
```

State non-results just as plainly:

```
⚠️  Did not run the e2e suite - it needs a seeded database I could not create
```

Never write a check you did not perform.
A handoff that overstates verification is worse than no handoff, because the user stops looking.

### What needs your eyes

The core of the document.
A numbered list of steps the user performs, ordered by risk: what would be expensive to discover later goes first.

Each step names three things - where to go, what to do, what correct looks like:

```
1. Open /settings/billing, switch the plan to Pro.
   Expect: the price updates to $29 immediately and the invoice preview
   shows a proration line. If the total stays at $0, the webhook did not land.

2. Reload the page.
   Expect: still on Pro. A revert to Free means the state never persisted.
```

"Check that billing works" is not a step.
If you cannot say what correct looks like, you do not understand the change well enough to hand it off.

### What I could not check

Credentials you lack, devices you cannot run, visual judgement, product decisions.
Be specific about why, so the user knows whether to hand it back or take it on.

### Known gaps

Shortcuts, TODOs, deliberately-out-of-scope cases.
Anything a reasonable person would be annoyed to discover in a week.

## Length

Short enough to act on in one sitting.
Three sharp steps beat eleven vague ones.

If the change was genuinely trivial, say so in two lines and stop.
Padding a handoff for a one-line copy fix teaches the user to skim the next one.

## Anti-patterns

| Don't | Do |
|---|---|
| "Everything works, let me know if you see issues" | Name the specific things to look at |
| "Run the tests to verify" | Run them yourself, report the output |
| Restating the git diff | Describe user-visible behavior |
| "Should work as expected" | State what you observed, or that you did not check |
| Listing every file touched | List every behavior that changed |
| Burying the risky item at step 9 | Risk first |

## Related

- [[verification-before-completion]] - your half of the job, do it before this
- [[requesting-code-review]] - correctness of the code, a separate axis from validation
