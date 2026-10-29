// Helpers for the behavioral evals: judge a stream-json trace and validate case files.
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

export function parseStream(text) {
  const events = [];
  for (const line of String(text ?? "").split("\n")) {
    const t = line.trim();
    if (!t) continue;
    try {
      events.push(JSON.parse(t));
    } catch {
      // a partial or non-JSON line is ignored; completeness is judged on what parses
    }
  }
  return events;
}

// Returns null when the trace is a complete, successful run; otherwise a short reason.
export function executionFailure(streamJsonText) {
  const events = parseStream(streamJsonText);
  if (events.length === 0) return "empty trace";
  const result = [...events].reverse().find((e) => e.type === "result");
  if (!result) return "no result event";
  if (events[events.length - 1] !== result) return "result event is not last";
  if (result.subtype !== "success") return `result subtype is ${result.subtype ?? "missing"}`;
  if (result.is_error) return "result is_error is true";
  if (Array.isArray(result.permission_denials) && result.permission_denials.length > 0) {
    const names = result.permission_denials.map((d) => d.tool_name || "unknown").join(", ");
    return `permission denied: ${names}`;
  }
  const called = new Set();
  const answered = new Set();
  for (const e of events) {
    const content = e.message?.content;
    if (!Array.isArray(content)) continue;
    for (const block of content) {
      if (e.type === "assistant" && block.type === "tool_use") called.add(block.id);
      if (e.type === "user" && block.type === "tool_result") answered.add(block.tool_use_id);
    }
  }
  const missing = [...called].filter((id) => !answered.has(id));
  if (missing.length > 0) return `${missing.length} tool call(s) without a result`;
  return null;
}

// Compact, readable rendering of a trace for the grader.
export function renderTrace(streamJsonText, maxChars = 60000) {
  const out = [];
  for (const e of parseStream(streamJsonText)) {
    const content = e.message?.content;
    if (e.type === "assistant" && Array.isArray(content)) {
      for (const b of content) {
        if (b.type === "text") out.push(`ASSISTANT: ${b.text}`);
        else if (b.type === "tool_use") out.push(`TOOL_CALL ${b.name}: ${JSON.stringify(b.input)}`);
      }
    } else if (e.type === "user" && Array.isArray(content)) {
      for (const b of content) {
        if (b.type !== "tool_result") continue;
        const body = typeof b.content === "string" ? b.content : JSON.stringify(b.content);
        out.push(`TOOL_RESULT: ${body.slice(0, 2000)}`);
      }
    }
  }
  const text = out.join("\n");
  return text.length > maxChars ? `${text.slice(0, maxChars / 2)}\n[...trimmed...]\n${text.slice(-maxChars / 2)}` : text;
}

const KINDS = ["execution", "dialogue"];
const PRESSURES = ["time", "sunk-cost", "authority"];

// Returns a list of error strings; empty means valid.
export function validateCase(c, fixturesRoot, repoRoot) {
  const errors = [];
  if (!c || typeof c !== "object") return ["case file is not an object"];
  if (!c.skill || typeof c.skill !== "string") errors.push("missing skill");
  if (!c.plugin || typeof c.plugin !== "string") errors.push("missing plugin");
  if (c.skill && c.plugin && repoRoot) {
    const p = join(repoRoot, "plugins", c.plugin, "skills", c.skill, "SKILL.md");
    if (!existsSync(p)) errors.push(`skill not found at plugins/${c.plugin}/skills/${c.skill}/SKILL.md`);
  }
  if (!Array.isArray(c.evals) || c.evals.length === 0) return [...errors, "evals must be a non-empty array"];
  const ids = new Set();
  for (const [i, ev] of c.evals.entries()) {
    const at = `eval ${ev?.id ?? `#${i}`}`;
    if (ev?.id === undefined || ev?.id === null || ev.id === "") errors.push(`${at}: missing id`);
    else if (ids.has(ev.id)) errors.push(`${at}: duplicate id`);
    else ids.add(ev.id);
    const kind = ev?.kind ?? "execution";
    if (!KINDS.includes(kind)) errors.push(`${at}: kind must be execution or dialogue`);
    if (!ev?.prompt || typeof ev.prompt !== "string") errors.push(`${at}: missing prompt`);
    if (ev?.pressure !== undefined && !PRESSURES.includes(ev.pressure)) errors.push(`${at}: pressure must be time, sunk-cost or authority`);
    if (!Array.isArray(ev?.expectations) || ev.expectations.length === 0 || ev.expectations.some((x) => typeof x !== "string" || !x.trim())) {
      errors.push(`${at}: expectations must be a non-empty list of strings`);
    }
    if (kind === "execution") {
      if (!Array.isArray(ev?.files) || ev.files.length === 0) errors.push(`${at}: files required for execution`);
      else {
        for (const f of ev.files) {
          const p = join(fixturesRoot, f);
          if (typeof f !== "string" || f.includes("..") || !existsSync(p)) errors.push(`${at}: fixture not found: ${f}`);
          else if (!statSync(p).isFile() && !statSync(p).isDirectory()) errors.push(`${at}: fixture is not a file or directory: ${f}`);
        }
      }
    }
  }
  return errors;
}

// Pull the first balanced JSON object out of grader text and check its shape.
export function parseGrade(text, expectations) {
  const s = String(text ?? "");
  for (let start = s.indexOf("{"); start !== -1; start = s.indexOf("{", start + 1)) {
    let depth = 0;
    let inStr = false;
    for (let i = start; i < s.length; i++) {
      const ch = s[i];
      if (inStr) {
        if (ch === "\\") i++;
        else if (ch === '"') inStr = false;
      } else if (ch === '"') inStr = true;
      else if (ch === "{") depth++;
      else if (ch === "}" && --depth === 0) {
        try {
          const obj = JSON.parse(s.slice(start, i + 1));
          const list = obj.expectations;
          if (
            Array.isArray(list) &&
            list.length === expectations.length &&
            list.every((x) => x && typeof x.text === "string" && typeof x.passed === "boolean" && typeof x.evidence === "string")
          ) {
            return obj;
          }
        } catch {
          // try the next candidate
        }
        break;
      }
    }
  }
  return null;
}
