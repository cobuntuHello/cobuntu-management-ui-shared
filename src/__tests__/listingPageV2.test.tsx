/**
 * The listing page v2, rendered (listings/v2/ListingPageV2.tsx), with a fake
 * transport and the canvas' own listing: Marta's EUR 18 evening at TEJÁ House,
 * no commission on event tickets, the room in two halves of EUR 184.50.
 *
 * What each test pins is a way the page could mislead a real person: the wrong
 * seat's money, a lever that fires without a confirmation, a publish button
 * that works before the booking is accepted, an action drawn that the host
 * cannot perform.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor, fireEvent, within } from "@testing-library/react";
import { ListingPageV2 } from "../listings/v2/ListingPageV2";
import { LISTING_PAGE_CSS } from "../listings/v2/styles";
import type { ListingTransport } from "../listings/v2/transport";
import type { ListingMoney, BookingView } from "../listings/v2/types";

const lines = {
    seller: [{ key: "price", amount: 1800 }, { key: "stripe", amount: 52 }, { key: "commission", amount: 0 }, { key: "cobuntu", amount: 50 }, { key: "keep", amount: 1698 }],
    community: [{ key: "price", amount: 1800 }, { key: "stripe", amount: 52 }, { key: "seller", amount: 1748 }, { key: "commission", amount: 0 }, { key: "cobuntu", amount: 0 }, { key: "keep", amount: 0 }],
} as const;

function money(seat: "seller" | "community", live: boolean, bookingStatus = "ACCEPTED"): ListingMoney {
    const community = seat === "community";
    return {
        kind: "event", listingId: "lst", seat, status: live ? "ACTIVE" : "PENDING", live, currency: "EUR",
        oneSale: { gross: 1800, vat: 0, commissionRate: 0, rateSource: "agreed", platformFeeRate: 0, memberSale: true, sellerPremium: false, lines: lines[seat] as any },
        soldSoFar: live ? { count: 25, lines: (lines[seat] as any).map((l: any) => ({ key: l.key, amount: l.amount * 25 })) } : null,
        upfront: {
            room: "The Sound Room", bookingStatus, isPriority: false, card: { brand: "visa", last4: "4242" },
            payments: [
                { key: "first", state: "paid", gross: 18450, amount: community ? 18148 : 18450, stripe: community ? 302 : 0, estimated: false, paidAt: "2026-11-18T10:00:00Z", dueAt: null, saleId: "s1" },
                { key: "second", state: bookingStatus === "IN_REVIEW" ? "waiting" : "next", gross: 18450, amount: community ? 18148 : 18450, stripe: community ? 302 : 0, estimated: community, paidAt: null, dueAt: "2026-12-02T18:00:00Z", saleId: null },
            ],
            addons: [
                { id: "light", name: "Light designer", slot: null, status: "PRICE_PROPOSED", required: false, quantity: 1, listedCents: 15000, proposedCents: 15000, vatRate: 23, gross: 18450, amount: 18450, stripe: 0, estimated: false, included: false, paidAt: null, saleId: null },
                { id: "chairs", name: "Tables and chairs", slot: null, status: "APPROVED", required: false, quantity: 1, listedCents: 0, proposedCents: null, vatRate: 23, gross: 0, amount: 0, stripe: 0, estimated: false, included: true, paidAt: null, saleId: null },
            ],
            paid: community ? 18148 : 18450, toCome: community ? 18148 : 18450, total: community ? 36296 : 36900,
            next: { amount: community ? 18148 : 18450, dueAt: "2026-12-02T18:00:00Z", what: "second" },
        },
        result: live
            ? (community
                ? { kind: "communitySoFar", fromSales: 0, upfrontIn: 18148, amount: 18148, toCome: 18148, nextDueAt: "2026-12-02T18:00:00Z" }
                : { kind: "sellerSoFar", fromSales: 42450, upfrontPaid: 18450, amount: 24000, afterNext: 5550, nextDueAt: "2026-12-02T18:00:00Z", salesToCover: null })
            : (community ? null : { kind: "breakEven", perSale: 1698, upfront: 36900, sales: 22 }),
    };
}

const booking = (status: string): BookingView => ({
    eventId: "evt", status, isPriority: false, currency: "EUR", lines: [], totalAmountCents: 36900, vatAmountCents: 6900,
    firstPaymentCents: 18450, firstPaidAt: "2026-11-18T10:00:00Z", secondPaymentCents: 18450, secondChargeDueAt: "2026-12-02T18:00:00Z",
    secondPaidAt: null, decidedAt: status === "ACCEPTED" ? "2026-11-22T10:00:00Z" : null, declineReason: null, guestCount: 40,
    details: { logistics: { format: "One-off", schedule: "Doors 18:00, two sides, close 21:00" }, marketing: { plan: "Instagram and the newsletter" } },
    detailsSubmittedAt: "2026-11-18T11:00:00Z", card: { brand: "visa", last4: "4242" }, dateChangedAt: null,
});

function transport(seat: "seller" | "community", opts: { status?: string; bookingStatus?: string } = {}) {
    const status = opts.status ?? "PENDING";
    const live = status === "ACTIVE";
    const bookingStatus = opts.bookingStatus ?? "ACCEPTED";
    const t: ListingTransport & Record<string, any> = {
        listing: vi.fn(async () => ({
            id: "lst", status, isHidden: false, commissionRate: 0, isPaid: true, listingPrice: { amount: 18, currency: "EUR" },
            createdAt: "2026-11-18T09:00:00Z", approvedAt: live ? "2026-11-24T10:00:00Z" : null,
            community: { id: "teja", name: "TEJÁ House", communityTag: "tejahouse", iconUrl: null },
            requestedBy: { id: "marta", name: "Marta Silva", usertag: "marta-silva", profileImage: null },
            event: { id: "evt", name: "Slow Records: a vinyl listening evening", slug: "slow-records", startDate: "2026-12-09T18:00:00Z", endDate: "2026-12-09T21:00:00Z", capacity: 40 },
        })),
        proposals: vi.fn(async () => []),
        topics: vi.fn(async () => []),
        money: vi.fn(async () => money(seat, live, bookingStatus)),
        packages: vi.fn(async () => []),
        setStatus: vi.fn(async () => {}),
        setHidden: vi.fn(async () => {}),
        propose: vi.fn(async () => {}),
        respond: vi.fn(async () => {}),
        openTopic: vi.fn(async () => {}),
        comment: vi.fn(async () => {}),
        setTopicDone: vi.fn(async () => {}),
        booking: vi.fn(async () => booking(bookingStatus)),
        addons: vi.fn(async () => ({ guestCount: 40, locked: false, selections: [] })),
    };
    if (seat === "community") {
        t.decideBooking = vi.fn(async () => {});
        t.decideAddon = vi.fn(async () => {});
    } else {
        t.confirmAddonPrice = vi.fn(async () => {});
        t.cancelAddon = vi.fn(async () => {});
        t.startCardChange = vi.fn(async () => ({ checkoutUrl: "https://checkout.stripe.com/c/pay/x" }));
        t.setGuests = vi.fn(async () => {});
    }
    return t;
}

const mount = (t: ListingTransport, seat: "seller" | "community", extra: Record<string, unknown> = {}) =>
    render(<ListingPageV2 transport={t} seat={seat} kind="event" backHref="/back" {...extra} />);

/** Open one of the three section tiles (its accessible name starts with the section's). */
const openSection = (name: "Overview" | "Earnings" | "Negotiation") =>
    fireEvent.click(screen.getByRole("button", { name: new RegExp(`^${name}`) }));
