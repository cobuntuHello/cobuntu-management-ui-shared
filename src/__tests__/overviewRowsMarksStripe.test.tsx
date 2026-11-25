/**
 * Three Overview changes reported on 25 Nov 2026:
 *   - the whole listing row opens the listing, not only the button at its end;
 *   - "Where the money goes" draws each party's real mark (the owner, the
 *     community, Cobuntu, Stripe) instead of a bare coloured square;
 *   - with no Stripe account connected, a Connect Stripe button goes to the
 *     owner's setup (a person's item) or the community's (a community's item),
 *     shown only to the viewer who can connect it.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { ManageOverview } from "../overview/ManageOverview";
import { defaultTranslate } from "../listings/copy";
import type { OverviewStats } from "../overview/types";

const t = (k: string, v?: Record<string, string | number>) => defaultTranslate(k, v);

const listing = {
    listingId: "l1", communityId: "c1", communityName: "Finance Social Club", communityTag: "fsc",
    communityIcon: "https://img/fsc.png",
    status: "ACTIVE", commissionRate: 8, views: 100, sold: 3, gross: 3000, net: 2400, communityNet: 200,
    weekly: [{ week: "2026-11-16", sold: 3, net: 2400, views: 100 }],
};

const stats = (over: Partial<OverviewStats> = {}): OverviewStats => ({
    kind: "product",
    viewerRole: "owner",
    ownership: "member",
    owner: { kind: "user", name: "Thiago Vieira", imageUrl: "https://img/thiago.jpg" },
    destination: { scope: "user", connected: false, payoutsEnabled: false, bankBrand: null, last4: null, country: null, currency: null },
    money: {
        net: 2400, gross: 3000, held: 0, due: 0, paid: 0, nextPayoutAt: null, currency: "EUR",
        breakdown: { vat: 0, stripe: 120, cobuntu: 240, community: 240, net: 2400 },
    } as any,
    sold: 3,
    views: { total: 100, unattributed: 0 },
    weekly: [{ week: "2026-11-16", sold: 3, net: 2400, views: 100 }],
    listings: [listing as any],
    ...over,
} as OverviewStats);

const href = (l: { listingId: string }) => `/manage/listing/${l.listingId}`;

afterEach(() => cleanup());

describe("the listing row", () => {
    it("opens the listing from anywhere on the row, not only from its button", () => {
        const assign = vi.fn();
        const original = window.location;
        Object.defineProperty(window, "location", { configurable: true, value: { ...original, assign } });
        try {
            render(<ManageOverview stats={stats()} listingHref={href} t={t} />);
            const link = screen.getAllByRole("link", { name: "Manage listing" })[0];
            const row = link.closest("tr, li") as HTMLElement;
            fireEvent.click(row.querySelector("td, div") as HTMLElement);
            expect(assign).toHaveBeenCalledWith("/manage/listing/l1");
            expect(row.className).toMatch(/cursor-pointer/);
        } finally {
            Object.defineProperty(window, "location", { configurable: true, value: original });
        }
    });

    it("leaves a click on the link itself to the link", () => {
        const assign = vi.fn();
        const original = window.location;
        Object.defineProperty(window, "location", { configurable: true, value: { ...original, assign } });
        try {
            render(<ManageOverview stats={stats()} listingHref={href} t={t} />);
            fireEvent.click(screen.getAllByRole("link", { name: "Manage listing" })[0]);
            expect(assign).not.toHaveBeenCalled();
        } finally {
            Object.defineProperty(window, "location", { configurable: true, value: original });
        }
    });
});

describe("where the money goes, with the parties' marks", () => {
    it("draws the owner's photo, the community's icon, Cobuntu's mark and Stripe's", () => {
        const { container } = render(<ManageOverview stats={stats()} listingHref={href} t={t} />);
        const srcs = [...container.querySelectorAll("img")].map((i) => i.getAttribute("src"));
        expect(srcs).toContain("https://img/thiago.jpg");
        expect(srcs).toContain("https://img/fsc.png");
        expect(screen.getAllByRole("img", { name: "Stripe" }).length).toBeGreaterThan(0);
    });

    it("falls back to the avatar library for an owner with no photo", () => {
        const { container } = render(
            <ManageOverview stats={stats({ owner: { kind: "user", name: "Thiago Vieira", imageUrl: null } })} listingHref={href} t={t} />,
        );
        const srcs = [...container.querySelectorAll("img")].map((i) => i.getAttribute("src"));
        expect(srcs).toContain("https://api.cobuntu.com/api/avatars/cobuntu-campfire.svg");
    });
});

describe("Connect Stripe", () => {
    it("sends the owner of a person's item to their own setup", () => {
        const resolve = vi.fn((scope: "user" | "community") => (scope === "user" ? "/my-payouts/onboard" : "/fsc/connect-stripe"));
        render(<ManageOverview stats={stats()} listingHref={href} t={t} connectStripeHref={resolve} />);
        expect(screen.getByRole("link", { name: /Connect Stripe/ })).toHaveAttribute("href", "/my-payouts/onboard");
        expect(resolve).toHaveBeenCalledWith("user");
    });

    it("sends a leader of a community's item to the community's setup", () => {
        const resolve = (scope: "user" | "community") => (scope === "community" ? "/fsc/connect-stripe" : null);
        render(
            <ManageOverview
                stats={stats({
                    viewerRole: "community-leader",
                    ownership: "community",
                    owner: { kind: "community", name: "Finance Social Club", imageUrl: null },
                    destination: { scope: "community", connected: false, payoutsEnabled: false, bankBrand: null, last4: null, country: null, currency: null },
                })}
                listingHref={href}
                t={t}
                connectStripeHref={resolve}
            />,
        );
        expect(screen.getByRole("link", { name: /Connect Stripe/ })).toHaveAttribute("href", "/fsc/connect-stripe");
    });

    it("is not offered to a co-host, who cannot connect the owner's account", () => {
        render(<ManageOverview stats={stats({ viewerRole: "co-owner" })} listingHref={href} t={t} connectStripeHref={() => "/my-payouts/onboard"} />);
        expect(screen.getByText("No Stripe account connected yet")).toBeInTheDocument();
        expect(screen.queryByRole("link", { name: /Connect Stripe/ })).toBeNull();
    });

    it("is gone once an account is connected", () => {
        render(
            <ManageOverview
                stats={stats({ destination: { scope: "user", connected: true, payoutsEnabled: true, bankBrand: "Revolut", last4: "1234", country: "PT", currency: "eur" } })}
                listingHref={href}
                t={t}
                connectStripeHref={() => "/my-payouts/onboard"}
            />,
        );
        expect(screen.queryByRole("link", { name: /Connect Stripe/ })).toBeNull();
    });
});
