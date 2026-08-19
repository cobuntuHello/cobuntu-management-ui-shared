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
 * The shelf, per listing.
 *
 * There was a product-level Publish that flipped every paused listing at once:
 * it named none of the communities it changed, and on a product with no
 * listings it could only fail. Pausing was ALWAYS per-listing, so the two
 * halves of one act disagreed about what they operated on.
 *
 * The words are the ones the listing page has always used. A second vocabulary
 * for one act is how "Paused", "Off-shelf" and "Unpublished" end up on three
 * screens describing the same row.
 */
describe("taking a listing off the shelf", () => {
    it("offers the shelf action per listing, in the words the listing page uses", () => {
        const onShelfToggle = vi.fn();
        renderIt(stats(), { onShelfToggle });
        expect(screen.getByRole("button", { name: "Take off the shelf" })).toBeInTheDocument();
    });

    it("offers the way back for one that is off the shelf", () => {
        const onShelfToggle = vi.fn();
        renderIt(stats({ listings: [listing({ status: "PAUSED" })] }), { onShelfToggle });
        expect(screen.getByRole("button", { name: "Put back on the shelf" })).toBeInTheDocument();
    });

    it("names the listing and the state it is moving to", () => {
        const onShelfToggle = vi.fn();
        renderIt(stats(), { onShelfToggle });
        fireEvent.click(screen.getByRole("button", { name: "Take off the shelf" }));
        expect(onShelfToggle).toHaveBeenCalledWith(
            expect.objectContaining({ listingId: "l1" }),
            "PAUSED",
        );
    });

    /*
     * PENDING belongs to the community and CANCELLED/REVOKED are closed, so a
     * shelf control there would promise something the server refuses.
     */
    it("offers nothing for a state the seller does not own", () => {
        const onShelfToggle = vi.fn();
        for (const status of ["PENDING", "CANCELLED", "REVOKED"]) {
            const { unmount } = renderIt(stats({ listings: [listing({ status })] }), { onShelfToggle });
            expect(screen.queryByRole("button", { name: /shelf/ })).not.toBeInTheDocument();
            unmount();
        }
    });

    it("renders no control at all when the host does not offer one", () => {
        renderIt(stats());
        expect(screen.queryByRole("button", { name: /shelf/ })).not.toBeInTheDocument();
    });

    /* One act, one word. "Paused" was mine, and it was a second vocabulary. */
    it("calls the state off-shelf, as every other screen does", () => {
        renderIt(stats({ listings: [listing({ status: "PAUSED" })] }));
        expect(screen.getByText("Off-shelf")).toBeInTheDocument();
        expect(screen.queryByText("Paused")).not.toBeInTheDocument();
    });
});
