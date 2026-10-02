#!/usr/bin/env python3
"""Shared legal-surface classifier for the pro-legal hooks.

Pure functions do the classification:

  text_hits(text)            -> sorted unique categories matched in prose (plans, prompts)
  diff_files(diff, root)     -> {category: [paths]} for a unified diff
  diff_hits(diff, root)      -> sorted unique categories matched in a unified diff
  path_files(paths, new)     -> {category: [paths]} judged from file names alone
  resolve_license(name, ...) -> license string of an installed dependency, or None

The hooks import this module (each script puts its own directory on sys.path).
Below the classifier sit a few small I/O helpers shared by the hooks (state
file, git root, hook output). They are kept apart so the classifier stays pure.

Both classifiers err toward silence: a hook that cries wolf on engineering talk
gets turned off. Every category needs at least one strong term, and the common
false friends (LLM tokens, forked subagents, session cookies, pub/sub
subscriptions, DOM children, code exports) are scrubbed before matching.

Categories are coarse on purpose. Platform and app-store topics (store review
guidelines, DMCA, UGC, clickwrap) sit under `terms`. Contributor and team IP
topics (CLA, DCO, invention assignment, noncompete) sit under `client-ip`.
NIS2 and DORA sit under `sensitive-data`. Foreign privacy statutes sit under
`privacy`. Acronyms that collide with ordinary words or other jargon (SCC,
DORA metrics, ATT, PIPA) are matched case-sensitively and only in context.

Manual testing:
  echo "scrape LinkedIn profiles and send cold email" | python3 legal_surface.py
  git diff --cached | python3 legal_surface.py --diff
"""
from __future__ import annotations

import glob
import hashlib
import json
import os
import re
import subprocess
import sys
import tempfile

# ---------------------------------------------------------------------------
# Prose classifier

_I = re.IGNORECASE

# Phrases that look legal-adjacent but are not. Removed before matching.
_SCRUB = [
    r"\bdesign[- ]tokens?\b",
    r"\b(?:colou?r|spacing|typography|type|font|size|radius|shadow|motion|theme|css|brand)[- ]tokens?\b",
    r"\b(?:input|output|context|prompt|completion|max|total|cached|reasoning|thinking|auth|access|refresh|api|csrf|bearer|id)[- ]tokens?\b",
    r"\btokens?\b",
    r"\bcontext windows?\b",
    r"\bsession[- ](?:start|end|ledger|transcript|summary|memory|log|notes?|handoff)\b",
    r"\b(?:this|current|previous|last|claude(?: code)?|agent|coding) sessions?\b",
    r"\bfork(?:s|ed|ing)?\s+(?:a |an |the |one )?(?:sub-?agents?|process(?:es)?|workers?|threads?|children|child)\b",
    r"\bforked (?:process|worker|thread|subagent)\b",
    r"\bfork\s*\(\s*\)",
    r"\bgit fork\b",
    r"\blicen[sc]e[- ]keys?\b",
    r"\b(?:session|auth|authentication|login|csrf|refresh|http-?only|secure|signed) cookies?\b",
    r"\bcookies? (?:expiry|expiration|max-?age|domain|flags?|jar)\b",
    r"\bin terms of\b",
    r"\b(?:event|message|topic|channel|realtime|real-time|graphql|websocket|socket|observable|store|state|redux|pub-?sub)s? subscriptions?\b",
    r"\bsubscri(?:be|bes|bed|bing|ptions?)\s+to\s+(?:the |an? |all )?(?:\w+ )?(?:events?|websockets?|observables?|topics?|channels?|streams?|changes|updates|store|messages?|queues?|hooks?|feeds?)\b",
    r"\b(?:claude|anthropic|max|codex|chatgpt|github copilot)(?: \w+)? subscription\b",
    r"\b(?:issue|progress|bug|task|time|error|defect|change|dependency|version) (?:tracking|trackers?)\b",
    r"\btrack(?:ing)? (?:changes|progress|issues|tasks|state|versions|status|usage|costs?|tokens?)\b",
    r"\btask trackers?\b",
    r"\bchild processes?\b",
    r"\bchildren (?:prop|nodes?|elements?|array|of (?:the |a )?(?:tree|node|element|component|dom|directory|process))\b",
    r"\b(?:tree|dom|node|react|component|element|parent) children\b",
    r"\bprops\.children\b",
    r"\badd children to\b",
    r"\bminor (?:version|release|bump|update)s?\b",
    r"\bexport (?:default|function|const|class|type|interface|async|\{)",
    r"\b(?:named|default|barrel) exports?\b",
    r"\bmodule\.exports\b|\bexports\.\w+",
    r"\bexport(?:s|ed|ing)? (?:the |a |an )?(?:helper|function|helpers|constants?|symbols?|types?|components?|modules?)\b",
]
_SCRUB_RE = re.compile("|".join(_SCRUB), _I)

