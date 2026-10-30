// Component inventory and eval-tag coverage for the workflow plugins.
// A component is a skill, command, agent or hook a plugin ships. A plugin eval case
// declares what it covers in prompt.md frontmatter: `tags: [<kind>:<name>, ...]`; a
// stays-quiet case prefixes `quiet:`. A component counts as covered by a non-quiet tag.
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";

export const WORKFLOW_PLUGINS = ["pro-ai-sdlc", "pro-egm", "pro-spdd", "pro-speckit", "pro-pdd", "pro-electron"];

const isDir = (p) => existsSync(p) && statSync(p).isDirectory();
const sub = (p) => (isDir(p) ? readdirSync(p).sort() : []);

// Hook ids: the script stem for `${CLAUDE_PLUGIN_ROOT}/scripts/<stem>.<ext>`,
// else `<event>-inline-<n>` (n counts from 1 per event).
export function hookIds(hooksJson) {
  const ids = [];
  const events = (hooksJson && hooksJson.hooks) || {};
  for (const event of Object.keys(events)) {
    let inline = 0;
    for (const group of events[event] || []) {
      for (const h of group.hooks || []) {
        if (h.type && h.type !== "command") continue;
        const m = String(h.command || "").match(/scripts\/([^/"'\s]+?)\.(?:py|sh|mjs|js)\b/);
        if (m) ids.push(`hook:${m[1]}`);
        else ids.push(`hook:${event}-inline-${++inline}`);
      }
    }
  }
  return [...new Set(ids)];
}

export function listComponents(pluginDir) {
  const out = [];
  for (const s of sub(join(pluginDir, "skills")))
    if (existsSync(join(pluginDir, "skills", s, "SKILL.md"))) out.push(`skill:${s}`);
  for (const f of sub(join(pluginDir, "commands")))
    if (f.endsWith(".md")) out.push(`command:${f.slice(0, -3)}`);
  for (const f of sub(join(pluginDir, "agents")))
    if (f.endsWith(".md")) out.push(`agent:${f.slice(0, -3)}`);
  const hp = join(pluginDir, "hooks", "hooks.json");
  if (existsSync(hp)) {
    try { out.push(...hookIds(JSON.parse(readFileSync(hp, "utf8")))); } catch { /* the hooks check reports it */ }
  }
  return out;
}

const unquote = (s) => String(s).trim().replace(/^(["'])(.*)\1$/, "$2");

// Tags from one prompt.md text: inline array, block list or a bare scalar.
export function parseTags(text) {
  if (!text.startsWith("---")) return [];
  const end = text.indexOf("\n---", 3);
  if (end === -1) return [];
  const lines = text.slice(3, end).split("\n");
  const i = lines.findIndex((l) => /^tags\s*:/.test(l));
  if (i === -1) return [];
  const rest = lines[i].replace(/^tags\s*:\s*/, "").trim();
  if (rest.startsWith("[")) {
    return rest.replace(/^\[/, "").replace(/\]\s*(#.*)?$/, "").split(",").map(unquote).filter(Boolean);
  }
  if (rest) return [unquote(rest)];
  const tags = [];
  for (let j = i + 1; j < lines.length; j++) {
    const m = lines[j].match(/^\s+-\s*(.*)$/);
    if (!m) { if (lines[j].trim() === "") continue; break; }
    tags.push(unquote(m[1]));
  }
  return tags.filter(Boolean);
}

export function listCaseTags(pluginDir, evalDir = "evals") {
  const root = join(pluginDir, evalDir);
  const tags = [];
  for (const c of sub(root)) {
    if (c === "results") continue;
    const p = join(root, c, "prompt.md");
    if (existsSync(p)) tags.push(...parseTags(readFileSync(p, "utf8")));
  }
  return tags;
}

// components: ["kind:name"]; tags: every case tag; allowList: ["kind:name"] for this plugin.
export function coverageDiff(components, tags, allowList = []) {
  const covered = new Set(tags.filter((t) => !t.startsWith("quiet:")));
  const allowed = new Set(allowList);
  const exists = new Set(components);
  const missing = components.filter((c) => !covered.has(c) && !allowed.has(c));
  const stale = [...allowed].filter((c) => !exists.has(c) || covered.has(c));
  return { missing, stale };
}
