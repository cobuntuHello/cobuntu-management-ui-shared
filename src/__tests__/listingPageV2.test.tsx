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
            requestedBy: { id: "marta", name: "Marta Silva", profileImage: null },
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

const openStep = (name: RegExp) => fireEvent.click(screen.getByRole("button", { name }));

describe("the money, from each seat", () => {
    it("shows Marta the EUR 18 down to the EUR 16.98 she keeps, and the break-even before approval", async () => {
        mount(transport("seller"), "seller");
        await screen.findByText("Slow Records: a vinyl listening evening", { selector: "h1" });
        openStep(/Step 2 of 4, The money/);
        expect(screen.getAllByText("€16.98").length).toBeGreaterThan(0);
        expect(screen.getByText("You keep")).toBeTruthy();
        expect(screen.getByText("22 tickets")).toBeTruthy();
        // Before approval there is only the "One ticket" column.
        expect(screen.queryByText(/Sold so far/)).toBeNull();
    });

    it("shows TEJÁ its own view blurred under 'no commission', never the seller's Cobuntu fee", async () => {
        mount(transport("community"), "community");
        await screen.findByRole("heading", { level: 1 });
        openStep(/Step 2 of 4, The money/);
        expect(screen.getAllByText("TEJÁ House takes no commission on event ticket sales").length).toBeGreaterThan(0);
        expect(screen.queryByText("You keep")).toBeNull();
        expect(screen.getByText("Paid upfront · Marta Silva pays you")).toBeTruthy();
        expect(screen.getAllByText("€181.48").length).toBeGreaterThan(0);
    });

    it("adds 'Sold so far' once live, and Marta's result so far", async () => {
        mount(transport("seller", { status: "ACTIVE" }), "seller");
        await screen.findByRole("heading", { level: 1 });
        openStep(/Step 2 of 4, The money/);
        expect(screen.getByText("Sold so far · 25")).toBeTruthy();
        expect(screen.getByText("+ €240.00")).toBeTruthy();
    });
});

describe("the payment schedule", () => {
    it("names the room, puts the next payment on Marta's card, and lets her answer TEJÁ's price", async () => {
        const t = transport("seller");
        mount(t, "seller");
        await screen.findByRole("heading", { level: 1 });
        openStep(/Step 2 of 4, The money/);
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
        openStep(/Step 2 of 4, The money/);
        fireEvent.click(screen.getByRole("button", { name: "Change card" }));
        await waitFor(() => expect(t.startCardChange).toHaveBeenCalledWith("evt", { returnUrl: expect.stringContaining("card=done"), embedded: false }));
        await waitFor(() => expect(navigate).toHaveBeenCalledWith("https://checkout.stripe.com/c/pay/x"));
    });
});

describe("the request", () => {
    it("opens on the booking for TEJÁ while it is in review, and accepting asks first", async () => {
        const t = transport("community", { bookingStatus: "IN_REVIEW" });
        mount(t, "community");
        await screen.findByRole("heading", { name: "The request", level: 2 });
        fireEvent.click(screen.getByRole("button", { name: "Accept the booking" }));
        expect(t.decideBooking).not.toHaveBeenCalled();
        const dialog = await screen.findByRole("dialog");
        fireEvent.click(within(dialog).getByRole("button", { name: "Accept the booking" }));
        await waitFor(() => expect(t.decideBooking).toHaveBeenCalledWith("evt", "ACCEPT"));
    });

    it("never draws a lever the host cannot perform", async () => {
        const t = transport("community", { bookingStatus: "IN_REVIEW" });
        delete (t as any).decideBooking;
        mount(t, "community");
        await screen.findByRole("heading", { name: "The request", level: 2 });
        expect(screen.queryByRole("button", { name: "Accept the booking" })).toBeNull();
    });
});

describe("going live", () => {
    it("keeps 'Approve & publish' off while the booking waits, and says why", async () => {
        mount(transport("community", { bookingStatus: "IN_REVIEW" }), "community");
        await screen.findByRole("heading", { level: 1 });
        openStep(/Step 4 of 4, Go live/);
        const approve = screen.getByRole("button", { name: "Approve & publish" }) as HTMLButtonElement;
        expect(approve.disabled).toBe(true);
        expect(screen.getByText("Accept or decline the booking")).toBeTruthy();
    });

    it("publishes once nothing blocks, after the confirmation", async () => {
        const t = transport("community");
        // Nothing waiting on anyone: the add-on is agreed.
        const m = money("community", false);
        m.upfront!.addons = m.upfront!.addons.filter((a) => a.status !== "PRICE_PROPOSED");
        (t.money as any).mockResolvedValue(m);
        mount(t, "community");
        await screen.findByRole("heading", { name: "Go live", level: 2 });
        fireEvent.click(screen.getByRole("button", { name: "Approve & publish" }));
        const dialog = await screen.findByRole("dialog");
        fireEvent.click(within(dialog).getByRole("button", { name: "Approve & publish" }));
        await waitFor(() => expect(t.setStatus).toHaveBeenCalledWith("ACTIVE"));
    });

    it("lets Marta take a live listing off the shelf, after the confirmation", async () => {
        const t = transport("seller", { status: "ACTIVE" });
        mount(t, "seller");
        await screen.findByRole("heading", { level: 1 });
        openStep(/Step 4 of 4, Go live/);
        fireEvent.click(screen.getByRole("button", { name: "Take it off the shelf" }));
        const dialog = await screen.findByRole("dialog");
        fireEvent.click(within(dialog).getByRole("button", { name: "Take it off the shelf" }));
        await waitFor(() => expect(t.setStatus).toHaveBeenCalledWith("PAUSED"));
    });
});

describe("the talk", () => {
    it("sends a reply on Enter and marks a topic done for the viewer's side only", async () => {
        const t = transport("seller");
        (t.topics as any).mockResolvedValue([{ id: "tp", subject: "The photographer", status: "OPEN", closedBySeller: false, closedByCommunity: false, openedByUserId: "marta", comments: [{ id: "c1", body: "Mostly the room during the two sides.", authorUserId: "marta" }] }]);
        mount(t, "seller", { currentUser: { id: "marta", name: "Marta Silva" } });
        await screen.findByRole("heading", { level: 1 });
        openStep(/Step 3 of 4, The talk/);
        const box = screen.getByRole("textbox", { name: "Reply..." });
        fireEvent.change(box, { target: { value: "Could it be 2 hours?" } });
        fireEvent.keyDown(box, { key: "Enter" });
        await waitFor(() => expect(t.comment).toHaveBeenCalledWith("tp", "Could it be 2 hours?"));
        fireEvent.click(screen.getByRole("button", { name: "✓ It is done" }));
        await waitFor(() => expect(t.setTopicDone).toHaveBeenCalledWith("tp", true));
    });
});
