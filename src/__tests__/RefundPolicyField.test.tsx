import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import {
  RefundPolicyField,
  refundScheduleProblem,
  REFUND_SCHEDULE_DEFAULT,
  type RefundPolicyValue,
} from "../listings/RefundPolicyField";

/**
 * The one control that sets a refund policy.
 *
 * What is worth pinning here is what the control used to get WRONG, because
 * each is cheap to reintroduce:
 *
 *   - The schedule used to expand INLINE, pushing every control below it down
 *     the page on every click, and writing through `onChange` on every single
 *     keystroke. It opens in a modal now (2026-11-03), same pattern as the
 *     tier editor: a draft the seller edits and explicitly Saves or Cancels.
 *     `onChange` fires once, on Save -- never while the modal is open, and
 *     never at all on Cancel.
 *   - `days` means the opposite thing either side of the anchor. An event
 *     counts down to its date, a product counts up from purchase. Copy that
 *     says "days before" on a product is a lie about what the number does.
 *   - A new row must land on a VALID schedule. Appending {days: +7, pct: +25}
 *     would break the "later cannot return more" rule the backend enforces,
 *     so the seller would see an error for pressing a button.
 */

function setup(value: RefundPolicyValue, anchor: "EVENT_START" | "PURCHASE" = "EVENT_START") {
  const onChange = vi.fn();
  const r = render(<RefundPolicyField value={value} onChange={onChange} anchor={anchor} />);
  return { onChange, ...r };
}

function openScheduleModal() {
  fireEvent.click(screen.getByText("Cancellation schedule"));
}

function saveSchedule() {
  fireEvent.click(screen.getByText("Save"));
}

describe("RefundPolicyField — the three buyer-facing choices", () => {
  it("offers a schedule, which it did not before", () => {
    setup(null);
    expect(screen.getByText("Standard refunds")).toBeTruthy();
    expect(screen.getByText("Cancellation schedule")).toBeTruthy();
    expect(screen.getByText("No self-service refunds")).toBeTruthy();
  });

  it("treats a null policy as standard", () => {
    setup(null);
    expect(screen.getByText("Standard refunds").closest("button")?.getAttribute("aria-pressed")).toBe("true");
  });

  it("opens a modal rather than expanding inline, and writes nothing until Save", () => {
    const { onChange } = setup(null);
    openScheduleModal();
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("seeds a worked schedule rather than an empty table, written on Save", () => {
    // An empty table asks the seller to invent a format the backend rejects.
    const { onChange } = setup(null);
    openScheduleModal();
    expect((screen.getAllByLabelText("Days before the event")[0] as HTMLInputElement).value).toBe("14");
    saveSchedule();
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ bands: REFUND_SCHEDULE_DEFAULT }),
    );
  });

  it("Cancel closes the modal without writing anything", () => {
    const { onChange } = setup(null);
    openScheduleModal();
    fireEvent.click(screen.getByText("Cancel"));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("states a stored schedule on the row itself, without opening the modal", () => {
    setup({ mode: "default", bands: [{ days: 30, pct: 80 }] });
    expect(screen.getByText("Cancellation schedule").closest("button")?.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByText(/30 or more days before: 80% back/)).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("re-opening the modal on a stored schedule pre-fills the existing rows, not the default", () => {
    setup({ mode: "default", bands: [{ days: 30, pct: 80 }] });
    openScheduleModal();
    expect((screen.getByLabelText("Days before the event") as HTMLInputElement).value).toBe("30");
    expect((screen.getByLabelText("Percent refunded") as HTMLInputElement).value).toBe("80");
  });

  it("writes window 0 for no self-service refunds", () => {
    const { onChange } = setup(null);
    fireEvent.click(screen.getByText("No self-service refunds"));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ customBuyerWindowDays: 0 }));
  });
});

