import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PackagePicker } from "../ui/PackagePicker";

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
    expect(screen.getByText("Card processing")).toBeInTheDocument();
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
    expect(screen.getByText("Card processing")).toBeInTheDocument();
    expect(screen.getByText("Cobuntu")).toBeInTheDocument();
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
    expect(screen.queryByText(/reviews this/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Goes live/)).not.toBeInTheDocument();
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
    expect(screen.getByText("Orbis reviews this before it goes live.")).toBeInTheDocument();
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
    expect(screen.getByText("A leader reviews this before it goes live.")).toBeInTheDocument();
  });

  it("says it goes live immediately when no approval is needed", () => {
    render(
      <PackagePicker
        packages={[]}
        value={null}
        onChange={vi.fn()}
        platformFee={platformFee}
        approval={{ requiresApproval: false }}
      />,
    );
    expect(screen.getByText(/Goes live the moment you submit/)).toBeInTheDocument();
  });
});
