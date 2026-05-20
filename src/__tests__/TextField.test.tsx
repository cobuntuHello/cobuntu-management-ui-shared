import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { TextField } from "../ui/TextField";

describe("TextField", () => {
  it("renders label, hint, and prefix/suffix adornments", () => {
    render(
      <TextField
        label="Price"
        hint="Excluding VAT"
        prefix="€"
        suffix="EUR"
        placeholder="0.00"
        value=""
        onChange={() => {}}
      />,
    );
    expect(screen.getByLabelText("Price")).toBeInTheDocument();
    expect(screen.getByText("Excluding VAT")).toBeInTheDocument();
    expect(screen.getByText("€")).toBeInTheDocument();
    expect(screen.getByText("EUR")).toBeInTheDocument();
  });

  it("shows error and hides hint when error is set", () => {
    render(
      <TextField
        label="Email"
        hint="Required"
        error="Invalid email"
        value=""
        onChange={() => {}}
      />,
    );
    expect(screen.getByText("Invalid email")).toBeInTheDocument();
    expect(screen.queryByText("Required")).not.toBeInTheDocument();
  });

  it("forwards onChange events", async () => {
    const onChange = vi.fn();
    render(<TextField label="Name" value="" onChange={onChange} />);
    await userEvent.type(screen.getByLabelText("Name"), "abc");
    expect(onChange).toHaveBeenCalledTimes(3);
  });
});