describe("RefundPolicyField — the schedule editor (inside the modal)", () => {
  const BANDS = [{ days: 14, pct: 75 }, { days: 7, pct: 50 }];

  it("edits a row without touching the others, written on Save", () => {
    const { onChange } = setup({ mode: "default", bands: BANDS });
    openScheduleModal();
    const dayInputs = screen.getAllByLabelText("Days before the event");
    fireEvent.change(dayInputs[0], { target: { value: "21" } });
    saveSchedule();
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ bands: [{ days: 21, pct: 75 }, { days: 7, pct: 50 }] }),
    );
  });

  it("truncates a fractional day rather than sending it to a 400", () => {
    const { onChange } = setup({ mode: "default", bands: BANDS });
    openScheduleModal();
    fireEvent.change(screen.getAllByLabelText("Days before the event")[0], { target: { value: "10.9" } });
    saveSchedule();
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ bands: [{ days: 10, pct: 75 }, { days: 7, pct: 50 }] }),
    );
  });

  it("adds a row that is already valid", () => {
    // Below the last row on BOTH axes, so pressing the button cannot produce
    // the "later cannot return more" error.
    setup({ mode: "default", bands: BANDS });
    openScheduleModal();
    fireEvent.click(screen.getByText("Add a row"));
    const dayInputs = screen.getAllByLabelText("Days before the event");
    const pctInputs = screen.getAllByLabelText("Percent refunded");
    expect(dayInputs).toHaveLength(3);
    const lastDays = Number((dayInputs[2] as HTMLInputElement).value);
    const lastPct = Number((pctInputs[2] as HTMLInputElement).value);
    expect(lastDays).toBeLessThan(BANDS[1].days);
    expect(lastPct).toBeLessThan(BANDS[1].pct);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("removes a row, but never the last one, written on Save", () => {
    const { onChange } = setup({ mode: "default", bands: BANDS });
    openScheduleModal();
    fireEvent.click(screen.getByLabelText("Remove the 7-day row"));
    saveSchedule();
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ bands: [{ days: 14, pct: 75 }] }));
  });

  it("offers no remove control when one row is left", () => {
    setup({ mode: "default", bands: [{ days: 7, pct: 50 }] });
    openScheduleModal();
    expect(screen.queryByLabelText("Remove the 7-day row")).toBeNull();
  });

  it("stops offering rows at the cap the backend enforces", () => {
    const ten = Array.from({ length: 10 }, (_, i) => ({ days: 100 - i * 10, pct: 100 - i * 10 }));
    setup({ mode: "default", bands: ten });
    openScheduleModal();
    expect(screen.queryByText("Add a row")).toBeNull();
  });

  it("tells the seller at the table when the schedule rises, and disables Save", () => {
    setup({ mode: "default", bands: [{ days: 14, pct: 50 }, { days: 7, pct: 75 }] });
    openScheduleModal();
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toMatch(/cannot return more/);
    expect(screen.getByText("Save").closest("button")).toBeDisabled();
  });

  it("names a duplicate cutoff instead of saying 'invalid'", () => {
    setup({ mode: "default", bands: [{ days: 7, pct: 50 }, { days: 7, pct: 25 }] });
    openScheduleModal();
    expect(screen.getByRole("alert").textContent).toMatch(/Two rows both say 7 days/);
  });
});

describe("RefundPolicyField — the anchor changes what the number means", () => {
  it("counts down to the event for an event", () => {
    setup({ mode: "default", bands: [{ days: 7, pct: 50 }] }, "EVENT_START");
    openScheduleModal();
    expect(screen.getByText("days before")).toBeTruthy();
    expect(screen.getByLabelText("Days before the event")).toBeTruthy();
  });

  it("counts up from the sale for a product or course", () => {
    setup({ mode: "default", bands: [{ days: 7, pct: 50 }] }, "PURCHASE");
    openScheduleModal();
    expect(screen.getByText("days after")).toBeTruthy();
    expect(screen.getByLabelText("Days after buying")).toBeTruthy();
  });
});

describe("refundScheduleProblem", () => {
  it("mirrors the backend rules", () => {
    expect(refundScheduleProblem(REFUND_SCHEDULE_DEFAULT, "EVENT_START")).toBeNull();
    expect(refundScheduleProblem([], "EVENT_START")).toMatch(/at least one row/);
    expect(refundScheduleProblem([{ days: -1, pct: 50 }], "EVENT_START")).toMatch(/0 to 365/);
    expect(refundScheduleProblem([{ days: 7, pct: 101 }], "EVENT_START")).toMatch(/0 to 100/);
    expect(refundScheduleProblem([{ days: 7.5, pct: 50 }], "EVENT_START")).toMatch(/whole number of days/);
  });

  it("reads the monotonicity rule the right way round for each anchor", () => {
    const rising = [{ days: 7, pct: 100 }, { days: 14, pct: 50 }];
    // Valid for a product (sooner is better), invalid for an event (later is better).
    expect(refundScheduleProblem(rising, "PURCHASE")).toBeNull();
    expect(refundScheduleProblem(rising, "EVENT_START")).toMatch(/cannot return more/);
  });
});

