import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { LISTING_DETAIL_COPY } from "../listings/copy";

/**
 * Whose turn it is, said in words and from the right seat.
 *
 * The banner only ever spoke to the seller. A leader opening the request they
 * are supposed to answer was told "your request is in their review queue,
 * there is nothing for you to do until they answer" — about themselves, on the
 * page where they approve it, directly above an Approve button.
 *
 * The state was right the whole time. The AUDIENCE was never checked, which is
 * what happens when a component that served one caller acquires a second and
 * only its actions are made role-aware.
 *
 * The mockup this page is built from is explicit: whose move it is should never
 * have to be inferred from which buttons are enabled. So it is stated — and
 * stated per viewer.
 */

const SRC = readFileSync(join(process.cwd(), "src/listings/ManagedListingDetail.tsx"), "utf8");

describe("the waiting banner", () => {
    it("addresses the leader as the person being waited ON", () => {
        expect(LISTING_DETAIL_COPY.waitingLeaderTitle).toBe("Your turn");
        expect(LISTING_DETAIL_COPY.waitingLeaderBody).toMatch(/waiting on you/i);
    });

    it("never tells a leader there is nothing to do", () => {
        // The seller's copy says exactly that, and it is the sentence that was
        // appearing above an Approve button.
        expect(LISTING_DETAIL_COPY.waitingBody).toMatch(/nothing for you to do/i);
        expect(LISTING_DETAIL_COPY.waitingLeaderBody).not.toMatch(/nothing for you to do/i);
    });

    it("branches on the viewer, not on the state", () => {
        /*
         * The state is the same for both — PENDING is PENDING. What differs is
         * who is reading it, so the branch has to be the seat.
         */
        expect(SRC).toMatch(/viewer === "leader"\s*\?\s*t\("waitingLeaderTitle"\)/);
        expect(SRC).toMatch(/viewer === "leader" \? t\("waitingLeaderBody"\) : t\("waitingBody"\)/);
    });

    it("keeps the seller's wording untouched", () => {
        // The default seat is the owner, and this fix must not quietly reword
        // the page the community app has been shipping.
        expect(LISTING_DETAIL_COPY.waitingTitle).toMatch(/\{community\}/);
    });
});
