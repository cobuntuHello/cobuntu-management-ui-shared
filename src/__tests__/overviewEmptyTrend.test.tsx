import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { OverviewHero } from "../overview/OverviewHero";
import { EmptyTrend } from "../overview/EmptyTrend";
import { emptyTrendSpan } from "../overview/format";
import { defaultTranslate, LISTING_DETAIL_COPY } from "../listings/copy";

/**
 * The trend before there is one (fewer than two weeks of data): a ghost of
 * the chart, not a dashed box with a sentence. Seen on a new PBN listing on
 * 25 Nov 2026 ("A trend needs at least two weeks" in an empty frame).
 */

const t = (k: string, v?: Record<string, string | number>) => defaultTranslate(k, v);
const hero = (weekly: Array<{ week: string; views: number; sold: number; net: number }>) =>
    render(<OverviewHero label="You keep" value="€0.00" weekly={weekly as any} currency="EUR" locale="en-GB" t={t} />);

describe("the empty trend's axis", () => {
    // Wednesday 25 Nov 2026: its week starts Monday 23 Nov.
    const NOW = new Date("2026-11-25T15:00:00Z");

    it("spans the range picked, ending this week when there is no data", () => {
        expect(emptyTrendSpan([], "4", NOW)).toEqual({ from: "2026-11-02T00:00:00.000Z", to: "2026-11-23T00:00:00.000Z" });
        expect(emptyTrendSpan([], "11", NOW)).toEqual({ from: "2026-09-14T00:00:00.000Z", to: "2026-11-23T00:00:00.000Z" });
        // All time has no span yet: four weeks, like the shortest range.
        expect(emptyTrendSpan([], "all", NOW).from).toBe("2026-11-02T00:00:00.000Z");
    });

    it("ends at the latest week the series knows, as the range slicing counts", () => {
        expect(emptyTrendSpan([{ week: "2026-11-16T00:00:00.000Z" }], "4", NOW)).toEqual({ from: "2026-10-26T00:00:00.000Z", to: "2026-11-16T00:00:00.000Z" });
    });
});

describe("the empty trend", () => {
    it("is a ghost chart: the frame, three gridlines, the week labels and a message, and no data line", () => {
        const { container } = render(<EmptyTrend weekly={[]} range="4" locale="en-GB" t={t} now={new Date("2026-11-25T15:00:00Z")} />);
        expect(screen.getByText("No trend yet")).toBeTruthy();
        expect(screen.getByText("Views and earnings show here after two weeks.")).toBeTruthy();
        expect(container.querySelectorAll("svg line")).toHaveLength(3);
        // A flat line would read as a measured "nothing happened".
        expect(container.querySelector("polyline, path")).toBeNull();
        expect(screen.getByText("2 Nov")).toBeTruthy();
        expect(screen.getByText("23 Nov")).toBeTruthy();
    });

    it("stands in for the chart on a listing with under two weeks of data, and follows the range picked", () => {
        hero([{ week: "2026-11-16T00:00:00.000Z", views: 1, sold: 0, net: 0 }]);
        expect(screen.getByTestId("overview-empty-trend")).toBeTruthy();
        expect(screen.queryByText(/A trend needs at least two weeks/)).toBeNull();
        // The card opens on 11 weeks: 7 Sep to 16 Nov.
        expect(screen.getByText(/^7 Sept?$/)).toBeTruthy();
        expect(screen.getByText("16 Nov")).toBeTruthy();
        fireEvent.click(screen.getByRole("button", { name: defaultTranslate("overviewRange4") }));
        expect(screen.getByText("26 Oct")).toBeTruthy();
    });

    it("gives way to the real chart once there are two weeks", () => {
        hero([
            { week: "2026-11-09T00:00:00.000Z", views: 3, sold: 0, net: 0 },
            { week: "2026-11-16T00:00:00.000Z", views: 5, sold: 1, net: 2616 },
        ]);
        expect(screen.queryByTestId("overview-empty-trend")).toBeNull();
        expect(document.querySelector("polyline")).toBeTruthy();
    });

    it("drops the old sentence from the copy, so no host has to translate a string nothing renders", () => {
        expect(LISTING_DETAIL_COPY).not.toHaveProperty("overviewTrendTooEarly");
        expect(LISTING_DETAIL_COPY.overviewTrendEmptyTitle).toBe("No trend yet");
    });
});