# (?-i:...) keeps acronyms case-sensitive inside an otherwise case-insensitive pattern.
_CATEGORIES: dict[str, list[str]] = {
    "oss-licensing": [
        r"(?-i:\b(?:A|L)?GPL(?:[- ]?v?\d(?:\.\d)?\+?)?\b)", r"(?-i:\bSSPL\b)", r"(?-i:\bBSL\b)", r"(?-i:\bBUSL\b)",
        r"\bBusiness Source License\b", r"\bServer Side Public License\b",
        r"\bGNU (?:Affero |Lesser )?General Public License\b",
        r"\bcopyleft\b", r"\brelicens\w+", r"\bopen[- ]sourc(?:e|ing) (?:it|this|the (?:repo|project|code|library|tool|plugin))\b",
        r"\bvendor(?:ing|ed)? in\b", r"\bcopy(?:ing)? (?:the )?code from\b",
        r"\bport(?:ing|ed)? (?:the )?(?:code |logic |it )?from (?!the\b|main\b|master\b|a\b|an\b|one\b|branch\b|this\b|that\b)[A-Za-z0-9_./-]+",
        r"\battribution\b",
    ],
    "privacy": [
        r"\bpersonal (?:data|information)\b", r"(?-i:\bPII\b)", r"(?-i:\b(?:GDPR|CCPA|CPRA)\b)",
        r"\banalytics\b", r"\btracking pixels?\b", r"\b(?:user|visitor|cross-site|behaviou?ral|ad) tracking\b",
        r"\btrack(?:ing)? (?:users?|visitors?|customers?)\b",
        r"\b(?:tracking|third[- ]party|marketing|advertising|ad) cookies\b",
        r"\bcookie (?:banners?|consent|notices?|policy|wall)\b", r"\bconsent banners?\b",
        r"\bdata retention\b", r"\baccount deletion\b", r"\bdelet(?:e|ing) (?:a |the )?user(?:'s)? (?:accounts?|data)\b",
        r"\bprecise location\b", r"\bsell(?:ing)? (?:user|customer|personal) data\b",
        r"\bshar(?:e|ing) (?:\w+ ){0,3}with (?:\w+ )?third[- ]parties\b", r"\bemail lists?\b",
        # Laws outside the EU/UK/US baseline. Acronyms are case-sensitive.
        r"(?-i:\b(?:PIPEDA|LGPD|ANPD|PIPL|DPDP|APPI|PIPA|PDPA|POPIA|KVKK|nFADP)\b)", r"\bDigital Personal Data Protection\b",
        r"\brevised (?:Swiss )?FADP\b", r"\b(?:Quebec |Québec )?(?:Law 25|Loi 25|Bill 64)\b", r"\bCalOPPA\b", r"(?-i:\bCIPA\b)",
        # Wiretap only counts in a tracking or legal-claim context.
        r"\bwiretap(?:ping)? (?:claims?|laws?|statutes?|acts?|exposure|suits?|lawsuits?|liability|risk)\b",
        r"\b(?:tracking|analytics|pixels?|session[- ]replay|chat widgets?|chat)\b[^.\n]{0,40}\bwiretap\w*",
        r"\bsession[- ]replay\b", r"(?-i:\bDelete Act\b)", r"\bdata brokers?\b", r"\bbreach notification\b",
        r"\bdata (?:locali[sz]ation|residency) (?:laws?|requirements?|rules?|regulations?|obligations?|mandates?|compliance)\b",
        r"\b(?:EU|UK|China|India|Russia|Indonesia|Vietnam|GDPR|regional|in-region|in-country|customer) data residency\b",
        r"\bcross[- ]border (?:personal )?(?:data )?(?:transfers?|flows?)\b",
        r"\bstandard contractual clauses\b", r"(?-i:\b(?:EU|UK) SCCs?\b)",
        r"\bprivacy manifests?\b", r"\bApp Tracking Transparency\b", r"(?-i:\bATT (?:prompt|consent|permission|dialog|framework|opt-?in)s?\b)",
        r"\bdata safety (?:form|section)\b", r"\bprivacy nutrition labels?\b", r"\b(?:app store|apple|play store|google play) privacy labels?\b",
    ],
    "ai": [
        r"\b(?:train\w*|fine[- ]?tun\w*)\s+(?:\w+\s+){0,3}?(?:on|with|using)\s+(?:\w+\s+){0,2}?(?:user|customer|client)s?(?:'s?)?\s+(?:data|content|conversations?|messages?|documents?|chats?|prompts?)\b",
        r"\bAI[- ]generated (?:\w+ ){0,3}(?:shown|displayed|presented|served|published|sent|delivered) to (?:\w+ )?(?:end[- ]?)?(?:users?|customers?|visitors?|the public)\b",
        r"\buser[- ]facing AI[- ]generated\b",
        r"\bcustomer[- ](?:facing |support |service )?(?:chat ?bots?|AI assistants?)\b",
        r"\bchat ?bots? for (?:our |the )?(?:customers?|users?|visitors?)\b",
        r"\bdeep ?fakes?\b", r"\bvoice[- ]clon\w+", r"\bclon\w+ (?:a |someone(?:'s)? |their |his |her )?voices?\b",
        r"\bfac(?:e|ial)[- ]recogni\w+", r"\bbiometric\w*", r"\bemotion[- ]recogni\w+",
        r"\bautomated (?:decisions?|decision-making|scoring|screening) (?:about |on |for |of )?(?:hiring|credit|housing|insurance|lending|employment|loans?)\b",
        r"\b(?:hiring|credit|loan|housing|insurance|tenant) (?:decisions?|scoring|screening) (?:made )?(?:by|with|using) (?:an? )?(?:AI|LLM|model|algorithm)\b",
        r"\bEU AI Act\b", r"\bAI disclosures?\b",
        r"(?-i:\bAI Basic Act\b)", r"\bAI[- ]generated[- ]content label\w*",
        r"\bAI (?:content )?label(?:l?ing) (?:rules?|requirements?|measures?|law|regulations?|mandates?|obligations?)\b",
        r"\blabel(?:l?ing) (?:of )?AI[- ]generated (?:content|media|images?|videos?|text)\b",
        r"\bgenerative AI (?:interim )?measures\b", r"\balgorithm(?:ic)? (?:filings?|registry|registration)\b",
        r"\btext[- ]and[- ]data[- ]mining\b", r"(?-i:\bTDM)[- ](?:opt-?out|reservation|exception)\b", r"\bbot disclosures?\b",
    ],
    "scraping": [
        r"\bscrap(?:e|es|ed|ing|er|ers)\b", r"\bcrawlers?\b", r"\bcrawl(?:ing)? (?:the )?(?:web|sites?|websites?)\b",
        r"\bharvest(?:ing)? (?:e-?mails?|contacts?|addresses)\b",
        r"\blead enrichment\b", r"\benrich(?:ing)? (?:\w+ )?leads?\b", r"\bcontact data\b",
        r"\blinkedin (?:data|profiles?|scrap\w+)\b",
        r"\bbypass(?:ing)? (?:the |their |site )?rate[- ]?limits?\b", r"\brotat\w+ (?:\w+ )?proxies\b", r"\bproxy rotation\b",
    ],
    "consumer": [
        r"\bauto[- ]?renew\w*", r"\bfree trials? (?:that |which )?(?:auto-?)?convert\w*", r"\btrial converts?\b",
        r"\brecurring (?:billing|charges?|payments?)\b", r"\bcancell?ation (?:flow|page|process)\b",
        r"\bsubscriptions?\b", r"\bdark patterns?\b", r"\bfake reviews?\b", r"\bsweepstakes\b",
        r"\bsubscription contracts? regime\b", r"\bdrip pricing\b", r"(?-i:\bDMCC\b)",
    ],
    "marketing-comms": [
        r"\be-?mail marketing\b", r"\bnewsletter (?:blasts?|sends?|campaigns?)\b", r"\bmarketing e-?mails?\b",
        r"\bcold e-?mail\w*", r"\bSMS marketing\b", r"\btext message campaigns?\b", r"\brobocall\w*",
        r"\bauto-?dialers?\b", r"\bbulk e-?mail\b", r"\bdrip campaigns?\b", r"\bmass e-?mail\b",
        r"(?-i:\bCASL\b)", r"(?-i:\bSpam Act\b)",
    ],
    "children": [
        r"(?-i:\bCOPPA\b)", r"\bunder (?:the age of )?13\b", r"\b(?:kids|children(?:'s)?|childrens) (?:app|apps|game|games|product|platform|website)\b",
        r"\b(?:app|game|product|platform|site) for (?:kids|children)\b", r"\bage verification\b", r"\bage[- ]gates?\b",
        r"\bminors\b", r"\bunder[- ]16 (?:social media|accounts?|users?|ban|minors|kids|children|teens)\b",
        r"\bsocial media (?:minimum age|age (?:limit|ban|minimum))\b", r"\bage assurance\b",
    ],
    "sensitive-data": [
        r"\bhealth (?:data|information|records?)\b", r"(?-i:\bHIPAA\b)", r"(?-i:\bPHI\b)",
        r"\bmedical (?:data|records?|information|history|app)\b", r"\bpatient data\b", r"\bbiometric\w*",
        r"\bfinancial account (?:data|information|numbers?)\b", r"\bcredit scores?\b", r"(?-i:\bKYC\b)", r"(?-i:\bGLBA\b)",
        r"(?-i:\bNIS2\b)", r"\bDigital Operational Resilience\b",
        # DORA also names DevOps metrics and a first name: only the uppercase acronym next to regulation words.
        r"(?-i:\bDORA\b)(?=[^.\n]{0,60}\b(?:ICT|financial|regulation|EU)\b)",
        r"(?-i:\b(?:ICT|financial|regulation|EU)\b)[^.\n]{0,40}(?-i:\bDORA\b)",
    ],
    "export": [
        r"\bexport controls?\b", r"(?-i:\bEAR(?:99)?\b)", r"(?-i:\bITAR\b)", r"\bsanctions\b", r"(?-i:\bOFAC\b)",
        r"\bembargo(?:ed)? countr\w+", r"\bship(?:ping)? encryption to\b",
    ],
    "accessibility": [
        r"(?-i:\bADA\b)", r"(?-i:\bWCAG\b)", r"\bSection 508\b", r"\bEuropean Accessibility Act\b",
        r"\baccessibility (?:compliance|lawsuits?|audit)\b",
    ],
    "trademark": [
        r"\brenam\w+ (?:the )?(?:product|company|brand)\b", r"\bbrand names?\b", r"\btrademarks?\b",
        r"\bdomain names? for (?:the |our |this )?(?:product|app|brand)\b",
        r"\bpackage names? (?:that )?(?:matches|matching|clash\w*|conflicts?)\b",
    ],
    "client-ip": [
        r"\bclient owns\b", r"\bwork[- ]for[- ]hire\b", r"\bIP assignment\b", r"\bclient data\b",
        r"(?-i:\bNDAs?\b)", r"\bdeliverable licen[sc]e\b", r"\bcontractor agreement\b",
        r"\binvention assignments?\b", r"\bwork made for hire\b", r"(?-i:\bCLAs?\b)", r"\bcontributor licen[sc]e agreements?\b",
        r"(?-i:\bDCO\b)", r"\bDeveloper Certificate of Origin\b", r"\bnon-?compete\w*",
    ],
    "terms": [
        r"\bterms (?:of (?:service|use)|and conditions)\b", r"\bprivacy polic(?:y|ies)\b", r"(?-i:\bEULA\b)",
        r"(?-i:\bToS\b)", r"\bAPI terms\b",
        r"\bApp Store Review Guidelines\b", r"\bGoogle Play (?:developer )?polic(?:y|ies)\b", r"\baccount deletion requirements?\b",
        r"(?-i:\bDMCA\b)", r"\b(?:notice[- ]and[- ])?takedown (?:notices?|requests?|polic(?:y|ies)|procedures?|process)\b",
        r"\bnotice[- ]and[- ]takedown\b", r"\bSection 230\b", r"\bdesignated (?:DMCA )?agent\b",
        r"\buser[- ]generated content\b", r"(?-i:\bUGC\b)", r"\bclickwrap\b", r"\bbrowsewrap\b",
    ],
}
_COMPILED = {k: [re.compile(p, _I) for p in v] for k, v in _CATEGORIES.items()}


