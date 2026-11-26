/**
 * The listing beside its chat (T-417; canvas 8YTrdyqmNdkKECpACpdd7c, page
 * "Listing chat"), with the real case: PBN asks 10% on Thiago's "Immersion to
 * Austin Texas" ($3,997.00), whose terms today are 0%.
 *
 * The drawer is ListingPageV2 with layout="drawer": the same loads, moves and
 * confirmations as the page, in one column. What each test pins is a way it
 * could mislead or misfire in the chat: a move without a confirmation, a
 * "Reply" or "Share" repeating what the chat already gives, ending moves mixed
 * in with the decision, the wrong seat's money, shelf wording.
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
};

function moneyAt(seat: "seller" | "community", rate: number, live = false): ListingMoney {
    const lines = seat === "seller" ? (SELLER_AT[rate] ?? SELLER_AT[10]) : COMMUNITY_AT[0];
    return {
        kind: "product", listingId: "lst", seat, status: live ? "ACTIVE" : "PENDING", live, currency: "USD",
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

function transport(seat: "seller" | "community", opts: { ask?: boolean; status?: string } = {}) {
    const status = opts.status ?? "PENDING";
    const t: ListingTransport & Record<string, any> = {
        listing: vi.fn(async () => ({
            id: "lst", status, isHidden: false, commissionRate: 0, createdAt: "2026-11-17T13:25:00Z",
            approvedAt: status === "ACTIVE" ? "2026-11-25T10:00:00Z" : null,
            community: { id: "pbn", name: "PBN", communityTag: "pbn", iconUrl: "https://img/pbn.png" },
            requestedBy: { id: "thiago", name: "Thiago Vieira", usertag: "thiago-vieira", profileImage: null },
            products: { id: "p1", name: "Immersion to Austin Texas", productType: "DIGITAL", ownerId: "thiago", communityId: null, owner: { id: "thiago", name: "Thiago Vieira" } },
        })),
        proposals: vi.fn(async () => (opts.ask ? [ASK] : [])),
        topics: vi.fn(async () => []),
        money: vi.fn(async (o?: { rate?: number }) => moneyAt(seat, o?.rate ?? 0, status === "ACTIVE")),
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

const drawer = (t: ListingTransport, seat: "seller" | "community", extra: Record<string, unknown> = {}) =>
    render(<ListingPageV2 transport={t} seat={seat} kind="product" backHref="/back" layout="drawer" {...extra} />);
const card = () => document.querySelector(".cbtl-dd") as HTMLElement;
const foot = () => document.querySelector(".cbtl-df") as HTMLElement | null;

afterEach(() => { cleanup(); window.localStorage.clear(); });

describe("the seller, while PBN asks 10%", () => {
    it("shows the item, both sides and where it stands", async () => {
        drawer(transport("seller", { ask: true }), "seller");
        expect(await screen.findByRole("heading", { name: "Immersion to Austin Texas" })).toBeTruthy();
        const head = document.querySelector(".cbtl-dh") as HTMLElement;
        expect(within(head).getByText("Pending")).toBeTruthy();
        expect(head.textContent).toContain("Thiago Vieira");
        expect(head.textContent).toContain("PBN");
        // No page chrome: no trail, no section tiles.
        expect(document.querySelector(".cbtl-crumb")).toBeNull();
        expect(document.querySelector(".cbtl-dbar")).toBeNull();
    });

    it("answers in the decision card, with no Reply: the chat's message box is the reply", async () => {
        const t = transport("seller", { ask: true });
        drawer(t, "seller");
        await screen.findByRole("heading", { name: "Immersion to Austin Texas" });
        expect(within(card()).getByText("PBN asks 10% for this listing")).toBeTruthy();
        const buttons = within(card()).getAllByRole("button").map((b) => b.textContent);
        expect(buttons).toEqual(["Accept 10% and go live", "Keep 0%"]);
        expect(screen.queryByRole("button", { name: "Reply" })).toBeNull();
        expect(t.respond).not.toHaveBeenCalled();
    });

    it("accepting confirms first, with the same dialog as the page", async () => {
        const t = transport("seller", { ask: true });
        drawer(t, "seller");
        await screen.findByRole("heading", { name: "Immersion to Austin Texas" });
        fireEvent.click(within(card()).getByRole("button", { name: "Accept 10% and go live" }));
        const dlg = await screen.findByRole("dialog", { name: "Accept 10% and go live?" });
        expect(t.respond).not.toHaveBeenCalled();
        fireEvent.click(within(dlg).getByRole("button", { name: "Accept 10% and go live" }));
        await waitFor(() => expect(t.respond).toHaveBeenCalledWith("ask1", "ACCEPTED"));
    });

    it("shows one sale at the ask, and how much less it keeps than today's terms", async () => {
        const t = transport("seller", { ask: true });
        drawer(t, "seller");
        await screen.findByRole("heading", { name: "Immersion to Austin Texas" });
        await waitFor(() => expect(t.money).toHaveBeenCalledWith({ rate: 10 }));
        const money = document.querySelector(".cbtl-dm") as HTMLElement;
        await waitFor(() => expect(within(money).getByText(/3,437\.11/)).toBeTruthy());
        expect(within(money).getByText("You keep, each sale")).toBeTruthy();
        expect(within(money).getByText(/399\.70 less than at 0%/)).toBeTruthy();
        const terms = document.querySelector(".cbtl-dt") as HTMLElement;
        expect(within(terms).getByText("PBN asks")).toBeTruthy();
        expect(within(terms).getByText("10%")).toBeTruthy();
        expect(within(terms).getByText("this listing only")).toBeTruthy();
    });

    it("keeps withdrawing in the footer, never beside the answer", async () => {
        drawer(transport("seller", { ask: true }), "seller");
        await screen.findByRole("heading", { name: "Immersion to Austin Texas" });
        expect(within(card()).queryByRole("button", { name: /withdraw/i })).toBeNull();
    });
});

describe("the community, reviewing", () => {
    it("says it is their review and approves only after the confirmation", async () => {
        const t = transport("community");
        drawer(t, "community");
        await screen.findByRole("heading", { name: "Immersion to Austin Texas" });
        expect(within(document.querySelector(".cbtl-dh") as HTMLElement).getByText("Your review")).toBeTruthy();
        const approve = within(card()).getAllByRole("button").find((b) => /^Approve/.test(b.textContent ?? ""))!;
        fireEvent.click(approve);
        const dlg = await screen.findByRole("dialog");
        expect(t.setStatus).not.toHaveBeenCalled();
        fireEvent.click(within(dlg).getAllByRole("button").find((b) => /Approve/.test(b.textContent ?? ""))!);
        await waitFor(() => expect(t.setStatus).toHaveBeenCalledWith("ACTIVE"));
    });

    it("never shows the community Cobuntu Premium", async () => {
        drawer(transport("community"), "community", { premiumCheckout: { start: vi.fn(), monthly: "€8", yearly: "€88" } });
        await screen.findByRole("heading", { name: "Immersion to Austin Texas" });
        expect(screen.queryByText(/Premium/)).toBeNull();
    });
});

describe("a live listing", () => {
    it("pauses sales from the footer, after saying so", async () => {
        const t = transport("seller", { status: "ACTIVE" });
        drawer(t, "seller");
        await screen.findByRole("heading", { name: "Immersion to Austin Texas" });
        expect(within(document.querySelector(".cbtl-dh") as HTMLElement).getByText("Live")).toBeTruthy();
        fireEvent.click(within(foot()!).getByRole("button", { name: "Pause sales" }));
        const dlg = await screen.findByRole("dialog");
        expect(dlg.textContent).toContain("Pause sales on PBN?");
        expect(t.setStatus).not.toHaveBeenCalled();
        fireEvent.click(within(dlg).getByRole("button", { name: "Pause sales" }));
        await waitFor(() => expect(t.setStatus).toHaveBeenCalledWith("PAUSED"));
    });

    it("links to the live page, and nothing else in the card: no Reply, no Share", async () => {
        drawer(transport("seller", { status: "ACTIVE" }), "seller", { links: { live: "https://pbn.community/p/immersion" } });
        await screen.findByRole("heading", { name: "Immersion to Austin Texas" });
        const view = within(card()).getByRole("link", { name: "View on PBN" }) as HTMLAnchorElement;
        expect(view.href).toBe("https://pbn.community/p/immersion");
        expect(within(card()).queryAllByRole("button")).toHaveLength(0);
    });

    it("never says shelf", async () => {
        drawer(transport("seller", { status: "ACTIVE" }), "seller");
        await screen.findByRole("heading", { name: "Immersion to Austin Texas" });
        expect(document.body.textContent).not.toMatch(/shelf/i);
    });
});

describe("closing", () => {
    it("closes from the head", async () => {
        const onClose = vi.fn();
        drawer(transport("seller", { ask: true }), "seller", { onClose });
        await screen.findByRole("heading", { name: "Immersion to Austin Texas" });
        fireEvent.click(screen.getByRole("button", { name: "Close" }));
        expect(onClose).toHaveBeenCalledTimes(1);
    });
});

describe("the listing page, once the talk lives in the chat", () => {
    it("turns the third tile into Chat, which opens the listing's chat", async () => {
        const navigate = vi.fn();
        render(<ListingPageV2 transport={transport("seller", { ask: true })} seat="seller" kind="product" backHref="/back"
            chatHref="/conversations/conv-1" navigate={navigate} />);
        await screen.findByRole("heading", { level: 1 });
        const tile = screen.getByRole("button", { name: /^Chat/ });
        expect(tile.textContent).toContain("Talk it through with PBN");
        expect(screen.queryByRole("button", { name: /^Negotiation/ })).toBeNull();
        fireEvent.click(tile);
        expect(navigate).toHaveBeenCalledWith("/conversations/conv-1");
    });

    it("keeps its own thread when the host has no chat for it", async () => {
        render(<ListingPageV2 transport={transport("seller", { ask: true })} seat="seller" kind="product" backHref="/back" />);
        await screen.findByRole("heading", { level: 1 });
        expect(screen.getByRole("button", { name: /^Negotiation/ })).toBeTruthy();
    });
});

describe("the drawer's colours", () => {
    it("keeps the primary move's label visible: its colour outranks .cbtl button{color:inherit}", async () => {
        // jsdom does not compute the cascade, so pin the selectors. A bare
        // .cbtl-dd-p lost to ".cbtl button" and inherited the card's white into
        // a white button: the primary move rendered as a blank box (26 Nov 2026).
        const { LISTING_PAGE_CSS } = await import("../listings/v2/styles");
        expect(LISTING_PAGE_CSS).toContain(".cbtl .cbtl-dd-p{");
        expect(LISTING_PAGE_CSS).not.toMatch(/(^|\n)\.cbtl-dd-p\{/);
        expect(LISTING_PAGE_CSS).toContain(".cbtl .cbtl-prem-go{");
    });

    it("lights every drawer button on hover, only where a pointer hovers, and presses on click", async () => {
        const { LISTING_PAGE_CSS } = await import("../listings/v2/styles");
        const hover = LISTING_PAGE_CSS.slice(LISTING_PAGE_CSS.indexOf("@media (hover:hover){"));
        for (const sel of [".cbtl .cbtl-dh-x:hover", ".cbtl .cbtl-dd-p:not(:disabled):hover", ".cbtl .cbtl-dd-s:not(:disabled):hover",
            ".cbtl .cbtl-df-btn:not(:disabled):hover", ".cbtl .cbtl-df-btn[data-danger]:not(:disabled):hover", ".cbtl .cbtl-dt-btn:not(:disabled):hover"]) {
            expect(hover, sel).toContain(sel + "{");
        }
        expect(LISTING_PAGE_CSS).toContain(".cbtl .cbtl-df-btn:not(:disabled):active");
    });

    it("draws the close button as the chat header's round button, with a 44px tap target", async () => {
        const { LISTING_PAGE_CSS } = await import("../listings/v2/styles");
        const rule = LISTING_PAGE_CSS.match(/\.cbtl \.cbtl-dh-x\{[^}]*\}/)?.[0] ?? "";
        expect(rule).toContain("width:32px;height:32px");
        expect(rule).toContain("border-radius:50%");
        expect(rule).toContain("background:color-mix(in srgb,var(--cbtl-ink) 4%,transparent)");
        expect(LISTING_PAGE_CSS).toContain(".cbtl .cbtl-dh-x::after{content:\"\";position:absolute;inset:-6px");
    });
});
