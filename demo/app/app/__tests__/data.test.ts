import { describe, it, expect } from "vitest";
import { PHASES, PLUGINS, BRIDGES, USE_CASES, INSTALL_STEPS } from "@/components/data";

describe("landing page content model", () => {
  it("covers the full eight-phase lifecycle", () => {
    expect(PHASES.map((p) => p.name)).toEqual([
      "Define", "Plan", "Spec", "Build", "Verify", "Review", "Security", "Ship",
    ]);
  });

  it("gives every phase a routing skill", () => {
    for (const phase of PHASES) expect(phase.skill.length).toBeGreaterThan(0);
  });

  it("lists plugins, each with a blurb and at least one skill", () => {
    expect(PLUGINS.length).toBeGreaterThanOrEqual(8);
    for (const p of PLUGINS) {
      expect(p.blurb.length).toBeGreaterThan(0);
      expect(p.skills.length).toBeGreaterThan(0);
    }
  });

  it("ties each bridge to an install command", () => {
    for (const b of BRIDGES) expect(b.command.startsWith("/")).toBe(true);
  });

  it("documents both use-case paths ending at a ship step", () => {
    expect(USE_CASES).toHaveLength(2);
    for (const uc of USE_CASES) expect(uc.path.at(-1)).toMatch(/ship/i);
  });

  it("install steps add the marketplace then install the starter", () => {
    expect(INSTALL_STEPS[0]).toContain("marketplace add");
    expect(INSTALL_STEPS[1]).toContain("pro-starter");
  });
});