/** The decision bar along the bottom. */
const bar = () => document.querySelector(".cbtl-dbar") as HTMLElement;

describe("three sections and a decision (the redesign, 24 Nov 2026)", () => {
    it("shows Overview, Earnings and Negotiation as tiles, never Messages, and opens on Overview", async () => {
        mount(transport("community"), "community");
        await screen.findByRole("heading", { level: 1 });
        const tiles = document.querySelectorAll(".cbtl-sec");
        expect([...tiles].map((t) => t.getAttribute("data-sec"))).toEqual(["overview", "earnings", "negotiation"]);
        expect(screen.queryByRole("button", { name: /^Messages/ })).toBeNull();
        expect(document.querySelector('.cbtl-sec[aria-current="page"]')?.getAttribute("data-sec")).toBe("overview");
        openSection("Earnings");
        expect(document.querySelector('.cbtl-sec[aria-current="page"]')?.getAttribute("data-sec")).toBe("earnings");
    });

    it("draws no step track and no Go live section: the decision is the bar", async () => {
        mount(transport("community"), "community");
        await screen.findByRole("heading", { level: 1 });
        expect(document.querySelector(".cbtl-track")).toBeNull();
        expect(screen.queryByText("Go live")).toBeNull();
        expect(bar()).not.toBeNull();
    });
});

