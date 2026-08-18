import { describe, it, expect } from "vitest";
import { LISTING_TOKENS, listingTokenStyle } from "../listings/ui/tokens";

/**
 * The palette the listing review page is built on.
 *
 * Ported from the negotiation MVP, which is the agreed design for this page —
 * a runnable app rather than a mockup, so these values are the ones that were
 * actually looked at and approved.
 *
 * They are applied as inline custom properties on the panel's own root rather
 * than shipped as a stylesheet: a package cannot add a CSS file without asking
 * every consumer to wire it into their build, and the two apps here have
 * different Tailwind setups.
 */

describe("the listing palette", () => {
    it("is warm paper, not neutral grey", () => {
        /*
         * Load-bearing, per the MVP's own note: this screen is about money
         * changing hands between two people, and a cold ground makes it feel
         * like an invoice system. The money bands also need a warm-neutral
         * ground or their amber and green read as warnings.
         */
        expect(LISTING_TOKENS["--paper"]).toBe("#f6f4f0");
        expect(LISTING_TOKENS["--paper"]).not.toBe("#ffffff");
    });

    it("carries every band of the split", () => {
        // The waterfall is the thing being read; a missing band is a missing
        // part of someone's money.
        for (const band of ["--b-tax", "--b-comm", "--b-cob", "--b-card", "--b-keep"]) {
            expect(LISTING_TOKENS[band]).toMatch(/^#[0-9a-f]{6}$/i);
        }
    });

    it("has ONE commit colour", () => {
        // Colour is spent on the split column. Anything that commits wears the
        // single near-black accent, so nothing else competes with the numbers.
        expect(LISTING_TOKENS["--commit"]).toBe(LISTING_TOKENS["--ink"]);
    });

    it("cascades from a root element without a stylesheet", () => {
        const style = listingTokenStyle();
        expect(style["--ink-3"]).toBe("#99928a");
        // Custom properties inherit, so children need nothing of their own.
        expect(Object.keys(style).every((k) => k.startsWith("--"))).toBe(true);
    });

    it("lets a host override without losing the rest", () => {
        // A community's brand may need to reach one token; it must not have to
        // restate the palette to do it.
        const style = listingTokenStyle({ "--commit": "#c07a4a" });
        expect(style["--commit"]).toBe("#c07a4a");
        expect(style["--paper"]).toBe("#f6f4f0");
    });
});

describe("branding, per host", () => {
    /*
     * The community app is community-BRANDED; the admin is plain by design.
     *
     * A leader works across communities. A page that repainted itself per
     * community would turn "whose shelf am I on" into a colour-matching
     * exercise, on the screen where they agree commissions.
     */
    it("moves only the commit colour", () => {
        /*
         * The paper, the ink and the money bands must NOT move with a brand.
         * The bands encode a quantity split five ways; retinting them to a
         * community's palette would make two shares indistinguishable, and the
         * warm ground exists so the amber and green read as parts of a split
         * rather than as warnings.
         */
        const branded = listingTokenStyle({ "--commit": "#c07a4a" });
        expect(branded["--commit"]).toBe("#c07a4a");
        expect(branded["--paper"]).toBe(LISTING_TOKENS["--paper"]);
        expect(branded["--ink"]).toBe(LISTING_TOKENS["--ink"]);
        for (const band of ["--b-comm", "--b-cob", "--b-keep"]) {
            expect(branded[band]).toBe(LISTING_TOKENS[band]);
        }
    });

    it("falls back to the near-black accent when no brand is given", () => {
        // Which is the admin, and it is a choice rather than an omission.
        expect(listingTokenStyle()["--commit"]).toBe(LISTING_TOKENS["--ink"]);
    });
});
