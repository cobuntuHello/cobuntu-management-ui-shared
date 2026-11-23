/**
 * The listing page v2's copy (listings/v2/copy.ts).
 *
 * A missing key renders as the key itself in front of real money, so every
 * key the v2 source asks for is scanned from the source and must exist. And
 * the house rules hold for every sentence: no em dashes; the community named,
 * never "your commission"; confirmations say what happens, never "are you sure".
 */
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "fs";
import { join } from "path";
import { LISTING_PAGE_COPY, makeSay, fill } from "../listings/v2/copy";

describe("listing page v2 copy", () => {
    it("defines every key the v2 source asks for", () => {
        const dir = join(__dirname, "..", "listings", "v2");
        const missing: Record<string, string[]> = {};
        for (const name of readdirSync(dir)) {
            if (!/\.tsx?$/.test(name) || name === "copy.ts") continue;
            const src = readFileSync(join(dir, name), "utf8");
            for (const m of src.matchAll(/\bsay\(\s*"([A-Za-z0-9_]+)"/g)) {
                if ((LISTING_PAGE_COPY as Record<string, string>)[m[1]] === undefined) (missing[m[1]] ??= []).push(name);
            }
        }
        expect(missing).toEqual({});
    });

    it("has no em dashes, never says 'your commission', and never asks 'are you sure'", () => {
        for (const [k, v] of Object.entries(LISTING_PAGE_COPY)) {
            expect(v, k).not.toMatch(/—/);
            expect(v.toLowerCase(), k).not.toContain("your commission");
            expect(v.toLowerCase(), k).not.toContain("are you sure");
        }
    });

    it("fills placeholders and keeps an unknown one visible", () => {
        expect(fill("{community}'s commission", { community: "TEJÁ House" })).toBe("TEJÁ House's commission");
        expect(fill("{a} and {b}", { a: 1 })).toBe("1 and {b}");
    });

    it("prefers the host's override, then its translator, then English; a translator miss falls through", () => {
        const say = makeSay({ upIncluded: "Incluído" }, (k) => (k === "upPaid" ? "Pago" : `misc.listingPage.${k}`));
        expect(say("upIncluded")).toBe("Incluído");
        expect(say("upPaid")).toBe("Pago");
        expect(say("upReceived")).toBe("Received");
    });
});
