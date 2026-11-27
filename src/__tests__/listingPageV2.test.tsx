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
import { holeFontSize } from "../listings/v2/sections";
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
        expect(within(bar()).queryByRole("button", { name: /^Approve/ })).toBeNull();
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
        const approve = within(bar()).getByRole("button", { name: "Approve at 0%" }) as HTMLButtonElement;
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
        fireEvent.click(within(bar()).getByRole("button", { name: "Approve at 0%" }));
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
        // Says what it does: "Pause sales", never "take it off the shelf".
        expect(screen.queryByRole("button", { name: /shelf/i })).toBeNull();
        fireEvent.click(within(bar()).getByRole("button", { name: "Pause sales" }));
        const dialog = await screen.findByRole("dialog");
        expect(dialog.textContent).toContain("Pause sales on TEJÁ House?");
        expect(dialog.textContent).toContain("Nobody can buy it until you resume");
        expect(t.setStatus).not.toHaveBeenCalled();
        fireEvent.click(within(dialog).getByRole("button", { name: "Pause sales" }));
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
        fireEvent.click(within(bar()).getByRole("button", { name: "Resume sales" }));
        expect(t.setHidden).not.toHaveBeenCalled();
        const dialog = await screen.findByRole("dialog");
        expect(dialog.textContent).toContain("Resume sales on TEJÁ House?");
        fireEvent.click(within(dialog).getByRole("button", { name: "Resume sales" }));
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

    it("still draws the split for a free event: a dashed ring, every party's line at nothing", async () => {
        const t = transport("community", { status: "ACTIVE" });
        const m = money("community", true);
        m.oneSale = null;
        (t.money as any).mockResolvedValue(m);
        mount(t, "community");
        await screen.findByRole("heading", { level: 1 });
        openSection("Earnings");
        expect(screen.getByText("Nothing is sold, so there is nothing to split.")).toBeTruthy();
        const panel = document.querySelector('.cbtl-panel[data-placeholder]') as HTMLElement;
        expect(panel.querySelector("circle[stroke-dasharray]")).not.toBeNull();
        expect(within(panel).getByText("Free")).toBeTruthy();
        expect(within(panel).getByText("Stripe")).toBeTruthy();
        expect(within(panel).getAllByText("€0.00").length).toBe(4);
    });
});

