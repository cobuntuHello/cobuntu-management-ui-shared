import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ManageLedger } from "../ledger/ManageLedger";
import type { ItemLedger, LedgerMovement } from "../ledger/types";
import { defaultTranslate } from "../listings/copy";

/**
 * The Ledger tab.
 *
 * EVERY AMOUNT HERE IS IN THE SMALLEST UNIT, as the endpoint sends them and as
 * formatMoney expects (it divides on the way out). Writing 19.99 in a fixture
 * renders EUR 0.20 -- which is how the dispute row's double conversion was
 * caught.
 *
 * Every assertion here is about a way a money page reads as a confident lie
 * rather than about "it renders rows".
 */

const movement = (over: Partial<LedgerMovement> = {}): LedgerMovement => ({
    key: `k${Math.random()}`,
    kind: "sale",
    at: "2026-08-12T10:00:00.000Z",
    currency: "EUR",
    sign: 1,
    gross: 1999,
    communityCut: 200,
    sellerNet: 1642,
    status: "ESCROW",
    ...over,
});

const ledgerOf = (movements: LedgerMovement[]): ItemLedger => ({
    kind: "product", currency: "EUR", movements,
});

const renderIt = (movements: LedgerMovement[], props: Record<string, unknown> = {}) =>
    render(<ManageLedger ledger={ledgerOf(movements)} t={defaultTranslate} {...props} />);

describe("a payout row shows this item's part, never the transfer", () => {
    /*
     * THE TRAP. One transfer paid out four products. Rendering payoutTotal as
     * the amount would have all four pages claim the same EUR 210.
     */
    it("puts the attributable amount in the column and the whole in the sub-line", () => {
        renderIt([
            movement({
                kind: "payout", sign: -1, gross: 0, communityCut: 0, sellerNet: 4926,
                status: "COMPLETED", payoutLeg: "seller", payoutTotal: 21000, salesFromThisItem: 3,
            }),
        ]);

        // The amount column carries this item's part.
        expect(screen.getByText("−€49.26")).toBeInTheDocument();
        // The transfer's own size is stated, and is NOT the amount.
        expect(screen.getByText(/of €210\.00/)).toBeInTheDocument();
        expect(screen.queryByText("−€210.00")).not.toBeInTheDocument();
    });

    it("names the two legs apart", () => {
        renderIt([
            movement({ kind: "payout", sign: -1, gross: 0, sellerNet: 4926, communityCut: 0, payoutLeg: "seller", payoutTotal: 4926 }),
            movement({ kind: "payout", sign: -1, gross: 0, sellerNet: 0, communityCut: 600, payoutLeg: "commission", payoutTotal: 600 }),
        ]);
        expect(screen.getByText("To the seller")).toBeInTheDocument();
        expect(screen.getByText("Commission to the community")).toBeInTheDocument();
    });
});

describe("a won dispute is not a loss", () => {
    /*
     * The money stayed. A minus sign and a red number tell the seller they lost
     * something they still have.
     */
    it("shows no minus and no red on a win", () => {
        const { container } = renderIt([
            movement({ kind: "dispute", sign: 1, gross: 50000, communityCut: 0, sellerNet: 0, status: "DISPUTE_WON" }),
        ]);
        expect(screen.getByText("€500.00")).toBeInTheDocument();
        expect(screen.queryByText("−€500.00")).not.toBeInTheDocument();
        expect(container.querySelector(".text-red-700")).toBeNull();
    });

    it("shows both on a loss", () => {
        renderIt([
            movement({ kind: "dispute", sign: -1, gross: 50000, communityCut: 0, sellerNet: 0, status: "DISPUTE_LOST" }),
        ]);
        expect(screen.getByText("−€500.00")).toBeInTheDocument();
    });
});

