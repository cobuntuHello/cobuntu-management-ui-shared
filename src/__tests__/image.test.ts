/**
 * Capping an image before it is uploaded.
 *
 * The wizards used to send whatever the camera produced — a 4000px JPEG at
 * quality 0.92 for a card that renders a few hundred pixels wide. Products
 * carried up to five of them as multipart; events embedded one as base64 inside
 * a JSON body, adding a further third on the wire. Nothing resized them
 * afterwards, so the browser is the only place it can be fixed.
 *
 * `fitWithin` is the whole decision, kept pure so it can be tested without a
 * DOM. The cases below are the ones that bite: not enlarging, keeping the
 * aspect ratio, and treating BOTH orientations by their longest edge rather
 * than by width.
 */

import { describe, it, expect } from "vitest";
import { fitWithin, MAX_IMAGE_EDGE, IMAGE_QUALITY } from "../lib/image";

describe("fitWithin", () => {
    it("caps a landscape photo on its width", () => {
        expect(fitWithin({ width: 4000, height: 3000 }, 2000)).toEqual({ width: 2000, height: 1500 });
    });

    it("caps a PORTRAIT photo on its height, not its width", () => {
        /*
         * The bug a naive `if (width > max)` would ship: a phone held upright
         * produces 3000x4000, whose width is already under the cap. Scaling on
         * width alone would leave a 4000px-tall image untouched — the exact
         * case this is meant to fix, since portrait is how most people
         * photograph a product.
         */
        expect(fitWithin({ width: 3000, height: 4000 }, 2000)).toEqual({ width: 1500, height: 2000 });
    });

    it("leaves an image that is already small alone", () => {
        // Never enlarges: upscaling adds bytes and no detail, and someone
        // uploading a 400px logo means it.
        expect(fitWithin({ width: 400, height: 300 }, 2000)).toEqual({ width: 400, height: 300 });
    });

    it("leaves an image exactly on the cap alone", () => {
        expect(fitWithin({ width: 2000, height: 1200 }, 2000)).toEqual({ width: 2000, height: 1200 });
    });

    it("keeps a square square", () => {
        expect(fitWithin({ width: 3000, height: 3000 }, 2000)).toEqual({ width: 2000, height: 2000 });
    });

    it("preserves the aspect ratio to within a pixel", () => {
        const src = { width: 4032, height: 3024 };  // a real iPhone frame
        const out = fitWithin(src, 2000);
        expect(Math.abs(out.width / out.height - src.width / src.height)).toBeLessThan(0.01);
    });

    it("survives a zero-sized source instead of dividing by it", () => {
        // A decode that failed leaves 0x0. Returning it unchanged lets the
        // caller fail on its own terms rather than on a NaN canvas size.
        expect(fitWithin({ width: 0, height: 0 }, 2000)).toEqual({ width: 0, height: 0 });
    });

    it("defaults to the shared cap when none is passed", () => {
        const out = fitWithin({ width: MAX_IMAGE_EDGE * 2, height: MAX_IMAGE_EDGE * 2 });
        expect(Math.max(out.width, out.height)).toBe(MAX_IMAGE_EDGE);
    });
});

describe("the constants", () => {
    it("caps well above what any surface displays, and below what a camera makes", () => {
        // 2000 is the judgement: a 2x retina hero at full width still fits
        // under it, and every phone shoots above it.
        expect(MAX_IMAGE_EDGE).toBeGreaterThanOrEqual(1600);
        expect(MAX_IMAGE_EDGE).toBeLessThanOrEqual(2400);
    });

    it("keeps quality in the range where artefacts stay invisible", () => {
        expect(IMAGE_QUALITY).toBeGreaterThanOrEqual(0.75);
        expect(IMAGE_QUALITY).toBeLessThan(0.92);
    });
});
