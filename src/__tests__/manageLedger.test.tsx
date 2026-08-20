import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
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
        expect(screen.getByText(/In escrow/)).toBeInTheDocument();
    });
});

describe("the summary line", () => {
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
        expect(screen.getByText(/2 sales · €32\.84 net/)).toBeInTheDocument();
    });

    it("subtracts a refund", () => {
        renderIt([
            movement({ sellerNet: 1642 }),
            movement({ kind: "refund", sign: -1, sellerNet: 1642, gross: 1999, communityCut: 2 }),
        ]);
        expect(screen.getByText(/€0\.00 net/)).toBeInTheDocument();
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
