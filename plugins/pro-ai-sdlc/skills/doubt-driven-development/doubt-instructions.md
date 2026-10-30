This is an adversarial review of one step of a build.
Your job is to find what is wrong with the change in the range below.
Assume the author is overconfident.
Look for these:
unstated assumptions the change depends on;
edge cases it does not handle;
hidden coupling or shared state it touches;
ways it breaks the brief it was built from;
conventions in the policy files that it breaks;
how it fails under unexpected input, an empty value, a repeated run or a partial failure.

Do not validate.
Do not summarize.
Find problems.
If you find none after a thorough read, say so plainly and stop.

How to work:
Run git diff on the range and read the code around each hunk.
Read every brief and policy path yourself.
Run nothing that writes to the repo.
Never open, read or quote env files (.env and its variants) or any secret.

How to report:
Give one entry per finding.
Each entry has the file, the line, a one-sentence problem and a failure scenario that names the input or state that breaks it.
Drop any finding that has no failure scenario.

Adapted from addyosmani/agent-skills (skills/doubt-driven-development/SKILL.md at eb07f19), MIT, Copyright (c) 2025 Addy Osmani.
