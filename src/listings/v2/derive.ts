/**
 * Where a listing stands, step by step, from one seat: pure functions over
 * the data the page loaded, so every state can be tested without a screen.
 *
 * THE FOUR STEPS are the same for every listing in every community (decided
 * 22 Nov 2026); only their state differs. A step's tone is whose turn it is:
 *   done    agreed, nothing left
 *   you     waiting on the viewer (amber, with a count)
 *   them    waiting on the other side (blue)
 *   live    on the shelf (dark)
 *   locked  cannot happen yet (dashed)
 *
 * WHAT BLOCKS GOING LIVE: a venue booking not yet accepted, a paid event with
 * no agreed commission (the backend's own rule: approveNeedsTerms), and
 * add-ons still waiting on an answer. Open topics never block; they say so.
 */
import type { Say } from "./copy";
import { shortDate, toRate, percent } from "./format";
import type { BookingView, ListingMoney, ListingStatus, Proposal, Seat, Topic, UpfrontAddon } from "./types";

export type StepId = "request" | "money" | "talk" | "live";
export type Tone = "done" | "you" | "them" | "live" | "locked";
export interface StepState { tone: Tone; sub: string; badge?: number | "done" }

export interface Snapshot {
    seat: Seat;
    kind: "event" | "product";
    status: ListingStatus | null;
    isHidden: boolean;
    /** The agreed rate (null until agreed; 0 is a real agreement). */
    rate: number | null;
    /** A paid item: a paid event needs agreed terms before it can go live. */
    paid: boolean;
    proposals: Proposal[];
    sellerUserId: string | null;
    booking: BookingView | null;
    money: ListingMoney | null;
    topics: Topic[];
    approvedAt: string | null;
    capacity: number | null;
    names: { community: string; seller: string };
}

const LIVE_BOOKING = new Set(["IN_REVIEW", "ACCEPTED", "COMPLETED"]);

/** The newest offer still open, and whose it is. */
export function pendingOffer(s: Snapshot): { proposal: Proposal; by: Seat } | null {
    const open = s.proposals
        .filter((p) => (p.status ?? "PENDING") === "PENDING")
        .sort((a, b) => Date.parse(b.createdAt ?? "") - Date.parse(a.createdAt ?? ""));
    const p = open[0];
    if (!p) return null;
    const by = p.proposedByUserId ?? p.proposedByUser?.id ?? p.proposedBy?.id ?? null;
    return { proposal: p, by: by && s.sellerUserId && by === s.sellerUserId ? "seller" : "community" };
}

/** Add-ons waiting on a seat: the community prices requests; the seller answers a proposed price. */
export function addonsWaitingOn(addons: UpfrontAddon[], seat: Seat): UpfrontAddon[] {
    return addons.filter((a) => !a.included && (seat === "community" ? a.status === "REQUESTED" : a.status === "PRICE_PROPOSED"));
}

export function openTopics(topics: Topic[]): Topic[] {
    return topics.filter((t) => t.status === "OPEN");
}

/** Has this seat said the topic is done? */
export function saidDone(t: Topic, seat: Seat): boolean {
    return seat === "seller" ? t.closedBySeller : t.closedByCommunity;
}

export interface Derived {
    steps: Record<StepId, StepState>;
    offer: ReturnType<typeof pendingOffer>;
    myAddons: UpfrontAddon[];
    theirAddons: UpfrontAddon[];
    bookingLive: boolean;
    bookingAwaitsCommunity: boolean;
    approveNeedsTerms: boolean;
    blockers: Array<{ text: string; step: 1 | 2 | 3 }>;
    checks: Array<{ ok: boolean; text: string; step?: 1 | 2 | 3 }>;
}

