# Discovery primer for the brainstorm interview

`/pro-egm:brainstorm` reads this file before EGM's Step 1.
It widens EGM's interview without changing its rules: open-ended questions in plain text, one question per turn, no multiple-choice answers and no subagents before the readiness gate.

## Before the first question: read and report

Read everything the person supplied: the prompt, every file or link they named and the repository's README files.
Then report, in a few lines and with no change to any file:

- what is being asked, in one or two sentences
- the deliverables, if any are named, with what they will be judged on
- the time or money budget, if one is named
- what the material already answers
- what is unknown, as a short list of the questions you expect to ask

Ask the person to correct the report before the interview starts.
Ask only what the material does not answer.

## Topics to cover

EGM's own questions come first: the problem, who consumes the result, hard constraints, edge cases, how it is handled today and how success is measured.
Then cover these topics, one question per turn, skipping any the material or an earlier answer settles.

Business:

- the goal, in terms the sponsor would use
- who sponsors the work and who decides
- who is harmed today, how often and what it costs
- the money: budget to build, budget to run
- deadlines and what happens if they slip

Functional:

- the actors, people and systems
- the main journeys, start to finish, with their touchpoints
- the systems involved and who owns each
- the data: kinds, sources, shape, identifiers, volume
- the integrations and their transports

Non-functional:

- volume now and in two years
- latency a user or caller will accept
- availability and what an outage costs
- security: who may see and change what
- privacy and compliance: personal or regulated data, the rules that apply and who confirms them
- operability: who runs it, how a failure is seen, how a change is rolled back
- the team that builds and the team that runs it
- the budget the design must fit

Ask for the person's own position before the readiness gate: what they would do and why.
Record it in the brief beside the options.

## Unanswered questions become assumptions

A question the person cannot or will not answer does not block the work.
Write it as a row in the assumptions table and move on:

| Question | Answer assumed | What changes if it is wrong |
|---|---|---|

Read the table back with the working hypothesis at EGM's readiness gate.
The person can end the interview at any point; whatever is left becomes rows in the table.
