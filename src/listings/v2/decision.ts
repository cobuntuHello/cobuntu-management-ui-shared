/**
 * THE DECISION BAR, as data (the redesign, approved 24 Nov 2026;
 * cobuntu-backend-monorepo docs/features/listing-page-redesign.md).
 *
 * The page has three places to look (Overview, Earnings, Negotiation) and one
 * thing to do, which is never a place: it is this bar, along the bottom, the
 * same for both seats. It says where the listing stands and offers only the
 * moves open right now, the main one in white.
 *
 * THE ICON. Its colour says whose move it is, its mark what kind:
 *   you      amber, "!"   a decision is yours
 *   answer   amber, "?"   an offer waits for your answer
 *   them     grey, clock  it is on the other side
 *   live     green, check on sale
 *   paused   grey, pause  agreed but not on sale
 *   closed   red, x       declined, withdrawn or removed
 *
 * EVERY MOVE CONFIRMS (decided 24 Nov 2026): the page turns each move id into
 * a confirmation that says exactly what happens, or into the package sheet
 * (which shows the split before anything is sent). Nothing here acts.
 *
 * A move is offered only when the host's transport can perform it (`can`),
 * the old panel's rule: never draw a lever that cannot be pulled.
 */
import type { Say } from "./copy";
import { percent, shortDate } from "./format";
import type { Derived } from "./derive";
import type { ListingStatus, Seat } from "./types";

export type BarTone = "you" | "answer" | "them" | "live" | "paused" | "closed";

export type MoveId =
    | "pickPackage"      // open the package sheet
    | "acceptOffer"      // the other side's pick: open the sheet on it (or confirm, without packages)
    | "declineOffer"
    | "approve"          // community: publish
    | "decline"          // community: decline the request
    | "remove"           // community: end a live listing for good (was "Take it down")
    | "pause"            // stop sales for now (community: hide; seller: PAUSED)
    | "resume"
    | "withdraw"         // seller: end their own request or listing
    | "acceptBooking"
    | "declineBooking";

export interface Move {
    id: MoveId;
    label: string;
    /** The main move: drawn in white. */
    primary?: boolean;
    /** A quiet text button ("Pick another"). */
    text?: boolean;
    disabled?: boolean;
    /** Why it is disabled. */
    title?: string;
}

export interface Decision {
    tone: BarTone;
    /** The small label over the title: Your move, Your answer, Waiting for X, Live. */
    eyebrow: string;
    title: string;
    sub: string;
    moves: Move[];
}

export interface DecisionInput {
    seat: Seat;
    kind: "event" | "product";
    status: ListingStatus | null;
    isHidden: boolean;
    /** The agreed rate (percent), null until agreed. */
    rate: number | null;
    /** The agreed package's name, when it was agreed through one. */
    packageName: string | null;
    /** When the terms were agreed. */
    agreedAt: string | null;
    approvedAt: string | null;
    createdAt: string | null;
    sold: number;
    names: { community: string; seller: string };
    /** The booked room's name, when the request is a venue booking. */
    room: string | null;
    rejectionReason: string | null;
    d: Derived;
    /** What the host's transport can do. */
    can: { decideBooking: boolean; setHidden: boolean; respond: boolean; propose: boolean; setStatus: boolean };
    /**
     * The status moves the backend allows from here (listingTransitions.ts):
     * a move the state machine would refuse is never drawn.
     */
    reviewer: string[];
    owner: string[];
}

/** "Standard · 10%", "10%", or "no commission". */
export function termsLabel(say: Say, rate: number | null, packageName: string | null, kind: "event" | "product"): string {
    if (rate == null) return "";
    const r = rate === 0 ? (kind === "event" ? say("lineCommissionNone") : say("lineCommissionNoneProduct")) : percent(rate);
    return packageName ? `${packageName} · ${r}` : r;
}