describe("Overview", () => {
    const eventListing = () => ({
        id: "lst", status: "PENDING", isHidden: false, commissionRate: 0, isPaid: true, listingPrice: { amount: 18, currency: "EUR" },
        createdAt: "2026-11-18T09:00:00Z", approvedAt: null,
        community: { id: "teja", name: "TEJÁ House", communityTag: "tejahouse", iconUrl: null },
        requestedBy: { id: "marta", name: "Marta Silva", usertag: "marta-silva", profileImage: null },
        event: {
            id: "evt", name: "Slow Records: a vinyl listening evening", slug: "slow-records", startDate: "2026-12-09T18:00:00Z", endDate: "2026-12-09T21:00:00Z",
            bannerUrl: "https://img/a.jpg", images: ["https://img/b.jpg"], description: "<p>Two sides of a record.</p><p>Bring one.</p>", tags: ["vinyl", { name: "listening" }],
        },
    });

    it("puts the facts on the page beside the photos, no box, and never repeats the name", async () => {
        const t = transport("community");
        (t.listing as any).mockImplementation(async () => eventListing());
        mount(t, "community");
        await screen.findByRole("heading", { level: 1 });
        const top = document.querySelector(".cbtl-ov-top") as HTMLElement;
        expect(document.querySelector(".cbtl-ov-card")).toBeNull();
        expect(top.querySelectorAll(".cbtl-ov-thumb")).toHaveLength(2);
        expect(within(top).getByText("€18.00")).toBeTruthy();
        expect(within(top).getByText("vinyl, listening")).toBeTruthy();
        expect(within(top).getByText("@marta-silva")).toBeTruthy();
        expect(within(top).queryByText("Slow Records: a vinyl listening evening")).toBeNull();
        fireEvent.click(within(top).getByRole("button", { name: "Next photo" }));
        expect((top.querySelector(".cbtl-ov-photo img") as HTMLImageElement).src).toBe("https://img/b.jpg");
    });

    it("always has Category and Tags rows, and says Sent with the date, the year and the time", async () => {
        const t = transport("community");
        (t.listing as any).mockImplementation(async () => ({ ...eventListing(), event: { ...eventListing().event, tags: [] } }));
        mount(t, "community");
        await screen.findByRole("heading", { level: 1 });
        const top = document.querySelector(".cbtl-ov-top") as HTMLElement;
        expect(within(top).getByText("No category")).toBeTruthy();
        expect(within(top).getByText("No tags")).toBeTruthy();
        expect(within(top).getByText("Sent")).toBeTruthy();
        expect(within(top).getByText(/^18 Nov 2026, \d\d:\d\d$/)).toBeTruthy();
        expect(within(top).getByText("Owner")).toBeTruthy();
    });

    it("reads the description as an article under its heading, as text, never as markup", async () => {
        const t = transport("community");
        (t.listing as any).mockImplementation(async () => eventListing());
        mount(t, "community");
        await screen.findByRole("heading", { level: 1 });
        const sec = screen.getByRole("region", { name: "Description" });
        expect(within(sec).getByRole("heading", { name: "Description" })).toBeTruthy();
        expect(within(sec).getByText("Two sides of a record.")).toBeTruthy();
        expect(within(sec).getByText("Bring one.")).toBeTruthy();
    });

    it("shows a product's photos from its media list, banner first, and its category and tags by name", async () => {
        const t = transport("community");
        (t.listing as any).mockImplementation(async () => ({
            ...eventListing(), event: undefined,
            products: {
                id: "prd", name: "Immersion to Austin Texas", price: 399700, description: "Cybertech Texas Mission.",
                product_media: [
                    { url: "https://img/second.jpg", order: 2, isBanner: false, mimeType: "image/jpeg" },
                    { url: "https://img/doc.pdf", order: 0, isBanner: false, mimeType: "application/pdf" },
                    { url: "https://img/first.jpg", order: 1, isBanner: true, mimeType: "image/jpeg" },
                ],
                category: { id: "c", name: "Programmes" }, subcategory: { id: "s", name: "Missions abroad" },
                tags: [{ id: "t1", name: "startups" }, { id: "t2", name: "usa" }],
            },
        }));
        render(<ListingPageV2 transport={t} seat="community" kind="product" backHref="/back" />);
        await screen.findByRole("heading", { level: 1 });
        const top = document.querySelector(".cbtl-ov-top") as HTMLElement;
        expect((top.querySelector(".cbtl-ov-photo img") as HTMLImageElement).src).toBe("https://img/first.jpg");
        expect(top.querySelectorAll(".cbtl-ov-thumb")).toHaveLength(2);
        expect(within(top).getByText("Programmes › Missions abroad")).toBeTruthy();
        expect(within(top).getByText("startups, usa")).toBeTruthy();
    });
});

