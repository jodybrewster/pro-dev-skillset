---
name: dream
description: "Consolidate accumulated agent memory - scan recent session transcripts for corrections, decisions, preferences, and recurring patterns, merge the findings into the memory files, resolve contradictions, and rebuild MEMORY.md as a lean index under 200 lines. Use when the user says dream, asks to consolidate, compact, prune, clean up, or tidy memory or MEMORY.md, asks for a memory pass, memory audit, or memory maintenance run, or when a session-start nudge reports that consolidation is due. Supports a dry run that reports every proposed merge, rewrite, and deletion without writing anything. Not for saving a single new fact - that is the ordinary auto-memory write path, not this skill."
---

# Dream - memory consolidation

Agent memory rots quietly.
Facts get superseded and the old version stays.
Relative dates like "yesterday" lose their anchor the moment the session ends.
Guidance keeps naming a script that was deleted two months ago.
The index grows until it stops being an index.

Dream is a maintenance pass over memory that already exists.
It reads the memory directory, scans recent session transcripts for what those sessions established, merges the findings into the memory files, and rebuilds the index.
Four phases, in order.

```
orient -> gather signal -> consolidate -> prune and index
```

## When to run this

- The user asks to consolidate, compact, prune, clean up, or tidy memory.
- The user says dream.
- A session-start nudge reports that consolidation is due. The interval is time-based only, default 24 hours since the last run. There is no session-count condition.
- MEMORY.md has grown past roughly 200 lines, or reads like a content store rather than an index.

Do not run this to save one new fact.
Writing a single memory is the ordinary auto-memory path.
Dream rewrites what is already on disk, which is a much larger blast radius.

## Dry run first

A dry run walks all four phases read-only and prints the plan: which memories would be written, which rewritten, which merged, which archived or deleted, and what the rebuilt index would look like.
It writes nothing.
No memory files, no MEMORY.md, no `.last-dream`.

### The preview rule

> Preview the plan and wait for confirmation whenever this is the first consolidation for the project, or the plan would delete or archive anything.
> Otherwise, an explicit request to consolidate applies directly.

An explicit apply request does not skip the preview when either condition holds.
`/dream` with no arguments is an explicit apply request, so it applies directly on a project that has been consolidated before and where the plan only adds and edits.
On a first-ever dream it previews, because that run has the largest blast radius and the least evidence that the layout was detected correctly.
A run triggered by the interval nudge previews first as well.
The nudge fires inside a live session with the user present, so the preview costs one beat and stops a bad merge from landing silently in their memory files.
A request to look at memory rather than fix it is a preview and nothing else: report the plan and stop.

Both conditions are decidable before a byte is written.
This is the first consolidation when the resolved memory directory has no `.last-dream` and no dream backup beside it.
Whether the plan deletes or archives anything is known at the end of phase 3, before phase 4 writes.

Ignoring a preview is safe: the interval only resets when a real consolidation writes `.last-dream`, and the Stop hook re-flags the project on session exit while it is still overdue.

## Memory layouts

Detect the layout at runtime.
Do not persist a config file.

| Layout | Memory directory | Detect by |
|--------|------------------|-----------|
| native (default) | `~/.claude/projects/<project-slug>/memory/` | `MEMORY.md` exists there |
| openclaw | `<project>/memory/` | dated logs such as `memory/2026-08-17.md` exist |
| project-root | `<project>/` | `MEMORY.md` sits at the repo root |

If nothing matches, use native.
It needs no setup and is the standard.

### Resolve the native directory from the timer

`scripts/dream-timer.py` is the resolver this plugin's hooks already use.
Ask it, and the skill and the hooks cannot disagree about which directory holds this project's memory.

```bash
DREAM_STATE=$(python3 "${CLAUDE_PLUGIN_ROOT}/scripts/dream-timer.py" --json)
MEM=$(printf '%s' "$DREAM_STATE" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("memory_dir") or "")')
PROJ=${MEM:+$(dirname "$MEM")}
```

`--json` prints one object.
The fields this skill reads are `memory_dir` (absolute path, or `null`), `has_memory_content` (true when at least one `.md` file exists anywhere beneath it), `last_dream` (epoch seconds from the marker, or `null`), `due`, and `reason`.

