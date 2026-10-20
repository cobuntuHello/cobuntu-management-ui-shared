import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { OfferedPackages } from "../listings/ui/OfferedPackages";
import { saleSplit, euroSplit, allocateCents } from "../listings/ui/DealSpine";

/**
 * The leader's package options, shown on a request with no cut agreed.
 *
 * The point of this component is that the packages AND what each does to a sale
 * are visible without hunting for "Propose different terms" — the PBN complaint.
 */
describe("OfferedPackages", () => {
    const pkgs = [
        { id: "self", name: "Self-run", description: null, rate: 8 },
        { id: "co", name: "Co-run", description: "We help run it", rate: 15 },
        { id: "pbn", name: "PBN-run", description: null, rate: 22 },
    ];

    it("lists every offered package with its rate", () => {
        render(<OfferedPackages packages={pkgs} communityName="PBN" sellerName="Drew" onChoose={() => {}} />);
        expect(screen.getByText("Self-run")).toBeInTheDocument();
        expect(screen.getByText("Co-run")).toBeInTheDocument();
        expect(screen.getByText("PBN-run")).toBeInTheDocument();
        // Each carries an "Offer X%" action, so the choice is one click.
        expect(screen.getByRole("button", { name: "Offer 8%" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Offer 22%" })).toBeInTheDocument();
    });

    it("shows what the seller keeps, matching the spine's split exactly", () => {
        const fee = { rate: 0.04, fixed: 30 };
        render(<OfferedPackages packages={pkgs} communityName="PBN" sellerName="Drew" sellerFee={fee} platformShare={10} onChoose={() => {}} />);
        const s = saleSplit(8, 10, fee); // the Self-run row
        const keep = Math.round(s.sellerOfSale * 10) / 10;
        // The split renders as a labelled bar legend: the "You keep" label and
        // its percentage are separate elements, so assert the value directly.
        expect(screen.getAllByText("You keep").length).toBe(pkgs.length);
        expect(screen.getByText(`${keep}%`)).toBeInTheDocument();
    });

    it("offers a package by id, so the member can accept it", () => {
        const onChoose = vi.fn();
        render(<OfferedPackages packages={pkgs} communityName="PBN" sellerName="Drew" onChoose={onChoose} />);
        fireEvent.click(screen.getByRole("button", { name: "Offer 15%" }));
        expect(onChoose).toHaveBeenCalledWith("co");
    });

    it("names the effective floor that checkout already charges, on the cheapest package", () => {
        // The checkout bills Math.min(tier rates) when nothing is agreed, so the
        // page must say so: the 8% Self-run is the floor and must be flagged.
        render(<OfferedPackages packages={pkgs} communityName="PBN" sellerName="Drew" onChoose={() => {}} />);
        expect(screen.getByText(/already takes 8% on every sale/)).toBeInTheDocument();
        // The badge marks the floor package only (one badge, on Self-run's row).
        const badges = screen.getAllByText("Applies now by default");
        expect(badges.length).toBe(1);
    });

    it("renders nothing when the community publishes no packages", () => {
        const { container } = render(<OfferedPackages packages={[]} communityName="PBN" sellerName="Drew" onChoose={() => {}} />);
        expect(container).toBeEmptyDOMElement();
    });
});

/** PBN's real shape: 5% of the commission, 4% + EUR 0.30 on the seller. */
const FEES = {
    platformShare: 5,
    sellerFee: { rate: 0.04, fixed: 30 },
    stripeRate: 0.015,
    stripeFixed: 25,
};

const PACKAGES = [
    { id: "a", name: "Self-run", description: null, rate: 8 },
    { id: "b", name: "Co-run", description: null, rate: 15 },
    { id: "c", name: "PBN-run", description: null, rate: 22 },
];

const base = {
    packages: PACKAGES,
    ...FEES,
    communityName: "PBN",
    sellerName: "Drew Milligan",
    onChoose: () => {},
};

describe("the money adds up", () => {
    /*
     * The whole reason this card works in euros rather than percentages: two of
     * the four deductions carry a FLAT per-sale charge, and a flat charge has no
     * percentage until a price is named.
     */
    it.each([8, 15, 22])("four shares sum to the ticket at %i%%", (rate) => {
        const price = 25;
        const e = euroSplit(price, rate, FEES.platformShare, FEES.sellerFee, {
            rate: FEES.stripeRate,
            fixed: FEES.stripeFixed,
        });
        const sum = e.hostKeeps + e.communityNet + e.cobuntuNet + e.stripeAmt;
        expect(sum).toBeCloseTo(price, 8);
    });

    /*
     * Rounding each row on its own does NOT add up. At 8% on EUR 25, Cobuntu's
     * 0.695 and Stripe's 0.625 both round up and the rows total 25.01 against a
     * printed total of 25.00 -- a receipt disagreeing with itself.
     */
    it("rounds rows to cents that still total the ticket", () => {
        const price = 25;
        const e = euroSplit(price, 8, FEES.platformShare, FEES.sellerFee, {
            rate: FEES.stripeRate,
            fixed: FEES.stripeFixed,
        });
        const naive = [e.hostKeeps, e.communityNet, e.cobuntuNet, e.stripeAmt]
            .map((x) => Math.round(x * 100))
            .reduce((a, b) => a + b, 0);
        expect(naive).toBe(2501); // the bug, pinned so the fix cannot be undone

        const cents = allocateCents(price, [e.hostKeeps, e.communityNet, e.cobuntuNet, e.stripeAmt]);
        expect(cents.reduce((a, b) => a + b, 0)).toBe(2500);
        // and no row drifts more than a cent from its true value
        cents.forEach((c, i) => {
            const exact = [e.hostKeeps, e.communityNet, e.cobuntuNet, e.stripeAmt][i] * 100;
            expect(Math.abs(c - exact)).toBeLessThan(1);
        });
    });

    it.each([3, 9.99, 25, 480])("totals exactly at a %p ticket", (price) => {
        const e = euroSplit(price, 15, FEES.platformShare, FEES.sellerFee, {
            rate: FEES.stripeRate,
            fixed: FEES.stripeFixed,
        });
        const cents = allocateCents(price, [e.hostKeeps, e.communityNet, e.cobuntuNet, e.stripeAmt]);
        expect(cents.reduce((a, b) => a + b, 0)).toBe(Math.round(price * 100));
    });

    /*
     * The percentage split CANNOT carry the flat fees, which is why it is only
     * the fallback. Pinned so nobody "fixes" the card by going back to it.
     */
    it("percentage split ignores the fixed fee, by nature", () => {
        const withFixed = saleSplit(8, 5, { rate: 0.04, fixed: 30 });
        const withoutFixed = saleSplit(8, 5, { rate: 0.04, fixed: 0 });
        expect(withFixed).toEqual(withoutFixed);
    });
});

describe("what the card shows", () => {
    const price = { samplePrice: 25, sampleCurrency: "EUR" };

    it("names the seller on the leader's side, not 'You'", () => {
        render(<OfferedPackages {...base} {...price} viewer="leader" />);
        expect(screen.getAllByText("Drew Milligan keeps").length).toBe(3);
        expect(screen.queryByText("You keep")).toBeNull();
    });

    it("says 'You keep' on the seller's side", () => {
        render(<OfferedPackages {...base} {...price} viewer="seller" />);
        expect(screen.getAllByText("You keep").length).toBe(3);
        expect(screen.queryByText("Drew Milligan keeps")).toBeNull();
    });

    /*
     * The original complaint: a heading reading 8% over a row reading 7.6%,
     * with nothing saying they were different things. Both are true -- one is
     * charged, the other arrives -- so both are named.
     */
    it("shows the gross commission AND what is taken out of it", () => {
        render(<OfferedPackages {...base} {...price} viewer="leader" />);
        expect(
            screen.getByText("8% is €2.00, less Cobuntu's 5% of it (€0.10)"),
        ).toBeTruthy();
        expect(screen.getAllByText("€1.90").length).toBeGreaterThan(0);
    });

    /*
     * Cobuntu's member-seller fee is ALL-IN (feeConstants: "Stripe's processing
     * comes out of it"), so card processing used to be real money with no row.
     */
    it("gives Stripe its own line", () => {
        render(<OfferedPackages {...base} {...price} viewer="leader" />);
        expect(screen.getAllByText("Stripe (card processing)").length).toBe(3);
    });

    it("prints a ticket total, which is what makes the rows checkable", () => {
        render(<OfferedPackages {...base} {...price} viewer="leader" />);
        expect(screen.getAllByText("Ticket price").length).toBe(3);
        expect(screen.getAllByText("€25.00").length).toBe(3);
    });

    it("falls back to percentages when no price is known", () => {
        render(<OfferedPackages {...base} viewer="leader" />);
        expect(screen.queryByText("Ticket price")).toBeNull();
        expect(screen.queryByText("Stripe (card processing)")).toBeNull();
        expect(screen.getAllByText("88.3%").length).toBe(1);
    });

    it("still names the floor package, which bills whether or not terms are set", () => {
        render(<OfferedPackages {...base} {...price} viewer="leader" />);
        expect(screen.getByText(/already takes 8% on every sale/)).toBeTruthy();
    });
});
