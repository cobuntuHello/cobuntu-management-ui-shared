/**
 * The shape `GET /api/{products,events}/:id/ledger` answers with.
 *
 * Declared here rather than imported from the backend because the package
 * cannot depend on it, and duplicated deliberately rather than loosely typed:
 * the two things this page must not get wrong -- that a payout row is only this
 * item's part of a transfer, and that a won dispute is not a loss -- are both
 * expressible in the type, and `Record<string, number>` would express neither.
 */

export interface LedgerMovement {
    key: string;
    kind: "sale" | "refund" | "payout" | "dispute";
    /** ISO. Refunds and disputes carry their OWN date, not their sale's. */
    at: string;
    currency: string;
    /** +1 money in, -1 money out. The amounts below are always positive. */
    sign: 1 | -1;
    /** What the buyer paid. Zero on a payout: no new money entered, it moved. */
    gross: number;
    /** The broker community's share. */
    communityCut: number;
    /** The seller's share. */
    sellerNet: number;
    status: string;
    buyerName?: string | null;
    reason?: string | null;
    /** The sale a refund or dispute belongs to, so rows can be paired. */
    saleKey?: string | null;
    payoutLeg?: "seller" | "commission";
    /**
     * The WHOLE transfer, of which the amounts above are this item's part.
     *
     * Never render this as the row's amount. A payout covers many sales across
     * many items; printing it would have every item claim the same transfer.
     */
    payoutTotal?: number;
    salesFromThisItem?: number;
}

export interface ItemLedger {
    kind: "product" | "event";
    currency: string;
    /** Newest first. */
    movements: LedgerMovement[];
}
