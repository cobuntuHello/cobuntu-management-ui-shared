import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ManageOverview } from "../overview/ManageOverview";
import { defaultTranslate } from "../listings/copy";
import type { OverviewStats } from "../overview/types";

/**
 * The Overview tab.
 *
 * Two rules carry this page, and both are things a dashboard gets wrong by
 * being reasonable:
 *
 * 1. MONEY IS NOT ONE NUMBER. Held is not spendable and paid is already gone.
 *    A single "earnings" figure invites a seller to expect a transfer that has
 *    not happened — six ticket sales produced exactly that, EUR 24.72 earned
 *    and EUR 0 received, with no screen saying so.
 *
 * 2. ZEROES MEAN TWO DIFFERENT THINGS. "Nobody bought it" and "nobody COULD
 *    buy it" look identical on a dashboard, and only one of them is the
 *    seller's fault.
 */

const t = (k: string, v?: Record<string, string | number>) => defaultTranslate(k, v);

const listing = (over: Partial<OverviewStats["listings"][0]> = {}) => ({
    listingId: "l1", communityId: "c1", communityName: "Porto Business Network",
    communityTag: "pbn", status: "ACTIVE", commissionRate: 8,
    views: 861, sold: 41, gross: 20500, net: 16892,
    ...over,
});

const stats = (over: Partial<OverviewStats> = {}): OverviewStats => ({
    kind: "product",
    money: { net: 24720, gross: 30000, held: 15340, due: 5680, paid: 3700, nextPayoutAt: null, currency: "EUR" },
    sold: 60,
    views: { total: 1284, unattributed: 0 },
    weekly: [],
    listings: [listing()],
    ...over,
});

const renderIt = (s: OverviewStats, over: Record<string, unknown> = {}) =>
    render(<ManageOverview stats={s} listingHref={() => "#"} t={t} {...over} />);

describe("money is shown as what it actually is", () => {
    it("splits earnings into held, due and paid rather than one figure", () => {
        renderIt(stats());
        expect(screen.getByText("€153.40 held")).toBeInTheDocument();
        expect(screen.getByText("€56.80 due")).toBeInTheDocument();
        expect(screen.getByText("€37.00 paid")).toBeInTheDocument();
    });

    /*
     * The Build Room case exactly: everything earned, nothing received. The
     * page must not let that read as money in hand.
     */
    it("names the date held money is released", () => {
        renderIt(stats({
            money: {
                net: 2472, gross: 3000, held: 2472, due: 0, paid: 0,
                nextPayoutAt: "2026-08-22T00:00:00.000Z", currency: "EUR",
            },
        }));
        expect(screen.getByText(/€24\.72 held/)).toBeInTheDocument();
        expect(screen.getByText(/22 Aug/)).toBeInTheDocument();
    });

    it("says nothing is earned rather than showing a bare zero", () => {
        renderIt(stats({
            money: { net: 0, gross: 0, held: 0, due: 0, paid: 0, nextPayoutAt: null, currency: "EUR" },
        }));
        expect(screen.getByText("Nothing earned yet")).toBeInTheDocument();
    });
});

