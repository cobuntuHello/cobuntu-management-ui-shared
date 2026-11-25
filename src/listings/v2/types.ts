/**
 * The listing page v2's data, as the backend sends it
 * (cobuntu-backend-monorepo docs/features/listing-page-v2.md).
 *
 * Mirrors core's ListingMoneyService and the booking views; money is in the
 * smallest unit of the listing's currency, everywhere.
 */

export type Seat = "seller" | "community";
export type ListingKind = "event" | "product";
export type ListingStatus = "PENDING" | "ACTIVE" | "PAUSED" | "CANCELLED" | "REVOKED";

/*
 * WHO SEES WHICH COBUNTU CUT (core ListingMoneyService.linesFor, 24 Nov 2026):
 * the community also reads Cobuntu's fee on a member (`sellerFee`) and what
 * the member keeps (`sellerNet`); the seller of a community-owned item also
 * reads Cobuntu's cut of the commission (`commissionCut`) and what the
 * community keeps (`communityNet`). A member never gets those two.
 */
export type LineKey = "price" | "stripe" | "commission" | "cobuntu" | "seller" | "keep"
    | "sellerFee" | "sellerNet" | "commissionCut" | "communityNet";
export interface MoneyLine { key: LineKey; amount: number }

export interface UpfrontPayment {
    key: "first" | "second";
    state: "paid" | "next" | "waiting" | "failed" | "refunded" | "cancelled";
    gross: number;
    amount: number;
    stripe: number;
    estimated: boolean;
    paidAt: string | null;
    dueAt: string | null;
    saleId: string | null;
}

export interface UpfrontAddon {
    id: string;
    name: string;
    slot: string | null;
    status: string;
    required: boolean;
    quantity: number;
    listedCents: number;
    proposedCents: number | null;
    vatRate: number | null;
    gross: number;
    amount: number;
    stripe: number;
    estimated: boolean;
    included: boolean;
    paidAt: string | null;
    saleId: string | null;
}

export interface ListingMoney {
    kind: ListingKind;
    listingId: string;
    seat: Seat;
    status: string;
    live: boolean;
    currency: string;
    oneSale: null | {
        gross: number;
        vat: number;
        commissionRate: number;
        rateSource: "agreed" | "matrix" | "proposed" | "none";
        platformFeeRate: number;
        memberSale: boolean;
        sellerPremium: boolean;
        lines: MoneyLine[];
    };
    soldSoFar: null | { count: number; lines: MoneyLine[] };
    /**
     * Every price of the item split, in the seller's order: each ticket tier
     * or variant (`label` its name; null for one price). A free one has no
     * lines. Absent from an older backend: the page then shows `oneSale` only.
     */
    prices?: Array<{ productId: string; label: string | null; gross: number; vat: number; free: boolean; lines: MoneyLine[] }>;
    /** An example donation split, when the item takes donations (the community's commission at the same rate; Cobuntu nothing). */
    donation?: null | { amount: number; lines: MoneyLine[] };
    /** The package this read previews (money({ packageId })), or null: the listing's own terms. */
    previewPackage?: null | { id: string; name: string; rate: number };
    upfront: null | {
        /** What was booked, from the booking's first line ("The Sound Room"). */
        room: string | null;
        bookingStatus: string;
        isPriority: boolean;
        card: { brand: string | null; last4: string } | null;
        payments: UpfrontPayment[];
        addons: UpfrontAddon[];
        paid: number;
        toCome: number;
        total: number;
        next: null | { amount: number; dueAt: string | null; what: "first" | "second" | "addon" };
    };
    result: null
        | { kind: "breakEven"; perSale: number; upfront: number; sales: number }
        | { kind: "sellerSoFar"; fromSales: number; upfrontPaid: number; amount: number; afterNext: number | null; nextDueAt: string | null; salesToCover: number | null }
        | { kind: "communitySoFar"; fromSales: number; upfrontIn: number; amount: number; toCome: number; nextDueAt: string | null };
}

/** The booking, as both seats read it (core VenueBookingController.bookingView). */
export interface BookingView {
    eventId: string;
    status: string;
    isPriority: boolean;
    currency: string;
    lines: Array<{ kind?: string; label?: string; cents?: number; vatRate?: number; vatCents?: number }>;
    totalAmountCents: number;
    vatAmountCents: number;
    firstPaymentCents: number;
    firstPaidAt: string | null;
    secondPaymentCents: number;
    secondChargeDueAt: string | null;
    secondPaidAt: string | null;
    decidedAt: string | null;
    declineReason: string | null;
    guestCount: number | null;
    details: { logistics?: Record<string, unknown>; marketing?: Record<string, unknown> } | null;
    detailsSubmittedAt: string | null;
    card: { brand: string | null; last4: string } | null;
    dateChangedAt: string | null;
}

export interface AddonSelection {
    id: string;
    addonId: string;
    name: string;
    slot: string | null;
    status: string;
    required: boolean;
    quantity: number;
    currency: string;
    priceCents: number;
    listedPriceCents: number;
    proposedPriceCents: number | null;
    vatRate: number | null;
    vatCents: number | null;
    declineReason: string | null;
}

export interface BookingAddons {
    guestCount: number | null;
    locked?: boolean;
    selections: AddonSelection[];
}

export interface Proposal {
    id: string;
    commissionRate: unknown;
    message?: string | null;
    status?: string | null;
    createdAt?: string | null;
    package?: { id: string; name: string; rate?: unknown } | null;
    proposedBy?: { id?: string; name?: string | null } | null;
    proposedByUser?: { id?: string; name?: string | null } | null;
    proposedByUserId?: string | null;
}

export interface Package { id: string; name: string; description: string | null; rate: number }

export interface TopicComment {
    id: string;
    body: string;
    authorUserId: string;
    createdAt?: string;
    author?: { id: string; name?: string | null; usertag?: string | null; profileImage?: string | null } | null;
}

export interface Topic {
    id: string;
    subject: string;
    status: "OPEN" | "RESOLVED";
    closedBySeller: boolean;
    closedByCommunity: boolean;
    openedByUserId: string;
    changedSince?: boolean;
    comments: TopicComment[];
}

/** The parts of the listing row the page reads (event and product listings differ in shape). */
export interface ListingDetail {
    id: string;
    status: string;
    isHidden?: boolean;
    commissionRate?: unknown;
    packageId?: string | null;
    createdAt?: string | null;
    approvedAt?: string | null;
    rejectionReason?: string | null;
    isPaid?: boolean;
    listingPrice?: { amount: number; currency: string } | null;
    community?: { id: string; name: string; communityTag?: string; tagLower?: string; iconUrl?: string | null } | null;
    communities?: { id: string; name: string; communityTag?: string; tagLower?: string; iconUrl?: string | null } | null;
    /** The seller who asked; core sends usertag with it (shown as @usertag in the community's header). */
    requestedBy?: { id: string; name?: string | null; usertag?: string | null; profileImage?: string | null } | null;
    event?: any;
    events?: any;
    products?: any;
    product?: any;
    proposals?: Proposal[];
}
