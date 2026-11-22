import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { ManageOverview } from "../overview/ManageOverview";
import { defaultTranslate } from "../listings/copy";
import { sliceRange, sortListings, rollupOthers, countByStatus } from "../overview/format";
import type { OverviewStats } from "../overview/types";

/**
 * The redesigned Overview: who is looking, what the hero says, and how the
 * per-community section behaves from one community up to ten.
 */

const t = (k: string, v?: Record<string, string | number>) => defaultTranslate(k, v);

const listing = (i: number, over: Partial<OverviewStats["listings"][0]> = {}) => ({
    listingId: `l${i}`, communityId: `c${i}`, communityName: `Community ${i}`, communityTag: `c${i}`,
    status: "ACTIVE", commissionRate: 8, views: 100 * (10 - i), sold: 10 - i, gross: 10000 * (10 - i),
    net: 8000 * (10 - i), communityNet: 500 * (10 - i),
    weekly: [{ week: "2026-10-26", sold: 1, net: 100, views: 10 }, { week: "2026-11-02", sold: 2, net: 200, views: 20 }],
    ...over,
});

const stats = (over: Partial<OverviewStats> = {}): OverviewStats => ({
    kind: "event",
    viewerRole: "owner",
    money: { net: 128400, gross: 164000, held: 41200, due: 22000, paid: 65200, nextPayoutAt: null, currency: "EUR" },
    sold: 31,
    views: { total: 1284, unattributed: 0 },
    weekly: [{ week: "2026-10-26", sold: 4, net: 40000, views: 40 }, { week: "2026-11-02", sold: 6, net: 60000, views: 63 }],
    listings: [listing(1), listing(2)],
    ...over,
});

const renderIt = (s: OverviewStats, over: Record<string, unknown> = {}) =>
    render(<ManageOverview stats={s} listingHref={() => "#"} t={t} {...over} />);

describe("the page says who is looking", () => {
    it.each([
        ["owner", "Owned by you", "You manage it"],
        ["community-leader", "Owned by this community", "You manage it as a leader"],
        ["carrier", "Carried by your community", "You moderate the listing"],
    ] as const)("names a %s", (role, who, what) => {
        renderIt(stats({ viewerRole: role }));
        expect(screen.getByText(who)).toBeInTheDocument();
        expect(screen.getByText(what)).toBeInTheDocument();
    });

    it("names a co-host and staff without claiming an owner", () => {
        const { unmount } = renderIt(stats({ viewerRole: "co-owner" }));
        expect(screen.getByText("You manage it as a co-host")).toBeInTheDocument();
        expect(screen.queryByText("Owned by you")).not.toBeInTheDocument();
        unmount();
        renderIt(stats({ viewerRole: "admin" }));
        expect(screen.getByText("Viewing as Cobuntu staff")).toBeInTheDocument();
    });

    it("names nobody when the backend did not say", () => {
        renderIt(stats({ viewerRole: undefined }));
        expect(screen.queryByText("Owned by you")).not.toBeInTheDocument();
        expect(screen.getByText("Net earnings")).toBeInTheDocument();
    });
});

describe("the hero is named for whose money it is", () => {
    it("an owner keeps, a co-host sees what the owner keeps", () => {
        const { unmount } = renderIt(stats({ viewerRole: "owner" }));
        expect(screen.getAllByText("You keep").length).toBeGreaterThan(0);
        expect(screen.getByText("€1,284.00")).toBeInTheDocument();
        unmount();
        renderIt(stats({ viewerRole: "co-owner" }));
        expect(screen.getByText("The owner keeps")).toBeInTheDocument();
        // The listing column says whose money it is too, not "You keep".
        expect(within(screen.getByRole("table")).getByText("Seller keeps")).toBeInTheDocument();
    });

    it("a carrier sees what THEIR community earned, never the seller's net or fees", () => {
        renderIt(stats({
            viewerRole: "carrier",
            ownership: "member",
            listings: [listing(1, { communityNet: 11808 })],
        }));
        expect(screen.getAllByText("Your community earned").length).toBeGreaterThan(0);
        expect(screen.getAllByText("€118.08").length).toBeGreaterThan(0);
        // The seller's held/due/paid and fee split are not the carrier's business.
        expect(screen.queryByText(/held/)).not.toBeInTheDocument();
    });
});