def text_hits(text: str) -> list[str]:
    """Categories matched in prose. Sorted, unique. Empty for benign text."""
    if not text or not isinstance(text, str):
        return []
    clean = _SCRUB_RE.sub(" ", text)
    return sorted(c for c, pats in _COMPILED.items() if any(p.search(clean) for p in pats))


# ---------------------------------------------------------------------------
# Diff classifier

_DOC_EXT = (".md", ".mdx", ".txt", ".rst")
_LOCKFILES = {
    "package-lock.json", "yarn.lock", "pnpm-lock.yaml", "bun.lockb", "bun.lock",
    "poetry.lock", "cargo.lock", "go.sum", "gemfile.lock", "uv.lock", "composer.lock",
}


def _is_doc_like(path: str) -> bool:
    p = path.lower()
    base = p.rsplit("/", 1)[-1]
    if p.endswith(_DOC_EXT) or base in _LOCKFILES:
        return True
    return p.startswith("docs/") or "/docs/" in p


_LICENSE_BASE = re.compile(
    r"^(?:(?:license|licence|copying|notice|unlicense)(?:[-_](?:mit|apache|bsd|gpl|lgpl|agpl|mpl|isc|apache-2\.0))?"
    r"(?:\.(?:md|txt|rst|markdown))?|third[-_]?party[-_](?:licen[sc]es?|notices?)(?:\.(?:md|txt|rst|json))?)$"
)
_PRIVACY_PATH = re.compile(
    r"(?:^|/)(?:privacy(?:[-_](?:policy|notice))?|cookies?(?:[-_](?:consent|banner|policy))?|consent(?:[-_]\w+)?|gdpr|ccpa|analytics|tracking|tracker)"
    r"(?:/|\.[a-z]+$)"
    r"|(?<!issue)(?<!bug)(?<!progress)(?<!time)(?<!task)[-_](?:analytics|tracking|consent)\.[a-z]+$"
)
_TERMS_PATH = re.compile(
    r"(?:^|/)(?:terms[-_](?:of[-_](?:service|use)|and[-_]conditions)|tos|eula|legal)(?:/|\.[a-z]+$)"
)
_VENDOR_PATH = re.compile(r"(?:^|/)(?:vendor|third[-_]party|thirdparty)/")

