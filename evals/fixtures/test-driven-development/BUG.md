# Bug: formatDuration shows 60m for one hour

`formatDuration(3600)` returns "60m 0s". It should return "1h 0m 0s".
Anything of an hour or more is wrong. Durations under an hour are fine.

Expected examples:

- formatDuration(3600) -> "1h 0m 0s"
- formatDuration(3725) -> "1h 2m 5s"
- formatDuration(59) -> "59s"
