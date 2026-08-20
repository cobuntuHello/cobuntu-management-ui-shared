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

/**
 * FOUR TILES, and the page must not grow a fifth.
 *
 * Conversion and the event countdown both used to have one. They were real
 * numbers, and they still lost: every extra ratio competed with the money for
 * the same glance, and the tile a seller opens this page for is what they
 * earned. Pinning the set here is what makes the next well-meaning addition
 * fail loudly instead of quietly crowding the row.
 *
 * The dropped figures are not lost -- the countdown is on the event's own
 * Details tab, and views over sold is a division the two tiles beside each
 * other already support.
 */
describe("the tiles are exactly four", () => {
    const TILES = ["Net earnings", "Gross earnings", "Total views", "Sales"];

    it("names the four, in the order money-first", () => {
        renderIt(stats({ sold: 60, views: { total: 1284, unattributed: 0 } }));
        for (const label of TILES) expect(screen.getByText(label)).toBeInTheDocument();
    });

    it("has no conversion tile", () => {
        renderIt(stats({ sold: 60, views: { total: 1284, unattributed: 0 } }));
        expect(screen.queryByText("Viewed to bought")).not.toBeInTheDocument();
        expect(screen.queryByText("4.7%")).not.toBeInTheDocument();
    });

    it("still splits earnings into held, due and paid under the first tile", () => {
        renderIt(stats({
            money: {
                net: 1236, gross: 1500, held: 412, due: 412, paid: 412,
                nextPayoutAt: new Date("2026-09-01").toISOString(), currency: "EUR",
            },
        }));
        expect(screen.getByText(/held/i)).toBeInTheDocument();
    });
});

