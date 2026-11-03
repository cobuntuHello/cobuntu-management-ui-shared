/**
 * The shape `GET /api/communities/:tag/referrals/{products|events}/:id`
 * answers with.
 *
 * Declared here rather than imported from the backend, which the package
 * cannot depend on, and typed tightly on purpose: the one thing this page must
 * not get wrong is expressible in the type, and a looser shape would not
 * express it.
 */

export interface ArtifactReferralOwner {
    id: string;
    name: string | null;
    usertag: string | null;
    profileImage: string | null;
}

export interface ArtifactReferralLink {
    id: string;
    /**
     * NULL UNTIL THE PERSON HAS CONNECTED STRIPE, and that is the whole point.
     *
     * A link is created as an INVITATION: the row exists so the person can be
     * notified and nothing is lost if they connect later, but no code is
     * minted and there is NOTHING TO SHARE yet. Rendering a null code as an
     * empty box, or offering a copy control beside it, would put a link that
     * can never pay anybody into circulation.
     *
     * `string | null`, never `string`, so a component cannot read it without
     * deciding what to do when it is absent.
     */
    code: string | null;
    status: "PENDING_STRIPE" | "ACTIVE" | "DISABLED";
    /** A fraction: 0.08 is 8%. Matches how the backend stores it. */
    commissionPct: number;
    /** The owner's private note. Never shown to the referrer or a buyer. */
    label: string | null;
    createdAt: string;
    owner: ArtifactReferralOwner;
    /** Sales attributed to this link. */
    sales: number;
    /** Earned but still inside the buyer's refund window. */
    earnedHeldCents: number;
    /** Earned and already transferred. */
    earnedPaidCents: number;
}

/**
 * What a sale is CALLED on this artifact. Passed in rather than inferred,
 * because the same component serves products, courses and events and
 * "2 tickets" reads wrong on a workbook.
 */
export interface ArtifactReferralCopy {
    /** Plural noun for an attributed sale: "tickets", "purchases", "enrolments". */
    unit: string;
}