A `null` `memory_dir` means this project has no native auto-memory directory.
That is not a failure and not a reason to invent one - check the openclaw and project-root layouts before concluding there is nothing to consolidate.

### Manual fallback

A Codex install ships `skills/` only, so `${CLAUDE_PLUGIN_ROOT}` and the timer script may both be missing.
Resolve the directory by hand in that case.

Claude Code flattens the project's absolute path into a single directory name by replacing every character that is not a letter or a digit with `-`.
Every character, not only `/`.
Dots, spaces, tildes, and colons all flatten the same way, and runs are never collapsed.

- `/Users/ada/Projects/app` becomes `-Users-ada-Projects-app`
- `/Users/ada/Projects/.internal/api` becomes `-Users-ada-Projects--internal-api`
- `/Users/ada/Library/Mobile Documents/iCloud~md~obsidian/Documents/Notes` becomes `-Users-ada-Library-Mobile-Documents-iCloud-md-obsidian-Documents-Notes`

A `/`-only rule reaches none of the last two, which is most of the directories on a real machine.
Some older state directories were written with that rule, though, and a directory reached through a symlink has more than one valid absolute path.
So generate candidates and let the filesystem pick the one that exists.

```bash
resolve_project_dir() {
  base="$HOME/.claude/projects"
  for path in "$PWD" "$(pwd -P)"; do
    for slug in "$(printf '%s' "$path" | LC_ALL=C tr -c 'A-Za-z0-9' '-')" "$(printf '%s' "$path" | tr '/' '-')"; do
      if [ -n "$slug" ] && [ -d "$base/$slug" ]; then printf '%s\n' "$base/$slug"; return 0; fi
    done
  done
  return 1
}

PROJ=$(resolve_project_dir) || PROJ=""
MEM="${PROJ:+$PROJ/memory}"
```

### Confirm the directory exists before any write

Whichever path produced `$MEM`, confirm it is a directory that exists before you copy, write, move, or delete a single file.

```bash
[ -n "$MEM" ] && [ -d "$MEM" ] || { echo "dream: no memory directory resolved for $PWD"; exit 1; }
```

When it does not exist, stop and report three things: the project path you resolved, the candidate slugs you tried, and that no memory directory was found.
Do not create one.
Do not continue into phases 3 and 4.
A dream against a path that does not exist backs up nothing, builds a phantom memory tree, and drops `.last-dream` where the hooks never look, so the nudge fires forever while the real memory is never touched.

Under the native layout:

- One memory per file, named `<type>_<slug>.md`.
- Frontmatter carries `name` and `description`, plus provenance in one of two shapes. Most files nest it: a `metadata` block holding `node_type`, `type`, and `originSessionId`. Some carry `type` and `originSessionId` as top-level keys instead. Both shapes are valid and both are in live use.
- Preserve whichever shape a file already uses. Converting one into the other is a provenance rewrite, which the safety rails forbid, and it buys nothing.
- The body is prose - the claim, why it exists, and how to apply it.
- `MEMORY.md` is the index. One line per memory file: a link to the file plus a short hook saying when that memory matters. No memory content.

```
- [Short title](<memory-file>.md) <SEP> a dozen words on when this memory applies
```

`<SEP>` is a placeholder, not a literal.
It stands for whatever separator the file already puts between the link and the hook.
Detect it; never choose it.

```bash
python3 - "$MEM/MEMORY.md" <<'PY'
import re, sys
try:
    text = open(sys.argv[1], errors="replace").read()
except OSError:
    text = ""
lines = [l for l in text.splitlines() if re.match(r"\s*[-*]\s*\[", l)]
em = sum(1 for l in lines if "\u2014" in l)   # U+2014 em dash
hyphen = sum(1 for l in lines if re.search(r"\)\s+-\s", l))
print("\u2014" if em > hyphen else "-")
PY
```

Real index files use either a plain hyphen or U+2014, and some mix both, so take whichever already dominates the file and write every new line with that one.
A file with no index lines yet gets a plain hyphen.
Never rewrite an existing line's separator: that is punctuation churn, and it produces a diff that says nothing about memory.