describe("the money, from each seat", () => {
    it("shows Marta the EUR 18 down to the EUR 16.98 she keeps, and the break-even before approval", async () => {
        mount(transport("seller"), "seller");
        await screen.findByText("Slow Records: a vinyl listening evening", { selector: "h1" });
        openSection("Earnings");
        expect(screen.getAllByText("€16.98").length).toBeGreaterThan(0);
        expect(screen.getByText("You keep")).toBeTruthy();
        expect(screen.getByText("22 tickets")).toBeTruthy();
        // Nothing has sold before approval: no So far.
        expect(screen.queryByText("So far")).toBeNull();
    });

    it("shows TEJÁ its own view blurred under 'no commission', never the seller's view", async () => {
        mount(transport("community"), "community");
        await screen.findByRole("heading", { level: 1 });
        openSection("Earnings");
        expect(screen.getAllByText("TEJÁ House takes no commission on event ticket sales").length).toBeGreaterThan(0);
        expect(screen.queryByText("You keep")).toBeNull();
        expect(screen.getByText("Paid upfront · Marta Silva pays you")).toBeTruthy();
        expect(screen.getAllByText("€181.48").length).toBeGreaterThan(0);
    });

    it("adds So far once live, and Marta's result so far", async () => {
        mount(transport("seller", { status: "ACTIVE" }), "seller");
        await screen.findByRole("heading", { level: 1 });
        openSection("Earnings");
        expect(screen.getByText("So far")).toBeTruthy();
        expect(screen.getByText("25 sold, refunds left out")).toBeTruthy();
        expect(screen.getByText("+ €240.00")).toBeTruthy();
    });
});

describe("who sees which Cobuntu cut (decided 24 Nov 2026)", () => {
    // A EUR 18 member ticket at 10%: Cobuntu takes EUR 0.46 from Marta and EUR 0.14 of the commission.
    const memberLines = {
        seller: [{ key: "price", amount: 1800 }, { key: "stripe", amount: 52 }, { key: "commission", amount: 180 }, { key: "cobuntu", amount: 46 }, { key: "keep", amount: 1522 }],
        community: [
            { key: "price", amount: 1800 }, { key: "stripe", amount: 52 }, { key: "seller", amount: 1568 },
            { key: "sellerFee", amount: 46 }, { key: "sellerNet", amount: 1522 },
            { key: "commission", amount: 180 }, { key: "cobuntu", amount: 14 }, { key: "keep", amount: 166 },
        ],
    };
    const at10 = (seat: "seller" | "community", lines: any[]) => {
        const t = transport(seat);
        const m = money(seat, false);
        m.oneSale = { ...m.oneSale!, commissionRate: 10, platformFeeRate: 0.08, lines };
        (t.money as any).mockResolvedValue(m);
        return t;
    };

    it("tells the community what Cobuntu takes from the seller as well as its cut", async () => {
        mount(at10("community", memberLines.community), "community");
        await screen.findByRole("heading", { level: 1 });
        openSection("Earnings");
        expect(screen.getByText("€0.46 from Marta Silva, €0.14 of the commission")).toBeTruthy();
        expect(screen.getAllByText("€1.66").length).toBeGreaterThan(0);
    });

    it("never tells the seller Cobuntu's cut of the community's commission", async () => {
        mount(at10("seller", memberLines.seller), "seller");
        await screen.findByRole("heading", { level: 1 });
        openSection("Earnings");
        expect(screen.getByText("fee on your side")).toBeTruthy();
        expect(document.querySelector(".cbtl-inner")!.textContent).not.toMatch(/of the commission/);
        expect(screen.queryByText("€0.14")).toBeNull();
    });
});

