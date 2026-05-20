import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { WizardProgress } from "../ui/WizardProgress";

const steps = [
  { id: "basics", label: "Basics" },
  { id: "options", label: "Options" },
  { id: "members", label: "Members" },
  { id: "form", label: "Form" },
];

describe("WizardProgress", () => {
  it("marks the current step with aria-current=step", () => {
    render(<WizardProgress steps={steps} currentIndex={1} />);
    const current = screen.getByRole("button", { current: "step" });
    expect(current).toHaveTextContent("Options");
  });

  it("does not call onStepClick for unreachable future steps", async () => {
    const onStepClick = vi.fn();
    render(
      <WizardProgress
        steps={steps}
        currentIndex={0}
        onStepClick={onStepClick}
      />,
    );
    const future = screen.getByRole("button", { name: /Members/ });
    expect(future).toBeDisabled();
    await userEvent.click(future);
    expect(onStepClick).not.toHaveBeenCalled();
  });

  it("allows clicking back to completed steps", async () => {
    const onStepClick = vi.fn();
    render(
      <WizardProgress
        steps={steps}
        currentIndex={2}
        completedIndexes={[0, 1]}
        onStepClick={onStepClick}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: /Basics/ }));
    expect(onStepClick).toHaveBeenCalledWith(0);
  });
});
