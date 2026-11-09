/**
 * ValueLinesModal: what buyers get, each line with a value (PBN feedback L2).
 * Shared by the product/course and event packages.
 *
 * Defends: amounts are typed in whole units and saved in cents; the total is
 * the sum; a half-filled row blocks Save with a note instead of being dropped;
 * fully empty rows are ignored; seeded lines come back as typed.
 */
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ValueLinesModal } from "../listings/ValueLinesModal";
import { amountToCents, centsToAmount, sumValueLines, sameValueLines } from "../lib/valueLines";

describe("valueLines helpers", () => {
  it("converts typed amounts to cents and back", () => {
    expect(amountToCents("120")).toBe(12000);
    expect(amountToCents("120,5")).toBe(12050);
    expect(amountToCents("1 200.50")).toBe(120050);
    expect(amountToCents("")).toBeNull();
    expect(amountToCents("-1")).toBeNull();
    expect(amountToCents("abc")).toBeNull();
    expect(centsToAmount(12000)).toBe("120");
    expect(centsToAmount(12050)).toBe("120.50");
  });

  it("sums and compares", () => {
    expect(sumValueLines([{ label: "a", value: 100 }, { label: "b", value: 250 }])).toBe(350);
    expect(sameValueLines(null, [])).toBe(true);
    expect(sameValueLines([{ label: "a", value: 1 }], [{ label: "a", value: 2 }])).toBe(false);
  });
});

describe("ValueLinesModal", () => {
  function setup(initial: { label: string; value: number }[] = []) {
    const onSave = vi.fn();
    render(<ValueLinesModal initial={initial} currency="EUR" onSave={onSave} onClose={vi.fn()} />);
    return { onSave };
  }

  it("saves typed lines in cents, ignoring empty rows, and shows the total", async () => {
    const { onSave } = setup();
    fireEvent.change(screen.getByLabelText("Line 1 description"), { target: { value: " Keynotes " } });
    fireEvent.change(screen.getByLabelText("Line 1 value"), { target: { value: "120" } });
    fireEvent.click(screen.getByRole("button", { name: /Add line/ }));
    fireEvent.change(screen.getByLabelText("Line 2 description"), { target: { value: "Brunch" } });
    fireEvent.change(screen.getByLabelText("Line 2 value"), { target: { value: "60" } });
    fireEvent.click(screen.getByRole("button", { name: /Add line/ }));

    expect(screen.getByTestId("value-lines-total").textContent).toContain("180");

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledWith([
      { label: "Keynotes", value: 12000 },
      { label: "Brunch", value: 6000 },
    ]));
  });

  it("a half-filled row blocks Save with a note", () => {
    const { onSave } = setup();
    fireEvent.change(screen.getByLabelText("Line 1 description"), { target: { value: "Brunch" } });

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(screen.getByRole("alert").textContent).toContain("Line 1 needs both a description and an amount");
    expect(onSave).not.toHaveBeenCalled();
  });

  it("seeds the existing lines in whole units", () => {
    setup([{ label: "Keynotes", value: 12000 }]);

    expect((screen.getByLabelText("Line 1 description") as HTMLInputElement).value).toBe("Keynotes");
    expect((screen.getByLabelText("Line 1 value") as HTMLInputElement).value).toBe("120");
  });

  it("removing the only line leaves an empty one, and saving that clears the list", async () => {
    const { onSave } = setup([{ label: "Keynotes", value: 12000 }]);
    fireEvent.click(screen.getByRole("button", { name: "Remove line 1" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledWith([]));
  });
});
