// Content model for the landing page. Kept separate from markup so the copy is
// editable in one place and unit-testable (see app/__tests__).

export type Phase = {
  name: string;
  tagline: string;
  skill: string;
};

export const PHASES: Phase[] = [
  { name: "Define", tagline: "Clarify intent", skill: "interview-me" },
  { name: "Plan", tagline: "Commit to an approach", skill: "writing-plans" },
  { name: "Spec", tagline: "Align before code", skill: "open-SPDD" },
  { name: "Build", tagline: "Implement with discipline", skill: "test-driven-development" },
  { name: "Verify", tagline: "Prove it works", skill: "qa-suite" },
  { name: "Review", tagline: "Polish & critique", skill: "requesting-code-review" },
  { name: "Security", tagline: "Harden", skill: "security-and-hardening" },
  { name: "Ship", tagline: "Launch & document", skill: "shipping-and-launch" },
];

export type Plugin = {
  name: string;
  blurb: string;
  skills: string[];
};

export const PLUGINS: Plugin[] = [
  { name: "pro-core", blurb: "Router, guardrails, and ecosystem discovery.", skills: ["using-pro-dev", "find-skills", "karpathy-guidelines"] },
  { name: "pro-execution", blurb: "Execution discipline for getting code written.", skills: ["test-driven-development", "subagent-driven-development", "systematic-debugging"] },
  { name: "pro-quality", blurb: "Review and verification gates before you ship.", skills: ["requesting-code-review", "verification-before-completion"] },
  { name: "pro-design", blurb: "Design tokens, type, motion, a11y — plus the impeccable bridge.", skills: ["ui-ux-pro-max", "design-token", "motion-system"] },
  { name: "pro-data", blurb: "Schema and auth patterns for the data layer.", skills: ["drizzle-schema-definition", "prisma-schema-patterns", "nextauth-patterns"] },
  { name: "pro-testing", blurb: "Unit, interactive, and the bridged QA suite.", skills: ["vitest", "agent-browser", "qa-suite"] },
  { name: "pro-spdd", blurb: "Structured prompt-driven spec workflow for clients.", skills: ["spdd-story", "spdd-reasons-canvas", "spdd-generate"] },
  { name: "pro-pdd", blurb: "Opt-in Define + Plan: interview, refine, plan.", skills: ["interview-me", "idea-refine", "brainstorming"] },
];

export type Bridge = {
  name: string;
  engine: string;
  command: string;
  blurb: string;
};

export const BRIDGES: Bridge[] = [
  { name: "ui-ux-pro-max", engine: "impeccable", command: "/design-engine", blurb: "The full end-to-end UI/UX engine, installed on demand." },
  { name: "qa-suite", engine: "qa-skills", command: "/qa-engine", blurb: "Playwright e2e, visual regression, contract testing, QA strategy." },
  { name: "pro-mieruka", engine: "Mieruka", command: "/init-mieruka", blurb: "Live client-facing progress: stories, canvases, approval gates." },
];

export type UseCase = {
  title: string;
  who: string;
  path: string[];
};

export const USE_CASES: UseCase[] = [
  {
    title: "Solo developer",
    who: "Building a full application end to end.",
    path: ["interview-me", "writing-plans", "test-driven-development", "qa-suite", "shipping-and-launch"],
  },
  {
    title: "Consulting team",
    who: "Delivering for a client who needs a written artifact trail.",
    path: ["interview-me", "open-SPDD", "qa-suite", "requesting-code-review", "ship"],
  },
];

export const INSTALL_STEPS = [
  "claude plugin marketplace add jodybrewster/pro-dev-skillset",
  "claude plugin install pro-starter@pro-dev-skillset",
];