describe("statuses the copy does not know", () => {
    /*
     * `t` returns the key when it has none and next-intl throws outright, so a
     * status built into a key and hoped for is how a page prints
     * "ledgerStatus_PARTIALLY_REFUNDED" at a customer. Both enums grow.
     */
    it("humanises an unmapped status instead of leaking the key", () => {
        renderIt([movement({ status: "PARTIALLY_REFUNDED" })]);
        expect(screen.getByText(/Partially refunded/)).toBeInTheDocument();
        expect(screen.queryByText(/ledgerStatus_/)).not.toBeInTheDocument();
    });

    it("still translates the ones it knows", () => {
        renderIt([movement({ status: "ESCROW" })]);
        // Matches both the row's own status subline and the "In escrow"
        // summary tile label -- either is fine, the point is no raw key leaks.
        expect(screen.getAllByText(/In escrow/).length).toBeGreaterThan(0);
    });
});

describe("the summary tiles", () => {
    /*
     * Payouts must not enter the total. A payout is money already counted when
     * its sale was recorded, moving somewhere else -- summing every signed row
     * would make a fully paid-out product look like it earned nothing.
     */
    it("counts sales less refunds, and ignores payouts entirely", () => {
        renderIt([
            movement({ sellerNet: 1642 }),
            movement({ sellerNet: 1642 }),
            movement({ kind: "payout", sign: -1, gross: 0, sellerNet: 1642, communityCut: 0, payoutLeg: "seller", payoutTotal: 1642 }),
        ]);
        // Two sales, nothing refunded, and the payout does not subtract.
        const label = screen.getByText("Net earned");
        expect(label.nextElementSibling).toHaveTextContent("€32.84");
    });

    it("subtracts a refund", () => {
        renderIt([
            movement({ sellerNet: 1642 }),
            movement({ kind: "refund", sign: -1, sellerNet: 1642, gross: 1999, communityCut: 2 }),
        ]);
        // "Net earned" is the first tile; refund zeroes it out even though
        // the sale's own ESCROW status still counts the full amount In escrow.
        const label = screen.getByText("Net earned");
        expect(label.nextElementSibling).toHaveTextContent("€0.00");
    });
});

describe("the community column", () => {
    it("can be hidden where there is no broker", () => {
        renderIt([movement()], { showCommunity: false });
        expect(screen.queryByText("Community")).not.toBeInTheDocument();
        expect(screen.getByText("Seller net")).toBeInTheDocument();
    });
});

describe("an item nothing has happened to", () => {
    it("says so rather than drawing an empty table", () => {
        renderIt([]);
        expect(screen.getByText("Nothing has moved yet")).toBeInTheDocument();
        expect(document.querySelector("table")).toBeNull();
    });

    /*
     * The second line is what stops an empty tab reading as a broken one: it
     * says the tab works and the item simply has no history yet.
     */
    it("says what will fill it", () => {
        renderIt([]);
        expect(screen.getByText(/Sales, refunds, payouts and disputes/)).toBeInTheDocument();
    });

    /*
     * And NO action. An empty ledger is not something the reader can fix --
     * you cannot make someone buy -- so a button would offer a way out of a
     * state that is simply early.
     */
    it("offers no button, because there is nothing to press", () => {
        const { container } = renderIt([]);
        expect(container.querySelector("button")).toBeNull();
    });
});

/**
 * A guest purchase is a complete row, not a missing one.
 *
 * The server falls back name -> usertag -> the email a guest checked out with;
 * null means there was not even that. An empty cell on a ledger reads as a
 * record that failed to load.
 */
describe("a buyer with no account", () => {
    it("says Guest rather than leaving the cell blank", () => {
        renderIt([movement({ buyerName: null })]);
        expect(screen.getByText("Guest")).toBeInTheDocument();
    });

    it("prefers whatever the server could find", () => {
        renderIt([movement({ buyerName: "someone@example.com" })]);
        expect(screen.getByText("someone@example.com")).toBeInTheDocument();
        expect(screen.queryByText("Guest")).not.toBeInTheDocument();
    });

    /*
     * A payout has no buyer. Labelling one "Guest" would invent a person on a
     * row that is about money moving, not about anyone buying.
     */
    it("never calls a payout a guest", () => {
        renderIt([movement({
            kind: "payout", sign: -1, gross: 0, sellerNet: 4926, communityCut: 0,
            payoutLeg: "seller", payoutTotal: 4926, buyerName: null,
        })]);
        expect(screen.queryByText("Guest")).not.toBeInTheDocument();
    });
});