_DEP_FILES = {"package.json", "requirements.txt", "pyproject.toml", "go.mod", "cargo.toml", "gemfile"}
_NOT_DEP_KEYS = {
    "version", "name", "edition", "python", "requires-python", "rust-version", "description",
    "license", "authors", "readme", "ruby", "main", "module", "types", "type", "private",
    "homepage", "repository", "node", "npm", "engines", "packageManager", "go", "toolchain",
}
_SEMVERISH = re.compile(
    r"^(?:[\^~<>=]*\s*\d[\w.\-+ <>=|^~*]*|(?:workspace|npm|file|link|github|git\+?\w*|https?):.*|latest|\*)$"
)


def _dep_names(basename: str, line: str) -> str | None:
    """Return the dependency name an added line declares, or None."""
    s = line.strip()
    if not s or s.startswith(("#", "//")):
        return None
    if basename == "package.json":
        m = re.match(r'^"([@\w./\-]+)"\s*:\s*"([^"]*)"\s*,?$', s)
        if m and m.group(1) not in _NOT_DEP_KEYS and _SEMVERISH.match(m.group(2)):
            return m.group(1)
    elif basename == "requirements.txt":
        m = re.match(r"^([A-Za-z0-9][\w.\-]*)(?:\[[^\]]*\])?\s*(?:[<>=~!]=?.*)?$", s)
        if m:
            return m.group(1).lower()
    elif basename == "pyproject.toml":
        m = re.match(r'^"([A-Za-z0-9][\w.\-]*)(?:\[[^\]]*\])?\s*[<>=~!]=?[^"]*",?$', s)
        if m:
            return m.group(1).lower()
        m = re.match(r'^([A-Za-z0-9][\w.\-]*)\s*=\s*(?:"([^"]*)"|\{.*\})\s*,?$', s)
        if m and m.group(1) not in _NOT_DEP_KEYS and (m.group(2) is None or _SEMVERISH.match(m.group(2))):
            return m.group(1).lower()
    elif basename == "go.mod":
        m = re.match(r"^(?:require\s+)?([\w.\-]+\.[a-z]+/[\w./\-~]+)\s+v\d", s)
        if m:
            return m.group(1)
    elif basename == "cargo.toml":
        m = re.match(r'^([A-Za-z0-9][\w\-]*)\s*=\s*(?:"([^"]*)"|\{.*\})\s*,?$', s)
        if m and m.group(1) not in _NOT_DEP_KEYS and (m.group(2) is None or _SEMVERISH.match(m.group(2))):
            return m.group(1).lower()
    elif basename == "gemfile":
        m = re.match(r"""^gem\s+['"]([\w.\-]+)['"]""", s)
        if m:
            return m.group(1).lower()
    return None