describe("several prices, and donations", () => {
    const tiered = (seat: "seller" | "community") => {
        const t = transport(seat);
        const m = money(seat, false);
        m.oneSale = { ...m.oneSale!, commissionRate: 10, lines: [{ key: "price", amount: 1200 }, { key: "stripe", amount: 43 }, { key: "commission", amount: 120 }, { key: "cobuntu", amount: 30 }, { key: "keep", amount: 1007 }] as any };
        m.prices = [
            { productId: "early", label: "Early bird", gross: 1200, vat: 0, free: false, lines: [{ key: "price", amount: 1200 }, { key: "stripe", amount: 43 }, { key: "commission", amount: 120 }, { key: "cobuntu", amount: 30 }, { key: "keep", amount: 1007 }] as any },
            { productId: "general", label: "General", gross: 1800, vat: 0, free: false, lines: [{ key: "price", amount: 1800 }, { key: "stripe", amount: 52 }, { key: "commission", amount: 180 }, { key: "cobuntu", amount: 46 }, { key: "keep", amount: 1522 }] as any },
            { productId: "members", label: "Members", gross: 0, vat: 0, free: true, lines: [] },
        ];
        m.donation = { amount: 1000, lines: [{ key: "price", amount: 1000 }, { key: "stripe", amount: 29 }, { key: "commission", amount: 100 }, { key: "cobuntu", amount: 0 }, { key: "keep", amount: 871 }] as any };
        (t.money as any).mockResolvedValue(m);
        return t;
    };

    it("opens on the cheapest paid ticket, switches price, and says what Marta keeps on every price", async () => {
        mount(tiered("seller"), "seller");
        await screen.findByRole("heading", { level: 1 });
        openSection("Earnings");
        const panel = document.querySelector(".cbtl-panel") as HTMLElement;
        expect(panel.querySelector(".cbtl-ring-hole b")?.textContent).toBe("€12.00");
        fireEvent.click(within(panel.querySelector(".cbtl-seg") as HTMLElement).getByRole("button", { name: /^General/ }));
        expect(panel.querySelector(".cbtl-ring-hole b")?.textContent).toBe("€18.00");
        const every = panel.querySelector(".cbtl-every") as HTMLElement;
        expect(every.textContent).toContain("You keep, every price");
        expect(every.textContent).toContain("€10.07");
        expect(every.textContent).toContain("€15.22");
        expect(every.textContent).toContain("Nothing to split");
    });

    it("gives donations their own line: the community's commission, Cobuntu nothing", async () => {
        mount(tiered("seller"), "seller");
        await screen.findByRole("heading", { level: 1 });
        openSection("Earnings");
        expect(screen.getByText("A €10.00 donation leaves you €8.71 after Stripe and TEJÁ House's commission. Cobuntu takes nothing from donations.")).toBeTruthy();
    });
});

describe("the payment schedule", () => {
    it("names the room, puts the next payment on Marta's card, and lets her answer TEJÁ's price", async () => {
        const t = transport("seller");
        mount(t, "seller");
        await screen.findByRole("heading", { level: 1 });
        openSection("Earnings");
        expect(screen.getAllByText("The Sound Room").length).toBeGreaterThan(0);
        expect(screen.getByText("Your card ending 4242")).toBeTruthy();
        expect(screen.getByText("Tables and chairs")).toBeTruthy();
        fireEvent.click(screen.getByRole("button", { name: "Accept €150.00" }));
        const dialog = await screen.findByRole("dialog");
        fireEvent.click(within(dialog).getByRole("button", { name: "Accept €150.00" }));
        await waitFor(() => expect(t.confirmAddonPrice).toHaveBeenCalledWith("evt", "light"));
    });

    it("opens Stripe's page for a new card when the host gave no publishable key", async () => {
        const t = transport("seller");
        const navigate = vi.fn();
        mount(t, "seller", { navigate });
        await screen.findByRole("heading", { level: 1 });
        openSection("Earnings");
        fireEvent.click(screen.getByRole("button", { name: "Change card" }));
        await waitFor(() => expect(t.startCardChange).toHaveBeenCalledWith("evt", { returnUrl: expect.stringContaining("card=done"), embedded: false }));
        await waitFor(() => expect(navigate).toHaveBeenCalledWith("https://checkout.stripe.com/c/pay/x"));
    });
});

