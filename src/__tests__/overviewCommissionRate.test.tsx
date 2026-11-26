/**
 * The commission says the rate that was agreed (26 Nov 2026).
 *
 * "Food for Thought #1": PBN at 8% beside the host's own Impact Hub Porto at
 * 0%, 10 tickets, €339.48 taken with €63.48 VAT (23%). Every ticket was charged
 * 8% of its price before VAT (€22.08 = 8% of €276.00). The card showed
 * "Community commission · 6.5%", the commission's share of the VAT-inclusive
 * total, and PBN's Art read it as the agreed 8% having changed.
 *
 * What each test pins is a way the card could say the wrong number again.
 */
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { ManageOverview } from "../overview/ManageOverview";
import { defaultTranslate } from "../listings/copy";
import type { OverviewStats } from "../overview/types";

const t = (k: string, v?: Record<string, string | number>) => defaultTranslate(k, v);

const listing = (over: Record<string, unknown>) => ({
    listingId: "l-pbn", communityId: "c-pbn", communityName: "PBN", communityTag: "pbn", communityIcon: null,
    status: "ACTIVE", commissionRate: 8, views: 1127, sold: 10, gross: 33948, net: 30165, communityNet: 2096,
    weekly: [], ...over,
});

const foodForThought = (over: Partial<OverviewStats> = {}): OverviewStats => ({
    kind: "event",
    viewerRole: "owner",
    ownership: "member",
    owner: { kind: "user", name: "Ana", imageUrl: null },
    destination: { scope: "user", connected: true, payoutsEnabled: true, bankBrand: null, last4: "4242", country: "PT", currency: "EUR" },
    money: {
        net: 30165, gross: 33948, held: 0, due: 0, paid: 0, nextPayoutAt: null, currency: "EUR",
        breakdown: { vat: 6348, stripe: 943, cobuntu: 632, community: 2208, net: 30165 },
    } as any,
    rates: { cobuntuPct: null, communityPct: 8 },
    sold: 10,
    views: { total: 1170, unattributed: 0 },
    weekly: [],
    listings: [
        listing({}) as any,
        listing({ listingId: "l-ih", communityId: "c-ih", communityName: "Impact Hub Porto", communityTag: "ihp", commissionRate: 0, views: 43, sold: 0, gross: 0, net: 0, communityNet: 0 }) as any,
    ],
    ...over,
} as OverviewStats);

/** The commission's row in "Where the money goes", found by its label. */
const commissionLine = (label = "PBN’s commission") =>
    screen.getByText(label).closest("div.flex.items-center") as HTMLElement;

afterEach(() => cleanup());

describe("the commission line on the owner's card", () => {
    it("names PBN, the one community charging, beside a listing at 0%", () => {
        render(<ManageOverview stats={foodForThought()} listingHref={() => "#"} t={t} />);
        expect(screen.getByText("PBN’s commission")).toBeTruthy();
        expect(screen.queryByText("Community commission")).toBeNull();
    });

    it("says the agreed 8%, of the price before VAT, never its 6.5% share of the VAT-inclusive total", () => {
        render(<ManageOverview stats={foodForThought()} listingHref={() => "#"} t={t} />);
        const line = commissionLine();
        expect(line.textContent).toContain("8% of the price before VAT");
        expect(line.textContent).toMatch(/8%$/);
        expect(line.textContent).not.toContain("6.5%");
    });

    it("says what it gained on each ticket: the average over the 10 sold", () => {
        render(<ManageOverview stats={foodForThought()} listingHref={() => "#"} t={t} />);
        expect(commissionLine().textContent).toMatch(/2\.21 a ticket on average/);
    });

    it("keeps the share for the other lines: they have no rate of their own here", () => {
        render(<ManageOverview stats={foodForThought()} listingHref={() => "#"} t={t} />);
        // You keep €301.65 of €339.48 = 89%.
        expect(screen.getAllByText("89%").length).toBeGreaterThan(0);
    });

    it("falls back to the share when no single rate can be named (two listings charging)", () => {
        render(<ManageOverview stats={foodForThought({
            rates: { cobuntuPct: null, communityPct: null },
            listings: [listing({}) as any, listing({ listingId: "l-x", communityId: "c-x", communityName: "Other", commissionRate: 5 }) as any],
        })} listingHref={() => "#"} t={t} />);
        expect(commissionLine("Community commission").textContent).toContain("6.5%");
    });
});