Session transcripts live in the project state directory, `$PROJ`, which is `~/.claude/projects/<project-slug>/` under every layout - openclaw and project-root relocate the memory files, not the transcripts.
Under native it is the parent of `$MEM`, which is how both resolvers above set it.
Under openclaw and project-root, `$MEM` is inside the repository, so set `$PROJ` with `resolve_project_dir` instead of deriving it from `$MEM`.
Older installs nest transcripts in a `sessions/` subdirectory, so glob both depths.

## Phase 1 - orient

Know exactly what memory exists before changing a byte.

1. Resolve the memory directory and the layout, and confirm the directory exists.
2. List the memory directory, including `archive/` if there is one. Record the file count and the line count of MEMORY.md.
3. Read MEMORY.md, then read every memory file. There are usually fewer than thirty. Read them all rather than sampling - you cannot spot a contradiction in a file you did not open. For archived files, the frontmatter and the first line of the body are enough; they are there so you do not re-add a claim that was already retired.
4. Build a working list. For each memory: filename, `name`, type, the claim in one line, whether it has an index line, and anything suspect. Suspect means a relative date with no anchor, a claim that fights another memory, or a named file, function, flag, or command that may no longer exist.
5. On the first dream for a project, back up first. Put the copy beside the memory directory, never inside it, so the backup is not scanned as memory.

```bash
BASE=$(basename "$MEM")
if [ -z "$(find "$(dirname "$MEM")" -maxdepth 1 -type d -name "$BASE.backup-*" -print -quit)" ]; then
  cp -R "$MEM" "$MEM.backup-$(date +%Y%m%d-%H%M%S)"
fi
```

The guard matches on any existing `$MEM.backup-*`, not on today's date.
A date-keyed guard makes a fresh full copy on every calendar day a dream applies, which grows without bound beside the memory directory.
One backup per project, taken before the first dream ever touches these files, is the whole intent.
If a particular run looks risky enough to want a fresh snapshot, delete the old backup first so the count stays at one, and name it in the report.

Write nothing else in this phase.

## Phase 2 - gather signal

Find what recent sessions established that memory does not yet know.

Scope to transcripts modified inside your window, default seven days.

```bash
find "$PROJ" -maxdepth 2 -name '*.jsonl' -mtime -7 | sort
```

Four signal classes, in priority order:

1. Corrections. The user told you that you were wrong. Highest value - these are the memories that stop repeat mistakes.
2. Decisions. A choice was made and there is a reason attached.
3. Preferences. Standing instructions about how the user wants things done.
4. Patterns. Something has now happened often enough to be a rule.

Read the user's voice, not your own.
In a transcript line, genuine user input has `type: "user"`, `userType: "external"`, and `isSidechain: false`.
Skip `isSidechain: true` - that is subagent traffic, not the user.
`type: "user"` is a channel rather than an author, so plenty of what arrives on it is not the user's words: tool results, slash-command envelopes, command output, hook output, and interruption notices.
Filter those by shape, not by tag name, and fail closed - the rule and the measured leak counts are in [signal-patterns.md](signal-patterns.md).

Match with targeted patterns instead of reading whole transcripts.
The pattern catalogue, the line shapes, and the extraction recipes are in [signal-patterns.md](signal-patterns.md).

Phase 2 parallelizes cleanly.
If your runtime supports subagents, dispatch one per batch of transcripts and have each return a compact findings list.
If it does not, scan inline - the result is the same, just slower.

For each finding, record:

- the claim in one sentence
- the absolute date, taken from the line's `timestamp` field and never from words like yesterday
- the session id
- confidence: an explicit instruction is high, an inferred preference is medium
- which existing memory it confirms, refines, or contradicts

Drop findings that are already in memory unchanged, are one-off task detail with no future value, or are scoped to a branch or ticket that is now closed.

## Phase 3 - consolidate

Land the findings in the memory files.
This is the delicate phase.
The safety rails apply hardest here.

Decide per finding:

- New claim with no existing home. Write a new memory file.
- Confirms an existing memory. Leave it alone, or sharpen the wording if the new evidence makes it more precise.
- Refines an existing memory. Edit that file in place.
- Contradicts an existing memory. Newer evidence wins. Rewrite the memory to the new claim and keep one line of history: `(updated 2026-08-17, previously: prefers tabs)`.
- Two memories now make the same claim over the same scope. Merge them, delete the loser, and fix the index.

