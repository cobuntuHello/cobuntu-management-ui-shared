/**
 * The shape `GET /api/{products,events}/:id/overview` answers with.
 *
 * Declared here rather than imported from the backend because the package
 * cannot depend on it, and duplicated deliberately rather than loosely typed:
 * the two things this page must not get wrong are both expressible in the type,
 * and a `Record<string, number>` would express neither.
 */

export interface OverviewListing {
    listingId: string;
    communityId: string;
    communityName: string;
    communityTag: string;
    /**
     * The community's square icon, or null when it has never set one.
     *
     * Null rather than a placeholder URL: a seller carried by four communities
     * recognises logos before names, and the page draws the initial in the same
     * square so a missing image does not shift the row.
     */
    communityIcon?: string | null;
    /** PENDING | ACTIVE | PAUSED | CANCELLED | REVOKED */
    status: string;
    commissionRate: number | null;
    /**
     * The arrangement by NAME. A rate alone is a number; "PBN-promoted, 10%" is
     * a deal with obligations on both sides. Null when self-listed at a bare
     * rate, or when the listing predates packages.
     */
    packageName?: string | null;
    /** When the community approved it. Null while pending, and null for rows
     *  approved before the column existed -- those show the requested date. */
    approvedAt?: string | null;
    requestedAt?: string | null;
    views: number;
    sold: number;
    gross: number;
    /**
     * What the SELLER keeps. Named `net` for history; read it as the seller's.
     *
     * Shown beside `communityNet` because the same sale is two different
     * numbers depending on who is looking, and a lone "net" column on a
     * community's own admin page was read as the community's.
     */
    net: number;
    /** What the carrying COMMUNITY keeps, after Cobuntu's slice of it. */
    communityNet?: number;
}

export interface OverviewMoney {
    /**
     * What the seller has EARNED. Not what they have received.
     *
     * Led with over `gross` because a seller's question is what they are paid,
     * and reading the wrong money column is how a EUR 5 ticket came to report
     * that Cobuntu earned nothing.
     */
    net: number;
    gross: number;
    /** In escrow. Earned, not yet releasable. */
    held: number;
    /** Releasable now, or accumulating below the payout threshold. */
    due: number;
    /** Already transferred. */
    paid: number;
    /** When the earliest held money becomes due. Null when nothing is held. */
    nextPayoutAt: string | null;
    currency: string;
}

export interface OverviewStats {
    kind: "product" | "event";
    money: OverviewMoney;
    sold: number;
    views: {
        total: number;
        /**
         * Views belonging to NO listing.
         *
         * Purchaser views on a product (recorded as direct-access) and every
         * event view from before the community column existed. Present so the
         * page can show totals and per-listing side by side without implying
         * they partition: `sum(listings.views) + unattributed === total`.
         *
         * Never subtract it to "fix" the totals. It is not an error term.
         */
        unattributed: number;
    };
    /** Oldest first. Only weeks with activity appear. */
    weekly: Array<{ week: string; sold: number; net: number; views: number }>;
    listings: OverviewListing[];
}

/** Event-only figures the product page has no equivalent for. */
export interface EventExtras {
    /** Attendees going, and the cap if there is one. */
    going?: number;
    capacity?: number | null;
    /** ISO start, for the "starts in" tile. */
    startsAt?: string | null;
}