export function decisionOf(x: DecisionInput, say: Say): Decision {
    const out = draft(x, say);
    const allowed = (id: MoveId): boolean => {
        if (id === "approve") return x.reviewer.includes("approve");
        if (id === "decline") return x.reviewer.includes("decline");
        if (id === "remove") return x.reviewer.includes("revoke");
        if (id === "withdraw") return x.owner.includes("withdraw");
        // The seller pauses with a status; the community hides it from its page (ACTIVE only).
        if (id === "pause") return x.seat === "seller" ? x.owner.includes("pause") : x.status === "ACTIVE" && x.can.setHidden;
        if (id === "resume") return x.seat === "seller" ? x.owner.includes("resume") : x.status === "ACTIVE" && x.can.setHidden;
        return true;
    };
    return { ...out, moves: out.moves.filter((m) => allowed(m.id)) };
}

function draft(x: DecisionInput, say: Say): Decision {
    const { seat, status, names, d, can } = x;
    const community = names.community;
    const seller = names.seller;
    const terms = termsLabel(say, x.rate, x.packageName, x.kind);
    const offer = d.offer;
    const offerTerms = offer
        ? termsLabel(say, Number(offer.proposal.commissionRate ?? 0), offer.proposal.package?.name ?? null, x.kind)
        : "";
    const pending = status === "PENDING";

    // ── ended ──
    if (status === "CANCELLED" || status === "REVOKED") {
        const title = status === "CANCELLED"
            ? (seat === "seller" ? say("barWithdrawnYou") : say("barWithdrawnBy", { seller }))
            : x.approvedAt ? say("barRemovedFrom", { community }) : say("barDeclinedBy", { community });
        return {
            tone: "closed", eyebrow: say("barClosed"), title,
            sub: x.rejectionReason ? say("barReason", { reason: x.rejectionReason }) : say("liveHintClosed"),
            moves: [],
        };
    }

    // ── a venue booking waiting for the community ──
    if (d.bookingAwaitsCommunity) {
        if (seat === "community" && can.decideBooking) {
            return {
                tone: "you", eyebrow: say("barYourMove"),
                title: x.room ? say("barBooked", { seller, room: x.room }) : say("barBookedNoRoom", { seller }),
                sub: say("barBookedSub"),
                moves: [
                    { id: "declineBooking", label: say("declineAndRefund") },
                    { id: "acceptBooking", label: say("acceptBooking"), primary: true },
                ],
            };
        }
        if (seat === "seller") {
            return {
                tone: "them", eyebrow: say("barWaitingFor", { who: community }),
                title: say("barBookingReview", { community }),
                sub: say("barBookingReviewSub", { community }),
                moves: can.setStatus ? [{ id: "withdraw", label: say("withdrawRequest") }] : [],
            };
        }
    }

    if (pending) {
        const theirOffer = offer && offer.by !== seat;
        const myOffer = offer && offer.by === seat;
        if (theirOffer) {
            const who = seat === "seller" ? community : seller;
            const r = percent(Number(offer.proposal.commissionRate ?? 0));
            const moves: Move[] = [];
            if (can.propose) moves.push({ id: "pickPackage", label: say("barPickAnother"), text: true });
            if (can.respond) {
                moves.push({ id: "declineOffer", label: say("declineOffer") });
                moves.push({ id: "acceptOffer", label: say("acceptOffer", { rate: r }), primary: true });
            }
            return {
                tone: "answer", eyebrow: say("barYourAnswer"),
                title: say("barTheyPicked", { who, terms: offerTerms }),
                sub: say("barTheyPickedSub"),
                moves,
            };
        }
        if (myOffer) {
            const who = seat === "seller" ? community : seller;
            const moves: Move[] = [];
            if (can.propose) moves.push({ id: "pickPackage", label: say("barPickAnother"), text: true });
            if (can.setStatus) moves.push(seat === "community" ? { id: "decline", label: say("decline") } : { id: "withdraw", label: say("withdrawRequest") });
            return {
                tone: "them", eyebrow: say("barWaitingFor", { who }),
                title: say("barYouPicked", { terms: offerTerms }),
                sub: say("barYouPickedSub", { date: shortDate(offer.proposal.createdAt), who }),
                moves,
            };
        }
        // No package agreed and none on the table.
        const needsPackage = d.approveNeedsTerms || (x.rate == null && x.kind === "event");
        if (seat === "community") {
            if (needsPackage) {
                const moves: Move[] = [];
                if (can.setStatus) moves.push({ id: "decline", label: say("decline") });
                if (can.propose) moves.push({ id: "pickPackage", label: say("barPickPackage"), primary: true });
                return {
                    tone: "you", eyebrow: say("barYourMove"), title: say("barPickToAgree"),
                    sub: say("barPickToAgreeSub", { seller, community, date: shortDate(x.createdAt) }),
                    moves,
                };
            }
            // Everything that stands between it and the shelf (a booking not
            // accepted, add-ons waiting): Approve stays drawn, off, with why.
            const blockers = d.blockers;
            const moves: Move[] = [];
            if (can.propose && x.rate == null) moves.push({ id: "pickPackage", label: say("barPickPackage"), text: true });
            if (can.setStatus) {
                moves.push({ id: "decline", label: say("decline") });
                moves.push({
                    id: "approve", label: say("approvePublish"), primary: true,
                    disabled: blockers.length > 0, title: blockers.map((b) => b.text).join(". ") || undefined,
                });
            }
            if (blockers.length > 0) {
                return { tone: "you", eyebrow: say("barYourMove"), title: say("barFirst"), sub: blockers.map((b) => b.text).join(". "), moves };
            }
            return {
                tone: "you", eyebrow: say("barYourMove"), title: say("barReady"),
                sub: terms
                    ? (x.agreedAt ? say("barAgreedWith", { terms, who: seller, date: shortDate(x.agreedAt) }) : say("barAtTerms", { terms }))
                    : say("barStandardTerms", { community }),
                moves,
            };
        }
        // The seller, waiting.
        if (needsPackage) {
            const moves: Move[] = [];
            if (can.setStatus) moves.push({ id: "withdraw", label: say("withdrawRequest") });
            if (can.propose) moves.push({ id: "pickPackage", label: say("barPickPackage"), primary: true });
            return {
                tone: "you", eyebrow: say("barYourMove"), title: say("barPickHow", { community }),
                sub: say("barPickHowSub", { community }),
                moves,
            };
        }
        return {
            tone: "them", eyebrow: say("barWaitingFor", { who: community }),
            title: say("barPublishesNext", { community }),
            sub: terms
                ? (x.agreedAt ? say("barAgreedOn", { terms, date: shortDate(x.agreedAt) }) : say("barAtTerms", { terms }))
                : say("barStandardTerms", { community }),
            moves: [
                ...(can.propose && x.rate == null ? [{ id: "pickPackage" as const, label: say("barPickPackage"), text: true }] : []),
                ...(can.setStatus ? [{ id: "withdraw" as const, label: say("withdrawRequest") }] : []),
            ],
        };
    }

    const since = shortDate(x.approvedAt);

    if (status === "ACTIVE" && !x.isHidden) {
        const moves: Move[] = [];
        if (seat === "community") {
            if (can.setStatus) moves.push({ id: "remove", label: say("barRemove") });
            if (can.setHidden) moves.push({ id: "pause", label: say("barPause") });
        } else if (can.setStatus) {
            moves.push({ id: "withdraw", label: say("withdraw") });
            moves.push({ id: "pause", label: say("barPause") });
        }
        return {
            tone: "live", eyebrow: say("stateLive"),
            title: since ? say("barLiveSince", { community, date: since }) : say("barLiveOn", { community }),
            // Terms only: a sold count is Earnings' to tell (seen live as "0 sold", 24 Nov).
            sub: terms,
            moves,
        };
    }

    // Paused: by the community (hidden) or by the seller (PAUSED).
    const pausedBySeller = status === "PAUSED";
    const mine = (seat === "community" && !pausedBySeller) || (seat === "seller" && pausedBySeller);
    const moves: Move[] = [];
    if (seat === "community") {
        if (can.setStatus) moves.push({ id: "remove", label: say("barRemove") });
        if (mine && can.setHidden) moves.push({ id: "resume", label: say("barResume"), primary: true });
    } else if (can.setStatus) {
        moves.push({ id: "withdraw", label: say("withdraw") });
        if (mine) moves.push({ id: "resume", label: say("barResume"), primary: true });
    }
    return {
        tone: "paused",
        eyebrow: mine ? say("barPaused") : say("barPausedBy", { who: seat === "community" ? seller : community }),
        title: say("barNotOnSale", { community }),
        sub: mine ? say("barPausedSub") : say("barPausedTheirSub", { who: seat === "community" ? seller : community }),
        moves,
    };
}
