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
    spineSub: "of every sale, split as shown",
    spineNotAgreed: "Nothing agreed yet",
    spineOffer: "Offer",
    /* Whose turn, said in words rather than inferred from the buttons. */
    turnMine: "Your turn",
    turnTheirs: "They are on it",
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
    counterCancel: "Cancel"
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
