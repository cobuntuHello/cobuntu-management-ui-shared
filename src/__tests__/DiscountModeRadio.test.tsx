import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { DiscountModeRadio } from "../ui/DiscountModeRadio";

describe("DiscountModeRadio", () => {
  it("renders the four default modes", () => {
    render(<DiscountModeRadio value="FREE" onChange={() => {}} />);
    expect(screen.getByRole("radio", { name: /Free for members/ })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Percent off/ })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Flat amount off/ })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Fixed price/ })).toBeInTheDocument();
  });

  it("marks the selected option with aria-checked", () => {
    render(<DiscountModeRadio value="PERCENT_OFF" onChange={() => {}} />);
    expect(
      screen.getByRole("radio", { name: /Percent off/ }),
    ).toHaveAttribute("aria-checked", "true");
  });

  it("calls onChange when a new mode is clicked", async () => {
    const onChange = vi.fn();
    render(<DiscountModeRadio value="FREE" onChange={onChange} />);
    await userEvent.click(screen.getByRole("radio", { name: /Flat amount off/ }));
    expect(onChange).toHaveBeenCalledWith("FLAT_OFF");
  });

  it("does not call onChange when disabled", async () => {
    const onChange = vi.fn();
    render(<DiscountModeRadio value="FREE" onChange={onChange} disabled />);
    await userEvent.click(screen.getByRole("radio", { name: /Percent off/ }));
    expect(onChange).not.toHaveBeenCalled();
  });
});