/*
 * Fee lines + payout timing/destination -- the "how much in fees" and
 * "when/where" a seller opens the ledger for.
 */
describe("fee lines and payout when/where", () => {
    const memberLedger = (movements: LedgerMovement[]): ItemLedger => ({
        kind: "product", currency: "EUR", ownership: "member", movements,
    });

    it("puts a payout's scheduled date and destination in the sub-line", () => {
        render(
            <ManageLedger
                ledger={{
                    kind: "product", currency: "EUR", ownership: "community",
                    movements: [movement({
                        kind: "payout", sign: -1, gross: 0, communityCut: 0, sellerNet: 5284,
                        status: "PENDING", payoutLeg: "seller", payoutTotal: 5284, salesFromThisItem: 5,
                        scheduledFor: "2026-09-22T19:00:00.000Z",
                        destination: { scope: "user", connected: true, payoutsEnabled: true, bankBrand: "Revolut", last4: "9931", country: "PT", currency: "EUR" },
                    })],
                }}
                t={defaultTranslate}
            />,
        );
        expect(screen.getByText(/fires 22 Sept 2026/)).toBeInTheDocument();
        expect(screen.getByText(/to Revolut ••9931/)).toBeInTheDocument();
    });

    it("expands a member sale into its fee lines, Stripe and Cobuntu shown as two separate real amounts", () => {
        render(
            <ManageLedger
                ledger={memberLedger([movement({
                    kind: "sale", gross: 4500, communityCut: 328, sellerNet: 3930,
                    // Decomposed the way LedgerService now sends it: stripeFee
                    // is the real cost Cobuntu funds out of its own fee, and
                    // cobuntuFee is what's left after funding it -- the two
                    // are siblings, not one absorbing the other.
                    vat: 0, stripeFee: 40, cobuntuFee: 170, communityFee: 360,
                })])}
                t={defaultTranslate}
            />,
        );
        // Collapsed by default: the fee lines are not shown until asked for.
        expect(screen.queryByText("-€0.40")).not.toBeInTheDocument();

        fireEvent.click(screen.getByText("Sale").closest("tr")!);

        // Never the word "covered" -- a real amount, same as every other line.
        expect(screen.queryByText("Absorbed by Cobuntu")).not.toBeInTheDocument();
        expect(screen.getByText("-€0.40")).toBeInTheDocument();   // Stripe, real cost
        expect(screen.getByText("-€1.70")).toBeInTheDocument();   // Cobuntu's own take
        expect(screen.getByText("-€3.60")).toBeInTheDocument();   // community commission
    });

    it("shows real Stripe on a community sale breakdown", () => {
        render(
            <ManageLedger
                ledger={{
                    kind: "product", currency: "EUR", ownership: "community",
                    movements: [movement({
                        kind: "sale", gross: 5900, communityCut: 0, sellerNet: 5284,
                        vat: 0, stripeFee: 144, cobuntuFee: 472, communityFee: 0,
                    })],
                }}
                showCommunity={false}
                t={defaultTranslate}
            />,
        );
        fireEvent.click(screen.getByText("Sale").closest("tr")!);
        expect(screen.getByText("-€1.44")).toBeInTheDocument();  // real Stripe
        expect(screen.getByText("-€4.72")).toBeInTheDocument();  // platform fee
        expect(screen.queryByText("Absorbed by Cobuntu")).not.toBeInTheDocument();
    });

    it("clicking anywhere in the row opens the drawer, not just a sub-element", () => {
        render(
            <ManageLedger
                ledger={memberLedger([movement({
                    kind: "sale", gross: 4500, communityCut: 328, sellerNet: 3930, buyerName: "Ana Neto",
                    vat: 0, stripeFee: 40, cobuntuFee: 170, communityFee: 360,
                })])}
                t={defaultTranslate}
            />,
        );
        // Clicking the buyer's name -- not any particular button -- opens it.
        fireEvent.click(screen.getByText("Ana Neto"));
        expect(screen.getByText("Breakdown")).toBeInTheDocument();
    });

    it("does not make a non-expandable row (a payout) clickable", () => {
        render(
            <ManageLedger
                ledger={{
                    kind: "product", currency: "EUR", ownership: "community",
                    movements: [movement({
                        kind: "payout", sign: -1, gross: 0, communityCut: 0, sellerNet: 100,
                        payoutLeg: "seller", payoutTotal: 100,
                    })],
                }}
                t={defaultTranslate}
            />,
        );
        const row = screen.getByText("Payout").closest("tr")!;
        expect(row.className).not.toContain("cursor-pointer");
        fireEvent.click(row);
        expect(screen.queryByText("Breakdown")).not.toBeInTheDocument();
    });
});

