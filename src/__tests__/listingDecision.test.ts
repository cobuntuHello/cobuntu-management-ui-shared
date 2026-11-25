/**
 * The decision bar as data (listings/v2/decision.ts): what the bar says and
 * which moves it offers, per seat and state. Each case is a way it could
 * mislead: a move the state machine would refuse, a publish without terms on
 * a paid event, the wrong side's turn, a closed listing that still offers
 * moves.
 */
import { describe, it, expect } from "vitest";
import { decisionOf, type DecisionInput } from "../listings/v2/decision";
import { makeSay } from "../listings/v2/copy";
import type { Derived } from "../listings/v2/derive";
import { ownerListingActions, reviewerListingActions } from "../listings/listingTransitions";

const say = makeSay();

const derived = (over: Partial<Derived> = {}): Derived => ({
    steps: {} as any, offer: null, myAddons: [], theirAddons: [], bookingLive: false, bookingAwaitsCommunity: false,
    approveNeedsTerms: false, blockers: [], checks: [], ...over,
});

function input(over: Partial<DecisionInput> & { status: DecisionInput["status"] }): DecisionInput {
    const status = over.status;
    return {
        seat: "community", kind: "product", isHidden: false, rate: 10, packageName: "Standard", agreedAt: "2026-11-24T10:00:00Z",
        approvedAt: null, createdAt: "2026-11-24T09:00:00Z", sold: 0, names: { community: "DDDIMO", seller: "Alexandra" },
        room: null, rejectionReason: null, d: derived(),
        can: { decideBooking: true, setHidden: true, respond: true, propose: true, setStatus: true },
        reviewer: reviewerListingActions(status as any), owner: ownerListingActions(status as any),
        ...over,
    };
}

const ids = (x: DecisionInput) => decisionOf(x, say).moves.map((m) => m.id);

describe("the community's bar", () => {
    it("asks for a package first on a paid event with no terms: Pick a package is the main move, no Approve", () => {
        const d = decisionOf(input({ status: "PENDING", kind: "event", rate: null, packageName: null, d: derived({ approveNeedsTerms: true }) }), say);
        expect(d.tone).toBe("you");
        expect(d.title).toBe("Pick a package to agree the terms");
        expect(d.moves.map((m) => [m.id, !!m.primary])).toEqual([["decline", false], ["pickPackage", true]]);
    });

    it("is ready to publish once agreed, at the agreed terms", () => {
        const d = decisionOf(input({ status: "PENDING" }), say);
        expect(d.title).toBe("Ready to publish");
        expect(d.sub).toBe("Standard · 10% agreed with Alexandra on 24 Nov.");
        expect(d.moves.find((m) => m.id === "approve")?.primary).toBe(true);
    });

    it("keeps Approve off while something blocks, and says what", () => {
        const d = decisionOf(input({ status: "PENDING", d: derived({ blockers: [{ step: 2, text: "Decide 1 add-on" }] }) }), say);
        expect(d.moves.find((m) => m.id === "approve")).toMatchObject({ disabled: true, title: "Decide 1 add-on" });
    });

    it("answers the seller's pick: accept, decline, or pick another", () => {
        const offer = { proposal: { id: "p", commissionRate: 15, package: { id: "f", name: "Featured" } } as any, by: "seller" as const };
        const d = decisionOf(input({ status: "PENDING", rate: null, d: derived({ offer }) }), say);
        expect(d.tone).toBe("answer");
        expect(d.title).toBe("Alexandra picked Featured · 15%");
        expect(d.moves.map((m) => m.id)).toEqual(["pickPackage", "declineOffer", "acceptOffer"]);
    });

    it("waits on the seller after offering a package", () => {
        const offer = { proposal: { id: "p", commissionRate: 15, createdAt: "2026-11-24T18:20:00Z", package: { id: "f", name: "Featured" } } as any, by: "community" as const };
        const d = decisionOf(input({ status: "PENDING", rate: null, d: derived({ offer }) }), say);
        expect(d.tone).toBe("them");
        expect(d.eyebrow).toBe("Waiting for Alexandra");
    });

    it("live: Remove and Pause; hidden: Remove and Resume", () => {
        expect(ids(input({ status: "ACTIVE" }))).toEqual(["remove", "pause"]);
        const hidden = decisionOf(input({ status: "ACTIVE", isHidden: true }), say);
        expect(hidden.tone).toBe("paused");
        expect(hidden.moves.map((m) => m.id)).toEqual(["remove", "resume"]);
    });

    it("cannot pause without a host that hides, or resume what the seller paused", () => {
        expect(ids(input({ status: "ACTIVE", can: { decideBooking: true, setHidden: false, respond: true, propose: true, setStatus: true } }))).toEqual(["remove"]);
        const sellerPaused = decisionOf(input({ status: "PAUSED" }), say);
        expect(sellerPaused.eyebrow).toBe("Paused by Alexandra");
        expect(sellerPaused.moves.map((m) => m.id)).not.toContain("resume");
    });

    it("a venue booking in review comes first, and only when the host can decide it", () => {
        const d = decisionOf(input({ status: "PENDING", kind: "event", room: "The Sound Room", d: derived({ bookingAwaitsCommunity: true }) }), say);
        expect(d.title).toBe("Alexandra booked The Sound Room");
        expect(d.moves.map((m) => m.id)).toEqual(["declineBooking", "acceptBooking"]);
        const cannot = decisionOf(input({ status: "PENDING", kind: "event", d: derived({ bookingAwaitsCommunity: true, blockers: [{ step: 1, text: "Accept or decline the booking" }] }), can: { decideBooking: false, setHidden: true, respond: true, propose: true, setStatus: true } }), say);
        expect(cannot.moves.map((m) => m.id)).not.toContain("acceptBooking");
        expect(cannot.moves.find((m) => m.id === "approve")?.disabled).toBe(true);
    });
});