// ────────────────────────────────────────────────────────────────────────
// The house policy, stated rather than offered (T-296).
// ────────────────────────────────────────────────────────────────────────

import { RefundScheduleStatement, describeRefundBand } from "../listings/RefundPolicyField";

describe("describeRefundBand", () => {
  it("reads an event band as a deadline before the event", () => {
    expect(describeRefundBand({ days: 14, pct: 75 }, "EVENT_START")).toBe("14 or more days before: 75% back");
  });

  it("reads a product band as a window after buying", () => {
    expect(describeRefundBand({ days: 7, pct: 100 }, "PURCHASE")).toBe("Within 7 days of buying: 100% back");
  });

  it("reads the SAME row in opposite directions per anchor", () => {
    // The reason this is a shared function: getting it backwards tells a
    // seller their policy does the reverse of what it does.
    const band = { days: 7, pct: 50 };
    expect(describeRefundBand(band, "EVENT_START")).toMatch(/before/);
    expect(describeRefundBand(band, "PURCHASE")).toMatch(/of buying/);
  });

  it("says 'nothing back' rather than '0% back'", () => {
    expect(describeRefundBand({ days: 0, pct: 0 }, "EVENT_START")).toBe("Any time before it starts: nothing back");
  });

  it("singularises one day", () => {
    expect(describeRefundBand({ days: 1, pct: 50 }, "PURCHASE")).toBe("Within 1 day of buying: 50% back");
  });
});

describe("RefundScheduleStatement", () => {
  const TEJA = [
    { days: 7, pct: 50 },
    { days: 14, pct: 75 },
    { days: 0, pct: 0 },
  ];

  it("offers no controls at all, which is the point", () => {
    // Not a disabled picker: a greyed-out control invites someone to hunt for
    // the permission that would re-enable it. A statement reads as settled.
    const { container } = render(<RefundScheduleStatement bands={TEJA} anchor="EVENT_START" />);
    expect(container.querySelectorAll("button")).toHaveLength(0);
    expect(container.querySelectorAll("input")).toHaveLength(0);
  });

  it("orders the rows the way they apply, whatever order they were passed in", () => {
    render(<RefundScheduleStatement bands={TEJA} anchor="EVENT_START" />);
    const rows = screen.getAllByText(/back/).map((n) => n.textContent);
    expect(rows[0]).toMatch(/^14 or more days before/);
    expect(rows[1]).toMatch(/^7 or more days before/);
    expect(rows[2]).toMatch(/^Any time before it starts/);
  });

  it("says what a schedule does NOT cover: the venue cancelling", () => {
    // A host reading "nothing back" on the last row will reasonably wonder
    // what happens when the venue cancels, and the answer is the opposite.
    render(<RefundScheduleStatement bands={TEJA} anchor="EVENT_START" />);
    expect(screen.getByText(/cancelled by the venue, everyone is refunded in full/)).toBeTruthy();
  });

  it("uses seller wording on the purchase anchor", () => {
    render(<RefundScheduleStatement bands={[{ days: 7, pct: 100 }]} anchor="PURCHASE" />);
    expect(screen.getByText(/cancelled by the seller, you are refunded in full/)).toBeTruthy();
  });

  it("lets the house name itself", () => {
    render(<RefundScheduleStatement bands={TEJA} anchor="EVENT_START" title="TEJÁ's cancellation terms" />);
    expect(screen.getByText("TEJÁ's cancellation terms")).toBeTruthy();
  });

  it("renders an optional note when one is given", () => {
    render(<RefundScheduleStatement bands={TEJA} anchor="EVENT_START" note="Write to curation@tejahouse.com." />);
    expect(screen.getByText("Write to curation@tejahouse.com.")).toBeTruthy();
  });
});