describe("nothing to buy yet", () => {
    const empty = (over: Partial<OverviewStats> = {}) => stats({ listings: [], everPublished: false, sold: 0, ...over });

    it("offers Publish to an event that was never published", () => {
        const onPublish = vi.fn();
        renderIt(empty(), { onPublish });
        fireEvent.click(screen.getByRole("button", { name: "Publish to a community" }));
        expect(onPublish).toHaveBeenCalledTimes(1);
    });

    it("does not offer Publish to an event that was published and came down", () => {
        renderIt(empty({ everPublished: true, listings: [listing(1, { status: "PAUSED" })] }), { onPublish: vi.fn() });
        expect(screen.queryByRole("button", { name: "Publish to a community" })).not.toBeInTheDocument();
    });

    it("does not offer Publish on a product, which has no publish step", () => {
        renderIt(empty({ kind: "product", everPublished: undefined }), { onPublish: vi.fn() });
        expect(screen.queryByRole("button", { name: "Publish to a community" })).not.toBeInTheDocument();
    });
});

describe("courses and products", () => {
    it("a course reads Students where a product reads Sales", () => {
        const { unmount } = renderIt(stats({ kind: "product" }), { itemType: "course" });
        expect(screen.getByText("Students")).toBeInTheDocument();
        unmount();
        renderIt(stats({ kind: "product" }));
        expect(screen.getByText("Sales")).toBeInTheDocument();
        expect(screen.queryByText("Students")).not.toBeInTheDocument();
    });
});

describe("one to three communities stay a plain list", () => {
    it("shows no picker, sort or summary, and no heading", () => {
        renderIt(stats());
        expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
        expect(screen.queryByText(/^\d+ communities$/)).not.toBeInTheDocument();
    });
});