describe("the seller's bar", () => {
    it("asks how the community lists it when no package is agreed on a paid event", () => {
        const d = decisionOf(input({ seat: "seller", status: "PENDING", kind: "event", rate: null, packageName: null, d: derived({ approveNeedsTerms: true }) }), say);
        expect(d.title).toBe("Pick how DDDIMO lists it");
        expect(d.moves.map((m) => m.id)).toEqual(["withdraw", "pickPackage"]);
    });

    it("waits for the community once agreed, and can still withdraw", () => {
        const d = decisionOf(input({ seat: "seller", status: "PENDING" }), say);
        expect(d.tone).toBe("them");
        expect(d.title).toBe("DDDIMO publishes it next");
        expect(d.moves.map((m) => m.id)).toEqual(["withdraw"]);
    });

    it("live: Withdraw and Pause; paused: Withdraw and Resume", () => {
        expect(ids(input({ seat: "seller", status: "ACTIVE" }))).toEqual(["withdraw", "pause"]);
        expect(ids(input({ seat: "seller", status: "PAUSED" }))).toEqual(["withdraw", "resume"]);
    });

    it("says the community paused it, without offering Resume", () => {
        const d = decisionOf(input({ seat: "seller", status: "ACTIVE", isHidden: true }), say);
        expect(d.eyebrow).toBe("Paused by DDDIMO");
        expect(d.moves.map((m) => m.id)).toEqual(["withdraw"]);
    });
});

describe("a closed listing", () => {
    it("offers nothing, says how it ended, and quotes the reason", () => {
        const declined = decisionOf(input({ status: "REVOKED", rejectionReason: "The photos don't show the shelf." }), say);
        expect(declined.tone).toBe("closed");
        expect(declined.title).toBe("Declined by DDDIMO");
        expect(declined.sub).toBe("“The photos don't show the shelf.”");
        expect(declined.moves).toEqual([]);
        expect(decisionOf(input({ status: "REVOKED", approvedAt: "2026-11-25T10:00:00Z" }), say).title).toBe("Removed from DDDIMO");
        expect(decisionOf(input({ seat: "seller", status: "CANCELLED" }), say).title).toBe("You withdrew it");
    });
});
