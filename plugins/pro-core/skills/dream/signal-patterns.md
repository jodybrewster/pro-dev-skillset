# Signal patterns for phase 2

Phase 2 of the dream skill needs to find the few lines in a week of transcripts that are worth remembering.
This file holds the line shapes, the match patterns, and the extraction recipes.
Read it when you reach phase 2, not before.

## Transcript line shapes

Each `.jsonl` transcript is one JSON object per line, appended in order.
Only some line types carry conversation.

| `type` | What it is | Scan it? |
|--------|------------|----------|
| `user` | a turn attributed to the user | yes, with the filters below |
| `assistant` | a model turn | only as context around a match |
| `system` | runtime notices | no |
| `attachment` | hook output, file snapshots, injected context | no |
| `mode`, `permission-mode`, `last-prompt`, `file-history-snapshot` | session bookkeeping | no |

Fields that matter on a conversation line:

- `message.role` and `message.content` - content is either a string (plain typed prose) or an array of blocks (`text`, `tool_use`, `tool_result`, images).
- `timestamp` - ISO 8601 in UTC, and the only trustworthy date. Resolve every relative date in the text against it.
- `sessionId` - record it with each finding so a memory can cite where it came from.
- `isSidechain` - `true` means the line belongs to a subagent conversation, not the user's, so skip those.
- `userType` - `external` is a real person typing; anything else is generated.

## Lines that arrive as the user but are not the user

`type: "user"` is a channel, not an author.
The harness writes on that channel too: tool results, slash-command envelopes, command output, hook output, injected context, and interruption notices.
Some of that is arbitrary shell output.
Reading it as user prose invents preferences the user never stated, and it is the path by which a token or an API key ends up copied into a memory file.

Filter on shape, not on tag name.
Everything the harness puts on the user channel arrives in one of three shapes:

1. A content block with `type: "tool_result"`. Output, not intent. Drop the whole line.
2. Text that starts with an angle-bracket envelope tag - `<local-command-stdout>`, `<local-command-caveat>`, `<bash-input>`, `<bash-stdout>`, `<task-notification>`, and whatever the harness adds next.
3. Text that is nothing but a bracketed harness notice - `[Request interrupted by user]`, `[Image: source: ...]`.

Rejecting on the shape is the reason this holds.
A blocklist of known tag names goes stale the moment the harness ships a new tag, and it goes stale silently, because a leaked line looks exactly like user prose.
Measured over 460 real transcripts on one machine, a three-tag blocklist admitted 629 harness lines as user prose across six tag families and two notice families, and three of the six tags were not on the list.
Matching `^<tag>` instead admitted none.

Two tags need the whole line dropped rather than truncated, because they wrap injected content that can sit on either side of the user's words: `<system-reminder>` and `<command-name>` / `<command-message>`.

## Extraction recipe

Reduce a transcript to real user prose first, then match against it.
This is far cheaper than grepping raw JSON, and it stops you from matching your own words.

```bash
python3 - "$TRANSCRIPT" <<'PY'
import json, re, sys

ENVELOPE = re.compile(r"<[A-Za-z][A-Za-z0-9_-]*>")            # any harness envelope tag
WRAPPER = re.compile(r"<system-reminder>|<command-(name|message)>")
NOTICE = re.compile(r"^(?:\[[^\]]*\]\s*)+")                   # leading bracketed notices

for raw in open(sys.argv[1], errors="replace"):
    try:
        d = json.loads(raw)
    except ValueError:
        continue
    if d.get("type") != "user" or d.get("isSidechain") or d.get("userType") != "external":
        continue
    c = (d.get("message") or {}).get("content")
    if isinstance(c, list):
        if any(isinstance(b, dict) and b.get("type") == "tool_result" for b in c):
            continue
        c = " ".join(b.get("text", "") for b in c if isinstance(b, dict) and b.get("type") == "text")
    if not isinstance(c, str) or not c.strip():
        continue
    text = c.strip()
    if ENVELOPE.match(text) or WRAPPER.search(text):
        continue
    text = NOTICE.sub("", ENVELOPE.split(text, 1)[0]).strip()
    if not text:
        continue
    print(d.get("timestamp", "")[:10], "|", d.get("sessionId", "")[:8], "|", " ".join(text.split())[:400])
PY
```

Three lines do the filtering, in this order.
`ENVELOPE.match` drops any line whose text opens with an envelope tag, whatever that tag turns out to be.
`ENVELOPE.split(text, 1)[0]` truncates at the first envelope tag inside a line that started as prose, so injected context appended after the user's words never reaches the pattern match or a memory file.
`NOTICE.sub` strips leading bracketed notices, which reduces `[Request interrupted by user]` to nothing and leaves `[Image #1] add these dropdowns` as the prose it is.

Truncation is the direction to fail in.
A turn that quotes markup - `<div>`, `<Suspense>` - gets cut at the tag and may lose the rest of the sentence.
That costs a little recall on a candidate line, and a candidate is only a pointer: you re-read the full turn before writing a memory anyway.
The other direction costs a credential in a file the user did not read.

Without Python, a coarse first pass over raw lines still narrows the field:

```bash
grep -il 'actually\|I prefer\|from now on\|never use' "$PROJ"/*.jsonl
```

`grep -l` prints filenames only, so it cannot leak content on its own.
Extract prose from the files it names using the recipe above; do not read the matching raw lines directly.

## Pattern catalogue

Match case-insensitively against extracted user prose.
A hit is a candidate, never a finding - read the surrounding turn before you believe it.

Corrections, highest priority:

```
actually | no, | that's wrong | that's not | incorrect | not right | stop doing
don't do that | I said | I meant | I already told you | you keep | revert that
that's not what I asked | wrong again | fix that
```

Decisions:

```
let's go with | we're using | I decided | the plan is | switch to | move to
we settled on | going with | we agreed | drop | replace it with
```

Preferences and standing instructions:

```
I prefer | always | never | I want | I like | I don't like | from now on
going forward | remember that | keep in mind | make sure to | default to
my rule is | house style
```

Recurring patterns:

```
again | every time | keep forgetting | as usual | same as before | like last time
we always | the usual | you always | this keeps happening
```

Two frequent false positives:

- "always" and "never" inside a description of code behaviour ("this function never returns null") is not a preference.
- "actually" used as filler ("actually, that worked") is not a correction.

## Turning a candidate into a finding

For each candidate, read the user turn in full plus the assistant turn that follows, so you can see whether the instruction was understood and acted on.
Then write the finding down as:

```
claim:      one sentence, in the user's terms
date:       YYYY-MM-DD from the line timestamp
session:    session id
class:      correction | decision | preference | pattern
confidence: high (explicit instruction) | medium (inferred)
collides:   which existing memory this confirms, refines, or contradicts (or none)
```

## What earns a memory

Keep a finding when it will still be true and still be useful next month.

Worth remembering:

- A correction the user has now made more than once - that is a pattern, and the most valuable thing memory can hold.
- A standing preference stated as a rule rather than as a one-off request.
- A decision plus its reason, where the reason is not obvious from the code.
- A trap in this project that cost real time - a command that fails a specific way, a step that is easy to skip.

Not worth remembering:

- Anything reconstructible by reading the repo in ten seconds.
- Detail scoped to one job: a filename in a branch that has merged, a temporary workaround already removed.
- Anything the project's own instruction files already state, since duplicating those wastes the index.
- Praise, thanks, and conversational filler.

A good memory body says the claim, why it exists, and how to apply it, in that order, in under 200 words.
