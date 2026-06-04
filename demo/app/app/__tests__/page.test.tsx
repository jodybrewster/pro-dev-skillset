import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import Home from "@/app/page";

describe("landing page", () => {
  it("renders the hero headline", () => {
    render(<Home />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toMatch(
      /entire dev lifecycle/i,
    );
  });

  it("exposes the install commands as text", () => {
    render(<Home />);
    expect(screen.getByText(/claude plugin install pro-starter/)).toBeTruthy();
  });

  it("renders all eight lifecycle phases", () => {
    render(<Home />);
    for (const name of ["Define", "Plan", "Spec", "Build", "Verify", "Review", "Security", "Ship"]) {
      expect(screen.getAllByText(name).length).toBeGreaterThan(0);
    }
  });
});
