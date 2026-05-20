import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { NumberField } from "../ui/NumberField";

describe("NumberField", () => {
  it("renders as a number input", () => {
    render(
      <NumberField label="Tickets" value={3} onChange={() => {}} integer />,
    );
    const input = screen.getByLabelText("Tickets") as HTMLInputElement;
    expect(input.type).toBe("number");
    expect(input.value).toBe("3");
  });

  it("calls onChange with integer when integer=true", () => {
    const onChange = vi.fn();
    render(
      <NumberField label="Months" value="" onChange={onChange} integer />,
    );
    fireEvent.change(screen.getByLabelText("Months"), {
      target: { value: "12" },
    });
    expect(onChange).toHaveBeenCalledWith(12);
  });

  it("emits empty string when the input is cleared", () => {
    const onChange = vi.fn();
    render(<NumberField label="x" value={5} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("x"), { target: { value: "" } });
    expect(onChange).toHaveBeenCalledWith("");
  });

  it("supports decimal input by default", () => {
    const onChange = vi.fn();
    render(<NumberField label="x" value="" onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("x"), { target: { value: "9.5" } });
    expect(onChange).toHaveBeenCalledWith(9.5);
  });
});
