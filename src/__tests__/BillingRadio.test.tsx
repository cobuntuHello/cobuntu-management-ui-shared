import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { BillingRadio } from "../ui/BillingRadio";

describe("BillingRadio", () => {
  it("renders the three default modes", () => {
    render(<BillingRadio value="ONE_TIME" onChange={() => {}} />);
    expect(screen.getByLabelText(/One-time/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Recurring/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Installment plan/)).toBeInTheDocument();
  });

  it("marks the selected option as checked", () => {
    render(<BillingRadio value="INSTALLMENT_PLAN" onChange={() => {}} />);
    expect(screen.getByLabelText(/Installment plan/)).toBeChecked();
    expect(screen.getByLabelText(/One-time/)).not.toBeChecked();
  });

  it("calls onChange with the new mode", async () => {
    const onChange = vi.fn();
    render(<BillingRadio value="ONE_TIME" onChange={onChange} />);
    await userEvent.click(screen.getByLabelText(/Recurring/));
    expect(onChange).toHaveBeenCalledWith("RECURRING");
  });

  it("hides options flagged with hidden (e.g. events suppressing RECURRING)", () => {
    render(
      <BillingRadio
        value="ONE_TIME"
        onChange={() => {}}
        options={[
          { value: "ONE_TIME", label: "One-time" },
          { value: "RECURRING", label: "Recurring", hidden: true },
          { value: "INSTALLMENT_PLAN", label: "Installments" },
        ]}
      />,
    );
    expect(screen.queryByLabelText(/Recurring/)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Installments/)).toBeInTheDocument();
  });

  it("disables all options when disabled=true", () => {
    render(
      <BillingRadio value="ONE_TIME" onChange={() => {}} disabled />,
    );
    expect(screen.getByLabelText(/One-time/)).toBeDisabled();
    expect(screen.getByLabelText(/Recurring/)).toBeDisabled();
  });
});