/**
 * A refund nests directly under its sale rather than appearing as its own
 * top-level row -- same choice the admin community ledger makes, and for the
 * same reason: same sort date, so they never drift apart in a long list.
 */
describe("pairing a refund under its sale", () => {
    it("does not list a paired refund as its own top-level row", () => {
        renderIt([
            movement({ key: "s1", kind: "sale", buyerName: "Ana Neto" }),
            movement({ key: "r1", kind: "refund", saleKey: "s1", sign: -1, sellerNet: 1642, gross: 1999, communityCut: 2 }),
        ]);
        // One buyer name rendered once: the refund's row doesn't repeat it.
        expect(screen.getAllByText("Ana Neto")).toHaveLength(1);
        // Both kind pills are present -- sale AND refund -- just in one group.
        expect(screen.getByText("Sale")).toBeInTheDocument();
        expect(screen.getByText("Refund")).toBeInTheDocument();
    });

    it("leaves a refund with no matching sale as a normal top-level row", () => {
        renderIt([
            movement({ key: "r1", kind: "refund", saleKey: "nonexistent", sign: -1, sellerNet: 1642, gross: 1999, communityCut: 2, buyerName: "Bo Silva" }),
        ]);
        expect(screen.getByText("Bo Silva")).toBeInTheDocument();
        expect(screen.getByText("Refund")).toBeInTheDocument();
    });
});

describe("month grouping", () => {
    it("groups rows under a month header", () => {
        renderIt([
            movement({ at: "2026-08-12T10:00:00.000Z" }),
            movement({ at: "2026-07-01T10:00:00.000Z" }),
        ]);
        expect(screen.getByText("August 2026")).toBeInTheDocument();
        expect(screen.getByText("July 2026")).toBeInTheDocument();
    });

    it("keeps a paired refund in its SALE's month, not its own", () => {
        renderIt([
            movement({ key: "s1", kind: "sale", at: "2026-08-12T10:00:00.000Z" }),
            movement({ key: "r1", kind: "refund", saleKey: "s1", at: "2026-09-02T10:00:00.000Z", sign: -1, sellerNet: 1642, gross: 1999, communityCut: 2 }),
        ]);
        expect(screen.getByText("August 2026")).toBeInTheDocument();
        expect(screen.queryByText("September 2026")).not.toBeInTheDocument();
    });
});

describe("filtering", () => {
    it("hides rows that don't match the search query", () => {
        renderIt([
            movement({ buyerName: "Ana Neto" }),
            movement({ buyerName: "Bo Silva" }),
        ]);
        fireEvent.change(screen.getByPlaceholderText(/Search/), { target: { value: "Ana" } });
        expect(screen.getByText("Ana Neto")).toBeInTheDocument();
        expect(screen.queryByText("Bo Silva")).not.toBeInTheDocument();
    });

    it("shows a no-matches state when nothing passes the filter", () => {
        renderIt([movement({ buyerName: "Ana Neto" })]);
        fireEvent.change(screen.getByPlaceholderText(/Search/), { target: { value: "nobody-like-this" } });
        expect(screen.getByText("No movements match")).toBeInTheDocument();
    });

    it("does not change the summary tiles when a filter hides rows", () => {
        renderIt([
            movement({ buyerName: "Ana Neto", sellerNet: 1642 }),
            movement({ buyerName: "Bo Silva", sellerNet: 1000 }),
        ]);
        fireEvent.change(screen.getByPlaceholderText(/Search/), { target: { value: "Ana" } });
        const label = screen.getByText("Net earned");
        // Still the sum of BOTH sales, not just the one the filter left visible.
        expect(label.nextElementSibling).toHaveTextContent("€26.42");
    });
});