# Content rules: (category, pattern). Run on added lines of non-doc files.
_CONTENT_RULES: list[tuple[str, re.Pattern]] = [
    ("privacy", re.compile(
        r"\bposthog\b|\bmixpanel\b|@segment/|analytics\.js|\bgtag\s*\(|googletagmanager|\bfbq\s*\(|"
        r"\bhotjar\b|\bfullstory\b|@amplitude/|clarity\.ms", re.I)),
    ("privacy", re.compile(
        r"\brrweb\b|@fullstory/|\blogrocket\b|\bsmartlook\b|\bmouseflow\b|@intercom/|\bintercom\s*\(|"
        r"crisp\.chat|drift\.com", re.I)),
    ("privacy", re.compile(
        r"NSUserTrackingUsageDescription|ATTrackingManager|AdvertisingIdClient|com\.google\.android\.gms\.permission\.AD_ID")),
    ("marketing-comms", re.compile(
        r"\bnodemailer\b|@sendgrid/|\bmailchimp\b|"
        r"""(?:from|require\(|import)\s*['"]resend['"]|\bnew Resend\s*\(|\bresend\.emails\b""", re.I)),
    ("consumer", re.compile(r"\bstripe\.subscriptions\b|\btrial_period_days\b|\brecurring\s*:")),
    ("ai", re.compile(r"\bface-api\b|\brekognition\b|\bface_recognition\b", re.I)),
    ("sensitive-data", re.compile(r"\bface-api\b|\brekognition\b|\bface_recognition\b", re.I)),
    ("scraping", re.compile(
        r"linkedin\.com/in/|puppeteer-extra-plugin-stealth|user[-_ ]?agent[-_ ]?(?:rotation|rotate|rotator|pool)|"
        r"\brotate_?user_?agents?\b|proxy[-_ ]rotation|rotating[-_ ]prox", re.I)),
]
# A machine-readable license declaration counts in any file, docs included.
_SPDX_RULE: tuple[str, re.Pattern] = (
    "oss-licensing", re.compile(r"SPDX-License-Identifier:\s*\(?\s*(?:A|L)?GPL"))
