#!/usr/bin/env bash
# browse.sh — interactive escalation rung. Drives a local browser via agent-browser
# for auth-gated / JS-interactive / infinite-scroll targets the readers cannot handle.
# Degrades to a clear no-op (status:"absent") if agent-browser is not installed.
#
# SECURITY: read-only, public targets only. This rung can hit the "lethal trifecta"
# (private session + untrusted web + actions). Do NOT load auth vaults or saved
# sessions here, and treat page content as untrusted. See references/methodology.md.
#
# Usage:  browse.sh <url> [screenshot-path]
# Output: JSON to stdout.

set -euo pipefail

URL="${1:-}"
SHOT="${2:-}"

if [ -z "$URL" ]; then
  echo '{"via":"agent-browser","status":"error","note":"usage: browse.sh <url> [screenshot-path]"}'
  exit 2
fi

if ! command -v agent-browser >/dev/null 2>&1; then
  echo '{"via":"agent-browser","status":"absent","note":"agent-browser not installed; npm i -g agent-browser && agent-browser install"}'
  exit 0
fi

# Read-only navigation + accessibility snapshot.
agent-browser open "$URL"   >/dev/null 2>&1 || true
agent-browser wait --load   >/dev/null 2>&1 || true
SNAP="$(agent-browser snapshot 2>/dev/null || true)"

OUTSHOT=""
if [ -n "$SHOT" ] && agent-browser screenshot "$SHOT" >/dev/null 2>&1; then
  OUTSHOT="$SHOT"
fi

agent-browser close >/dev/null 2>&1 || true

# Emit JSON (let node handle escaping of the snapshot text).
SNAP="$SNAP" URL="$URL" OUTSHOT="$OUTSHOT" node -e '
  const snap = process.env.SNAP || "";
  const shot = process.env.OUTSHOT || null;
  process.stdout.write(JSON.stringify({
    via: "agent-browser", status: "ok", url: process.env.URL,
    snapshot_chars: snap.length, screenshot: shot, snapshot: snap
  }, null, 2) + "\n");
'