Which file survives a merge is decided by a ladder, so that two runs pick the same survivor:

1. Keep the file whose name follows the local convention - `<type>_<slug>.md` under native.
2. Still tied? Keep the file that already has an index line in MEMORY.md.
3. Still tied? Keep the filename that sorts first under `LC_ALL=C`.

A merge never changes what a claim covers.
"Prefer pnpm" and "prefer pnpm for the web app only" are two claims, not one - the second is scoped - so they do not merge.
Folding them together either widens a rule the user scoped deliberately or narrows one they meant globally, and both are silent.
When two memories differ only by a scope qualifier, keep both, and make each index hook name its scope.

Writing rules:

- Absolute dates only. A session dated 2026-03-15 saying "yesterday I rotated the key" becomes "2026-03-14: rotated the key".
- Keep existing frontmatter intact. `name`, `description`, and the provenance keys survive every rewrite, in the shape the file already uses - `metadata.originSessionId` for the nested shape, top-level `type` and `originSessionId` for the flat one. When merging, keep the surviving file's `originSessionId` and name the merged session in the body.
- One claim per memory file. If a file has grown two unrelated claims, split it.
- New files follow the local naming convention - `<type>_<slug>.md` under native.
- `description` is one line and says what the memory is for, so future retrieval finds it.
- Read a file before editing it.

## Phase 4 - prune and index

MEMORY.md is an index.
It never holds memory content.

1. Give every memory file exactly one index line: the link, plus a hook of a dozen words or so telling a future session when this memory matters.
2. Drop index lines pointing at files that no longer exist. Add lines for files that have none.
3. Order by usefulness, most load-bearing first. Group by type only when the list is long enough to need it.
4. Keep MEMORY.md under 200 lines. Over the limit, work down this list and stop as soon as you are under: shorten the longest hooks, then merge memories that make the same claim over the same scope under the phase 3 rules, then relocate whole memory files into `archive/`.
5. Preserve the formatting and separator style already used in the file. Do not churn punctuation.

### Archiving moves files, it never concatenates them

```bash
mkdir -p "$MEM/archive"
mv "$MEM/<file>.md" "$MEM/archive/<file>.md"
```

One claim per file still holds, frontmatter travels with the file, and nothing is rewritten.
Folding several memories into one archive file would destroy every provenance block but one, which the frontmatter rail forbids outright.

Pick what to archive by a property you can check on disk.
Use the first of these that applies:

- The claim is scoped to a repository, branch, service, file, or command that no longer exists. Confirm with a read or a grep first.
- The memory has no index line and no other memory refers to it.
- The claim is superseded in substance and you want the history kept rather than deleted.

"Least-used" is not on that list and cannot be: nothing on disk records how often a memory was read.
Do not rank by guessed usage, by apparent age, or by how important a claim feels.
If none of the three apply and MEMORY.md is still over budget, shorten hooks further and say in the report that the index is at its floor.

The archive gets one index line of its own, pointing at the directory:

```
- [Archived memories](archive/) <SEP> N retired memories, kept for provenance; read before re-deriving an old decision
```

That keeps MEMORY.md an index.
Content still lives in memory files, one claim per file, now one directory down.
`dream-timer.py` walks the memory directory recursively, so archived files still count as memory content - archiving never makes a project look empty to the hooks and never silences the nudge.

Prune candidates, each still subject to the deletion rail below:

- Claims a later session disproved.
- Guidance about a file, function, flag, script, or command that no longer exists. Verify with a read or a grep before deciding.
- Memories about a project or repo that is gone.
- Duplicates already merged in phase 3.

Age alone is never a reason to delete.
A two-year-old preference the user has never contradicted is still true.

## The timer contract

After a completed non-dry consolidation, write the current unix epoch seconds to `.last-dream` in the memory directory you just consolidated.

```bash
date +%s > "$MEM/.last-dream"
```

- File name: exactly `.last-dream`.
- Contents: unix epoch seconds as a decimal integer, nothing else. No trailing prose, no ISO date.
- Location: the memory directory of the project you consolidated, and only that one. `~/.claude/projects/<project-slug>/memory/.last-dream` under native, `<project>/memory/.last-dream` under openclaw, beside MEMORY.md under project-root.

