import { describe, it, expect } from "vitest";
import { LISTING_DETAIL_COPY, defaultTranslate } from "../listings/copy";

/**
 * The panel's copy, now that the package owns it.
 *
 * ── Why this moved here ─────────────────────────────────────────────────────
 *
 * The listing review panel lived in the community app, and the admin showed a
 * small modal of its own instead — two screens for the same decision, drifting
 * apart. Sharing the component meant sharing its words, and the alternative
 * (each host defining the same thirty keys in its own message file) is exactly
 * the duplication the move exists to end.
 *
 * A host with its own translations passes a `t` down instead. The signature is
 * deliberately next-intl's, so the community app hands over its existing `t`
 * unchanged and keeps every locale it already had — the package default is the
 * fallback for a host that has none, which is what lets the admin mount this
 * with no message file at all.
 */

describe("the package's own English", () => {
    it("carries the keys the panel actually renders", () => {
        for (const key of ["threadTitle", "counterSend", "withdrawRequest", "community"]) {
            expect(LISTING_DETAIL_COPY[key]).toBeTruthy();
        }
    });

    it("fills in placeholders", () => {
        // The panel names the community in several sentences; a literal
        // "{community}" reaching a seller would read as a broken template.
        const out = defaultTranslate("waitingTitle", { community: "Cobuntu" });
        expect(out).not.toMatch(/\{community\}/);
        expect(out).toContain("Cobuntu");
    });

    it("returns the KEY for something it does not know", () => {
        /*
         * Not an empty string. A missing label should look wrong in review
         * rather than vanish silently in production — an empty button is a
         * control nobody can identify, and it ships.
         */
        expect(defaultTranslate("noSuchKeyAnywhere")).toBe("noSuchKeyAnywhere");
    });

    it("leaves a placeholder visible when its value is missing", () => {
        // Same reasoning: a caller that forgets a variable should see which
        // one, not a sentence with a hole in it.
        expect(defaultTranslate("waitingTitle", {})).toMatch(/\{community\}/);
    });

    it("does not need vars for a plain string", () => {
        expect(defaultTranslate("threadTitle")).toBe(LISTING_DETAIL_COPY.threadTitle);
    });
});

/**
 * The tab strip's copy, and the reason there is a strip.
 *
 * The proposals thread became its own tab because it is a RECORD, not a task:
 * read once, argued over rarely, and empty on the common listing that was
 * accepted as asked -- where it had been a full card holding one grey sentence
 * in the middle of the page. Terms leads because it holds the rate, the
 * agreement and the points either side raised, which is the live conversation.
 */
describe("the tab strip", () => {
    it("names both tabs", () => {
        expect(LISTING_DETAIL_COPY.tabTerms).toBe("Terms");
        expect(LISTING_DETAIL_COPY.tabHistory).toBe("History");
    });

    /*
     * The count belongs on the tab, so a listing with a real argument behind it
     * says so before you open it -- and the countless one does not show "(0)",
     * which reads as a broken counter rather than as nothing having happened.
     */
    it("has a separate counted form, so an empty history shows no zero", () => {
        expect(LISTING_DETAIL_COPY.tabHistoryCount).toContain("{count}");
        expect(LISTING_DETAIL_COPY.tabHistory).not.toContain("{count}");
    });
});

/**
 * Every lever confirms first, and the dialog says what happens.
 *
 * All of these are public and most are hard to undo. Only withdrawal used to
 * ask, which left the two acts a LEADER performs on somebody else's listing --
 * approve and revoke -- as the unguarded ones.
 */
describe("the confirmations", () => {
    const CRITICAL = ["Approve", "Pause", "Resume", "Revoke"];

    it("has a title and a body for every lever", () => {
        for (const act of CRITICAL) {
            expect(LISTING_DETAIL_COPY[`confirm${act}Title`]).toBeTruthy();
            expect(LISTING_DETAIL_COPY[`confirm${act}Body`]).toBeTruthy();
        }
    });

    /*
     * A dialog that only repeats its button teaches people to click through it,
     * and then the one that matters gets the same reflex. Each body has to say
     * what actually happens, so none of them may be a bare "are you sure".
     */
    it("explains rather than asking whether you are sure", () => {
        for (const act of CRITICAL) {
            const body = LISTING_DETAIL_COPY[`confirm${act}Body`];
            expect(body.toLowerCase()).not.toContain("are you sure");
            expect(body.length).toBeGreaterThan(40);
        }
    });

    /*
     * Revoke is the one people confuse with a pause, and the difference is the
     * whole reason it is a separate act: the arrangement ends, and getting it
     * back means asking again.
     */
    it("says plainly that revoking is not a pause", () => {
        expect(LISTING_DETAIL_COPY.confirmRevokeBody).toMatch(/not a pause/i);
        expect(LISTING_DETAIL_COPY.confirmPauseBody).toMatch(/put it back|without asking/i);
    });
});
