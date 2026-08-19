import { describe, it, expect } from "vitest";
import {
    conversion, delta, recentWindows, daysUntil, isSellable, hasUnattributedViews, formatMoney,
} from "../overview/format";
import type { OverviewStats } from "../overview/types";

/**
 * The arithmetic behind the Overview tiles.
 *
 * Each case is one that would be WRONG ON SCREEN WITHOUT LOOKING WRONG: a rate
 * that divides by zero, a change measured against a period with no data, a
 * window that quietly includes a fifth week. None of these throw; they all just
 * render a confident number that is not true.
 */

const stats = (over: Partial<OverviewStats> = {}): OverviewStats => ({
    kind: "product",
    money: { net: 0, gross: 0, held: 0, due: 0, paid: 0, nextPayoutAt: null, currency: "EUR" },
    sold: 0,
    views: { total: 0, unattributed: 0 },
    weekly: [],
    listings: [],
    ...over,
});

describe("conversion", () => {
    it("is a percentage of views", () => {
        expect(conversion(6, 300)).toBeCloseTo(2);
    });

    /*
     * The one that matters. "0%" claims people looked and did not buy, which is
     * a different and more discouraging fact than "nobody has looked yet". A
     * new listing would have been told it converts at zero on its first day.
     */
    it("is null when nothing has been viewed, not zero", () => {
        expect(conversion(0, 0)).toBeNull();
        expect(conversion(3, 0)).toBeNull();
    });

    it("survives more sales than views without pretending that is normal", () => {
        // Possible: a purchase from a direct link records no community view.
        expect(conversion(2, 1)).toBe(200);
    });
});

describe("delta", () => {
    it("is the change against the previous window", () => {
        expect(delta(120, 100)).toBeCloseTo(20);
        expect(delta(80, 100)).toBeCloseTo(-20);
    });

    /*
     * A previous period of zero has no percentage change. "+100%" off a base of
     * nothing is not information and "+Infinity" is worse, so the tile shows
     * the raw number alone.
     */
    it("is null against a period with nothing in it", () => {
        expect(delta(41, 0)).toBeNull();
        expect(delta(0, 0)).toBeNull();
    });
});

describe("recentWindows", () => {
    const weekly = [
        { week: "2026-06-01", sold: 1, net: 100, views: 10 },
        { week: "2026-06-08", sold: 2, net: 200, views: 20 },
        { week: "2026-06-15", sold: 3, net: 300, views: 30 },
        { week: "2026-06-22", sold: 4, net: 400, views: 40 },
        { week: "2026-06-29", sold: 5, net: 500, views: 50 },
        { week: "2026-07-06", sold: 6, net: 600, views: 60 },
        { week: "2026-07-13", sold: 7, net: 700, views: 70 },
        { week: "2026-07-20", sold: 8, net: 800, views: 80 },
    ];

    it("reads the last four weeks and the four before them", () => {
        const { current, previous } = recentWindows(weekly, "sold", 4);
        expect(current).toBe(5 + 6 + 7 + 8);
        expect(previous).toBe(1 + 2 + 3 + 4);
    });

    /*
     * A short series must not let the two windows overlap: with five weeks of
     * data the "previous" window is one week, not four, and certainly not four
     * that include weeks already counted as current.
     */
    it("does not double-count when there is not enough history", () => {
        const short = weekly.slice(0, 5);
        const { current, previous } = recentWindows(short, "sold", 4);
        expect(current).toBe(2 + 3 + 4 + 5);
        expect(previous).toBe(1);
        expect(current + previous).toBe(short.reduce((n, w) => n + w.sold, 0));
    });

    it("is zero on both sides for an empty series", () => {
        expect(recentWindows([], "net")).toEqual({ current: 0, previous: 0 });
    });
});

describe("views that belong to no listing", () => {
    /*
     * The relationship the page must respect. Per-listing views summing to LESS
     * than the total is a fact, not a bug: purchaser views on a product and
     * every event view older than the community column belong to no listing.
     */
    it("flags when a total cannot be explained by the listings alone", () => {
        const s = stats({
            views: { total: 100, unattributed: 12 },
            listings: [{
                listingId: "l1", communityId: "c1", communityName: "PBN", communityTag: "pbn",
                status: "ACTIVE", commissionRate: 8, views: 88, sold: 4, gross: 2000, net: 1600,
            }],
        });
        expect(hasUnattributedViews(s)).toBe(true);
        const perListing = s.listings.reduce((n, l) => n + l.views, 0);
        expect(perListing + s.views.unattributed).toBe(s.views.total);
    });

    it("stays quiet when every view belongs somewhere", () => {
        expect(hasUnattributedViews(stats({ views: { total: 10, unattributed: 0 } }))).toBe(false);
    });
});

describe("can this be bought at all", () => {
    /*
     * The Overview's most consequential state. A product with listings that are
     * all PENDING or PAUSED reads as "listed" to a careless check and cannot be
     * bought by anybody.
     */
    it("is false when no listing is ACTIVE, however many exist", () => {
        const row = {
            listingId: "l", communityId: "c", communityName: "X", communityTag: "x",
            commissionRate: 8, views: 0, sold: 0, gross: 0, net: 0,
        };
        expect(isSellable(stats({ listings: [{ ...row, status: "PENDING" }] }))).toBe(false);
        expect(isSellable(stats({ listings: [{ ...row, status: "PAUSED" }] }))).toBe(false);
        expect(isSellable(stats({ listings: [] }))).toBe(false);
        expect(isSellable(stats({ listings: [{ ...row, status: "ACTIVE" }] }))).toBe(true);
    });
});

describe("daysUntil", () => {
    const now = new Date("2026-08-19T12:00:00Z");

    it("counts whole days to a future date", () => {
        expect(daysUntil("2026-08-22T12:00:00Z", now)).toBe(3);
    });

    it("is null for a date that has passed, so nothing renders a negative countdown", () => {
        expect(daysUntil("2026-08-18T12:00:00Z", now)).toBeNull();
    });

    it("is null for nothing and for nonsense", () => {
        expect(daysUntil(null, now)).toBeNull();
        expect(daysUntil("not a date", now)).toBeNull();
    });
});

describe("formatMoney", () => {
    it("reads cents and prints an amount", () => {
        expect(formatMoney(2472, "EUR")).toContain("24.72");
        expect(formatMoney(0, "EUR")).toContain("0.00");
    });
});
