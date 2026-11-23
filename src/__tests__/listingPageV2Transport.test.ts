/**
 * restTransport: the listing page v2 on Cobuntu's own REST API (the admin and
 * the community app). Pins the URLs each seat uses, that each seat only gets
 * the booking levers it may pull, and that a refusal keeps the server's words.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { restTransport, TransportError } from "../listings/v2/transport";

const calls: Array<{ url: string; method: string; body?: any; headers: Record<string, string> }> = [];
let reply: { status: number; body: unknown } = { status: 200, body: {} };

beforeEach(() => {
    calls.length = 0;
    reply = { status: 200, body: {} };
    vi.stubGlobal("fetch", vi.fn(async (url: string, init: any) => {
        calls.push({ url, method: init?.method ?? "GET", body: init?.body ? JSON.parse(init.body) : undefined, headers: init?.headers ?? {} });
        return { ok: reply.status < 400, status: reply.status, text: async () => JSON.stringify(reply.body) } as any;
    }));
});
afterEach(() => vi.unstubAllGlobals());

describe("restTransport", () => {
    it("reads the money from the seat it sits in, with the host's auth", async () => {
        const t = restTransport({ kind: "event", listingId: "L1", seat: "community", apiBaseUrl: "https://api.test", authHeaders: { Authorization: "Bearer x" }, communityTag: "tejahouse" });
        await t.money();
        expect(calls[0]).toMatchObject({ url: "https://api.test/api/event-listings/L1/money?seat=community", method: "GET", headers: { Authorization: "Bearer x" } });
    });

    it("gives the seller the host's booking routes, and the community the team's", async () => {
        const seller = restTransport({ kind: "event", listingId: "L1", seat: "seller" });
        expect(seller.confirmAddonPrice).toBeTypeOf("function");
        expect(seller.decideBooking).toBeUndefined();
        await seller.changeDate!("E1", { date: "2027-01-13", start: 18, hours: 3 });
        expect(calls[0]).toMatchObject({ url: "/api/me/events/E1/booking/date", method: "POST", body: { date: "2027-01-13", start: 18, hours: 3 } });

        const team = restTransport({ kind: "event", listingId: "L1", seat: "community", communityTag: "tejahouse" });
        expect(team.confirmAddonPrice).toBeUndefined();
        await team.decideBooking!("E1", "DECLINE", "Double booked");
        expect(calls[1]).toMatchObject({ url: "/api/communities/tejahouse/events/E1/booking/decision", body: { decision: "DECLINE", reason: "Double booked" } });
    });

    it("has no booking levers on a product listing", () => {
        const t = restTransport({ kind: "product", listingId: "L2", seat: "seller" });
        expect(t.booking).toBeUndefined();
        expect(t.startCardChange).toBeUndefined();
    });

    it("asks Stripe for the embedded form or its own page", async () => {
        const t = restTransport({ kind: "event", listingId: "L1", seat: "seller" });
        await t.startCardChange!("E1", { returnUrl: "https://app.test/back?card=done", embedded: true });
        await t.startCardChange!("E1", { returnUrl: "https://app.test/back?card=done", embedded: false });
        expect(calls[0].body).toEqual({ uiMode: "embedded", returnUrl: "https://app.test/back?card=done" });
        expect(calls[1].body).toEqual({ successUrl: "https://app.test/back?card=done", cancelUrl: "https://app.test/back?card=done" });
    });

    it("reads proposals as a list or wrapped, and answers an offer by its own id", async () => {
        const t = restTransport({ kind: "product", listingId: "L2", seat: "seller" });
        reply = { status: 200, body: [{ id: "p1" }] };
        expect(await t.proposals()).toEqual([{ id: "p1" }]);
        reply = { status: 200, body: { proposals: [{ id: "p2" }] } };
        expect(await t.proposals()).toEqual([{ id: "p2" }]);
        await t.respond("p2", "ACCEPTED");
        expect(calls[2]).toMatchObject({ url: "/api/listings/proposals/p2/respond", body: { response: "ACCEPTED" } });
    });

    it("keeps the server's words and code on a refusal; a missing booking is null, not an error", async () => {
        const t = restTransport({ kind: "event", listingId: "L1", seat: "seller" });
        reply = { status: 409, body: { error: "That time is not free; choose another", code: "SLOT_TAKEN" } };
        await expect(t.changeDate!("E1", { date: "2027-01-13", start: 18, hours: 3 })).rejects.toMatchObject({ message: "That time is not free; choose another", code: "SLOT_TAKEN", status: 409 });
        reply = { status: 404, body: { error: "No booking for this event", code: "NOT_FOUND" } };
        expect(await t.booking!("E1")).toBeNull();
        await expect(t.setStatus("ACTIVE")).rejects.toBeInstanceOf(TransportError);
    });
});