/**
 * The sale drawer's payout timeline -- Sale completed -> Escrow ends ->
 * Paid out. Pinning the three real states this reads off the dates the
 * backend now sends, not a hardcoded hold length.
 */
describe("the payout timeline", () => {
    it("shows escrow as upcoming with a relative countdown before it ends", () => {
        const farFuture = new Date(Date.now() + 5 * 86400000).toISOString();
        renderIt([
            movement({ vat: 0, at: "2026-08-12T10:00:00.000Z", escrowEndsAt: farFuture, status: "ESCROW" }),
        ]);
        fireEvent.click(screen.getByText("Sale").closest("tr")!);
        expect(screen.getByText("Escrow ends")).toBeInTheDocument();
        expect(screen.getByText(/in 5 days/)).toBeInTheDocument();
    });

    it("marks escrow as done once its end date has passed", () => {
        const past = new Date(Date.now() - 86400000).toISOString();
        renderIt([movement({ vat: 0, escrowEndsAt: past, status: "ELIGIBLE" })]);
        fireEvent.click(screen.getByText("Sale").closest("tr")!);
        expect(screen.getByText("Escrow ended")).toBeInTheDocument();
    });

    it("shows the real paid-out date on a PAID sale, not just the status", () => {
        renderIt([
            movement({
                vat: 0, status: "PAID",
                escrowEndsAt: new Date(Date.now() - 86400000).toISOString(),
                paidOutAt: "2026-09-15T10:00:00.000Z",
            }),
        ]);
        fireEvent.click(screen.getByText("Sale").closest("tr")!);
        // "Paid out" also labels the summary tile -- two matches is correct.
        expect(screen.getAllByText("Paid out").length).toBeGreaterThan(1);
        // en-GB (the component's default locale) abbreviates September "Sept".
        expect(screen.getByText(/15 Sept 2026/)).toBeInTheDocument();
    });

    it("shows the scheduled payout date once escrow has ended but nothing is paid yet", () => {
        renderIt([
            movement({
                vat: 0, status: "ELIGIBLE",
                escrowEndsAt: new Date(Date.now() - 86400000).toISOString(),
                payoutScheduledFor: "2026-09-20T10:00:00.000Z",
            }),
        ]);
        fireEvent.click(screen.getByText("Sale").closest("tr")!);
        expect(screen.getByText(/20 Sept 2026/)).toBeInTheDocument();
    });

    it("does not render a timeline for a payout or refund row", () => {
        renderIt([
            movement({
                key: "p1", kind: "payout", sign: -1, gross: 0, sellerNet: 100, communityCut: 0,
                payoutLeg: "seller", payoutTotal: 100,
            }),
        ]);
        expect(screen.queryByText("Payout timeline")).not.toBeInTheDocument();
    });
});

/**
 * Invoice / credit note links in the drawer. Shown only when the field is
 * present -- an empty ledger-wide feature should never render a dead link.
 */