export function derive(s: Snapshot, say: Say): Derived {
    const other = s.seat === "seller" ? s.names.community : s.names.seller;
    const offer = pendingOffer(s);
    const addons = s.money?.upfront?.addons ?? [];
    const myAddons = addonsWaitingOn(addons, s.seat);
    const theirAddons = addonsWaitingOn(addons, s.seat === "seller" ? "community" : "seller");
    const topics = openTopics(s.topics);
    const bookingLive = !!s.booking && LIVE_BOOKING.has(s.booking.status);
    const bookingAwaitsCommunity = !!s.booking && s.booking.status === "IN_REVIEW";
    const live = s.status === "ACTIVE" || s.status === "PAUSED";
    const closed = s.status === "CANCELLED" || s.status === "REVOKED";
    const approveNeedsTerms = s.kind === "event" && s.paid && s.rate == null && s.status === "PENDING";
    const sold = s.money?.soldSoFar?.count ?? 0;

    // ── 1. the request ──
    let request: StepState;
    if (!s.booking) request = { tone: "done", sub: say("subNothingHere"), badge: "done" };
    else if (bookingAwaitsCommunity) {
        request = s.seat === "community"
            ? { tone: "you", sub: say("subAcceptBooking"), badge: 1 }
            : { tone: "them", sub: say("subToAccept", { who: s.names.community }) };
    } else if (bookingLive) request = { tone: "done", sub: say("stateConfirmed").toLowerCase(), badge: "done" };
    else request = { tone: "locked", sub: s.booking.status.toLowerCase().replace(/_/g, " ") };

    // ── 2. the money ──
    let money: StepState;
    if (offer && offer.by !== s.seat) money = { tone: "you", sub: say("subOffer"), badge: 1 };
    else if (myAddons.length > 0) money = { tone: "you", sub: myAddons.length === 1 ? say("subAddonForYou") : say("subAddonsForYou", { count: myAddons.length }), badge: myAddons.length };
    else if (approveNeedsTerms && s.seat === "community" && !offer) money = { tone: "you", sub: say("moneyHintNoTerms").split(".")[0].toLowerCase(), badge: 1 };
    else if (offer || theirAddons.length > 0 || approveNeedsTerms) money = { tone: "them", sub: say("stateTheirTurn", { who: other }) };
    else if (live) money = { tone: "done", sub: say("subSold", { count: sold }), badge: "done" };
    else money = { tone: "done", sub: say("stateAgreed").toLowerCase(), badge: "done" };

    // ── 3. the talk ──
    let talk: StepState;
    if (topics.length === 0) talk = { tone: "done", sub: s.topics.length ? say("stateSettled").toLowerCase() : say("subNothingHere"), badge: s.topics.length ? "done" : undefined };
    else {
        const mine = topics.filter((t) => !saidDone(t, s.seat));
        talk = mine.length > 0
            ? { tone: "you", sub: mine.length === 1 ? say("subTopicOpen") : say("subTopicsOpen", { count: mine.length }), badge: mine.length }
            : { tone: "them", sub: say("subToReply", { who: other }) };
    }

    // ── what stands between this listing and the shelf ──
    const blockers: Derived["blockers"] = [];
    if (bookingAwaitsCommunity) blockers.push({ step: 1, text: s.seat === "community" ? say("checkAcceptBooking") : say("checkCommunityAccepts", { community: s.names.community }) });
    if (approveNeedsTerms) blockers.push({ step: 2, text: say("checkTermsMissing") });
    const waitingAddons = addonsWaitingOn(addons, "community").length + addonsWaitingOn(addons, "seller").length;
    const addonText = s.seat === "community"
        ? (waitingAddons === 1 ? say("checkAddon") : say("checkAddons", { count: waitingAddons }))
        : (waitingAddons === 1 ? say("checkAddonYou") : say("checkAddonsYou", { count: waitingAddons }));
    if (waitingAddons > 0) blockers.push({ step: 2, text: addonText });

    // ── 4. go live ──
    let goLive: StepState;
    if (s.status === "ACTIVE") goLive = s.isHidden
        ? { tone: "them", sub: say("statePaused").toLowerCase() }
        : { tone: "live", sub: s.approvedAt ? say("subSince", { date: shortDate(s.approvedAt) }) : say("stateLive").toLowerCase() };
    else if (s.status === "PAUSED") goLive = { tone: s.seat === "seller" ? "you" : "them", sub: say("statePaused").toLowerCase() };
    else if (closed) goLive = { tone: "locked", sub: (s.status === "REVOKED" ? say("stateClosedRevoked") : say("stateClosedWithdrawn")).toLowerCase() };
    else if (blockers.length > 0) goLive = { tone: "locked", sub: s.seat === "community" ? say("stateAfterSteps").toLowerCase() : say("stateAfter", { who: s.names.community }).toLowerCase() };
    else goLive = s.seat === "community" ? { tone: "you", sub: say("approvePublish").toLowerCase(), badge: 1 } : { tone: "them", sub: say("stateAfter", { who: s.names.community }).toLowerCase() };

    // ── the go-live checklist ──
    const checks: Derived["checks"] = [];
    if (live) {
        checks.push({ ok: true, text: say("checkOnShelf", { community: s.names.community, date: shortDate(s.approvedAt) || "" }).replace(/ since $/, "") });
        checks.push({ ok: true, text: s.capacity ? say("checkSoldOf", { sold, capacity: s.capacity }) : say("checkSold", { sold }) });
        if (bookingLive) checks.push({ ok: true, text: say("checkBooking") });
    } else {
        if (s.booking) checks.push(bookingAwaitsCommunity
            ? { ok: false, step: 1, text: s.seat === "community" ? say("checkAcceptBooking") : say("checkCommunityAccepts", { community: s.names.community }) }
            : { ok: bookingLive, step: 1, text: say("checkBooking") });
        if (s.rate != null) {
            const terms = s.rate === 0 ? (s.kind === "event" ? say("lineCommissionNone") : say("lineCommissionNoneProduct")) : percent(s.rate);
            checks.push({ ok: true, text: say("checkTerms", { terms }), step: 2 });
        } else if (s.paid) checks.push({ ok: false, text: say("checkTermsMissing"), step: 2 });
        if (waitingAddons > 0) checks.push({ ok: false, step: 2, text: addonText });
        if (topics.length > 0) checks.push({ ok: false, step: 3, text: topics.length === 1 ? say("checkTopic") : say("checkTopics", { count: topics.length }) });
    }

    return {
        steps: { request, money, talk, live: goLive },
        offer, myAddons, theirAddons, bookingLive, bookingAwaitsCommunity, approveNeedsTerms, blockers, checks,
    };
}

/** The step a seat should land on: the first one waiting on them, else the money. */
export function firstStep(d: Derived): StepId {
    const order: StepId[] = ["request", "money", "talk", "live"];
    return order.find((id) => d.steps[id].tone === "you") ?? "money";
}

export const rateOf = toRate;