describe("the event variant", () => {
    it("counts places rather than sales", () => {
        const soon = new Date(Date.now() + 3 * 86400000).toISOString();
        renderIt(
            stats({ kind: "event" }),
            { extras: { going: 6, capacity: 40, startsAt: soon } },
        );
        expect(screen.getByText("Going")).toBeInTheDocument();
        expect(screen.getByText("of 40 places")).toBeInTheDocument();
        // No countdown TILE: four tiles is the rule, and the start date is on
        // the event's own Details tab where it can say the actual date.
        expect(screen.queryByText("Starts in")).not.toBeInTheDocument();
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

/**
 * The community's face on the card.
 *
 * A seller carried by four communities scans logos, not names -- but plenty of
 * communities never set one, and a missing image must not shift the row or
 * render a broken <img>. Both paths draw the same 44px square.
 */
describe("a listing card wears the community's icon", () => {
    it("shows the icon when there is one", () => {
        const { container } = renderIt(stats({
            listings: [listing({ communityName: "Coimbra Connect", communityIcon: "https://cdn.example/cc.png" })],
        }));
        // Queried by tag, not by role: the icon carries alt="" and is therefore
        // presentational, which is right -- the community's name sits beside it
        // in text, and a screen reader announcing it twice helps nobody.
        const img = container.querySelector("img") as HTMLImageElement;
        expect(img).not.toBeNull();
        expect(img.src).toContain("cc.png");
    });

    it("falls back to the initial rather than a broken image", () => {
        renderIt(stats({ listings: [listing({ communityName: "Coimbra Connect", communityIcon: null })] }));
        expect(screen.getByText("C")).toBeInTheDocument();
        expect(document.querySelector("img")).toBeNull();
    });
});

/**
 * The chart refuses to draw a series that does not exist.
 *
 * The reported case: 76 views, nothing sold. The old chart drew a confident
 * earnings line flat along the floor, which reads as a measured result rather
 * than as no data -- and put the loudest mark on the page under the series the
 * seller had not asked about.
 */
describe("the trend when nothing has sold", () => {
    const traffic = [
        { week: "2026-07-06", sold: 0, net: 0, views: 31 },
        { week: "2026-07-13", sold: 0, net: 0, views: 45 },
    ];

    /*
      * Queried by the earnings colour, not by tag: views are drawn as a
      * polyline too, so "is there a polyline" stopped being the question the
      * moment the bars became an area.
      */
    const earningsLine = (c: HTMLElement) => c.querySelector("polyline.stroke-amber-700");

    it("draws no earnings line, and says why", () => {
        const { container } = renderIt(stats({ weekly: traffic, sold: 0 }));
        expect(earningsLine(container)).toBeNull();
        // The views series is still drawn -- that is the whole signal at this
        // stage, and an empty box would say less than the truth.
        expect(container.querySelector("polyline")).not.toBeNull();
        expect(screen.getByText(/Nothing has sold yet/)).toBeInTheDocument();
    });

    it("draws the earnings line as soon as a week earns", () => {
        const { container } = renderIt(stats({
            weekly: [...traffic, { week: "2026-07-20", sold: 2, net: 824, views: 60 }],
        }));
        expect(earningsLine(container)).not.toBeNull();
        expect(screen.queryByText(/Nothing has sold yet/)).not.toBeInTheDocument();
    });
});

/**
 * One community, and the page says so either way.
 *
 * This replaced a picker offering every community you belong to. The picker
 * implied an item could be carried in several places, which is not true -- and
 * a control that promises what the rule forbids is worse than no control, since
 * the refusal arrives after the click.
 */
describe("asking a community to carry it", () => {
    const requestOn = { name: "Coimbra Connect", onRequest: () => {} };

    it("offers this community, once, when nothing carries it", () => {
        renderIt(stats({ listings: [] }), { requestOn });
        expect(screen.getByText("Ask Coimbra Connect to carry it")).toBeInTheDocument();
    });

    it("states the limit instead, once something carries it", () => {
        renderIt(stats({ listings: [listing({ communityName: "Coimbra Connect" })] }), { requestOn });
        expect(screen.queryByText(/Ask Coimbra Connect/)).not.toBeInTheDocument();
        expect(screen.getByText(/carried by one community for now/)).toBeInTheDocument();
    });

    /*
     * A PAUSED or PENDING listing still occupies the slot -- the server counts
     * them -- so the page must not offer a second the API would refuse.
     */
    it.each(["PENDING", "PAUSED"])("counts a %s listing as carried", (status) => {
        renderIt(stats({ listings: [listing({ status })] }), { requestOn });
        expect(screen.queryByText(/Ask Coimbra Connect/)).not.toBeInTheDocument();
    });

    it("offers nothing when the host passes no community", () => {
        renderIt(stats({ listings: [] }));
        expect(screen.queryByText(/to carry it/)).not.toBeInTheDocument();
    });
});

/**
 * A listing row names WHOSE money each column is.
 *
 * It showed one net figure -- the seller's -- under a heading reading "your
 * net", and on a community's own admin page "you" is the community. A leader
 * read the seller's EUR 37.08 as their own on an event where they had earned
 * about three. Both numbers are wanted, for different reasons, and neither may
 * be readable as the other.
 */
describe("a listing row shows both sides", () => {
    it("labels the community's earnings and the seller's separately", () => {
        renderIt(stats({ listings: [listing({ net: 3708, communityNet: 331, gross: 4500 })] }));
        expect(screen.getByText("Community earned")).toBeInTheDocument();
        expect(screen.getByText("Seller keeps")).toBeInTheDocument();
        expect(screen.getByText("€3.31")).toBeInTheDocument();
        expect(screen.getByText("€37.08")).toBeInTheDocument();
    });

    /*
     * No column may be called "your" anything HERE. The same panel renders on
     * the seller's page and on the community's, and "your" is a different
     * person on each -- which is how the original wording came to be wrong on
     * exactly one of them.
     */
    it("says whose money it is rather than 'yours'", () => {
        const { container } = renderIt(stats({ listings: [listing({ net: 3708, communityNet: 331 })] }));
        const band = container.querySelector("dl");
        expect(band?.textContent?.toLowerCase()).not.toContain("your");
    });

    it("shows a zero community cut rather than hiding the column", () => {
        renderIt(stats({ listings: [listing({ net: 5000, communityNet: 0 })] }));
        // A self-run listing earned the community nothing, and saying so is
        // the answer -- an absent column would read as "not measured".
        expect(screen.getByText("Community earned")).toBeInTheDocument();
        expect(screen.getByText("€0.00")).toBeInTheDocument();
    });
});
