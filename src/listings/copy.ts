/**
 * The panel's own English.
 *
 * ── Why the package carries copy at all ─────────────────────────────────────
 *
 * This component moved out of the community app so the admin could show the
 * SAME review page rather than a second one that drifts. The community app
 * held its strings in next-intl; the admin would have had to copy the same
 * thirty keys into its own message file, and two copies of the same sentences
 * in two repos is the drift this move exists to stop.
 *
 * So the package owns them, and a host that has its own translations passes a
 * `t` down instead. That signature is deliberately next-intl's, so the
 * community app hands over its existing `t` unchanged and keeps every locale
 * it already had.
 */
export const LISTING_DETAIL_COPY: Record<string, string> = {
    /* The commission spine, ported from the negotiation MVP. */
    spineHeading: "The community's cut",
    spineZero: "No commission on this listing. Nothing to split.",
    spineSub: "of every sale, split as shown",
    spineNotAgreed: "Nothing agreed yet",
    spineOffer: "Offer",
    /* Whose turn, said in words rather than inferred from the buttons. */
    turnMine: "Your turn",
    turnTheirs: "{other} is on it",
    turnLeaderBody: "This request is waiting on you. Agree the terms below, or propose different ones.",
    turnOwnerBody: "They have answered. Take a look at the terms below.",
    turnWaitBody: "Nothing for you to do until they answer. Their reply shows up below.",
    settledTitle: "You both shook on it",
    settledBody: "This listing is live.",
    theSeller: "the seller",
    waitingLeaderTitle: "Your turn",
    waitingLeaderBody: "This request is waiting on you. Agree the terms below, or propose different ones.",
    approve: "Approve & publish",
    decline: "Decline",
    revoke: "Take it down",
    listings: "Listings",
    community: "Community",
    stateActive: "Live",
    statePending: "In review",
    statePaused: "Off-shelf",
    stateWithdrawn: "Withdrawn",
    stateRevoked: "Ended by the community",
    termsTitle: "The arrangement",
    package: "Package",
    packageNone: "None yet",
    packageUnnamed: "No longer offered",
    commission: "Commission",
    rate: "{rate}%",
    rateNotAgreed: "Not agreed yet",
    requested: "Requested",
    communityNote: "Note from the community",
    waitingTitle: "Waiting on {community}",
    waitingBody: "Your request is in their review queue. There is nothing for you to do until they answer, and their reply shows up below.",
    threadTitle: "Negotiation",
    threadSubtitle: "Every arrangement either side has put forward.",
    threadEmpty: "Nothing proposed yet.",
    threadEmptyWaiting: "You asked. Nothing back yet.",
    proposedRate: "{who} proposed {rate}%",
    proposedPackage: "{who} proposed {name} at {rate}%",
    someone: "Someone",
    pause: "Take off the shelf",
    resume: "Put back on the shelf",
    withdraw: "Withdraw the listing",
    withdrawRequest: "Withdraw the request",
    confirmWithdrawTitle: "Withdraw this listing?",
    confirmWithdrawBody: "{community} stops carrying this. You can ask again later.",
    confirmWithdrawRequestTitle: "Withdraw this request?",
    confirmWithdrawRequestBody: "{community} stops seeing it in their review queue. You can ask again later.",
    close: "Close",
    paused: "Taken off the shelf",
    resumed: "Back on the shelf",
    withdrawn: "Withdrawn",
    actionFailed: "That did not work",
    closedWithdrawn: "You withdrew this listing, so {community} no longer carries it.",
    closedRevoked: "{community} ended this listing, so they no longer carry it.",
    askAgain: "Ask a community to carry it",
    notFound: "This listing is not available.",
    backToListings: "Back to listings",
    counterOpen: "Propose different terms",
    counterTitle: "Propose different terms",
    counterSubtitle: "Pick the arrangement you would rather have. This replaces your last offer.",
    counterNoPackages: "This community has not published arrangements you can pick from, so the terms are theirs to propose.",
    counterNotePlaceholder: "Why this one (optional)",
    counterSend: "Send",
    counterSending: "Sending...",
    counterCancel: "Cancel",

    /*
     * ── Topics ──────────────────────────────────────────────────────────────
     *
     * The half of the negotiation that is not money. Written as sentences
     * rather than labels, because the whole design argument is that these are
     * conversations, not form fields.
     */
    cancel: "Cancel",
    topicsTitle: "Points raised",
    topicsSubtitle: "Anything about this listing that is not the rate. Each one closes when you both agree it is done.",
    topicsComposerPlaceholder: "Raise something with {other}...",
    topicsSubjectPlaceholder: "What is this about?",
    topicsBodyPlaceholder: "Say more...",
    topicsPost: "Post",
    topicsEmptyTitle: "Nothing raised yet",
    topicsEmptyOwner: "{community} has not raised anything. When they do, it lands here.",
    topicsEmptyLeader: "Raise a point if you want something changed. You cannot edit {seller}'s listing yourself.",
    topicsReplyPlaceholder: "Reply...",
    topicsChangedSince: "changed since",
    topicsSettledCount: "{count} settled - show",
    /*
     * Both of these say the same thing from two positions, and neither says
     * "resolved". The state is a handshake, so the copy names who is still to
     * agree rather than announcing a status.
     */
    topicsClosesWhenBoth: "Closes when you both agree it is done",
    topicsWaitingOnThem: "Waiting for {other} to agree it is done",
    topicsDone: "It is done",
    topicsUndo: "Undo",
    topicsFailed: "That did not send. Try again.",

    /*
     * NextAction, once topics exist. The old three stage chips went because two
     * of them were unreachable -- a listing with open topics is always in the
     * middle one -- so what replaced them is the only progress that moves:
     * how many topics are still open.
     */
    topicsProgress: "{closed} of {total} settled",
    /*
     * Two keys rather than one with a plural rule. `defaultTranslate` does
     * `{var}` substitution and nothing else, deliberately, and adding ICU
     * plurals for two strings would put a second templating language in a file
     * whose whole job is to be readable. The component picks the key.
     */
    topicsOpenHeadline: "{count} topic still open",
    topicsOpenHeadlinePlural: "{count} topics still open",
    topicsOpenLeaderBody: "Work through them with them, then answer the terms below.",
    topicsOpenOwnerBody: "Work through them, then take another look at the terms below.",
    topicsOpenWaitBody: "{other} is working through them.",
    settledBodyWithTopics: "Live in {community}, with {count} topic settled along the way.",
    settledBodyWithTopicsPlural: "Live in {community}, with {count} topics settled along the way.",

    /*
     * ── The Overview tab ────────────────────────────────────────────────────
     *
     * Written so the money reads as three different things rather than one
     * total, because held is not spendable and paid is already gone.
     */
    overviewEarnings: "Your earnings",
    overviewHeld: "{amount} held",
    overviewDueOn: "until {date}",
    overviewDue: "{amount} due",
    overviewPaid: "{amount} paid",
    overviewNoEarningsYet: "Nothing earned yet",
    overviewSold: "Sold",
    overviewGoing: "Going",
    overviewOfCapacity: "of {capacity} places",
    overviewInLastWeeks: "{count} in the last 4 weeks",
    overviewViews: "Views",
    overviewVsPrevious: "vs the 4 weeks before",
    overviewConversion: "Viewed to bought",
    overviewNoViewsYet: "Nobody has looked yet",
    overviewStartsIn: "Starts in",
    overviewDays: "{count}d",
    overviewGross: "Gross taken",
    overviewGrossSub: "Before commission and fees",
    overviewYourNet: "Your net",
    overviewNetEarnings: "Net earnings",
    overviewGrossEarnings: "Gross earnings",
    overviewTotalViews: "Total views",
    overviewSales: "Sales",
    overviewTrendTitleViews: "Views over time",
    overviewTrendNoEarningsYet: "Nothing has sold yet, so there is no earnings line to draw. The bars are weekly views.",
    overviewTrendTooEarly: "A trend needs at least two weeks",
    overviewNotCarriedTitle: "No community carries this yet",
    overviewNotCarriedBody: "Nobody can buy it until one does. Ask {community} to carry it, and a leader there decides.",
    overviewListItHere: "Ask {community} to carry it",
    overviewRequesting: "Asking…",
    overviewOneCommunityOnly: "An item can be carried by one community for now, so there is nowhere else to list this.",
    ledgerTitle: "Money movements",
    ledgerSummary: "{sales} sales · {net} net after refunds",
    ledgerEmptyTitle: "Nothing has moved yet",
    ledgerEmptyBody: "Sales, refunds, payouts and disputes for this item show up here.",
    ledgerColMovement: "Movement",
    ledgerColGross: "Gross",
    ledgerColCommunity: "Community",
    ledgerColSeller: "Seller net",
    ledgerKind_sale: "Sale",
    ledgerKind_refund: "Refund",
    ledgerKind_payout: "Payout",
    ledgerKind_dispute: "Dispute",
    ledgerLeg_seller: "To the seller",
    ledgerLeg_commission: "Commission to the community",
    ledgerOfPayout: "of {total} · {count} from here",
    ledgerStatus_ESCROW: "In escrow",
    ledgerStatus_ELIGIBLE: "Ready to pay out",
    ledgerStatus_PAID: "Paid out",
    ledgerStatus_HOLD: "On hold",
    ledgerStatus_COMPLETED: "Completed",
    ledgerStatus_PENDING: "Pending",
    ledgerStatus_FAILED: "Failed",
    ledgerStatus_DISPUTE_WON: "Dispute won",
    ledgerStatus_DISPUTE_LOST: "Dispute lost",
    overviewTrendTitle: "Earnings and views",
    overviewTrendWeeks: "last {count} weeks",
    overviewTrendEarnings: "Your earnings",
    overviewTrendAria: "Weekly earnings and views over {weeks} weeks, most recently {latest}.",
    overviewWhereItSells: "Where this sells",
    overviewCarriedBy: "Carried by {count}",
    overviewCommission: "{rate}% commission",
    overviewApprovedOn: "agreed {date}",
    overviewRequestedOn: "asked {date}",
    overviewManageListing: "Manage listing",
    overviewUnattributedViews: "{count} views are not counted against any community: people who bought it, or who looked before we recorded where from.",

    /* The state that matters most: it exists, and nobody can buy it. */
    overviewNotSellableProduct: "Nobody can buy this yet",
    overviewNotSellableEvent: "Nobody can get a ticket yet",
    overviewNoListingsBody: "It is not on any community's shelf, so there is no page a buyer can reach and no way to pay for it.",
    overviewNoActiveListingBody: "Every community carrying it has it off the shelf or still under review, so there is nowhere to buy it right now.",
    overviewNoListingsHere: "No community carries this yet. Once one does, its sales and views appear here.",
    overviewSellItMyself: "Sell it myself",

    overviewStatus_ACTIVE: "Live",
    overviewStatus_PENDING: "In review",
    /* "Off-shelf", not "Paused": statePaused above has said that since the
       listing states were named, and one act must not have two words. */
    overviewStatus_PAUSED: "Off-shelf",
    overviewStatus_CANCELLED: "Closed",
    overviewStatus_REVOKED: "Ended",
    overviewListingState_PENDING: "Waiting on the community. Nothing can be bought here until they approve it.",
    overviewListingState_PAUSED: "You took this off the shelf. Put it back to start selling here again.",
    overviewListingState_CANCELLED: "This community is no longer carrying it.",
    overviewListingState_REVOKED: "This community ended the listing."
};

/**
 * Interpolates `{name}` placeholders, which is the subset of next-intl's
 * syntax this panel actually uses. Anything unknown returns the key rather
 * than an empty string: a missing label should look wrong in review, not
 * vanish silently in production.
 */
export function defaultTranslate(key: string, vars?: Record<string, unknown>): string {
    const raw = LISTING_DETAIL_COPY[key];
    if (raw === undefined) return key;
    if (!vars) return raw;
    return raw.replace(/\{(\w+)\}/g, (_m, name) => String(vars[name] ?? `{${name}}`));
}