describe("the decision bar", () => {
    it("asks TEJÁ about the booking first while it is in review, and accepting asks first", async () => {
        const t = transport("community", { bookingStatus: "IN_REVIEW" });
        mount(t, "community");
        await screen.findByRole("heading", { level: 1 });
        expect(within(bar()).getByText("Your move")).toBeTruthy();
        expect(within(bar()).queryByRole("button", { name: "Approve & publish" })).toBeNull();
        fireEvent.click(within(bar()).getByRole("button", { name: "Accept the booking" }));
        expect(t.decideBooking).not.toHaveBeenCalled();
        const dialog = await screen.findByRole("dialog");
        fireEvent.click(within(dialog).getByRole("button", { name: "Accept the booking" }));
        await waitFor(() => expect(t.decideBooking).toHaveBeenCalledWith("evt", "ACCEPT"));
    });

    it("never draws a move the host cannot perform, and keeps Approve off while the booking waits", async () => {
        const t = transport("community", { bookingStatus: "IN_REVIEW" });
        delete (t as any).decideBooking;
        mount(t, "community");
        await screen.findByRole("heading", { level: 1 });
        expect(screen.queryByRole("button", { name: "Accept the booking" })).toBeNull();
        const approve = within(bar()).getByRole("button", { name: "Approve & publish" }) as HTMLButtonElement;
        expect(approve.disabled).toBe(true);
        expect(within(bar()).getByText(/Accept or decline the booking/)).toBeTruthy();
    });

    it("publishes once nothing blocks, after the confirmation says at which terms", async () => {
        const t = transport("community");
        const m = money("community", false);
        m.upfront!.addons = m.upfront!.addons.filter((a) => a.status !== "PRICE_PROPOSED");
        (t.money as any).mockResolvedValue(m);
        mount(t, "community");
        await screen.findByRole("heading", { level: 1 });
        expect(within(bar()).getByText("Ready to publish")).toBeTruthy();
        fireEvent.click(within(bar()).getByRole("button", { name: "Approve & publish" }));
        const dialog = await screen.findByRole("dialog");
        expect(dialog.textContent).toContain("no commission on event tickets");
        fireEvent.click(within(dialog).getByRole("button", { name: "Approve & publish" }));
        await waitFor(() => expect(t.setStatus).toHaveBeenCalledWith("ACTIVE"));
    });

    it("lets Marta pause a live listing, only after the confirmation", async () => {
        const t = transport("seller", { status: "ACTIVE" });
        mount(t, "seller");
        await screen.findByRole("heading", { level: 1 });
        expect(within(bar()).getByText("Live")).toBeTruthy();
        expect(screen.queryByRole("button", { name: "Take it off the shelf" })).toBeNull();
        fireEvent.click(within(bar()).getByRole("button", { name: "Pause" }));
        const dialog = await screen.findByRole("dialog");
        expect(dialog.textContent).toContain("Nobody can buy it until you resume");
        expect(t.setStatus).not.toHaveBeenCalled();
        fireEvent.click(within(dialog).getByRole("button", { name: "Pause" }));
        await waitFor(() => expect(t.setStatus).toHaveBeenCalledWith("PAUSED"));
    });

    it("never resumes in one click: Resume confirms too", async () => {
        const t = transport("community", { status: "ACTIVE" });
        (t.listing as any).mockImplementation(async () => ({
            id: "lst", status: "ACTIVE", isHidden: true, commissionRate: 0, isPaid: true, listingPrice: { amount: 18, currency: "EUR" },
            createdAt: "2026-11-18T09:00:00Z", approvedAt: "2026-11-24T10:00:00Z",
            community: { id: "teja", name: "TEJÁ House", communityTag: "tejahouse", iconUrl: null },
            requestedBy: { id: "marta", name: "Marta Silva", usertag: "marta-silva", profileImage: null },
            event: { id: "evt", name: "Slow Records: a vinyl listening evening", slug: "slow-records", startDate: "2026-12-09T18:00:00Z" },
        }));
        mount(t, "community");
        await screen.findByRole("heading", { level: 1 });
        expect(within(bar()).getByText("Paused")).toBeTruthy();
        fireEvent.click(within(bar()).getByRole("button", { name: "Resume" }));
        expect(t.setHidden).not.toHaveBeenCalled();
        const dialog = await screen.findByRole("dialog");
        fireEvent.click(within(dialog).getByRole("button", { name: "Resume" }));
        await waitFor(() => expect(t.setHidden).toHaveBeenCalledWith(false));
    });

    it("calls Take it down Remove, and says it is for good", async () => {
        const t = transport("community", { status: "ACTIVE" });
        mount(t, "community");
        await screen.findByRole("heading", { level: 1 });
        expect(screen.queryByRole("button", { name: "Take it down" })).toBeNull();
        fireEvent.click(within(bar()).getByRole("button", { name: "Remove" }));
        const dialog = await screen.findByRole("dialog");
        expect(dialog.textContent).toContain("for good");
        fireEvent.click(within(dialog).getByRole("button", { name: "Remove" }));
        await waitFor(() => expect(t.setStatus).toHaveBeenCalledWith("REVOKED"));
    });
});

