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

/**
 * The gross split from the OWNER's side -- the deductions the person viewing
 * this page bears, ending at what they keep. Reconciles by construction:
 *   gross = vat + stripe + cobuntu + community + net
 * Two models fill it differently (see `OverviewStats.ownership`): a member
 * seller has `stripe = 0` (Cobuntu absorbs it), `cobuntu` = the member fee,
 * `community` = the broker's FULL commission; a community has real `stripe`,
 * `cobuntu` = the platform fee, `community = 0`. Smallest currency unit
 * throughout. Optional so the package keeps compiling against an older backend.
 */
export interface FeeBreakdown {
    /** Tax collected for the authorities. Part of gross, not a fee. */
    vat: number;
    /** Stripe fee the owner bears. Zero on member sales (Cobuntu absorbs it). */
    stripe: number;
    /** What the owner pays Cobuntu (member fee, or the platform fee). */
    cobuntu: number;
    /** What the owner pays the broker community (its full commission; 0 if none). */
    community: number;
    /** What the owner keeps. Equal to `money.net`. */
    net: number;
}

/** Which payout model an item is on. See `OverviewStats.ownership`. */
export type OwnershipModel = "community" | "member";

/**
 * The rates behind the amounts, each named only when it can be without guessing.
 * `cobuntuPct` is the variable per-community platform fee (community-owned only);
 * `communityPct` is the broker's commission on the seller (member-owned only).
 */
export interface FeeRates {
    cobuntuPct: number | null;
    communityPct: number | null;
}

/**
 * The connected account a payout lands in. No nickname is stored, so the label
 * is the bank/card brand + last four + country, from Stripe's external account.
 * `connected` false means no account is linked yet (the seller has not onboarded).
 */
export interface StripeDestination {
    scope: "user" | "community";
    connected: boolean;
    payoutsEnabled: boolean;
    bankBrand: string | null;
    last4: string | null;
    country: string | null;
    currency: string | null;
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
    /** Where the gross went, all time. Absent on a pre-feature backend. */
    breakdown?: FeeBreakdown;
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
    /**
     * EVENTS ONLY. Has this event ever been published?
     *
     * The not-sellable banner has to explain WHY nothing can be bought, and two
     * of the reasons are stored identically: an unpublished event is held as an
     * off-the-shelf listing (publish flips PAUSED to ACTIVE), and a host who
     * takes a live event down lands on PAUSED as well. Reading `status` alone,
     * the page told a host who had never pressed Publish that a community had
     * shelved their event.
     *
     * Only ever act on `=== false`. Undefined means the host did not tell us —
     * a product, which has no publish step, or a backend older than the field —
     * and the general wording is the safe answer there. Older events predating
     * the audit log also read false, which is why the false branch must name an
     * action the host can take rather than assert what happened.
     */
    everPublished?: boolean;
    /**
     * Which payout model this item is on -- `community` (the community sells and
     * pays only Cobuntu) or `member` (a user sells, a community brokers it,
     * Cobuntu absorbs Stripe). Drives which fee lines the card renders. Absent
     * on a pre-feature backend; the card hides itself when it is.
     */
    ownership?: OwnershipModel;
    /** The rates behind the amounts, when one can honestly be named. */
    rates?: FeeRates;
    /** The connected account this item's payouts land in. Null if none resolved. */
    destination?: StripeDestination | null;
}

/** Event-only figures the product page has no equivalent for. */
export interface OverviewExtras {
    /** Attendees going, and the cap if there is one. EVENTS ONLY. */
    going?: number;
    /**
     * The summed tier cap, or null when any tier is uncapped.
     *
     * Read by events AND products now: an event shows "of N places", a product
     * "of N in stock". Null means genuinely unknown rather than zero -- the
     * backend sums tiers and will not invent a total when one is unlimited.
     */
    capacity?: number | null;
    /** ISO start, for the "starts in" tile. EVENTS ONLY. */
    startsAt?: string | null;
}

/**
 * @deprecated Named when only events used it. Kept so both apps keep compiling
 * across the bump; prefer `OverviewExtras`.
 */
export type EventExtras = OverviewExtras;
