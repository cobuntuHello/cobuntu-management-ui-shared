/**
 * The seller changes the package on their own listing (T-415; canvas
 * 8YTrdyqmNdkKECpACpdd7c, page "Change package"), with the real case: PBN's
 * Thiago is on Champion's 0% package and wants PBN to promote it (10%).
 *
 *   - the bar and the terms card offer Change package, only to the seller, only
 *     with another package to move to, only where the host can do it;
 *   - the sheet: one card per package (what PBN does, what you keep, which one
 *     you are on), the chart follows the pick, Switch moves it;
 *   - a live listing asks first: it comes off PBN's marketplace until PBN approves.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, within, cleanup } from "@testing-library/react";
import { ListingPageV2 } from "../listings/v2/ListingPageV2";
import { packagePoints } from "../listings/v2/packagePoints";
import type { ListingTransport } from "../listings/v2/transport";
import type { ListingMoney, MoneyLine } from "../listings/v2/types";

const LISTING_PKG = { id: "pkg0", name: "Champion listing", description: "Champions list with no commission. You run it yourself.", rate: 0 };
const PROMOTED = { id: "pkg10", name: "Champion promoted", description: "- In PBN's newsletter and feed\n- Top placement in the marketplace\n- You deliver it and answer buyers", rate: 10 };

const SELLER_AT: Record<string, MoneyLine[]> = {
    pkg0: [{ key: "price", amount: 399700 }, { key: "stripe", amount: 6026 }, { key: "commission", amount: 0 }, { key: "cobuntu", amount: 9998 }, { key: "keep", amount: 383676 }],
    pkg10: [{ key: "price", amount: 399700 }, { key: "stripe", amount: 6026 }, { key: "commission", amount: 39970 }, { key: "cobuntu", amount: 8998 }, { key: "keep", amount: 344706 }],
};

function moneyOn(packageId: string, preview: boolean): ListingMoney {
    const lines = SELLER_AT[packageId];
    const rate = packageId === "pkg10" ? 10 : 0;
    return {
        kind: "product", listingId: "lst", seat: "seller", status: "PENDING", live: false, currency: "USD",
        oneSale: { gross: 399700, vat: 0, commissionRate: rate, rateSource: "agreed", platformFeeRate: 0.05, memberSale: true, sellerPremium: false, lines },
        soldSoFar: null, upfront: null, result: null, prices: [], donation: null,
        rates: { cobuntuPct: 5, stream: "products", commissionPct: rate, commissionSource: "agreed", ownedByListingCommunity: false, sellerFeePct: 2.5, sellerFeeFixed: 5 },
        previewPackage: preview ? { id: packageId, name: packageId === "pkg10" ? PROMOTED.name : LISTING_PKG.name } : null,
    } as unknown as ListingMoney;
}

function transport(opts: { status?: string; packages?: typeof LISTING_PKG[]; switchable?: boolean } = {}) {
    const t: ListingTransport & Record<string, any> = {
        listing: vi.fn(async () => ({
            id: "lst", status: opts.status ?? "PENDING", isHidden: false, commissionRate: 0, createdAt: "2026-11-17T13:25:00Z",
            approvedAt: opts.status === "ACTIVE" ? "2026-11-20T10:00:00Z" : null,
            package: { id: "pkg0", name: "Champion listing", rate: 0 },
            community: { id: "pbn", name: "PBN", communityTag: "pbn", iconUrl: "https://img/pbn.png" },
            requestedBy: { id: "thiago", name: "Thiago Vieira", usertag: "thiago-vieira", profileImage: null },
            products: { id: "p1", name: "Immersion to Austin Texas", ownerId: "thiago", communityId: null, owner: { id: "thiago", name: "Thiago Vieira" } },
        })),
        proposals: vi.fn(async () => []),
        topics: vi.fn(async () => []),
        money: vi.fn(async (o?: { packageId?: string }) => moneyOn(o?.packageId ?? "pkg0", !!o?.packageId)),
        packages: vi.fn(async () => opts.packages ?? [LISTING_PKG, PROMOTED]),
        setStatus: vi.fn(async () => {}),
        setHidden: vi.fn(async () => {}),
        propose: vi.fn(async () => {}),
        respond: vi.fn(async () => {}),
        openTopic: vi.fn(async () => {}),
        comment: vi.fn(async () => {}),
        setTopicDone: vi.fn(async () => {}),
    };
    if (opts.switchable !== false) t.switchPackage = vi.fn(async () => ({ status: "PENDING", sentBackToReview: opts.status === "ACTIVE" }));
    return t;
}

const mount = (t: ListingTransport, seat: "seller" | "community" = "seller") =>
    render(<ListingPageV2 transport={t} seat={seat} kind="product" backHref="/back" />);
const bar = () => document.querySelector(".cbtl-dbar") as HTMLElement;

afterEach(() => { cleanup(); window.localStorage.clear(); });

describe("packagePoints: a package's description as a checklist", () => {
    it("a sentence is a point, and one that starts with You is the seller's own part", () => {
        expect(packagePoints("Champions list with no commission. You run it yourself.")).toEqual([
            { text: "Champions list with no commission", yours: false },
            { text: "You run it yourself", yours: true },
        ]);
    });
    it("a list is taken as written", () => {
        expect(packagePoints(PROMOTED.description).map((p) => p.text)).toEqual([
            "In PBN's newsletter and feed", "Top placement in the marketplace", "You deliver it and answer buyers",
        ]);
    });
    it("no description, no points", () => {
        expect(packagePoints(null)).toEqual([]);
    });
});

describe("where Change package shows", () => {
    it("on the seller's pending listing: the bar's main move, and on the terms card", async () => {
        mount(transport());
        await screen.findByRole("heading", { level: 1 });
        expect(await within(bar()).findByRole("button", { name: "Change package" })).toBeTruthy();
        expect(within(bar()).getByText(/Picked the wrong package\? Change it while PBN reviews/)).toBeTruthy();
    });

    it("not with only one package to be on", async () => {
        const t = transport({ packages: [LISTING_PKG] });
        mount(t);
        await screen.findByRole("heading", { level: 1 });
        await waitFor(() => expect(t.packages).toHaveBeenCalled());
        expect(within(bar()).queryByRole("button", { name: "Change package" })).toBeNull();
    });

    it("not where the host cannot switch packages", async () => {
        mount(transport({ switchable: false }));
        await screen.findByRole("heading", { level: 1 });
        expect(within(bar()).queryByRole("button", { name: "Change package" })).toBeNull();
    });

    it("never to the community", async () => {
        mount(transport(), "community");
        await screen.findByRole("heading", { level: 1 });
        expect(within(bar()).queryByRole("button", { name: "Change package" })).toBeNull();
    });
});

describe("the sheet", () => {
    it("one card per package, the chart follows the pick, and Switch moves it", async () => {
        const t = transport();
        mount(t);
        await screen.findByRole("heading", { level: 1 });
        fireEvent.click(await within(bar()).findByRole("button", { name: "Change package" }));
        const sheet = await screen.findByRole("dialog", { name: "Change your package with PBN" });

        const cards = await within(sheet).findAllByRole("radio");
        expect(cards).toHaveLength(2);
        expect(within(cards[0]).getByText("Your package now")).toBeTruthy();
        // The other package is picked to start with, and the chart is on it.
        expect(cards[1].getAttribute("aria-checked")).toBe("true");
        expect(await within(sheet).findByText("On Champion promoted")).toBeTruthy();
        // What you keep on each, from each package's own split.
        expect(await within(cards[0]).findByText(/3,836\.76/)).toBeTruthy();
        expect(await within(cards[1]).findByText(/3,447\.06/)).toBeTruthy();
        expect(within(cards[1]).getByText(/389\.70 less than now/)).toBeTruthy();
        // What PBN does: ticks, and the seller's own part.
        expect(within(cards[1]).getByText("Top placement in the marketplace")).toBeTruthy();

        fireEvent.click(cards[0]);
        expect(await within(sheet).findByText("On Champion listing")).toBeTruthy();
        expect((within(sheet).getByRole("button", { name: "Your package now" }) as HTMLButtonElement).disabled).toBe(true);

        fireEvent.click(cards[1]);
        fireEvent.click(within(sheet).getByRole("button", { name: "Switch to Champion promoted" }));
        await waitFor(() => expect(t.switchPackage).toHaveBeenCalledWith("pkg10"));
        expect(await screen.findByText("Switched to Champion promoted. PBN reviews it next.")).toBeTruthy();
    });

    it("a live listing asks first, and Keep it live switches nothing", async () => {
        const t = transport({ status: "ACTIVE" });
        mount(t);
        await screen.findByRole("heading", { level: 1 });
        fireEvent.click(await within(bar()).findByRole("button", { name: "Change package" }));
        const sheet = await screen.findByRole("dialog", { name: "Change your package with PBN" });
        await within(sheet).findByText("On Champion promoted");
        fireEvent.click(within(sheet).getByRole("button", { name: "Switch to Champion promoted" }));

        const ask = await screen.findByRole("alertdialog", { name: "Switch the package of a live listing?" });
        expect(within(ask).getByText(/comes off PBN's marketplace while PBN reviews Champion promoted/)).toBeTruthy();
        fireEvent.click(within(ask).getByRole("button", { name: "Keep it live" }));
        expect(t.switchPackage).not.toHaveBeenCalled();

        fireEvent.click(within(sheet).getByRole("button", { name: "Switch to Champion promoted" }));
        fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Switch and send to PBN" }));
        await waitFor(() => expect(t.switchPackage).toHaveBeenCalledWith("pkg10"));
    });
});