describe("picking a package", () => {
    const unagreed = (seat: "seller" | "community", proposals: any[] = []) => {
        const t = transport(seat);
        (t.listing as any).mockImplementation(async () => ({
            id: "lst", status: "PENDING", isHidden: false, commissionRate: null, isPaid: true, listingPrice: { amount: 18, currency: "EUR" },
            createdAt: "2026-11-18T09:00:00Z", approvedAt: null,
            community: { id: "teja", name: "TEJÁ House", communityTag: "tejahouse", iconUrl: null },
            requestedBy: { id: "marta", name: "Marta Silva", usertag: "marta-silva", profileImage: null },
            event: { id: "evt", name: "Slow Records: a vinyl listening evening", slug: "slow-records", startDate: "2026-12-09T18:00:00Z" },
        }));
        (t.proposals as any).mockResolvedValue(proposals);
        (t.packages as any).mockResolvedValue([
            { id: "standard", name: "Standard", description: "On TEJÁ's page.", rate: 10 },
            { id: "featured", name: "Featured", description: "Standard, plus the newsletter.", rate: 15 },
        ]);
        (t.money as any).mockImplementation(async (opts?: { packageId?: string }) => {
            const m = money(seat, false);
            if (opts?.packageId) {
                const rate = opts.packageId === "featured" ? 15 : 10;
                m.previewPackage = { id: opts.packageId, name: opts.packageId === "featured" ? "Featured" : "Standard", rate };
                m.oneSale = { ...m.oneSale!, commissionRate: rate, rateSource: "proposed" };
            } else {
                m.oneSale = { ...m.oneSale!, rateSource: "none" };
            }
            return m;
        });
        return t;
    };

    it("asks for a package before anything else, and previews the split before sending it", async () => {
        const t = unagreed("seller");
        mount(t, "seller");
        await screen.findByRole("heading", { level: 1 });
        expect(within(bar()).getByText("Pick how TEJÁ House lists it")).toBeTruthy();
        fireEvent.click(within(bar()).getByRole("button", { name: "Pick a package" }));
        const sheet = await screen.findByRole("dialog");
        fireEvent.click(await within(sheet).findByRole("radio", { name: /Featured/ }));
        await waitFor(() => expect(t.money).toHaveBeenCalledWith({ packageId: "featured" }));
        await within(sheet).findByText("On Featured, one sale splits like this");
        // No note: the conversation is Negotiation.
        expect(within(sheet).queryByRole("textbox")).toBeNull();
        fireEvent.click(within(sheet).getByRole("button", { name: "Send Featured to TEJÁ House" }));
        await waitFor(() => expect(t.propose).toHaveBeenCalledWith({ packageId: "featured" }));
    });

    it("shows Earnings empty until a package is agreed", async () => {
        mount(unagreed("community"), "community");
        await screen.findByRole("heading", { level: 1 });
        openSection("Earnings");
        expect(screen.getByText("No package agreed yet")).toBeTruthy();
    });

    it("accepting the other side's package shows its split first, then accepts it", async () => {
        const offer = { id: "p1", status: "PENDING", commissionRate: 10, createdAt: "2026-11-24T18:00:00Z", proposedByUserId: "avi", package: { id: "standard", name: "Standard", rate: 10 } };
        const t = unagreed("seller", [offer]);
        mount(t, "seller");
        await screen.findByRole("heading", { level: 1 });
        expect(within(bar()).getByText("Your answer")).toBeTruthy();
        expect(within(bar()).getByText("TEJÁ House picked Standard · 10%")).toBeTruthy();
        fireEvent.click(within(bar()).getByRole("button", { name: "Accept 10%" }));
        const sheet = await screen.findByRole("dialog");
        await waitFor(() => expect(t.money).toHaveBeenCalledWith({ packageId: "standard" }));
        expect(t.respond).not.toHaveBeenCalled();
        fireEvent.click(await within(sheet).findByRole("button", { name: "Accept Standard" }));
        await waitFor(() => expect(t.respond).toHaveBeenCalledWith("p1", "ACCEPTED"));
    });
});

describe("Negotiation", () => {
    it("is one chat: a reply goes to the open thread, and the offers sit in it", async () => {
        const t = transport("seller");
        (t.topics as any).mockResolvedValue([{ id: "tp", subject: "The photographer", status: "OPEN", closedBySeller: false, closedByCommunity: false, openedByUserId: "marta", comments: [{ id: "c1", body: "Mostly the room during the two sides.", authorUserId: "marta", createdAt: "2026-11-24T18:02:00Z" }] }]);
        (t.proposals as any).mockResolvedValue([{ id: "p1", status: "PENDING", commissionRate: 10, createdAt: "2026-11-24T18:05:00Z", proposedByUserId: "avi", package: { id: "standard", name: "Standard" } }]);
        mount(t, "seller", { currentUser: { id: "marta", name: "Marta Silva" } });
        await screen.findByRole("heading", { level: 1 });
        openSection("Negotiation");
        expect(screen.getByText("Mostly the room during the two sides.")).toBeTruthy();
        expect(screen.getByText("TEJÁ House offered Standard · 10%")).toBeTruthy();
        expect(screen.queryByRole("button", { name: "Raise something" })).toBeNull();
        const box = screen.getByRole("textbox", { name: "Message…" });
        fireEvent.change(box, { target: { value: "Could it be 2 hours?" } });
        fireEvent.click(screen.getByRole("button", { name: "Send" }));
        await waitFor(() => expect(t.comment).toHaveBeenCalledWith("tp", "Could it be 2 hours?"));
    });

    it("opens the conversation with the first message", async () => {
        const t = transport("community");
        mount(t, "community");
        await screen.findByRole("heading", { level: 1 });
        openSection("Negotiation");
        fireEvent.change(screen.getByRole("textbox", { name: "Message…" }), { target: { value: "Welcome, Marta." } });
        fireEvent.click(screen.getByRole("button", { name: "Send" }));
        await waitFor(() => expect(t.openTopic).toHaveBeenCalledWith({ subject: "Conversation", body: "Welcome, Marta." }));
    });
});

