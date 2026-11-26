/**
 * Custom terms for one listing (T-414; canvas 8YTrdyqmNdkKECpACpdd7c, page
 * "Change terms"), with the real case: PBN asks 10% on Thiago's "Immersion to
 * Austin Texas" ($3,997.00), whose terms today are 0%.
 *
 *   - the community: Change terms beside "Approve at 0%", a sheet that previews
 *     the split at the typed rate and sends it as an offer;
 *   - the seller: "PBN asks 10% for this listing", Keep 0% / Accept 10% and go
 *     live, the ask against today's terms, an accept dialog that states
 *     Cobuntu's platform fee and offers Premium once;
 *   - Cobuntu Premium: the seller's own item only, never the community, never
 *     without a host that can sell it, and "Not now" holds.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, within, cleanup } from "@testing-library/react";
import { ListingPageV2 } from "../listings/v2/ListingPageV2";
import type { ListingTransport } from "../listings/v2/transport";
import type { ListingMoney, MoneyLine } from "../listings/v2/types";

const SELLER_AT: Record<number, MoneyLine[]> = {
    0: [{ key: "price", amount: 399700 }, { key: "stripe", amount: 6021 }, { key: "commission", amount: 0 }, { key: "cobuntu", amount: 9998 }, { key: "keep", amount: 383681 }],
    10: [{ key: "price", amount: 399700 }, { key: "stripe", amount: 6021 }, { key: "commission", amount: 39970 }, { key: "cobuntu", amount: 9998 }, { key: "keep", amount: 343711 }],
};
const COMMUNITY_AT: Record<number, MoneyLine[]> = {
    0: [{ key: "price", amount: 399700 }, { key: "stripe", amount: 6021 }, { key: "seller", amount: 393679 }, { key: "sellerFee", amount: 9998 }, { key: "sellerNet", amount: 383681 }, { key: "commission", amount: 0 }, { key: "cobuntu", amount: 0 }, { key: "keep", amount: 0 }],
    10: [{ key: "price", amount: 399700 }, { key: "stripe", amount: 6021 }, { key: "seller", amount: 353709 }, { key: "sellerFee", amount: 9998 }, { key: "sellerNet", amount: 343711 }, { key: "commission", amount: 39970 }, { key: "cobuntu", amount: 1999 }, { key: "keep", amount: 37971 }],
};

function moneyAt(seat: "seller" | "community", rate: number): ListingMoney {
    const lines = (seat === "seller" ? SELLER_AT : COMMUNITY_AT)[rate] ?? (seat === "seller" ? SELLER_AT[10] : COMMUNITY_AT[10]);
    return {
        kind: "product", listingId: "lst", seat, status: "PENDING", live: false, currency: "USD",
        oneSale: { gross: 399700, vat: 0, commissionRate: rate, rateSource: "agreed", platformFeeRate: 0.05, memberSale: true, sellerPremium: false, lines },
        soldSoFar: null, upfront: null, result: null, prices: [], donation: null,
        rates: { cobuntuPct: 5, stream: "products", commissionPct: rate, commissionSource: "agreed", ownedByListingCommunity: false, sellerFeePct: 2.5, sellerFeeFixed: 5 },
        previewRate: rate,
    } as ListingMoney;
}

const ASK = {
    id: "ask1", commissionRate: 10, status: "PENDING", package: null, createdAt: "2026-11-26T11:40:00Z",
    proposedByUserId: "art", proposedByUser: { id: "art", name: "Art Linkov" },
};

function transport(seat: "seller" | "community", opts: { ask?: boolean } = {}) {
    const t: ListingTransport & Record<string, any> = {
        listing: vi.fn(async () => ({
            id: "lst", status: "PENDING", isHidden: false, commissionRate: 0, createdAt: "2026-11-17T13:25:00Z", approvedAt: null,
            community: { id: "pbn", name: "PBN", communityTag: "pbn", iconUrl: "https://img/pbn.png" },
            requestedBy: { id: "thiago", name: "Thiago Vieira", usertag: "thiago-vieira", profileImage: null },
            products: { id: "p1", name: "Immersion to Austin Texas", ownerId: "thiago", communityId: null, owner: { id: "thiago", name: "Thiago Vieira" } },
        })),
        proposals: vi.fn(async () => (opts.ask ? [ASK] : [])),
        topics: vi.fn(async () => []),
        money: vi.fn(async (o?: { rate?: number }) => moneyAt(seat, o?.rate ?? 0)),
        packages: vi.fn(async () => []),
        setStatus: vi.fn(async () => {}),
        setHidden: vi.fn(async () => {}),
        propose: vi.fn(async () => {}),
        respond: vi.fn(async () => {}),
        openTopic: vi.fn(async () => {}),
        comment: vi.fn(async () => {}),
        setTopicDone: vi.fn(async () => {}),
    };
    return t;
}

const premium = { start: vi.fn(async () => "https://checkout.stripe.com/c/pay/cs_premium"), monthly: "€8", yearly: "€88" };
const mount = (t: ListingTransport, seat: "seller" | "community", extra: Record<string, unknown> = {}) =>
    render(<ListingPageV2 transport={t} seat={seat} kind="product" backHref="/back" {...extra} />);
const bar = () => document.querySelector(".cbtl-dbar") as HTMLElement;
const openEarnings = () => fireEvent.click(screen.getByRole("button", { name: /^Earnings/ }));

afterEach(() => { cleanup(); window.localStorage.clear(); window.history.replaceState(null, "", "/"); });

describe("the community: Change terms", () => {
    it("offers Change terms beside Approve at today's rate", async () => {
        mount(transport("community"), "community");
        await screen.findByRole("heading", { level: 1 });
        expect(within(bar()).getByRole("button", { name: "Change terms" })).toBeTruthy();
        expect(within(bar()).getByRole("button", { name: "Approve at 0%" })).toBeTruthy();
    });

    it("previews the split at the typed rate and sends it as an offer for this listing", async () => {
        const t = transport("community");
        mount(t, "community");
        await screen.findByRole("heading", { level: 1 });
        fireEvent.click(within(bar()).getByRole("button", { name: "Change terms" }));
        const sheet = await screen.findByRole("dialog", { name: "Change the terms for this listing" });
        // Sending today's rate again is not an offer.
        expect((within(sheet).getByRole("button", { name: /^Send 0%/ }) as HTMLButtonElement).disabled).toBe(true);
        fireEvent.click(within(sheet).getByRole("button", { name: "10%" }));
        await waitFor(() => expect(t.money).toHaveBeenCalledWith({ rate: 10 }));
        // In the split and in the footer's summary.
        expect((await within(sheet).findAllByText(/379\.71/)).length).toBe(2);
        fireEvent.click(within(sheet).getByRole("button", { name: "Send 10% to Thiago Vieira" }));
        await waitFor(() => expect(t.propose).toHaveBeenCalledWith({ commissionRate: 10 }));
    });

    it("keeps the split on screen while the next rate is worked out, then moves to it; no 'At 0% now' line", async () => {
        const t = transport("community");
        const atRate = t.money;
        let release: () => void = () => {};
        t.money = vi.fn((o?: { rate?: number }) => o?.rate === 10
            ? new Promise<ListingMoney>((ok) => { release = () => ok(moneyAt("community", 10)); })
            : atRate(o));
        mount(t, "community");
        await screen.findByRole("heading", { level: 1 });
        fireEvent.click(within(bar()).getByRole("button", { name: "Change terms" }));
        const sheet = await screen.findByRole("dialog", { name: "Change the terms for this listing" });
        expect(await within(sheet).findByText(/sale at 0%$/)).toBeTruthy();

        fireEvent.click(within(sheet).getByRole("button", { name: "10%" }));
        await waitFor(() => expect(t.money).toHaveBeenCalledWith({ rate: 10 }));
        // Still the 0% split while 10% is worked out: never the "Working out" line.
        expect(within(sheet).getByText(/sale at 0%$/)).toBeTruthy();
        expect(within(sheet).queryByText("Working out the split…")).toBeNull();

        release();
        expect(await within(sheet).findByText(/sale at 10%$/)).toBeTruthy();
        // The amounts glide there and land on the new rate's (split + footer).
        expect((await within(sheet).findAllByText(/379\.71/)).length).toBe(2);
        expect(within(sheet).queryByText(/^At 0% now$/)).toBeNull();
    });

    it("slides the picks' highlight to the picked rate, fades it on a typed one, and the number lands on the pick", async () => {
        mount(transport("community"), "community");
        await screen.findByRole("heading", { level: 1 });
        fireEvent.click(within(bar()).getByRole("button", { name: "Change terms" }));
        const sheet = await screen.findByRole("dialog", { name: "Change the terms for this listing" });
        const thumb = sheet.querySelector(".cbtl-ct-thumb") as HTMLElement;
        const picks = thumb.parentElement as HTMLElement;
        const field = within(sheet).getByRole("textbox") as HTMLInputElement;
        expect(picks.style.getPropertyValue("--i")).toBe("0");

        fireEvent.click(within(sheet).getByRole("button", { name: "10%" }));
        expect(picks.style.getPropertyValue("--i")).toBe("2");
        expect(thumb.hasAttribute("data-off")).toBe(false);
        await waitFor(() => expect(field.value).toBe("10"));

        // A rate that is not a pick: the highlight fades where it was, and what is typed stays as typed.
        fireEvent.change(field, { target: { value: "3" } });
        expect(thumb.hasAttribute("data-off")).toBe(true);
        expect(picks.style.getPropertyValue("--i")).toBe("2");
        expect(field.value).toBe("3");

        fireEvent.click(within(sheet).getByRole("button", { name: "Raise by 1%" }));
        await waitFor(() => expect(field.value).toBe("4"));
    });

    it("says it is waiting for the seller once the ask is out", async () => {
        const t = transport("community");
        (t.proposals as any).mockResolvedValue([{ ...ASK, proposedByUserId: "art" }]);
        mount(t, "community");
        await screen.findByRole("heading", { level: 1 });
        expect(within(bar()).getByText("You asked 10% for this listing")).toBeTruthy();
    });

    it("never shows the community Cobuntu Premium", async () => {
        mount(transport("community"), "community", { premiumCheckout: premium });
        await screen.findByRole("heading", { level: 1 });
        openEarnings();
        expect(screen.queryByText(/Cobuntu Premium/i)).toBeNull();
    });
});

describe("the seller: PBN asks 10% for this listing", () => {
    it("answers with Keep 0% or Accept 10% and go live", async () => {
        mount(transport("seller", { ask: true }), "seller");
        await screen.findByRole("heading", { level: 1 });
        expect(within(bar()).getByText("PBN asks 10% for this listing")).toBeTruthy();
        expect(within(bar()).getByRole("button", { name: "Keep 0%" })).toBeTruthy();
        expect(within(bar()).getByRole("button", { name: "Accept 10% and go live" })).toBeTruthy();
    });

    it("shows the ask, the split at 10% and what they keep against today's terms", async () => {
        const t = transport("seller", { ask: true });
        mount(t, "seller");
        await screen.findByRole("heading", { level: 1 });
        openEarnings();
        await waitFor(() => expect(t.money).toHaveBeenCalledWith({ rate: 10 }));
        expect(screen.getByText("PBN asks 10% on this listing")).toBeTruthy();
        const cmp = document.querySelector(".cbtl-cmp") as HTMLElement;
        expect(within(cmp).getByText(/3,836\.81/)).toBeTruthy();
        expect(within(cmp).getByText(/3,437\.11/)).toBeTruthy();
    });

    it("accepting states Cobuntu's platform fee and puts it live", async () => {
        const t = transport("seller", { ask: true });
        mount(t, "seller");
        await screen.findByRole("heading", { level: 1 });
        fireEvent.click(within(bar()).getByRole("button", { name: "Accept 10% and go live" }));
        const dlg = await screen.findByRole("dialog", { name: "Accept 10% and go live?" });
        expect(await within(dlg).findByText(/2\.5% \+ \S*0\.05/)).toBeTruthy();
        expect(within(dlg).getAllByText(/99\.98/).length).toBeGreaterThan(0);
        // No host that sells Premium: no Premium block.
        expect(within(dlg).queryByText(/Premium/)).toBeNull();
        fireEvent.click(within(dlg).getByRole("button", { name: "Accept 10% and go live" }));
        await waitFor(() => expect(t.respond).toHaveBeenCalledWith("ask1", "ACCEPTED"));
    });

    it("offers Premium once in the dialog: interval, the no-refunds waiver, then checkout back to this listing", async () => {
        premium.start.mockClear();
        const assign = vi.fn();
        const original = window.location;
        Object.defineProperty(window, "location", { configurable: true, value: { ...original, href: "http://x/marketplace/immersion/manage/listing/lst", pathname: "/marketplace/immersion/manage/listing/lst", assign } });
        try {
            mount(transport("seller", { ask: true }), "seller", { premiumCheckout: premium });
            await screen.findByRole("heading", { level: 1 });
            fireEvent.click(within(bar()).getByRole("button", { name: "Accept 10% and go live" }));
            const dlg = await screen.findByRole("dialog", { name: "Accept 10% and go live?" });
            expect(await within(dlg).findByText(/^Keep the \S*99\.98 too$/)).toBeTruthy();
            // Cobuntu's fee going to 0% and the amount kept: never the seller's totals.
            expect(within(dlg).getByText("Cobuntu fee today")).toBeTruthy();
            expect(within(dlg).getByText("0%")).toBeTruthy();
            expect(within(dlg).queryByText(/3,537|3,447\.\d\d.*Premium/)).toBeNull();
            // No monthly amount from the host: "pays for itself" is never guessed.
            expect(within(dlg).queryByText("Pays for itself on this one sale")).toBeNull();
            fireEvent.click(within(dlg).getByRole("button", { name: "Go Premium, then go live" }));
            const go = within(dlg).getByRole("button", { name: "Continue to payment" }) as HTMLButtonElement;
            expect(go.disabled).toBe(true);
            fireEvent.click(within(dlg).getByRole("checkbox"));
            fireEvent.click(go);
            await waitFor(() => expect(premium.start).toHaveBeenCalledWith("YEARLY", "/marketplace/immersion/manage/listing/lst?accept=ask1"));
            await waitFor(() => expect(assign).toHaveBeenCalledWith("https://checkout.stripe.com/c/pay/cs_premium"));
        } finally {
            Object.defineProperty(window, "location", { configurable: true, value: original });
        }
    });

    it("back from Premium checkout, accepts the ask and says it is live", async () => {
        window.history.replaceState(null, "", "/marketplace/immersion/manage/listing/lst?accept=ask1&premium=welcome");
        const t = transport("seller", { ask: true });
        mount(t, "seller", { premiumCheckout: premium });
        await waitFor(() => expect(t.respond).toHaveBeenCalledWith("ask1", "ACCEPTED"));
        expect(window.location.search).toBe("");
    });
});

describe("Cobuntu Premium on the seller's own item", () => {
    it("shows the Cobuntu card with what Premium would leave them, and Not now hides it", async () => {
        mount(transport("seller"), "seller", { premiumCheckout: premium });
        await screen.findByRole("heading", { level: 1 });
        openEarnings();
        expect(await screen.findByText(/^Keep the \S*99\.98 too$/)).toBeTruthy();
        // The fee going from 2.5% to 0%, not the seller's totals with and without.
        const card = document.querySelector(".cbtl-prem-card") as HTMLElement;
        expect(within(card).getByText("2.5%")).toBeTruthy();
        expect(within(card).getByText("0%")).toBeTruthy();
        expect(within(card).queryByText(/3,936\.79/)).toBeNull();
        fireEvent.click(screen.getByRole("button", { name: "Not now" }));
        expect(screen.queryByText(/^Keep the \S*99\.98 too$/)).toBeNull();
    });

    it("says it pays for itself only when that is certain", async () => {
        const withAmount = { ...premium, monthlyAmount: { minor: 800, currency: "EUR" } };
        mount(transport("seller", { ask: true }), "seller", { premiumCheckout: withAmount });
        await screen.findByRole("heading", { level: 1 });
        fireEvent.click(within(bar()).getByRole("button", { name: "Accept 10% and go live" }));
        const dlg = await screen.findByRole("dialog", { name: "Accept 10% and go live?" });
        // US$99.98 against €8: two close currencies, well past the 1.5x margin.
        expect(await within(dlg).findByText("Pays for itself on this one sale")).toBeTruthy();
    });

    it("wears Cobuntu's brand: the real mark and the wordmark, never the community's", async () => {
        mount(transport("seller"), "seller", { premiumCheckout: premium });
        await screen.findByRole("heading", { level: 1 });
        openEarnings();
        const card = await waitFor(() => document.querySelector(".cbtl-prem-card") as HTMLElement);
        expect(within(card).getByText("Cobuntu")).toBeTruthy();
        expect(within(card).getByText("Premium")).toBeTruthy();
        // The traced mark: copper ring, slate dots (cobuntu.com/icon.png).
        const svg = card.querySelector('svg[aria-label="Cobuntu"]') as SVGElement;
        expect(svg.querySelector("path")?.getAttribute("stroke")).toBe("#C68346");
        expect(Array.from(svg.querySelectorAll("circle")).map((c) => c.getAttribute("fill"))).toEqual(["#4A5260", "#4A5260"]);
    });

    it("is not shown without a host that can sell Premium", async () => {
        mount(transport("seller"), "seller");
        await screen.findByRole("heading", { level: 1 });
        openEarnings();
        expect(screen.queryByText(/Cobuntu Premium/i)).toBeNull();
    });
});