describe("the ring's hole", () => {
    it("keeps a short price at full size and shrinks a long one until it fits inside", () => {
        expect(holeFontSize("€6.90", 176)).toBe(20);
        expect(holeFontSize("US$3,997.00", 176)).toBeLessThanOrEqual(14);
        // About 0.6em a character: the text stays inside the ~100px hole of a 176px ring.
        expect(holeFontSize("US$3,997.00", 176) * 0.6 * "US$3,997.00".length).toBeLessThanOrEqual(100);
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

describe("whose item it is, and people's pictures (24 Nov 2026)", () => {
    const owned = (overrides: Record<string, unknown> = {}) => ({
        id: "lst", status: "ACTIVE", isHidden: false, commissionRate: 0, isPaid: false, listingPrice: null,
        createdAt: "2026-11-22T13:56:00Z", approvedAt: "2026-11-22T14:00:00Z",
        community: { id: "fsc", name: "Finance Social Club", communityTag: "fsc", iconUrl: "https://img/fsc.png" },
        requestedBy: { id: "buntu", name: "Buntu", usertag: "buntu", profileImage: null },
        event: { id: "evt", name: "Sessão de Boas-Vindas", slug: "boas-vindas", startDate: "2026-11-29T17:00:00Z", communityId: "fsc" },
        ...overrides,
    });

    it("says from the community, not with it, on its own item, and names it as the owner, not the collaborator who sent it", async () => {
        const t = transport("seller", { status: "ACTIVE" });
        (t.listing as any).mockImplementation(async () => owned());
        mount(t, "seller");
        await screen.findByRole("heading", { level: 1 });
        expect(within(document.querySelector(".cbtl-head") as HTMLElement).getByText("from Finance Social Club")).toBeTruthy();
        const top = document.querySelector(".cbtl-ov-top") as HTMLElement;
        expect(within(top).getByText("Finance Social Club")).toBeTruthy();
        expect(within(top).queryByText("Buntu")).toBeNull();
    });

    it("keeps 'with' for a member's own item", async () => {
        const t = transport("seller");
        mount(t, "seller");
        await screen.findByRole("heading", { level: 1 });
        expect(within(document.querySelector(".cbtl-head") as HTMLElement).getByText("with TEJÁ House")).toBeTruthy();
    });

    it("gives a person without a photo their library avatar, never a bare letter", async () => {
        const t = transport("community");
        mount(t, "community");
        await screen.findByRole("heading", { level: 1 });
        const img = document.querySelector(".cbtl-head .cbtl-avatar img") as HTMLImageElement;
        expect(img.src).toBe("https://api.cobuntu.com/api/avatars/auto/marta.svg");
        // A failed load walks on to the neutral library avatar.
        fireEvent.error(img);
        expect((document.querySelector(".cbtl-head .cbtl-avatar img") as HTMLImageElement).src).toBe("https://api.cobuntu.com/api/avatars/cobuntu-campfire.svg");
    });

    it("says no sold count in the bar of a live listing", async () => {
        const t = transport("seller", { status: "ACTIVE" });
        mount(t, "seller");
        await screen.findByRole("heading", { level: 1 });
        expect(bar().textContent).not.toMatch(/sold/);
    });
});

describe("a community's own item, in itself and in another community (25 Nov 2026)", () => {
    const fsc = { id: "fsc", name: "Finance Social Club", communityTag: "fsc", iconUrl: "https://img/fsc.png" };
    const teja = { id: "teja", name: "TEJÁ House", communityTag: "tejahouse", iconUrl: null };
    const listingIn = (community: typeof fsc | typeof teja, over: Record<string, unknown> = {}) => ({
        id: "lst", status: "ACTIVE", isHidden: false, commissionRate: null, isPaid: true, listingPrice: { amount: 18, currency: "EUR" },
        createdAt: "2026-11-22T13:56:00Z", approvedAt: "2026-11-22T14:00:00Z", community,
        requestedBy: { id: "buntu", name: "Buntu", usertag: "buntu", profileImage: null },
        event: { id: "evt", name: "Sessão de Boas-Vindas", slug: "boas-vindas", startDate: "2026-11-29T17:00:00Z", communityId: "fsc", community: fsc },
        ...over,
    });
    const moneyWith = (over: Partial<ListingMoney>): ListingMoney => ({
        kind: "event", listingId: "lst", seat: "seller", status: "ACTIVE", live: false, currency: "EUR",
        oneSale: null, soldSoFar: null, upfront: null, result: null, prices: [], donation: null, ...over,
    } as ListingMoney);
    const lineNames = () => [...document.querySelectorAll(".cbtl-lines .cbtl-line-name b")].map((b) => b.textContent);

    it("on itself, free: you are the community, there is no community line, and Cobuntu says its rate", async () => {
        const t = transport("seller", { status: "ACTIVE" });
        (t.listing as any).mockImplementation(async () => listingIn(fsc, { isPaid: false, listingPrice: null }));
        (t.money as any).mockResolvedValue(moneyWith({
            rates: { cobuntuPct: 8, stream: "events", commissionPct: null, commissionSource: "none", ownedByListingCommunity: true },
        }));
        mount(t, "seller");
        await screen.findByRole("heading", { level: 1 });
        openSection("Earnings");
        expect(lineNames()).toEqual(["You keep", "Cobuntu", "Stripe"]);
        const keep = document.querySelector(".cbtl-lines .cbtl-line") as HTMLElement;
        expect(keep.querySelector("img")?.getAttribute("src")).toBe("https://img/fsc.png");
        expect(screen.getByText("8% of event sales")).toBeTruthy();
    });

    it("on itself, paid: it keeps both shares, from the community's seat too", async () => {
        const t = transport("community", { status: "ACTIVE" });
        (t.listing as any).mockImplementation(async () => listingIn(fsc));
        const community = [
            { key: "price", amount: 1800 }, { key: "stripe", amount: 52 }, { key: "seller", amount: 1748 },
            { key: "sellerFee", amount: 144 }, { key: "sellerNet", amount: 1604 },
            { key: "commission", amount: 0 }, { key: "cobuntu", amount: 0 }, { key: "keep", amount: 0 },
        ];
        (t.money as any).mockResolvedValue(moneyWith({
            seat: "community",
            oneSale: { gross: 1800, vat: 0, commissionRate: 0, rateSource: "none", platformFeeRate: 0.08, memberSale: false, sellerPremium: false, lines: community as any },
            rates: { cobuntuPct: 8, stream: "events", commissionPct: null, commissionSource: "none", ownedByListingCommunity: true },
        }));
        mount(t, "community");
        await screen.findByRole("heading", { level: 1 });
        openSection("Earnings");
        expect(lineNames()).toEqual(["You keep", "Cobuntu", "Stripe"]);
        const amounts = [...document.querySelectorAll(".cbtl-lines .cbtl-line-amt")].map((b) => b.textContent);
        expect(amounts).toEqual(["€16.04", "€1.44", "€0.52"]);
        // No "pick a package" for a community selling its own item, and no blurred 0% overlay.
        expect(screen.queryByText("Pick a package")).toBeNull();
        expect(document.querySelector(".cbtl-blurwrap")).toBeNull();
    });

    it("in another community: you are the owner, that community takes its agreed %, Cobuntu its rate on your side", async () => {
        const t = transport("seller", { status: "ACTIVE" });
        (t.listing as any).mockImplementation(async () => listingIn(teja, { commissionRate: 10 }));
        const seller = [
            { key: "price", amount: 1800 }, { key: "stripe", amount: 52 }, { key: "commission", amount: 180 },
            { key: "cobuntu", amount: 72 }, { key: "keep", amount: 1496 }, { key: "commissionCut", amount: 14 }, { key: "communityNet", amount: 166 },
        ];
        (t.money as any).mockResolvedValue(moneyWith({
            oneSale: { gross: 1800, vat: 0, commissionRate: 10, rateSource: "agreed", platformFeeRate: 0.04, memberSale: false, sellerPremium: false, lines: seller as any },
            rates: { cobuntuPct: 4, stream: "events", commissionPct: 10, commissionSource: "agreed", ownedByListingCommunity: false },
        }));
        mount(t, "seller");
        await screen.findByRole("heading", { level: 1 });
        openSection("Earnings");
        expect(lineNames()).toEqual(["You keep", "TEJÁ House", "Cobuntu", "Stripe"]);
        const amounts = [...document.querySelectorAll(".cbtl-lines .cbtl-line-amt")].map((b) => b.textContent);
        expect(amounts).toEqual(["€14.96", "€1.80", "€0.72", "€0.52"]);
        expect(screen.getByText("commission · 10%")).toBeTruthy();
        expect(screen.getByText("4% of event sales")).toBeTruthy();
    });

    it("in another community with no package picked yet: no commission figure", async () => {
        const t = transport("seller", { status: "PENDING" });
        (t.listing as any).mockImplementation(async () => listingIn(teja, { status: "PENDING", approvedAt: null }));
        const seller = [
            { key: "price", amount: 1800 }, { key: "stripe", amount: 52 }, { key: "commission", amount: 0 },
            { key: "cobuntu", amount: 72 }, { key: "keep", amount: 1676 }, { key: "commissionCut", amount: 0 }, { key: "communityNet", amount: 0 },
        ];
        (t.money as any).mockResolvedValue(moneyWith({
            status: "PENDING",
            oneSale: { gross: 1800, vat: 0, commissionRate: 0, rateSource: "none", platformFeeRate: 0.04, memberSale: false, sellerPremium: false, lines: seller as any },
            rates: { cobuntuPct: 4, stream: "events", commissionPct: null, commissionSource: "none", ownedByListingCommunity: false },
        }));
        mount(t, "seller");
        await screen.findByRole("heading", { level: 1 });
        openSection("Earnings");
        const row = [...document.querySelectorAll(".cbtl-lines .cbtl-line")].find((r) => r.textContent?.includes("TEJÁ House")) as HTMLElement;
        expect(row.querySelector(".cbtl-line-amt")?.textContent).toBe("—");
    });
});

describe("a community's own event carried by ANOTHER community, read by the carrier (27 Nov 2026)", () => {
    /*
     * PBN reviewing Impact Hub Porto's Food for Thought #2: EUR 30 + 23% VAT,
     * PBN at 8%. The page called PBN the owner, showed EUR 36.90 as the price,
     * had no VAT anywhere (so fees looked as if taken on the VAT) and said
     * Cobuntu's share of the commission was 8% next to a 5% cut.
     */
    const ihp = { id: "ihp", name: "Impact Hub Porto", communityTag: "impact-hub-porto", iconUrl: null };
    const pbn = { id: "pbn", name: "PBN | Porto Business Network", communityTag: "pbn", iconUrl: null };
    const listing = (event: Record<string, unknown>) => ({
        id: "lst", status: "PENDING", isHidden: false, commissionRate: 8, isPaid: true, listingPrice: { amount: 36.9, currency: "EUR" },
        createdAt: "2026-11-27T14:21:00Z", approvedAt: null, community: pbn,
        requestedBy: { id: "ana", name: "Impact Hub Porto", usertag: "impact-hub-porto", profileImage: null },
        event: { id: "evt", name: "Food for Thought #2", slug: "food-for-thought-2", startDate: "2026-12-11T12:30:00Z", communityId: "ihp", ...event },
    });
    // PBN's seat: price 3690 (3000 + 690 VAT), Stripe 80, the owner's share 3370
    // (incl. VAT), its fee 240 and net 3130, PBN's 240 of which Cobuntu 12, keeps 228.
    const pbnLines = [
        { key: "price", amount: 3690 }, { key: "stripe", amount: 80 }, { key: "seller", amount: 3370 },
        { key: "sellerFee", amount: 240 }, { key: "sellerNet", amount: 3130 }, { key: "commission", amount: 240 },
        { key: "cobuntu", amount: 12 }, { key: "keep", amount: 228 },
    ];
    const carriedMoney = (): ListingMoney => ({
        kind: "event", listingId: "lst", seat: "community", status: "PENDING", live: false, currency: "EUR",
        oneSale: { gross: 3690, vat: 690, commissionRate: 8, rateSource: "agreed", platformFeeRate: 0.05, ownerFeeRate: 0.08, memberSale: false, sellerPremium: false, lines: pbnLines as any },
        soldSoFar: null, upfront: null, result: null, donation: null,
        prices: [{ productId: "t1", label: "Padrão", gross: 3690, vat: 690, free: false, lines: pbnLines as any }],
        rates: { cobuntuPct: 5, ownerCobuntuPct: 8, stream: "events", commissionPct: 8, commissionSource: "agreed", ownedByListingCommunity: false },
    } as ListingMoney);
    // "label note amount" per line, read from the line's own parts: the line also
    // carries a mark (a community without an icon draws its initials), so its
    // whole text would start with "IH", not with the label.
    const rowText = () => [...document.querySelectorAll(".cbtl-lines .cbtl-line")].map((r) => [
        r.querySelector(".cbtl-line-name b")?.textContent ?? "",
        r.querySelector(".cbtl-line-name small")?.textContent ?? "",
        r.querySelector(".cbtl-line-amt")?.textContent ?? "",
    ].join(" ").replace(/\s+/g, " ").trim());

    it("names the OWNING community as the owner, never the carrier", async () => {
        const t = transport("community");
        (t.listing as any).mockImplementation(async () => listing({ community: ihp }));
        (t.money as any).mockResolvedValue(carriedMoney());
        mount(t, "community");
        await screen.findByRole("heading", { level: 1 });
        const top = document.querySelector(".cbtl-ov-top") as HTMLElement;
        expect(within(top).getByText("Impact Hub Porto")).toBeTruthy();
        expect(within(top).queryByText("PBN | Porto Business Network")).toBeNull();
    });

    it("an older backend that sends no owner name never shows the carrier as the owner", async () => {
        const t = transport("community");
        (t.listing as any).mockImplementation(async () => listing({}));
        (t.money as any).mockResolvedValue(carriedMoney());
        mount(t, "community");
        await screen.findByRole("heading", { level: 1 });
        const top = document.querySelector(".cbtl-ov-top") as HTMLElement;
        expect(within(top).queryByText("PBN | Porto Business Network")).toBeNull();
    });

    it("states the price before VAT: EUR 30 + VAT", async () => {
        const t = transport("community");
        (t.listing as any).mockImplementation(async () => listing({ community: ihp }));
        (t.money as any).mockResolvedValue(carriedMoney());
        mount(t, "community");
        await screen.findByRole("heading", { level: 1 });
        const top = document.querySelector(".cbtl-ov-top") as HTMLElement;
        expect(within(top).getByText("€30.00 + VAT")).toBeTruthy();
        expect(within(top).queryByText("€36.90")).toBeNull();
    });

    it("splits the sale with VAT on its own line, the owner's line without it, the ring still the buyer's EUR 36.90", async () => {
        const t = transport("community");
        (t.listing as any).mockImplementation(async () => listing({ community: ihp }));
        (t.money as any).mockResolvedValue(carriedMoney());
        mount(t, "community");
        await screen.findByRole("heading", { level: 1 });
        openSection("Earnings");
        const rows = rowText();
        expect(rows.find((r) => r.startsWith("Impact Hub Porto"))).toMatch(/what they keep.*€24\.40/);
        expect(rows.find((r) => r.startsWith("VAT"))).toMatch(/Impact Hub Porto pays it to the tax office.*€6\.90/);
        expect(rows.some((r) => r.includes("PBN | Porto Business Network what they keep"))).toBe(false);
        expect(rows.find((r) => r.startsWith("Cobuntu"))).toMatch(/€2\.40 from Impact Hub Porto, €0\.12 of the commission/);
        expect(screen.getByText(/Cobuntu's share is 5% of the commission/)).toBeTruthy();
    });
});