describe("whether it can be sold at all", () => {
    /*
     * The most consequential state on the page, and the one a dashboard hides:
     * every tile reads zero and looks like a demand problem.
     */
    it("leads with the fact when there is no listing anywhere", () => {
        renderIt(stats({ listings: [], sold: 0, views: { total: 0, unattributed: 0 } }));
        expect(screen.getByText("Nobody can buy this yet")).toBeInTheDocument();
        expect(screen.getByText(/not on any community's shelf/)).toBeInTheDocument();
    });

    it("says so too when listings exist but none is live", () => {
        renderIt(stats({ listings: [listing({ status: "PENDING" })] }));
        expect(screen.getByText("Nobody can buy this yet")).toBeInTheDocument();
        // "off the shelf", not "paused": one act, one word, across every screen.
        expect(screen.getByText(/off the shelf or still under review/)).toBeInTheDocument();
    });

    it("stays quiet when something is live", () => {
        renderIt(stats());
        expect(screen.queryByText("Nobody can buy this yet")).not.toBeInTheDocument();
    });

    it("uses the event's own words", () => {
        renderIt(stats({ kind: "event", listings: [] }));
        expect(screen.getByText("Nobody can get a ticket yet")).toBeInTheDocument();
    });
});

describe("one section per community", () => {
    it("shows each listing's own numbers", () => {
        renderIt(stats({
            listings: [
                listing(),
                listing({ listingId: "l2", communityId: "c2", communityName: "Cobuntu", commissionRate: 5, views: 423, sold: 19, gross: 9500, net: 7828 }),
            ],
        }));
        expect(screen.getByText("Porto Business Network")).toBeInTheDocument();
        expect(screen.getByText("Cobuntu")).toBeInTheDocument();
        expect(screen.getByText("8% commission")).toBeInTheDocument();
        expect(screen.getByText("5% commission")).toBeInTheDocument();
        expect(screen.getByText("€168.92")).toBeInTheDocument();
        expect(screen.getByText("€78.28")).toBeInTheDocument();
    });

    /*
     * A listing that cannot sell shows no numbers. Four zeroes would read as
     * "nobody bought it here", where the truth is that nobody could.
     */
    it("gives a listing under review words instead of zeroes", () => {
        renderIt(stats({ listings: [listing({ status: "PENDING", views: 0, sold: 0, gross: 0, net: 0 })] }));
        expect(screen.getByText(/Waiting on the community/)).toBeInTheDocument();
        expect(screen.getByText("In review")).toBeInTheDocument();
    });
});

describe("views that belong to no listing", () => {
    /*
     * Per-listing views summing to less than the total is a FACT: purchaser
     * views on a product, and every event view older than the community column.
     * Unexplained, it reads as a bug to anyone who adds up.
     */
    it("explains the difference rather than leaving it to be noticed", () => {
        renderIt(stats({ views: { total: 1284, unattributed: 42 } }));
        expect(screen.getByText(/42 views are not counted against any community/)).toBeInTheDocument();
    });

    it("says nothing when every view belongs somewhere", () => {
        renderIt(stats());
        expect(screen.queryByText(/not counted against any community/)).not.toBeInTheDocument();
    });
});

describe("the conversion tile", () => {
    it("shows a dash, not 0%, before anyone has looked", () => {
        renderIt(stats({ sold: 0, views: { total: 0, unattributed: 0 } }));
        expect(screen.getByText("—")).toBeInTheDocument();
        expect(screen.getByText("Nobody has looked yet")).toBeInTheDocument();
    });

    it("shows the rate once there are views", () => {
        renderIt(stats({ sold: 60, views: { total: 1284, unattributed: 0 } }));
        expect(screen.getByText("4.7%")).toBeInTheDocument();
    });
});

describe("the event variant", () => {
    it("counts places rather than sales, and how long until it starts", () => {
        const soon = new Date(Date.now() + 3 * 86400000).toISOString();
        renderIt(
            stats({ kind: "event" }),
            { extras: { going: 6, capacity: 40, startsAt: soon } },
        );
        expect(screen.getByText("Going")).toBeInTheDocument();
        expect(screen.getByText("of 40 places")).toBeInTheDocument();
        expect(screen.getByText("Starts in")).toBeInTheDocument();
        expect(screen.getByText("3d")).toBeInTheDocument();
    });

    it("drops the countdown for an event that has already run", () => {
        renderIt(
            stats({ kind: "event" }),
            { extras: { going: 6, capacity: 40, startsAt: "2020-01-01T00:00:00.000Z" } },
        );
        expect(screen.queryByText("Starts in")).not.toBeInTheDocument();
    });
});

/**
 * The shelf is NOT on the row.
 *
 * It briefly was. It belongs on the listing's own page, where the state, the
 * terms and the consequences are on screen together -- on a summary row it is
 * one press away from taking a live listing down, beside numbers that give no
 * context for the decision.
 */
describe("the shelf control", () => {
    it("is not offered on a listing row", () => {
        renderIt(stats());
        expect(screen.queryByRole("button", { name: /shelf/i })).not.toBeInTheDocument();
    });

    it("is not offered for an off-shelf listing either", () => {
        renderIt(stats({ listings: [listing({ status: "PAUSED" })] }));
        expect(screen.queryByRole("button", { name: /shelf/i })).not.toBeInTheDocument();
    });

    /* One act, one word. "Paused" was mine, and it was a second vocabulary. */
    it("calls the state off-shelf, as every other screen does", () => {
        renderIt(stats({ listings: [listing({ status: "PAUSED" })] }));
        expect(screen.getByText("Off-shelf")).toBeInTheDocument();
        expect(screen.queryByText("Paused")).not.toBeInTheDocument();
    });
});

/**
 * What a listing row has to say beyond its numbers.
 *
 * A rate alone is not an agreement. "10%" is a number; "PBN-promoted · 10% ·
 * agreed 4 Jul 2026" is a deal with a name, terms and a date -- which is what
 * lets a seller compare two communities carrying the same thing.
 */
describe("the agreement on a listing row", () => {
    it("names the package, the rate and when it was agreed", () => {
        renderIt(stats({
            listings: [listing({
                packageName: "PBN-promoted",
                approvedAt: "2026-07-04T10:00:00.000Z",
                requestedAt: "2026-07-01T10:00:00.000Z",
            })],
        }));
        const line = screen.getByText(/PBN-promoted/);
        expect(line).toHaveTextContent("8% commission");
        expect(line).toHaveTextContent("agreed 4 Jul 2026");
    });

    /*
     * Rows approved before the column existed have no date, and inventing one
     * would put a wrong date under something that reads as a record. The
     * requested date is true, so it stands in.
     */
    it("falls back to the requested date when there is no approval date", () => {
        renderIt(stats({
            listings: [listing({ packageName: null, approvedAt: null, requestedAt: "2026-07-01T10:00:00.000Z" })],
        }));
        expect(screen.getByText(/asked 1 Jul 2026/)).toBeInTheDocument();
    });

    it("drops what it does not know rather than printing a dash", () => {
        renderIt(stats({
            listings: [listing({ packageName: null, commissionRate: null, approvedAt: null, requestedAt: null })],
        }));
        expect(screen.queryByText(/·\s*·/)).not.toBeInTheDocument();
    });

    /*
     * A named button, not a giant link. The row carries four figures and three
     * facts; making all of it one click target navigates a reader away by
     * accident and leaves no room for a second action.
     */
    it("offers a named way in rather than making the whole row a link", () => {
        renderIt(stats());
        expect(screen.getByRole("link", { name: "Manage listing" })).toBeInTheDocument();
    });
});

describe("the trend chart", () => {
    const weeks = (n: number) =>
        Array.from({ length: n }, (_, i) => ({
            week: `2026-06-${String(i + 1).padStart(2, "0")}`,
            sold: i, net: i * 100, views: i * 10,
        }));

    it("draws once there are at least two weeks", () => {
        renderIt(stats({ weekly: weeks(6) }));
        expect(screen.getByRole("img", { name: /Weekly earnings and views/ })).toBeInTheDocument();
    });

    /*
     * One point is not a trend. A chart with a single dot invites a reading
     * ("flat", "starting") the data cannot support, so below two weeks the
     * tiles carry the numbers alone.
     */
    it("draws nothing for a single week, or none", () => {
        renderIt(stats({ weekly: weeks(1) }));
        expect(screen.queryByRole("img", { name: /Weekly earnings/ })).not.toBeInTheDocument();
        renderIt(stats({ weekly: [] }));
        expect(screen.queryByRole("img", { name: /Weekly earnings/ })).not.toBeInTheDocument();
    });
});