# License names in prose count only in source files: docs that discuss the GPL
# (a licensing guide, a legal reference) are not code under that license.
_LICENSE_NAME_RULE: tuple[str, re.Pattern] = (
    "oss-licensing", re.compile(
        r"GNU (?:Affero |Lesser )?General Public License|Server Side Public License|Business Source License"))
# File-level rules: every pattern must appear somewhere in the file's added lines.
_FILE_RULES: list[tuple[str, tuple[re.Pattern, ...]]] = [
    ("marketing-comms", (re.compile(r"\btwilio\b", re.I), re.compile(r"\.messages\.create\s*\("))),
]


def _parse_diff(diff_text: str) -> list[dict]:
    files: list[dict] = []
    cur: dict | None = None
    in_hunk = False
    for line in (diff_text or "").splitlines():
        if line.startswith("diff --git "):
            m = re.search(r" b/(.+)$", line)
            cur = {"path": m.group(1) if m else "", "added": [], "removed": [], "deleted": False, "new": False}
            files.append(cur)
            in_hunk = False
            continue
        if not in_hunk:
            if line.startswith("deleted file mode") and cur:
                cur["deleted"] = True
            elif line.startswith("new file mode") and cur:
                cur["new"] = True
            elif line.startswith("+++ "):
                p = line[4:].strip()
                if p == "/dev/null":
                    continue
                p = p[2:] if p.startswith("b/") else p
                if cur is None or not cur["path"]:
                    cur = {"path": p, "added": [], "removed": [], "deleted": False, "new": False}
                    files.append(cur)
            elif line.startswith("@@") and cur is not None:
                in_hunk = True
            continue
        if line.startswith("@@") or cur is None:
            continue
        if line.startswith("+"):
            cur["added"].append(line[1:])
        elif line.startswith("-"):
            cur["removed"].append(line[1:])
    return files


def _path_cats(path: str, new: bool) -> list[str]:
    low = path.lower()
    base = low.rsplit("/", 1)[-1]
    cats: list[str] = []
    if _LICENSE_BASE.match(base):
        cats.append("oss-licensing")
    if new and _VENDOR_PATH.search(low):
        cats.append("oss-licensing")
    if low.startswith("docs/") or "/docs/" in low or base in _LOCKFILES:
        return cats
    if base == "privacyinfo.xcprivacy":
        cats.append("privacy")
    if _PRIVACY_PATH.search(low):
        cats.append("privacy")
    if _TERMS_PATH.search(low):
        cats.append("terms")
    return cats


# ---- dependency license resolution (local only, no network) ---------------

_BAD_LICENSE = re.compile(
    r"(?:^|[^A-Za-z])(?:A|L)?GPL(?![A-Za-z])|General Public License|\bSSPL\b|\bBUSL\b|\bBSL-?1|Business Source|"
    r"Elastic[- ]?(?:License[- ]?)?2|Commons[- ]Clause|CC-BY-NC|Non-?Commercial|^\s*UNLICENSED\s*$|SEE LICENSE IN",
    re.I,
)


def license_problem(expr: str | None) -> bool:
    """True when a license string is one the hooks flag. Unknown or empty is not a problem."""
    if not expr or not isinstance(expr, str):
        return False
    expr = expr.strip()
    if re.fullmatch(r"\(?\s*UNLICENSED\s*\)?", expr, re.I) or re.match(r"SEE LICENSE IN", expr, re.I):
        return True
    alts = [a.strip(" ()") for a in re.split(r"\s+OR\s+", expr, flags=re.I)]
    # A dual license with one clean option lets the consumer pick it.
    return all(bool(_BAD_LICENSE.search(a)) for a in alts if a)


def _npm_license(pkg_json: dict) -> str | None:
    lic = pkg_json.get("license")
    if isinstance(lic, dict):
        lic = lic.get("type")
    if isinstance(lic, str) and lic.strip():
        return lic.strip()
    lics = pkg_json.get("licenses")
    if isinstance(lics, list):
        names = [(x.get("type") if isinstance(x, dict) else x) for x in lics]
        names = [n for n in names if isinstance(n, str)]
        if names:
            return " OR ".join(names)
    return None