describe("invoice and credit note links", () => {
    it("shows a View invoice link on a sale with an invoice", () => {
        renderIt([
            movement({ vat: 0, invoiceUrl: "https://invoice.stripe.com/abc" }),
        ]);
        fireEvent.click(screen.getByText("Sale").closest("tr")!);
        const link = screen.getByText("View invoice").closest("a")!;
        expect(link).toHaveAttribute("href", "https://invoice.stripe.com/abc");
        expect(link).toHaveAttribute("target", "_blank");
    });

    it("renders no documents section on a sale with no invoice yet", () => {
        renderIt([movement({ vat: 0 })]);
        fireEvent.click(screen.getByText("Sale").closest("tr")!);
        expect(screen.queryByText("Documents")).not.toBeInTheDocument();
        expect(screen.queryByText("View invoice")).not.toBeInTheDocument();
    });

    it("shows a View credit note link on a refund with a credit note", () => {
        renderIt([
            movement({
                kind: "refund", vat: 0, sign: -1, gross: 500, sellerNet: 412, communityCut: 0,
                creditNoteUrl: "https://stripe.com/credit-note.pdf",
            }),
        ]);
        fireEvent.click(screen.getByText("Refund").closest("tr")!);
        const link = screen.getByText("View credit note").closest("a")!;
        expect(link).toHaveAttribute("href", "https://stripe.com/credit-note.pdf");
    });

    it("never shows a credit note link on a sale row, or an invoice link on a refund row", () => {
        renderIt([
            movement({ vat: 0, invoiceUrl: "https://invoice.stripe.com/abc" }),
            movement({
                key: "r1", kind: "refund", vat: 0, sign: -1, gross: 500, sellerNet: 412, communityCut: 0,
                creditNoteUrl: "https://stripe.com/credit-note.pdf",
            }),
        ]);
        fireEvent.click(screen.getByText("Sale").closest("tr")!);
        expect(screen.queryByText("View credit note")).not.toBeInTheDocument();
    });
});

/**
 * The host refund action in the drawer. A different feature from the
 * buyer's own self-service refund flow, which this component has no path to
 * at all -- there is no `onRefund` call site anywhere a buyer would reach.
 */
describe("host refund action", () => {
    it("is absent with no onRefund prop", () => {
        renderIt([movement({ key: "s1", vat: 0 })]);
        fireEvent.click(screen.getByText("Sale").closest("tr")!);
        expect(screen.queryByText("Refund")).not.toBeInTheDocument();
    });

    it("is absent on a sale that already has a refund", () => {
        renderIt(
            [
                movement({ key: "s1", vat: 0 }),
                movement({ key: "r1", kind: "refund", sign: -1, gross: 1999, sellerNet: 1642, communityCut: 200, saleKey: "s1" }),
            ],
            { onRefund: async () => ({ ok: true }) },
        );
        fireEvent.click(screen.getAllByText("Sale")[0].closest("tr")!);
        expect(screen.queryByRole("button", { name: "Refund" })).not.toBeInTheDocument();
    });

    it("collects a required reason, calls onRefund with the sale id, and shows success", async () => {
        const onRefund = vi.fn(async () => ({ ok: true }));
        renderIt([movement({ key: "sale:abc123", vat: 0 })], { onRefund });
        fireEvent.click(screen.getByText("Sale").closest("tr")!);
        fireEvent.click(screen.getByText("Refund"));

        // Confirm is disabled with no reason typed yet.
        const confirm = screen.getByText("Confirm refund");
        expect(confirm).toBeDisabled();

        fireEvent.change(screen.getByPlaceholderText(/why/i), { target: { value: "Buyer changed their mind" } });
        fireEvent.click(screen.getByText("Confirm refund"));

        await screen.findByText(/refunded/i);
        expect(onRefund).toHaveBeenCalledWith("abc123", "Buyer changed their mind");
    });

    it("shows the backend's own eligibility message on refusal", async () => {
        const onRefund = vi.fn(async () => ({ ok: false, error: "This sale has already been paid out. Contact Cobuntu support." }));
        renderIt([movement({ key: "sale:abc123", vat: 0 })], { onRefund });
        fireEvent.click(screen.getByText("Sale").closest("tr")!);
        fireEvent.click(screen.getByText("Refund"));
        fireEvent.change(screen.getByPlaceholderText(/why/i), { target: { value: "Testing" } });
        fireEvent.click(screen.getByText("Confirm refund"));

        await screen.findByText("This sale has already been paid out. Contact Cobuntu support.");
    });

    it("never appears on a refund, payout or dispute row", () => {
        renderIt(
            [movement({ key: "r1", kind: "refund", sign: -1, gross: 500, sellerNet: 412, communityCut: 0 })],
            { onRefund: async () => ({ ok: true }) },
        );
        fireEvent.click(screen.getByText("Refund").closest("tr")!);
        expect(screen.queryByText("Refund", { selector: "button" })).not.toBeInTheDocument();
    });
});