describe("every sentence is filled", () => {
    it.each(["seller", "community"] as const)("shows no raw {placeholder} in any section or the bar, live, from the %s's seat", async (seat) => {
        mount(transport(seat, { status: "ACTIVE" }), seat);
        await screen.findByRole("heading", { level: 1 });
        for (const name of ["Overview", "Earnings", "Negotiation"] as const) {
            openSection(name);
            expect(document.querySelector(".cbtl-inner")?.textContent ?? "").not.toMatch(/\{[a-zA-Z]+\}/);
        }
    });

    it("says what came from commission without an empty upfront figure", async () => {
        const t = transport("community", { status: "ACTIVE" });
        const m = money("community", true);
        m.upfront = null;
        m.result = { kind: "communitySoFar", fromSales: 2096, upfrontIn: 0, amount: 2096, toCome: 0, nextDueAt: null };
        (t.money as any).mockResolvedValue(m);
        mount(t, "community");
        await screen.findByRole("heading", { level: 1 });
        openSection("Earnings");
        expect(screen.getByText("€20.96 from commission")).toBeTruthy();
        expect(screen.queryByText(/€0.00 upfront/)).toBeNull();
    });
});

describe("paused, and free", () => {
    it("says Live while on sale, and Paused by Marta when she paused it", async () => {
        const live = transport("community", { status: "ACTIVE" });
        const first = mount(live, "community");
        await screen.findByRole("heading", { level: 1 });
        expect(within(bar()).getByText("Live")).toBeTruthy();
        first.unmount();
        const paused = transport("community", { status: "PAUSED" });
        mount(paused, "community");
        await screen.findByRole("heading", { level: 1 });
        expect(within(bar()).getByText("Paused by Marta Silva")).toBeTruthy();
    });

    it("says a free event has nothing to split", async () => {
        const t = transport("community", { status: "ACTIVE" });
        const m = money("community", true);
        m.oneSale = null;
        (t.money as any).mockResolvedValue(m);
        mount(t, "community");
        await screen.findByRole("heading", { level: 1 });
        openSection("Earnings");
        expect(screen.getByText("Nothing is sold, so there is nothing to split.")).toBeTruthy();
    });
});

describe("Overview", () => {
    it("is the item's card: its photos, price, date and who sent it", async () => {
        const t = transport("community");
        (t.listing as any).mockImplementation(async () => ({
            id: "lst", status: "PENDING", isHidden: false, commissionRate: 0, isPaid: true, listingPrice: { amount: 18, currency: "EUR" },
            createdAt: "2026-11-18T09:00:00Z", approvedAt: null,
            community: { id: "teja", name: "TEJÁ House", communityTag: "tejahouse", iconUrl: null },
            requestedBy: { id: "marta", name: "Marta Silva", usertag: "marta-silva", profileImage: null },
            event: {
                id: "evt", name: "Slow Records: a vinyl listening evening", slug: "slow-records", startDate: "2026-12-09T18:00:00Z", endDate: "2026-12-09T21:00:00Z",
                bannerUrl: "https://img/a.jpg", images: ["https://img/b.jpg"], description: "<p>Two sides of a record.</p><p>Bring one.</p>", tags: ["vinyl", { name: "listening" }],
            },
        }));
        mount(t, "community");
        await screen.findByRole("heading", { level: 1 });
        const card = document.querySelector(".cbtl-ov-card") as HTMLElement;
        expect(card.querySelectorAll(".cbtl-ov-thumb")).toHaveLength(2);
        expect(within(card).getByText("€18.00")).toBeTruthy();
        expect(within(card).getByText("vinyl, listening")).toBeTruthy();
        expect(within(card).getByText("@marta-silva")).toBeTruthy();
        // The description is read as text, never as markup.
        expect(screen.getByText("Two sides of a record.")).toBeTruthy();
        expect(screen.getByText("Bring one.")).toBeTruthy();
        fireEvent.click(within(card).getByRole("button", { name: "Next photo" }));
        expect((card.querySelector(".cbtl-ov-photo img") as HTMLImageElement).src).toBe("https://img/b.jpg");
    });
});