def _norm_py(name: str) -> str:
    return re.sub(r"[-_.]+", "-", name).lower()


def _py_license_from_metadata(text: str) -> str | None:
    head = text.split("\n\n", 1)[0]
    expr = re.search(r"^License-Expression:\s*(.+)$", head, re.M)
    if expr:
        return expr.group(1).strip()
    cls = [m.strip() for m in re.findall(r"^Classifier:\s*License ::\s*(.+)$", head, re.M)]
    cls = [c for c in cls if c.lower() != "osi approved"]
    if cls:
        return " OR ".join(cls)
    lic = re.search(r"^License:\s*(.+)$", head, re.M)
    if lic and len(lic.group(1).strip()) < 200 and lic.group(1).strip().upper() != "UNKNOWN":
        return lic.group(1).strip()
    return None


def resolve_license(name: str, root: str, manifest_dir: str = "") -> str | None:
    """Resolve an installed dependency's license from local files, or None.

    npm: walks node_modules/<name>/package.json up from the manifest dir to root.
    Python: looks in <root>/.venv and <root>/venv site-packages dist-info, then in
    the running interpreter via importlib.metadata. No network, no installs.
    """
    if not name or not root:
        return None
    try:
        base = os.path.normpath(os.path.join(root, manifest_dir))
        root_n = os.path.normpath(root)
        d = base
        while True:
            p = os.path.join(d, "node_modules", *name.split("/"), "package.json")
            if os.path.isfile(p):
                with open(p, errors="replace") as fh:
                    lic = _npm_license(json.load(fh))
                if lic:
                    return lic
            if d == root_n or len(d) <= len(root_n):
                break
            d = os.path.dirname(d)
        want = _norm_py(name)
        for venv in (".venv", "venv"):
            pat = os.path.join(root_n, venv, "lib", "python*", "site-packages", "*.dist-info", "METADATA")
            for meta in glob.glob(pat):
                dist = os.path.basename(os.path.dirname(meta))[: -len(".dist-info")]
                if _norm_py(dist.rsplit("-", 1)[0]) == want:
                    with open(meta, errors="replace") as fh:
                        lic = _py_license_from_metadata(fh.read(64 * 1024))
                    if lic:
                        return lic
        try:
            from importlib import metadata
            text = metadata.distribution(name).read_text("METADATA")
            if text:
                return _py_license_from_metadata(text)
        except Exception:
            pass
    except Exception:
        return None
    return None


def _added_deps(f: dict) -> list[str]:
    base = f["path"].lower().rsplit("/", 1)[-1]
    if base not in _DEP_FILES:
        return []
    removed = {_dep_names(base, r) for r in f["removed"]} - {None}
    out: list[str] = []
    for a in f["added"]:
        n = _dep_names(base, a)
        if n and n not in removed and n not in out:
            out.append(n)
    return out


def dependency_licenses(diff_text: str, root: str | None) -> list[tuple[str, str, str]]:
    """(manifest path, dependency, license) for newly added deps with a problematic license."""
    if not root:
        return []
    found: list[tuple[str, str, str]] = []
    for f in _parse_diff(diff_text):
        if not f["path"] or f["deleted"] or _is_doc_like(f["path"]):
            continue
        mdir = os.path.dirname(f["path"])
        for name in _added_deps(f):
            lic = resolve_license(name, root, mdir)
            if lic and license_problem(lic):
                found.append((f["path"], name, lic))
    return found


def diff_files(diff_text: str, root: str | None = None) -> dict[str, list[str]]:
    """Map category -> sorted unique file paths for a unified diff.

    With `root` (the repo root) newly added dependencies get a local license
    lookup and a problematic license adds `dependency-license`.
    """
    found: dict[str, set[str]] = {}

    def add(cat: str, path: str) -> None:
        found.setdefault(cat, set()).add(path)

    for f in _parse_diff(diff_text):
        path = f["path"]
        if not path or f["deleted"]:
            continue
        for cat in _path_cats(path, f["new"]):
            add(cat, path)
        if any(_SPDX_RULE[1].search(a) for a in f["added"]):
            add(_SPDX_RULE[0], path)
        if _is_doc_like(path):
            continue
        for a in f["added"]:
            for cat, rx in (*_CONTENT_RULES, _LICENSE_NAME_RULE):
                if rx.search(a):
                    add(cat, path)
        if f["added"]:
            body = "\n".join(f["added"])
            for cat, rxs in _FILE_RULES:
                if all(rx.search(body) for rx in rxs):
                    add(cat, path)
    for path, _name, _lic in dependency_licenses(diff_text, root):
        add("dependency-license", path)
    return {k: sorted(v) for k, v in found.items()}


def diff_hits(diff_text: str, root: str | None = None) -> list[str]:
    """Categories matched in a unified diff. Sorted, unique."""
    return sorted(diff_files(diff_text, root))


