#!/usr/bin/env python3
"""Rank documents against a query. Okapi BM25 over a small corpus.

This module knows nothing about Claude Code, hooks, or memory files. It takes
documents and a query and returns an ordered list. `memory-recall.py` uses it to
decide which memories to inject; Mieruka's context-package compiler is intended
to use the same contract to decide which knowledge documents to assemble. One
ranking mechanism, two consumers, no vector database and no network call.

Contract - JSON on stdin, JSON on stdout:

    in   {"query": "...",
          "documents": [{"id": "...",          # required, unique
                         "text": "...",        # optional, the searchable body
                         "description": "...", # optional, weighted higher
                         "name": "...",        # optional, weighted higher
                         "path": "...",        # optional, carried through
                         "status": "active",   # optional, filters
                         "memory_tier": "long" # optional, carried through
                        }, ...],
          "limit": 3,          # optional
          "min_score": 0.0,    # optional
          "include_all": false # optional, keep drafts and archived material
         }

    out  {"results": [{"id": "...", "score": 1.87, "why": "matched: hook, stop"},
                      ...]}

Exit 0 on success, 2 on unusable input, with the error on stderr as
{"error": "..."} so a caller parsing stdout sees an empty result rather than a
crash. Run with --self-test to check the ranking against fixed cases.

Why BM25 rather than embeddings: the corpus is tens of documents, not millions.
BM25 needs no model, no API key, no index to rebuild, and no cache to go stale,
which means it also runs inside a hook on every prompt without adding latency a
user would feel. Term saturation and length normalisation are the two things a
naive keyword count gets wrong, and BM25 fixes both in about forty lines.

Scoring is over `name`, `description`, and `text`. Name and description are
repeated so they weigh more: a description exists precisely to say when a
document is relevant, so a hit there is worth more than a hit buried in prose.
"""
from __future__ import annotations

import json
import math
import re
import sys
from typing import Any

K1 = 1.2   # term-frequency saturation
B = 0.75   # length normalisation strength
FIELD_WEIGHT = 3  # how many times name/description are repeated into the bag

DEFAULT_LIMIT = 3
DEFAULT_MIN_SCORE = 0.0

# Excluded unless include_all. `draft` is unaccepted working material and
# `archived` is deliberately kept out of active context - injecting either would
# present superseded thinking as current guidance. The names match the lifecycle
# states in Mieruka's DOCUMENT_LIFECYCLE.md so one vocabulary covers both.
INACTIVE_STATUS = frozenset({
    "draft", "archived", "removed", "superseded", "candidate_removal",
})

# Common words carry no signal and, worse, distort the length normalisation by
# inflating document length. This is deliberately short: an aggressive list
# starts eating real query terms ("no", "not", and "own" all matter somewhere).
STOPWORDS = frozenset("""
a an and are as at be by for from has have how i if in into is it its of on or
that the this to was were what when where which who why will with you your do
does did can could should would there their them they we us our
""".split())

TOKEN = re.compile(r"[a-z0-9]+")


def tokenize(text: str) -> list[str]:
    """Lowercase alphanumeric runs, minus stopwords and single characters.

    No stemming. A stemmer would help recall ("hooks" finding "hook") but it
    also silently merges terms that mean different things, and with a corpus
    this small a wrong merge is more expensive than a missed match. Callers that
    want plural tolerance should put both forms in the description.
    """
    if not isinstance(text, str):
        return []
    return [t for t in TOKEN.findall(text.lower()) if len(t) > 1 and t not in STOPWORDS]


def document_bag(doc: dict[str, Any]) -> list[str]:
    """Searchable tokens for one document, with name and description weighted."""
    weighted = " ".join(
        str(doc.get(field) or "") for field in ("name", "description")
    )
    body = str(doc.get("text") or "")
    return tokenize(weighted) * FIELD_WEIGHT + tokenize(body)