Write the marker on every completed non-dry run, including one that found nothing to change.
The work was done, so the interval resets.
A no-op run that skipped the marker would leave the project permanently overdue and the nudge would fire at every single session start.

Three rules that keep the timer honest:

- Never write `.last-dream` for a project you did not consolidate.
- Never write it after a dry run. A dry run that reset the timer would silently swallow a real consolidation.
- Consolidated several projects in one pass? Write one `.last-dream` per project, each in its own memory directory.

### How far the handshake reaches

The hooks read `.last-dream` at `~/.claude/projects/<project-slug>/memory/.last-dream` and nowhere else.
That is the native layout only.
`dream-timer.py` resolves that one path and stops, so under openclaw and project-root the marker is still the honest record of when you last consolidated, and still worth writing where you consolidated, but the Stop and SessionStart hooks will not see it.
The practical consequence: on those layouts the nudge stays quiet when no native memory directory exists, and keeps flagging when one exists with stale content of its own.
If a project uses openclaw or project-root while a native memory directory also exists, consolidate that one too, or expect the nudge to keep firing.
Say which layout you consolidated in the report so the user can read the nudge correctly.

Under project-root the marker lands inside the user's repository.
It is local state rather than project content, so most users will not want it committed.
Mention it once in the report and leave the decision to them.
Do not edit `.gitignore` yourself - that is a write outside the memory directory, and nobody asked for it.

## Safety rails

Consolidation rewrites the user's memory.
These are hard rules, not preferences.

- Confirm the memory directory exists before the first write. A dream against a phantom path is worse than no dream: it reports success over an empty tree.
- Never delete a memory whose claim has not been superseded or disproven. "Looks old", "seems unimportant", and "I would not have written this" are not grounds. When unsure, keep it and let the next dream decide.
- Preserve frontmatter on rewrite. `metadata`, `type`, and `originSessionId` are how Claude Code tracks provenance; dropping them orphans the memory. Keep the shape the file already uses.
- Archive by moving whole files. Never merge several memories into one file to save index lines - that destroys every provenance block but one.
- Never move memory content into MEMORY.md. It is an index. Content lives in the memory files.
- Verify before keeping. If a memory names a file, function, flag, script, or command as current guidance, confirm it still exists. If it is gone, either rewrite the memory as dated history or remove it as disproven - do not leave a dead pointer standing as advice.
- Never invent a memory. Every claim traces to a transcript line or an existing memory file.
- Keep secrets out. Do not copy API keys, tokens, or credentials from transcripts into memory. Record the variable name and where it lives, never the value.
- Back up before the first dream in a project, once, and only once.
- Dry runs write nothing at all.

## Report what changed

Print a report at the end, dry run or applied.
Label which one it was in the first line.

- Memory directory, how it was resolved (timer or manual fallback), and the detected layout.
- Transcript window scanned, and how many transcripts matched.
- Memories added, updated, merged, archived, and deleted - each by filename, each with a one-line reason.
- MEMORY.md line count before and after.
- Whether `.last-dream` was written, with the path, or skipped because this was a dry run.
- Anything you deliberately left alone that a person should look at.

Report what you actually did, not what this skill is meant to do.
If a phase found nothing, say it found nothing - and on a non-dry run, say that the marker was written anyway.

## Verify before claiming done

```bash
wc -l "$MEM/MEMORY.md"                                   # under 200

# No hits is the expected result here, so do not let grep's exit status read as a failure.
grep -rin 'yesterday\|last week\|last month\|last sprint' "$MEM" --include='*.md' \
  || echo "no unanchored relative dates"

# Absent on a project that has never applied a dream, and unchanged after a dry run.
if [ -f "$MEM/.last-dream" ]; then
  cat "$MEM/.last-dream"
else
  echo "no .last-dream yet"
fi
```

Then confirm by reading, not by assuming: every file linked from MEMORY.md exists, every memory file is linked exactly once, and every rewritten file still carries its provenance keys in the shape it had before.

---

_Forked from [grandamenium/dream-skill](https://github.com/grandamenium/dream-skill) — MIT License. See original repository for full license text._
