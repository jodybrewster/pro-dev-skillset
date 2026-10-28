# Standard for the scope goldfish

A finding is about whether the target and the intent match, never about whether the idea is good.

## Blocker

The target contains work the intent does not ask for and that changes behavior, adds a dependency, touches a new area or widens access.
Or the intent states a success condition or a constraint that nothing in the target covers.

## Major

A requirement, step or file that traces to no line of the intent but is small.
Or an intent goal that the target covers only by mention, with no way to tell it was done.

## Nit

A step that traces to the intent only loosely, where the link could be made clear with one added sentence.
Report at most five Nits.

## Not a finding

Work the intent clearly implies, such as the tests for a requirement it does state.
Wording differences between the intent and the target that mean the same thing.
