// Shared catalog loading for the routing evals (eval.mjs, route-lexical.mjs).
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

export const isDir = (p) => existsSync(p) && statSync(p).isDirectory();
export const listDirs = (p) => (isDir(p) ? readdirSync(p).filter((d) => isDir(join(p, d))) : []);

export function frontmatter(text) {
  const data = {};
  if (!text.startsWith("---")) return data;
  const end = text.indexOf("\n---", 3);
  if (end === -1) return data;
  for (const line of text.slice(3, end).split("\n")) {
    const m = line.match(/^(name|description):\s?(.*)$/);
    if (m) data[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return data;
}

// Hardcoded routing distractors: real user-level skills that compete for the
// same prompts in actual sessions but live outside this marketplace, so
// loadCatalog() never sees them. Descriptions snapshotted from the
// user's real environment on 2026-07-17.
export const DISTRACTORS = [
  {
    slug: "impeccable",
    plugin: "external",
    description:
      "Use when the user wants to design, redesign, shape, critique, audit, polish, clarify, distill, harden, optimize, adapt, animate, colorize, extract, or otherwise improve a frontend interface. Covers websites, landing pages, dashboards, product UI, app shells, components, forms, settings, onboarding, and empty states. Handles UX review, visual hierarchy, information architecture, cognitive load, accessibility, performance, responsive behavior, theming, anti-patterns, typography, fonts, spacing, layout, alignment, color, motion, micro-interactions, UX copy, error states, edge cases, i18n, and reusable design systems or tokens. Also use for bland designs that need to become bolder or more delightful, loud designs that should become quieter, live browser iteration on UI elements, or ambitious visual effects that should feel technically extraordinary. Not for backend-only or non-UI tasks.",
  },
  {
    slug: "dataviz",
    plugin: "external",
    description:
      "Use this skill whenever you are about to create ANY chart, graph, plot, dashboard, or data visualization, in ANY output medium - an HTML or React artifact, inline SVG, plotting code in any library (matplotlib, plotly, d3, Recharts), an image/PNG you will render, or a chart shared into Slack. Read it BEFORE writing the first line of chart code, choosing chart colors, building a stat tile / meter / KPI row, or laying out a dashboard.",
  },
  {
    slug: "skill-creator",
    plugin: "external",
    description:
      "Create new skills, modify and improve existing skills, and measure skill performance. Use when users want to create a skill from scratch, edit or optimize an existing skill, run evals to test a skill, benchmark skill performance with variance analysis, or optimize a skill's description for better triggering accuracy.",
  },
  {
    slug: "humanizer",
    plugin: "external",
    description:
      "Strip the machine fingerprints out of text - both the invisible character-level encoding (em-dashes, smart quotes, zero-width and non-breaking spaces) and the stylistic tells of LLM prose. Use whenever the user asks to humanize, de-AI, remove the AI-isms, make something sound less like ChatGPT, or strip hidden/weird characters from copied text.",
  },
  {
    slug: "deploy-to-vercel",
    plugin: "external",
    description:
      "Deploy applications and websites to Vercel. Use when the user requests deployment actions like \"deploy my app\", \"deploy and give me the link\", \"push this live\", or \"create a preview deployment\".",
  },
  {
    slug: "vercel-optimize",
    plugin: "external",
    description:
      "Use for Vercel cost and performance optimization on deployed projects, especially Next.js, SvelteKit, Nuxt, and limited Astro apps. Collect Vercel metrics, usage, project config, and code scan results first; investigate only metric-backed candidates; produce ranked recommendations grounded in verified files and version-aware Vercel/framework docs. Trigger for Vercel bill reduction, slow or expensive routes, caching opportunities, Function Invocations, Build Minutes, Fast Data Transfer, Core Web Vitals, Bot Management, Fluid compute, or cost breakdown requests.",
  },
  {
    slug: "vercel-react-best-practices",
    plugin: "external",
    description:
      "React and Next.js performance optimization guidelines from Vercel Engineering. This skill should be used when writing, reviewing, or refactoring React/Next.js code to ensure optimal performance patterns. Triggers on tasks involving React components, Next.js pages, data fetching, bundle optimization, or performance improvements.",
  },
];

// Build the routing catalog.
// Includes agents/*.md as well as skills: a real session routes across both, so
// a skills-only catalog would score a router that does not exist. It also means
// an agent that poaches a skill's prompts fails a case instead of failing quietly.
export function loadCatalog() {
  const catalog = [];
  const slugs = new Set();
  for (const plugin of listDirs(join(ROOT, "plugins"))) {
    for (const slug of listDirs(join(ROOT, "plugins", plugin, "skills"))) {
      const p = join(ROOT, "plugins", plugin, "skills", slug, "SKILL.md");
      if (!existsSync(p)) continue;
      const fm = frontmatter(readFileSync(p, "utf8"));
      catalog.push({ slug, plugin, kind: "skill", description: fm.description || "" });
      slugs.add(slug);
    }
    const agentsDir = join(ROOT, "plugins", plugin, "agents");
    if (!isDir(agentsDir)) continue;
    for (const file of readdirSync(agentsDir)) {
      if (!file.endsWith(".md")) continue;
      const slug = file.replace(/\.md$/, "");
      const fm = frontmatter(readFileSync(join(agentsDir, file), "utf8"));
      catalog.push({ slug, plugin, kind: "subagent", description: fm.description || "" });
      slugs.add(slug);
    }
  }
  return { catalog, slugs };
}

export function loadCases() {
  return readFileSync(join(ROOT, "tests", "cases", "routing.jsonl"), "utf8")
    .split("\n").map((l) => l.trim()).filter(Boolean).map((l) => JSON.parse(l));
}
