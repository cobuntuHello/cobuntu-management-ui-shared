import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
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

  it("renders the whole card as a button when onClick is set; clicking fires it", async () => {
    const onClick = vi.fn();
    render(
      <SectionCard
        title="Basics"
        description="€20"
        action={<span>›</span>}
        onClick={onClick}
      />,
    );
    const button = screen.getByRole("button", { name: /Basics/ });
    expect(button.tagName).toBe("BUTTON");
    await userEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("when disabled + onClick is set: renders as a non-interactive div", () => {
    const onClick = vi.fn();
    render(
      <SectionCard
        title="Locked"
        onClick={onClick}
        disabled
      />,
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByText("Locked").closest("[aria-disabled]")).not.toBeNull();
  });
});
