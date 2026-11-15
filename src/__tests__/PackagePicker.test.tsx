import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PackagePicker } from "../ui/PackagePicker";
import { formatFixedFee, memberFeeFor } from "../lib/memberFee";

/**
 * Cobuntu's (and Stripe's) cut is owed on every sale regardless of whether
 * the community has published a package yet -- it is not a property of the
 * community's own arrangement. Reported live: a seller on a community with
 * no published package saw "nothing to pick" and NOTHING about what listing
 * here actually costs, as if it were free.
 */
describe("PackagePicker — the platform fee is never conditional on a community package existing", () => {
  const platformFee = { rate: 4, fixedCents: 30, processing: { rate: 1.5, fixedCents: 25 } };

  it("shows the fee breakdown even with zero community packages", () => {
    render(<PackagePicker packages={[]} value={null} onChange={vi.fn()} platformFee={platformFee} />);

    expect(screen.getByText(/hasn.t published any arrangements/)).toBeInTheDocument();
    expect(screen.getByText("Card processing (estimate)")).toBeInTheDocument();
    expect(screen.getByText("Cobuntu")).toBeInTheDocument();
    expect(screen.getByText("1.5% + €0.25")).toBeInTheDocument();
    expect(screen.getByText("2.5% + €0.05")).toBeInTheDocument();
  });

  it("shows the fee breakdown with exactly one package too", () => {
    render(
      <PackagePicker
        packages={[{ id: "p1", name: "Standard", rate: 10 }]}
        value="p1"
        onChange={vi.fn()}
        platformFee={platformFee}
      />,
    );

    expect(screen.getByText("Standard")).toBeInTheDocument();
    expect(screen.getByText("Card processing (estimate)")).toBeInTheDocument();
    // "Cobuntu" now legitimately appears twice: once in the split legend,
    // once in the itemized breakdown row.
    expect(screen.getAllByText("Cobuntu").length).toBeGreaterThan(0);
  });

  it("renders nothing fee-related when platformFee is omitted — an un-updated caller stays unchanged", () => {
    render(<PackagePicker packages={[]} value={null} onChange={vi.fn()} />);

    expect(screen.getByText(/hasn.t published any arrangements/)).toBeInTheDocument();
    expect(screen.queryByText("Cobuntu")).not.toBeInTheDocument();
  });
});

describe("PackagePicker — the seller's actual take", () => {
  const platformFee = { rate: 4, fixedCents: 30, processing: { rate: 1.5, fixedCents: 25 } };

  it("totals the community's rate and Cobuntu's all-in rate into one 'you keep' line", () => {
    render(
      <PackagePicker
        packages={[{ id: "p1", name: "Standard", rate: 10 }]}
        value="p1"
        onChange={vi.fn()}
        platformFee={platformFee}
      />,
    );
    // 100 - 10 (community) - 4 (Cobuntu all-in, processing included) = 86.
    expect(screen.getByText("You keep, per sale")).toBeInTheDocument();
    expect(screen.getByText("86%")).toBeInTheDocument();
  });

  it("says nothing about what's kept until a rate is actually on the table", () => {
    render(<PackagePicker packages={[]} value={null} onChange={vi.fn()} platformFee={platformFee} />);
    expect(screen.queryByText(/You keep about/)).not.toBeInTheDocument();
  });
});

describe("PackagePicker — approval status, shown before the fees", () => {
  const platformFee = { rate: 4, fixedCents: 30, processing: { rate: 1.5, fixedCents: 25 } };

  it("renders nothing when approval status is unresolved", () => {
    render(<PackagePicker packages={[]} value={null} onChange={vi.fn()} platformFee={platformFee} />);
    expect(screen.queryByText("Submit your listing")).not.toBeInTheDocument();
    expect(screen.queryByText(/reviews it/)).not.toBeInTheDocument();
    expect(screen.queryByText("Automatically approved")).not.toBeInTheDocument();
  });

  it("names the reviewer when approval is required", () => {
    render(
      <PackagePicker
        packages={[]}
        value={null}
        onChange={vi.fn()}
        platformFee={platformFee}
        approval={{ requiresApproval: true, reviewerLabel: "Orbis" }}
      />,
    );
    expect(screen.getByText("Orbis reviews it")).toBeInTheDocument();
  });

  it("falls back to 'a leader' when no reviewer is named", () => {
    render(
      <PackagePicker
        packages={[]}
        value={null}
        onChange={vi.fn()}
        platformFee={platformFee}
        approval={{ requiresApproval: true }}
      />,
    );
    expect(screen.getByText("A leader reviews it")).toBeInTheDocument();
  });

  it("says it's approved automatically when no approval is needed", () => {
    render(
      <PackagePicker
        packages={[]}
        value={null}
        onChange={vi.fn()}
        platformFee={platformFee}
        approval={{ requiresApproval: false }}
      />,
    );
    expect(screen.getByText("Automatically approved")).toBeInTheDocument();
  });

  it("always shows the three-step flow: submit, decision, live", () => {
    render(
      <PackagePicker
        packages={[]}
        value={null}
        onChange={vi.fn()}
        platformFee={platformFee}
        approval={{ requiresApproval: true, reviewerLabel: "Orbis" }}
      />,
    );
    expect(screen.getByText("Submit your listing")).toBeInTheDocument();
    expect(screen.getByText("Orbis reviews it")).toBeInTheDocument();
    expect(screen.getByText("Sell on the marketplace")).toBeInTheDocument();
  });
});

