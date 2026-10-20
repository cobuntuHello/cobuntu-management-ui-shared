/**
 * Approve is disabled exactly where the server refuses it.
 *
 * EventListingService throws "Commission proposal must be accepted before
 * approving a paid event listing" when a paid MEMBER event reaches approval
 * with its ticket listing still PENDING -- that is, with no rate the seller has
 * ACCEPTED. Offering a package is not enough; they have to confirm it.
 *
 * Until this, the leader got an enabled "Approve & publish" and a thrown error,
 * which reads as a broken page rather than as a rule. The rule was always in
 * the right place; the button just did not know about it.
 *
 * The scope matters as much as the gate. It is paid EVENTS only, because that
 * is the one path with a proven server-side guard. Products resolve their terms
 * through a different route and disabling approve there on a hunch would break
 * a flow that works, so these tests pin the narrowness too.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { ManagedListingDetail } from "../listings/ManagedListingDetail";

function listing(over: Record<string, unknown> = {}) {
    return {
        id: "listing-1",
        state: "PENDING",
        status: "PENDING",
        communityId: "c1",
        isPaid: true,
        event: { id: "evt-9", slug: "the-build-room-2", name: "The Build Room" },
        requestedBy: { name: "Drew Milligan" },
        ...over,
    };
}

function mockApi(body: unknown) {
    return vi.fn(async (url: RequestInfo | URL) => {
        const u = String(url);
        const json = (b: unknown) => ({ ok: true, status: 200, json: async () => b }) as unknown as Response;
        if (/\/proposals$/.test(u)) return json([]);
        if (/\/topics$/.test(u)) return json([]);
        if (/\/packages$/.test(u)) return json([]);
        if (/\/config\/fees/.test(u)) return json({});
        return json(body);
    });
}

const base = { listingId: "listing-1", backHref: "/pbn/events/requests", apiBaseUrl: "https://api.test" };
const REASON = /Agree the commission first/;

describe("approve, with no commission agreed", () => {
    let original: typeof globalThis.fetch;
    afterEach(() => {
        globalThis.fetch = original;
    });
    beforeEach(() => {
        original = globalThis.fetch;
    });

    const mount = async (body: unknown, kind: "event" | "product" = "event") => {
        globalThis.fetch = mockApi(body) as unknown as typeof globalThis.fetch;
        render(<ManagedListingDetail {...base} kind={kind} viewer="leader" />);
        await screen.findByText("The Build Room");
    };

    it("is disabled on a PAID event with no rate, and says why", async () => {
        await mount(listing({ isPaid: true, commissionRate: null }));
        const approve = screen.getByRole("button", { name: /approve/i });
        expect(approve).toBeDisabled();
        // The reason is in the bar, not only in a title attribute: on a touch
        // screen a tooltip never appears.
        expect(screen.getByText(REASON)).toBeInTheDocument();
    });

    it("is enabled once a rate is agreed", async () => {
        await mount(listing({ isPaid: true, commissionRate: 8 }));
        expect(screen.getByRole("button", { name: /approve/i })).not.toBeDisabled();
        expect(screen.queryByText(REASON)).toBeNull();
    });

    it("is enabled on a FREE event, which has no commission to agree", async () => {
        await mount(listing({ isPaid: false, commissionRate: null }));
        expect(screen.getByRole("button", { name: /approve/i })).not.toBeDisabled();
        expect(screen.queryByText(REASON)).toBeNull();
    });

    it("does NOT gate a product, where no such server guard exists", async () => {
        await mount(
            {
                id: "listing-1",
                state: "PENDING",
                status: "PENDING",
                communityId: "c1",
                commissionRate: null,
                products: { id: "p1", name: "The Build Room" },
                requestedBy: { name: "Drew Milligan" },
            },
            "product",
        );
        expect(screen.getByRole("button", { name: /approve/i })).not.toBeDisabled();
        expect(screen.queryByText(REASON)).toBeNull();
    });
});
