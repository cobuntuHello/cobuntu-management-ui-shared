import { describe, it, expect } from "vitest";
import { ownerListingActions, reviewerListingActions } from "../listings/listingTransitions";

/**
 * One machine, two seats.
 *
 * The panel moved into this package so the admin could show the SAME page the
 * seller sees. That only works if it can be viewed from the leader's chair —
 * otherwise a leader mounting it gets the seller's controls, and "Withdraw"
 * appears exactly where "Approve" belongs.
 *
 * Both sides read the same transition table with a different `who`, which is
 * what stops them being two rule sets that have to be kept in agreement by
 * hand.
 */

describe("what a reviewing leader may do", () => {
    it("approves a request that is still being asked for", () => {
        expect(reviewerListingActions("PENDING")).toContain("approve");
    });

    it("cannot approve something already live", () => {
        // Approving is only meaningful on an open ask; offering it on a live
        // listing would be a button that changes nothing.
        expect(reviewerListingActions("ACTIVE")).not.toContain("approve");
    });

    it("declines an open request, and takes down a live one", () => {
        /*
         * Both land on REVOKED; the words differ because the acts do. Saying
         * "take it down" about something that was never up would misdescribe
         * what happened in the one record either side can read later.
         */
        expect(reviewerListingActions("PENDING")).toContain("decline");
        expect(reviewerListingActions("ACTIVE")).toContain("revoke");
        expect(reviewerListingActions("ACTIVE")).not.toContain("decline");
    });

    it("NEVER offers withdraw", () => {
        /*
         * The assertion that matters. CANCELLED is owner-only in the table, so
         * a leader closing a seller's request goes to REVOKED instead. They are
         * different states because they are different acts, and recording a
         * leader's decision as the seller's withdrawal would put the wrong name
         * on it permanently — the same mistake as calling a lapsed request
         * declined.
         */
        for (const state of ["PENDING", "ACTIVE", "PAUSED"] as const) {
            expect(reviewerListingActions(state)).not.toContain("withdraw");
        }
    });

    it("offers nothing on a closed listing", () => {
        expect(reviewerListingActions("CANCELLED")).toEqual([]);
        expect(reviewerListingActions("REVOKED")).toEqual([]);
    });

    it("shares no action with the owner's set", () => {
        /*
         * Pause and withdraw are the seller's; approve and revoke are the
         * leader's. An action appearing in both would mean the two seats can
         * take the same step, which the table deliberately does not allow.
         */
        for (const state of ["PENDING", "ACTIVE", "PAUSED"] as const) {
            const owner = new Set<string>(ownerListingActions(state));
            for (const a of reviewerListingActions(state)) expect(owner.has(a)).toBe(false);
        }
    });
});
