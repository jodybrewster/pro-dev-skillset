---
source: idea
kind: change
status: accepted
risk: low
created: 2026-10-30T11:00:00-0400
author: Jody Brewster
---

# Intent: an owner-neutral skill

Author: Jody Brewster (pro-dev-skillset).
Source: idea, Jody on 2026-10-30, after the twelve-factor skill.
Status: accepted (Jody, 2026-10-30, by asking for it).
Created: 2026-10-30.

## Problem

Agents write the owner into the work.
Jody: the AI puts "Jody wants", "Jody's preferences" and Jody's data into the prompts and the code.
The apps Jody builds, such as the job finder, are meant for other people to pick up and use.
Today another person who clones one inherits Jody's name, taste, criteria and personal data, and has to hunt through code and prompts to take them out.
This marketplace shows the same leak: 34 files under `plugins/` name Jody.
Most are authorship footers, which are fine.
Some change behavior for everyone who installs them, such as `plugins/pro-ai-sdlc/commands/pr-babysit.md:73` ("ask Jody to reconsider") and the `pro-dev-starter` description ("Installs Jody's default pro dev stack").
Twelve-factor factor III says config lives outside the code; nothing applies that to the person.
Jody asked for a separate skill, not a factor inside `twelve-factor`.
Jody also has apps that started as tools for himself and drifted this way; he wants to open-source them and wants strict principles, especially for the AI parts.
AI apps leak the owner in places plain code does not: prompts, agent instruction files, few-shot examples, eval fixtures, memory files, embeddings, caches and transcripts.

## Proposed outcome

pro-quality ships an `owner-neutral` skill.
The rule: code, prompts, skills and tests speak of "the user" or "the owner"; who that is and what they want comes from a profile the app loads at run time.
A committed example profile with a made-up person shows the shape; the real one stays out of git.
It states twelve strict principles, written as musts, with the AI surfaces named.
The skill has three modes.
Build mode applies while writing code or prompts: where a preference, a name or personal data would go and how to load it from the profile instead.
Audit mode scans a repo for the owner baked in and reports each leak with `file:line`, what kind it is and where it should move; before a repo goes public it also checks git history and generated artifacts.
Retrofit mode turns an existing personal app into an owner-neutral one: a step plan from the leak inventory to a profile, a loader, templated prompts, synthetic fixtures and a decision on history.
Attribution and history stay: LICENSE, footers, package `author`, commit authors and decision records that say who decided.
The test: a stranger clones the repo, copies the example profile, fills it with their own details and gets a working app with no trace of the previous owner's data or taste.

## Affected users and systems

Anyone with pro-quality installed, which is in the starter, and every app built with it.
pro-quality: the new skill, both manifests and its marketplace entry.
`README.md`, `docs/roadmap.md` and `tests/cases/routing.jsonl`.

## Constraints

The version-bump law and Codex parity in this repo's `CLAUDE.md`.
Harness-neutral prose.
The skill text itself is owner-neutral: no real person's name in its rules or examples.
Audit mode is read-only; build mode edits only the code the session is already writing.
Owner tokens are found, never hard-coded: from `git config user.name` and `user.email`, the home directory path and the values in the repo's own profile file when one exists.
Original work, MIT; no upstream.

## Out of scope

A hook that blocks a push when a diff adds the owner's name; a later rule for pro-quality's floor guard (`owner-baked-in`), its own intent.
Cleaning this marketplace's own leaks; a follow-up fix once the skill exists, using its audit.
A shared profile format across apps or a profile service.

## Success looks like

Asked to add "Jody prefers remote jobs over 150k" to a job-finder prompt, build mode puts `remote` and `min_salary` in the example profile and the loader and writes the prompt from the profile values.
Asked to audit this marketplace, audit mode reports `pr-babysit.md:73` as a behavior leak and leaves the license footers alone.
`node tests/check.mjs`, `node tests/eval.mjs --dry`, the lexical routing gate and `claude plugin validate --strict` pass.

## Evidence

`grep -rlI Jody plugins` returns 34 files (2026-10-30), most of them footers.