describe("ten communities", () => {
    const ten = () => stats({ listings: Array.from({ length: 10 }, (_, i) => listing(i + 1)) });

    it("summarises, shows the top five and folds the rest", () => {
        renderIt(ten());
        const table = within(screen.getByRole("table"));
        expect(screen.getByText("10 communities")).toBeInTheDocument();
        expect(table.getByText("Community 1")).toBeInTheDocument();
        expect(table.getByText("Community 5")).toBeInTheDocument();
        expect(table.queryByText("Community 6")).not.toBeInTheDocument();
        expect(screen.getByText("Others (5)")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Show all 10 communities" })).toBeInTheDocument();
    });

    it("shows every community once expanded, and can fold again", () => {
        renderIt(ten());
        fireEvent.click(screen.getByRole("button", { name: "Show all 10 communities" }));
        expect(within(screen.getByRole("table")).getByText("Community 10")).toBeInTheDocument();
        expect(screen.queryByText("Others (5)")).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Show fewer" }));
        expect(within(screen.getByRole("table")).queryByText("Community 10")).not.toBeInTheDocument();
    });

    it("picking one community rescopes the whole page to it", () => {
        renderIt(ten());
        const picker = screen.getByRole("combobox", { name: "All communities" });
        fireEvent.change(picker, { target: { value: "l3" } });
        // Community 3: 7 sold, 700 views. The hero is its net, not the item's.
        expect(screen.getAllByText("€560.00").length).toBeGreaterThan(0);
        expect(screen.queryByText("€1,284.00")).not.toBeInTheDocument();
        // Whole-item figures step aside rather than sit under a one-community view.
        expect(screen.queryByText(/held/)).not.toBeInTheDocument();
        expect(within(screen.getByRole("table")).queryByText("Community 1")).not.toBeInTheDocument();
    });

    it("sorts by the chosen measure", () => {
        renderIt(ten(), {});
        fireEvent.change(screen.getByRole("combobox", { name: "Sort by" }), { target: { value: "views" } });
        const rows = screen.getAllByRole("row").slice(1, 3);
        expect(within(rows[0]).getByText("Community 1")).toBeInTheDocument();
    });
});

describe("a listing that cannot sell shows its state, not figures", () => {
    it("says why in words", () => {
        renderIt(stats({ listings: [listing(1), listing(2, { status: "PENDING", sold: 0, views: 0, gross: 0, net: 0 })] }));
        expect(screen.getByText(/Waiting on the community/)).toBeInTheDocument();
    });
});

describe("the stacked chart", () => {
    it("draws the top three and folds the rest into 'others'", () => {
        renderIt(stats({ listings: Array.from({ length: 6 }, (_, i) => listing(i + 1)) }));
        expect(screen.getByText("Sold per week, by community")).toBeInTheDocument();
        expect(screen.getByText("3 others")).toBeInTheDocument();
    });

    it("is not drawn for one community, or when a backend sends no series", () => {
        renderIt(stats({ listings: [listing(1)] }));
        expect(screen.queryByText("Sold per week, by community")).not.toBeInTheDocument();
    });
});

describe("the range control", () => {
    const weekly = (n: number) => Array.from({ length: n }, (_, i) => ({
        week: new Date(Date.UTC(2026, 0, 5 + i * 7)).toISOString().slice(0, 10), sold: 1, net: 100, views: 10,
    }));

    it("slices to the last 4 or 11 weeks, counted from the latest week", () => {
        const w = weekly(20);
        expect(sliceRange(w, "4")).toHaveLength(4);
        expect(sliceRange(w, "11")).toHaveLength(11);
        expect(sliceRange(w, "all")).toHaveLength(20);
        expect(sliceRange(w, "4")[3]).toEqual(w[19]);
    });

    it("counts a quiet gap as weeks, not as nothing", () => {
        const w = [weekly(20)[0], weekly(20)[18], weekly(20)[19]];
        expect(sliceRange(w, "4")).toHaveLength(2);
    });

    it("switches range from the buttons", () => {
        renderIt(stats({ weekly: weekly(20) }));
        const four = screen.getByRole("button", { name: "4 weeks" });
        expect(screen.getByRole("button", { name: "11 weeks" })).toHaveAttribute("aria-pressed", "true");
        fireEvent.click(four);
        expect(four).toHaveAttribute("aria-pressed", "true");
    });
});

describe("the list helpers", () => {
    const rows = [
        { sold: 5, views: 100, net: 10, gross: 50, status: "ACTIVE" },
        { sold: 9, views: 900, net: 30, gross: 90, status: "ACTIVE" },
        { sold: 5, views: 50, net: 20, gross: 60, status: "PENDING" },
    ];
    it("sorts descending and keeps ties in order", () => {
        expect(sortListings(rows, "sold").map((r) => r.sold)).toEqual([9, 5, 5]);
        expect(sortListings(rows, "sold")[1]).toBe(rows[0]);
        expect(sortListings(rows, "keep").map((r) => r.net)).toEqual([30, 20, 10]);
        // Converts: 5/50 beats 5/100; a row with no views ranks last, not first.
        expect(sortListings([...rows, { sold: 0, views: 0, net: 0, gross: 0, status: "ACTIVE" }], "converts")[3].views).toBe(0);
    });
    it("rolls the rest into one row of totals", () => {
        expect(rollupOthers(rows)).toEqual({ sold: 19, views: 1050, gross: 200, net: 60, count: 3 });
    });
    it("counts statuses", () => {
        expect(countByStatus(rows)).toEqual([{ status: "ACTIVE", count: 2 }, { status: "PENDING", count: 1 }]);
    });
});
