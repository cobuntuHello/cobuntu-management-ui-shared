import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import {
  RefundPolicyField,
  refundScheduleProblem,
  REFUND_SCHEDULE_DEFAULT,
  type RefundPolicyValue,
} from "../listings/RefundPolicyField";

/**
 * The one control that sets a refund policy, now that it sets three things.
 *
 * What is worth pinning here is what the control used to get WRONG, because
 * each is cheap to reintroduce:
 *
 *   - `extended` mode was readable everywhere and writable nowhere. Eligibility
 *     told sellers to "enable extended host refunds in the event settings";
 *     there was no such setting. It must be writable, and it must survive a
 *     change to the buyer-facing choice, since the two are different axes.
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

  it("seeds a worked schedule rather than an empty table", () => {
    // An empty table asks the seller to invent a format the backend rejects.
    const { onChange } = setup(null);
    fireEvent.click(screen.getByText("Cancellation schedule"));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ bands: REFUND_SCHEDULE_DEFAULT }),
    );
  });

  it("recognises a stored schedule and shows its rows", () => {
    setup({ mode: "default", bands: [{ days: 30, pct: 80 }] });
    expect(screen.getByText("Cancellation schedule").closest("button")?.getAttribute("aria-pressed")).toBe("true");
    expect((screen.getByLabelText("Days before the event") as HTMLInputElement).value).toBe("30");
    expect((screen.getByLabelText("Percent refunded") as HTMLInputElement).value).toBe("80");
  });

  it("writes window 0 for no self-service refunds", () => {
    const { onChange } = setup(null);
    fireEvent.click(screen.getByText("No self-service refunds"));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ customBuyerWindowDays: 0 }));
  });
});

describe("RefundPolicyField — the schedule editor", () => {
  const BANDS = [{ days: 14, pct: 75 }, { days: 7, pct: 50 }];

  it("edits a row without touching the others", () => {
    const { onChange } = setup({ mode: "default", bands: BANDS });
    const dayInputs = screen.getAllByLabelText("Days before the event");
    fireEvent.change(dayInputs[0], { target: { value: "21" } });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ bands: [{ days: 21, pct: 75 }, { days: 7, pct: 50 }] }),
    );
  });

  it("truncates a fractional day rather than sending it to a 400", () => {
    const { onChange } = setup({ mode: "default", bands: BANDS });
    fireEvent.change(screen.getAllByLabelText("Days before the event")[0], { target: { value: "7.5" } });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ bands: [{ days: 7, pct: 75 }, { days: 7, pct: 50 }] }),
    );
  });

  it("adds a row that is already valid", () => {
    // Below the last row on BOTH axes, so pressing the button cannot produce
    // the "later cannot return more" error.
    const { onChange } = setup({ mode: "default", bands: BANDS });
    fireEvent.click(screen.getByText("Add a row"));
    const next = onChange.mock.calls[0][0].bands;
    expect(next).toHaveLength(3);
    expect(next[2].days).toBeLessThan(BANDS[1].days);
    expect(next[2].pct).toBeLessThan(BANDS[1].pct);
    expect(refundScheduleProblem(next, "EVENT_START")).toBeNull();
  });

  it("removes a row, but never the last one", () => {
    const { onChange } = setup({ mode: "default", bands: BANDS });
    fireEvent.click(screen.getByLabelText("Remove the 7-day row"));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ bands: [{ days: 14, pct: 75 }] }));
  });

  it("offers no remove control when one row is left", () => {
    setup({ mode: "default", bands: [{ days: 7, pct: 50 }] });
    expect(screen.queryByLabelText("Remove the 7-day row")).toBeNull();
  });

  it("stops offering rows at the cap the backend enforces", () => {
    const ten = Array.from({ length: 10 }, (_, i) => ({ days: 100 - i * 10, pct: 100 - i * 10 }));
    setup({ mode: "default", bands: ten });
    expect(screen.queryByText("Add a row")).toBeNull();
  });

  it("tells the seller at the table when the schedule rises", () => {
    setup({ mode: "default", bands: [{ days: 14, pct: 50 }, { days: 7, pct: 75 }] });
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toMatch(/cannot return more/);
  });

  it("names a duplicate cutoff instead of saying 'invalid'", () => {
    setup({ mode: "default", bands: [{ days: 7, pct: 50 }, { days: 7, pct: 25 }] });
    expect(screen.getByRole("alert").textContent).toMatch(/Two rows both say 7 days/);
  });
});

describe("RefundPolicyField — the anchor changes what the number means", () => {
  it("counts down to the event for an event", () => {
    setup({ mode: "default", bands: [{ days: 7, pct: 50 }] }, "EVENT_START");
    expect(screen.getByText("days before")).toBeTruthy();
    expect(screen.getByLabelText("Days before the event")).toBeTruthy();
  });

  it("counts up from the sale for a product or course", () => {
    setup({ mode: "default", bands: [{ days: 7, pct: 50 }] }, "PURCHASE");
    expect(screen.getByText("days after")).toBeTruthy();
    expect(screen.getByLabelText("Days after buying")).toBeTruthy();
  });
});

describe("RefundPolicyField — the host lever", () => {
  it("is writable at all, which was the defect", () => {
    const { onChange } = setup(null);
    fireEvent.click(screen.getByLabelText(/Let me refund after the window closes/));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ mode: "extended" }));
  });

  it("reflects a stored extended policy", () => {
    setup({ mode: "extended" });
    expect((screen.getByLabelText(/Let me refund after the window closes/) as HTMLInputElement).checked).toBe(true);
  });

  it("survives a change to the buyer-facing choice", () => {
    // Different axes: one is what the buyer may do, the other what the seller
    // may still do afterwards. Picking a schedule must not silently revoke it.
    const { onChange } = setup({ mode: "extended" });
    fireEvent.click(screen.getByText("Cancellation schedule"));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "extended", bands: REFUND_SCHEDULE_DEFAULT }),
    );
  });

  it("clears back to a null policy when switched off on standard refunds", () => {
    // null is how "platform default" is stored; leaving {mode:'default'} behind
    // would write a policy row that says nothing.
    const { onChange } = setup({ mode: "extended" });
    fireEvent.click(screen.getByLabelText(/Let me refund after the window closes/));
    expect(onChange).toHaveBeenCalledWith(null);
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