/**
 * The member fee in the currency the item is priced in (multi-currency MC3c,
 * decision MC-D7; Cobuntu Premium Phase 3): Cobuntu's 2.5% plus a fixed part
 * of about EUR 0.05 set per currency, and Stripe's estimate ON TOP, so a seller
 * pricing in pounds or yen reads what they are actually charged, in that
 * currency's own units.
 */
describe("PackagePicker — the fee in the item's currency", () => {
  it("states a pound item's fee in pence: Cobuntu 2.5% + £0.05, Stripe 1.5% + £0.20 on top", () => {
    render(<PackagePicker packages={[]} value={null} onChange={vi.fn()} platformFee={memberFeeFor("GBP")} />);

    expect(screen.getByText("1.5% + £0.20")).toBeInTheDocument();
    expect(screen.getByText("2.5% + £0.05")).toBeInTheDocument();
    expect(screen.queryByText(/€/)).not.toBeInTheDocument();
  });

  it("states yen in whole yen, never divided by 100", () => {
    render(<PackagePicker packages={[]} value={null} onChange={vi.fn()} platformFee={memberFeeFor("jpy")} />);

    expect(screen.getByText("1.5% + ¥45")).toBeInTheDocument();
    expect(screen.getByText("2.5% + ¥10")).toBeInTheDocument();
  });

  it("states a euro item as the backend charges it: 2.5% + €0.05, Stripe on top", () => {
    render(<PackagePicker packages={[]} value={null} onChange={vi.fn()} platformFee={memberFeeFor("EUR")} />);

    expect(screen.getByText("1.5% + €0.25")).toBeInTheDocument();
    expect(screen.getByText("2.5% + €0.05")).toBeInTheDocument();
  });
});

/**
 * Cobuntu Premium Phase 3: the fee is no longer all-in. Stripe comes off the
 * seller's share ON TOP of Cobuntu's fee, so "you keep" subtracts both, each
 * against its own base (Cobuntu's of the seller's share, Stripe's of the sale),
 * and a Premium seller pays Cobuntu nothing.
 */
describe("PackagePicker — Stripe on top of Cobuntu's fee (Premium Phase 3)", () => {
  const one = [{ id: "p1", name: "Standard", rate: 10 }];

  it("subtracts Cobuntu's fee on the seller's share and Stripe on the sale", () => {
    render(<PackagePicker packages={one} value="p1" onChange={vi.fn()} platformFee={memberFeeFor("EUR")} />);
    // (100 - 10) x (1 - 2.5%) - 1.5 = 86.25, shown as 86.3.
    expect(screen.getByText("86.3%")).toBeInTheDocument();
    expect(screen.getByText("2.5% + €0.05")).toBeInTheDocument();
    expect(screen.getByText("1.5% + €0.25")).toBeInTheDocument();
    // Card processing is its own band and legend entry, not inside Cobuntu's.
    expect(screen.getAllByText("Card processing (estimate)").length).toBe(2);
  });

  it("says a Premium seller pays Cobuntu nothing, and still shows Stripe", () => {
    render(<PackagePicker packages={one} value="p1" onChange={vi.fn()} platformFee={memberFeeFor("EUR", { premium: true })} />);
    // 100 - 10 - 0 - 1.5.
    expect(screen.getByText("88.5%")).toBeInTheDocument();
    expect(screen.getByText("No fee with Premium")).toBeInTheDocument();
    expect(screen.getByText("1.5% + €0.25")).toBeInTheDocument();
    expect(screen.queryByText(/0% \+ €0\.00/)).not.toBeInTheDocument();
  });

  it("keeps an all-in caller (no processingOnTop) exactly as it rendered before", () => {
    render(
      <PackagePicker
        packages={one}
        value="p1"
        onChange={vi.fn()}
        platformFee={{ rate: 4, fixedCents: 30, processing: { rate: 1.5, fixedCents: 25 } }}
      />,
    );
    expect(screen.getByText("86%")).toBeInTheDocument();
    expect(screen.getByText("2.5% + €0.05")).toBeInTheDocument();
  });
});

describe("memberFeeFor and formatFixedFee", () => {
  it("mirror the backend's per-currency amounts, and fall back to the euro's", () => {
    expect(memberFeeFor("GBP")).toEqual({
      rate: 2.5, fixedCents: 5, currency: "GBP", processing: { rate: 1.5, fixedCents: 20 }, processingOnTop: true, premium: false,
    });
    expect(memberFeeFor("KRW")).toMatchObject({ fixedCents: 80, currency: "KRW" });
    expect(memberFeeFor("JPY")).toMatchObject({ fixedCents: 10, currency: "JPY", processing: { rate: 1.5, fixedCents: 45 } });
    expect(memberFeeFor(null)).toEqual({
      rate: 2.5, fixedCents: 5, currency: "EUR", processing: { rate: 1.5, fixedCents: 25 }, processingOnTop: true, premium: false,
    });
    expect(memberFeeFor("XYZ")).toMatchObject({ fixedCents: 5, currency: "EUR" });
  });

  it("charges a Premium seller no Cobuntu fee, Stripe's estimate unchanged", () => {
    expect(memberFeeFor("GBP", { premium: true })).toEqual({
      rate: 0, fixedCents: 0, currency: "GBP", processing: { rate: 1.5, fixedCents: 20 }, processingOnTop: true, premium: true,
    });
  });

  it("formats each currency in its own units", () => {
    expect(formatFixedFee(30, "EUR")).toBe("€0.30");
    expect(formatFixedFee(25, "gbp")).toBe("£0.25");
    expect(formatFixedFee(50, "JPY")).toBe("¥50");
    expect(formatFixedFee(450, "KRW")).toBe("₩450");
  });
});
