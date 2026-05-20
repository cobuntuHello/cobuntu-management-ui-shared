import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { SectionCard } from "../ui/SectionCard";

describe("SectionCard", () => {
  it("renders title, description, action, and children", () => {
    render(
      <SectionCard
        title="Pricing"
        description="What buyers pay"
        action={<button>Edit</button>}
      >
        <p>€20</p>
      </SectionCard>,
    );
    expect(screen.getByText("Pricing")).toBeInTheDocument();
    expect(screen.getByText("What buyers pay")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
    expect(screen.getByText("€20")).toBeInTheDocument();
  });

  it("omits the border in subtle variant", () => {
    const { container } = render(
      <SectionCard variant="subtle" title="t">
        <p>x</p>
      </SectionCard>,
    );
    const section = container.querySelector("section")!;
    expect(section.className).not.toContain("border");
  });

  it("renders standalone when no children are provided", () => {
    render(<SectionCard title="Header only" />);
    expect(screen.getByText("Header only")).toBeInTheDocument();
  });
});