def path_files(paths: list[str], new_paths: list[str] | None = None) -> dict[str, list[str]]:
    """Category -> paths judged from file names alone (used when a diff is too big to read)."""
    new = set(new_paths or [])
    found: dict[str, set[str]] = {}
    for p in paths:
        for cat in _path_cats(p, p in new):
            found.setdefault(cat, set()).add(p)
    return {k: sorted(v) for k, v in found.items()}


# ---------------------------------------------------------------------------
# Shared hook helpers (I/O). Not part of the pure classifier above.

PLAN_SECTION_RE = re.compile(r"^##\s+Legal review\b", re.I | re.M)
AGENT_HINT = (
    "Dispatch the `software-counsel` subagent "
    "(if subagents are unavailable, apply the software-counsel skill yourself)"
)
PARALLEL_NOTE = (
    "If a security challenge is also pending, dispatch `security-architect` and "
    "`software-counsel` in parallel in one turn."
)
SELF_REVIEW_NOTE = (
    "A `## Legal review` section the plan's author wrote does not count: the point is an "
    "independent pass by someone who did not write the plan. "
)
COUNSEL_TRANSCRIPT_MAX_BYTES = 64 * 1024 * 1024


def counsel_ran(transcript_path: str | None) -> bool:
    """True when this session dispatched the software-counsel subagent or skill.

    Without a readable transcript the gate cannot tell, so it answers True and
    trusts the section heading alone (fail open, never wedge on missing data).
    """
    if not transcript_path:
        return True
    try:
        if os.path.getsize(transcript_path) > COUNSEL_TRANSCRIPT_MAX_BYTES:
            return True
        with open(transcript_path, errors="replace") as fh:
            for line in fh:
                if "software-counsel" not in line and "legal-review" not in line:
                    continue
                try:
                    entry = json.loads(line)
                except Exception:
                    continue
                msg = entry.get("message")
                content = msg.get("content") if isinstance(msg, dict) else None
                for block in content if isinstance(content, list) else []:
                    if not isinstance(block, dict) or block.get("type") != "tool_use":
                        continue
                    inp = block.get("input") if isinstance(block.get("input"), dict) else {}
                    name = block.get("name")
                    if name in ("Agent", "Task") and str(inp.get("subagent_type", "")).endswith("software-counsel"):
                        return True
                    if name == "Skill" and any(k in str(inp.get("skill", "")) for k in ("software-counsel", "legal-review")):
                        return True
    except OSError:
        return True
    return False


def read_payload() -> dict | None:
    try:
        payload = json.load(sys.stdin)
    except Exception:
        return None
    return payload if isinstance(payload, dict) else None


def run_git(args: list[str], cwd: str, timeout: int = 10) -> tuple[bool, str]:
    try:
        r = subprocess.run(["git", *args], cwd=cwd, capture_output=True, text=True,
                           timeout=timeout, errors="replace")
        return r.returncode == 0, r.stdout
    except Exception:
        return False, ""


def key_root(cwd: str) -> str:
    ok, out = run_git(["rev-parse", "--show-toplevel"], cwd)
    return out.strip() if ok and out.strip() else cwd


def state_path(session_id: str, root: str) -> str:
    home = os.environ.get("PRO_DEV_STATE_DIR") or os.path.expanduser("~/.claude/pro-dev")
    key = hashlib.sha256(f"{session_id}:{root}".encode()).hexdigest()[:16]
    return os.path.join(home, "legal", f"{key}.json")


def load_state(path: str) -> dict:
    try:
        with open(path) as fh:
            data = json.load(fh)
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}


def save_state(path: str, state: dict) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=os.path.dirname(path), suffix=".tmp")
    try:
        with os.fdopen(fd, "w") as fh:
            json.dump(state, fh)
        os.replace(tmp, path)
    except Exception:
        try:
            os.unlink(tmp)
        except Exception:
            pass
        raise


def session_state(payload: dict) -> tuple[str, dict]:
    cwd = payload.get("cwd") or os.getcwd()
    path = state_path(str(payload.get("session_id") or "nosession"), key_root(cwd))
    return path, load_state(path)


def plans_dir() -> str:
    return os.environ.get("PRO_DEV_PLANS_DIR") or os.path.expanduser("~/.claude/plans")


def emit(obj: dict) -> None:
    sys.stdout.write(json.dumps(obj))
    sys.stdout.flush()


def deny_pretool(reason: str) -> None:
    emit({"hookSpecificOutput": {"hookEventName": "PreToolUse",
                                 "permissionDecision": "deny",
                                 "permissionDecisionReason": reason}})


if __name__ == "__main__":
    data = sys.stdin.read()
    hits = diff_hits(data) if "--diff" in sys.argv[1:] else text_hits(data)
    print("\n".join(hits))