def rank(
    query: str,
    documents: list[dict[str, Any]],
    limit: int = DEFAULT_LIMIT,
    min_score: float = DEFAULT_MIN_SCORE,
    include_all: bool = False,
) -> list[dict[str, Any]]:
    """Documents ordered by BM25 relevance to `query`, best first.

    Returns at most `limit` entries, each scoring strictly above `min_score`.
    An empty list is a normal answer and means nothing was relevant enough -
    that is the point of the floor. Always returning the top N of an unrelated
    corpus is how a recall system turns into a noise generator.
    """
    q_terms = tokenize(query)
    if not q_terms or not documents:
        return []

    corpus: list[tuple[dict[str, Any], list[str]]] = []
    for doc in documents:
        if not isinstance(doc, dict) or not doc.get("id"):
            continue
        status = str(doc.get("status") or "active").strip().lower()
        if not include_all and status in INACTIVE_STATUS:
            continue
        corpus.append((doc, document_bag(doc)))

    if not corpus:
        return []

    n_docs = len(corpus)
    avg_len = sum(len(bag) for _, bag in corpus) / n_docs
    if avg_len <= 0:
        return []

    # Document frequency per query term, over the filtered corpus only, so a
    # term's rarity is judged against what could actually be returned.
    seen = {term: 0 for term in set(q_terms)}
    bags = []
    for _doc, bag in corpus:
        counts: dict[str, int] = {}
        for token in bag:
            counts[token] = counts.get(token, 0) + 1
        bags.append(counts)
        for term in seen:
            if term in counts:
                seen[term] += 1

    idf = {}
    for term, df in seen.items():
        # Standard BM25 idf, in the +1 form that stays positive. The textbook
        # form goes negative for a term present in more than half the corpus,
        # which would let a common term push a document *down* the ranking.
        idf[term] = math.log(1.0 + (n_docs - df + 0.5) / (df + 0.5))

    scored: list[dict[str, Any]] = []
    for (doc, bag), counts in zip(corpus, bags):
        length = len(bag)
        score = 0.0
        matched: list[str] = []
        for term in q_terms:
            freq = counts.get(term, 0)
            if not freq:
                continue
            norm = freq * (K1 + 1) / (freq + K1 * (1 - B + B * length / avg_len))
            score += idf[term] * norm
            if term not in matched:
                matched.append(term)
        if score > min_score and matched:
            scored.append({
                "id": doc["id"],
                "score": round(score, 4),
                "why": "matched: " + ", ".join(matched[:6]),
                "path": doc.get("path"),
                "memory_tier": doc.get("memory_tier"),
            })

    # Sort by score, then id, so equal scores order the same way on every run.
    scored.sort(key=lambda r: (-r["score"], str(r["id"])))
    return scored[: max(0, int(limit))]


def _coerce_number(value: Any, fallback: float) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return fallback
    return float(value) if math.isfinite(float(value)) else fallback


def main(argv: list[str]) -> int:
    if "--help" in argv or "-h" in argv:
        print(__doc__.strip())
        return 0
    if "--self-test" in argv:
        return _self_test()

    try:
        payload = json.loads(sys.stdin.read() or "{}")
    except ValueError as exc:
        print(json.dumps({"error": f"invalid JSON on stdin: {exc}"}), file=sys.stderr)
        print(json.dumps({"results": []}))
        return 2
    if not isinstance(payload, dict):
        print(json.dumps({"error": "payload must be a JSON object"}), file=sys.stderr)
        print(json.dumps({"results": []}))
        return 2

    documents = payload.get("documents")
    results = rank(
        query=str(payload.get("query") or ""),
        documents=documents if isinstance(documents, list) else [],
        limit=int(_coerce_number(payload.get("limit"), DEFAULT_LIMIT)),
        min_score=_coerce_number(payload.get("min_score"), DEFAULT_MIN_SCORE),
        include_all=bool(payload.get("include_all")),
    )
    print(json.dumps({"results": results}, indent=2))
    return 0


def _self_test() -> int:
    """Fixed cases. Ranking is easy to break in ways no type checker notices."""
    docs = [
        {"id": "hooks", "name": "hook loading law",
         "description": "Claude Code loads exactly one hook file per plugin, hooks/hooks.json"},
        {"id": "versions", "name": "version bump law",
         "description": "bump the plugin version or the cache serves stale content"},
        {"id": "parallel", "name": "parallel subagents",
         "description": "batch independent Agent calls into one turn"},
        {"id": "old", "name": "retired approach", "status": "archived",
         "description": "the hook file naming we used to use, one file per concern"},
    ]
    failures = []

    top = rank("why is my hook not firing?", docs)
    if not top or top[0]["id"] != "hooks":
        failures.append(f"expected 'hooks' first for a hook query, got {[r['id'] for r in top]}")

    if any(r["id"] == "old" for r in rank("hook file naming", docs)):
        failures.append("archived document was returned without include_all")
    if not any(r["id"] == "old" for r in rank("hook file naming", docs, include_all=True)):
        failures.append("include_all did not surface the archived document")

    if rank("photosynthesis in ferns", docs):
        failures.append("unrelated query returned matches")
    if rank("", docs) or rank("hooks", []):
        failures.append("empty query or empty corpus returned matches")

    if len(rank("hook version parallel", docs, limit=2)) > 2:
        failures.append("limit not honoured")
    if rank("hook", docs, min_score=1e9):
        failures.append("min_score floor not honoured")

    # A term in every document must not outrank a rare, specific one.
    common = [{"id": str(i), "description": "plugin plugin", "name": "plugin"} for i in range(5)]
    common.append({"id": "rare", "description": "plugin marketplace", "name": "marketplace"})
    if rank("marketplace", common)[0]["id"] != "rare":
        failures.append("idf did not favour the rare term")

    for line in failures:
        print(f"FAIL {line}", file=sys.stderr)
    print("memory-score self-test:", "FAILED" if failures else "ok",
          file=sys.stderr if failures else sys.stdout)
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
