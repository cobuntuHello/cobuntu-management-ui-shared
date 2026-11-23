/**
 * Where a listing stands, step by step, from each seat (listings/v2/derive.ts).
 * Built on the canvas' listing: Marta's evening at TEJÁ House.
 */
import { describe, it, expect } from "vitest";
import { derive, firstStep, type Snapshot } from "../listings/v2/derive";
import { makeSay } from "../listings/v2/copy";
import type { ListingMoney, UpfrontAddon } from "../listings/v2/types";

const say = makeSay();

const addon = (o: Partial<UpfrontAddon>): UpfrontAddon => ({
    id: Math.random().toString(36).slice(2), name: "Sound engineer", slot: null, status: "REQUESTED", required: false, quantity: 1,
    listedCents: 11250, proposedCents: null, vatRate: 23, gross: 13838, amount: 13838, stripe: 0, estimated: false, included: false,
    paidAt: null, saleId: null, ...o,
});

function money(addons: UpfrontAddon[] = [], sold?: number): ListingMoney {
    return {
        kind: "event", listingId: "l", seat: "seller", status: "PENDING", live: sold !== undefined, currency: "EUR",
        oneSale: null, soldSoFar: sold !== undefined ? { count: sold, lines: [] } : null, result: null,
        upfront: { room: "The Sound Room", bookingStatus: "IN_REVIEW", isPriority: false, card: null, payments: [], addons, paid: 0, toCome: 0, total: 0, next: null },
    };
}

function snap(o: Partial<Snapshot> = {}): Snapshot {
    return {
        seat: "community", kind: "event", status: "PENDING", isHidden: false, rate: 0, paid: true, proposals: [], sellerUserId: "marta",
        booking: null, money: money(), topics: [], approvedAt: null, capacity: 40, names: { community: "TEJÁ House", seller: "Marta Silva" }, ...o,
    };
}

const booking = (status: string) => ({ status } as any);

describe("the request", () => {
    it("is TEJÁ's turn while the booking is in review, and Marta waits", () => {
        const c = derive(snap({ booking: booking("IN_REVIEW") }), say);
        expect(c.steps.request).toMatchObject({ tone: "you", badge: 1 });
        const s = derive(snap({ seat: "seller", booking: booking("IN_REVIEW") }), say);
        expect(s.steps.request).toMatchObject({ tone: "them", sub: "TEJÁ House to accept" });
    });

    it("is done once accepted, and when there is no booking to accept", () => {
        expect(derive(snap({ booking: booking("ACCEPTED") }), say).steps.request.tone).toBe("done");
        expect(derive(snap(), say).steps.request.tone).toBe("done");
    });
});

describe("the money", () => {
    it("asks the side the offer was made TO, and counts the add-ons each side must answer", () => {
        const offer = { id: "p", commissionRate: 10, status: "PENDING", proposedByUserId: "leader", createdAt: "2026-11-20T10:00:00Z" };
        expect(derive(snap({ seat: "seller", proposals: [offer] }), say).steps.money).toMatchObject({ tone: "you", sub: "an offer to answer" });
        expect(derive(snap({ seat: "community", proposals: [offer] }), say).steps.money.tone).toBe("them");

        const m = money([addon({ status: "REQUESTED" }), addon({ status: "REQUESTED" }), addon({ status: "PRICE_PROPOSED" })]);
        expect(derive(snap({ money: m }), say).steps.money).toMatchObject({ tone: "you", badge: 2, sub: "2 add-ons for you" });
        expect(derive(snap({ seat: "seller", money: m }), say).steps.money).toMatchObject({ tone: "you", badge: 1, sub: "1 add-on for you" });
    });

    it("says how many sold once live", () => {
        expect(derive(snap({ status: "ACTIVE", money: money([], 25) }), say).steps.money).toMatchObject({ tone: "done", sub: "25 sold" });
    });
});

describe("the talk", () => {
    const topic = (seller: boolean, community: boolean) => ({ id: "t", subject: "The photographer", status: "OPEN" as const, closedBySeller: seller, closedByCommunity: community, openedByUserId: "marta", comments: [] });
    it("is the viewer's turn until they say it is done, then the other side's", () => {
        expect(derive(snap({ topics: [topic(false, false)] }), say).steps.talk).toMatchObject({ tone: "you", badge: 1 });
        expect(derive(snap({ topics: [topic(false, true)] }), say).steps.talk).toMatchObject({ tone: "them", sub: "Marta Silva to reply" });
    });
});

describe("going live", () => {
    it("waits on the booking, the terms and the add-ons, and never on an open topic", () => {
        const d = derive(snap({ booking: booking("IN_REVIEW"), rate: null, money: money([addon({})]), topics: [{ id: "t", subject: "s", status: "OPEN", closedBySeller: false, closedByCommunity: false, openedByUserId: "x", comments: [] }] }), say);
        expect(d.blockers.map((b) => b.step)).toEqual([1, 2, 2]);
        expect(d.steps.live.tone).toBe("locked");
        expect(d.approveNeedsTerms).toBe(true);
        expect(d.checks.find((c) => c.step === 3)?.text).toBe("1 topic open (does not block)");
    });

    it("is ready to publish for the community when nothing blocks", () => {
        const d = derive(snap({ booking: booking("ACCEPTED") }), say);
        expect(d.blockers).toEqual([]);
        expect(d.steps.live).toMatchObject({ tone: "you" });
        expect(firstStep(d)).toBe("live");
    });

    it("is live and says since when; off the shelf when the community hid it", () => {
        expect(derive(snap({ status: "ACTIVE", approvedAt: "2026-11-24T10:00:00Z", money: money([], 25) }), say).steps.live).toMatchObject({ tone: "live", sub: "since 24 Nov" });
        expect(derive(snap({ status: "ACTIVE", isHidden: true }), say).steps.live.tone).toBe("them");
    });

    it("lists what is done on a live listing: on the page, how many sold of how many", () => {
        const d = derive(snap({ status: "ACTIVE", approvedAt: "2026-11-24T10:00:00Z", money: money([], 25), booking: booking("ACCEPTED") }), say);
        expect(d.checks.map((c) => c.text)).toEqual(["On TEJÁ House's page since 24 Nov", "25 of 40 tickets sold", "Room confirmed"]);
    });
});

describe("where the page opens", () => {
    it("on the first step waiting on the viewer, else the money", () => {
        expect(firstStep(derive(snap({ booking: booking("IN_REVIEW") }), say))).toBe("request");
        expect(firstStep(derive(snap({ seat: "seller", status: "ACTIVE", money: money([], 3) }), say))).toBe("money");
    });
});