describe("a host's own page background", () => {
    // The admin and the app pass a transparent background so their own page
    // shows around the cards. It once also emptied the ring's hole, so the
    // amount sat on top of the coloured wedges.
    it("shows through around the cards, never through the tinted parts inside them", async () => {
        mount(transport("community", { status: "ACTIVE" }), "community", { theme: { background: "transparent" } });
        await screen.findByRole("heading", { level: 1 });
        const root = document.querySelector<HTMLElement>(".cbtl")!;
        expect(root.style.getPropertyValue("--cbtl-page")).toBe("transparent");
        expect(root.style.getPropertyValue("--cbtl-bg")).toBe("");
        expect(LISTING_PAGE_CSS).toMatch(/\.cbtl\{[^}]*background:var\(--cbtl-page,var\(--cbtl-bg\)\)/);
        // The cards draw on their own card colour, not the page's.
        expect(LISTING_PAGE_CSS).toMatch(/\.cbtl-panel\{[^}]*background:var\(--cbtl-card\)/);
    });
});

/*
 * The header (option A, 2026-11-24): the item's name, the other side, and
 * the host's buttons. No item picture, no sent date, no History, no status.
 */
describe("the header", () => {
    const header = (c: HTMLElement) => c.querySelector(".cbtl-head") as HTMLElement;

    it("shows the community the seller's photo, name and @usertag, and nothing else", async () => {
        const { container } = mount(transport("community"), "community");
        await waitFor(() => expect(header(container)).not.toBeNull());
        const h = header(container);
        await waitFor(() => expect(within(h).getByText("Marta Silva")).toBeTruthy());
        expect(within(h).getByText("@marta-silva")).toBeTruthy();
        expect(h.textContent).not.toMatch(/sent /i);
        expect(within(h).queryByRole("button", { name: /history/i })).toBeNull();
        // No item picture: any image in the header is the seller's avatar.
        expect([...h.querySelectorAll("img")].filter((i) => !i.closest(".cbtl-avatar"))).toHaveLength(0);
    });

    it("shows the seller the community, with no @usertag", async () => {
        const { container } = mount(transport("seller"), "seller");
        await waitFor(() => expect(within(header(container)).getByText("with TEJÁ House")).toBeTruthy());
        expect(header(container).textContent).not.toContain("@");
    });

    it("carries the host's buttons, and no button row without them", async () => {
        const first = mount(transport("community"), "community", {
            tools: <a className="cbtl-hbtn" data-kind="primary" href="/item">Details</a>,
        });
        await waitFor(() => expect(first.container.querySelector(".cbtl-tools .cbtl-hbtn")).not.toBeNull());
        first.unmount();
        const { container } = mount(transport("community"), "community");
        await waitFor(() => expect(header(container)).not.toBeNull());
        expect(container.querySelector(".cbtl-tools")).toBeNull();
    });

    it("puts the way back on the trail: its first link wears a back chevron", async () => {
        const { container } = mount(transport("community"), "community");
        await waitFor(() => expect(container.querySelector(".cbtl-crumb a")).not.toBeNull());
        const back = container.querySelector(".cbtl-crumb a") as HTMLAnchorElement;
        expect(back.getAttribute("href")).toBe("/back");
        expect(back.classList.contains("cbtl-crumb-back")).toBe(true);
        expect(back.querySelector("svg")).not.toBeNull();
    });

    it("gives both hosts one button style: outlined, and solid for the primary", () => {
        expect(LISTING_PAGE_CSS).toContain(".cbtl-hbtn{");
        expect(LISTING_PAGE_CSS).toContain('.cbtl-hbtn[data-kind="primary"]{');
        // View live is always in the header; before the listing is live it is
        // drawn disabled (aria-disabled), never as a link to a page not there.
        expect(LISTING_PAGE_CSS).toContain('.cbtl-hbtn[aria-disabled="true"]{');
        expect(LISTING_PAGE_CSS).not.toContain(".cbtl-head-img");
    });
});
