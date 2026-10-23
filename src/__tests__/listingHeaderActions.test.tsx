/**
 * The listing header's actions slot.
 *
 * The destinations belong to the HOST, not to this package: the backoffice
 * sends a leader to that community's own event or product page, routes this
 * component knows nothing about. So it renders a slot and the host fills it.
 * The community app (viewer "owner") passes nothing and the row must not appear at all.
 *
 * The slot takes a function because the href the host needs is usually built
 * from the item's slug or id, and only this component has loaded the listing.
 * Getting that handover wrong is the whole risk here, so it is what these
 * tests check: that the function is called with the real item, not with
 * undefined, and not with the listing wrapper around it.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { ManagedListingDetail } from "../listings/ManagedListingDetail";

const LISTING = {
    id: "listing-1",
    state: "PENDING",
    communityId: "c1",
    event: {
        id: "evt-9",
        slug: "the-build-room-2",
        name: "The Build Room",
        price: 5,
        currency: "EUR",
    },
    requestedBy: { name: "Drew Milligan" },
};

/** Only the listing route returns anything; the rest answer empty. */
function mockApi() {
    return vi.fn(async (url: RequestInfo | URL) => {
        const u = String(url);
        const json = (b: unknown) =>
            ({ ok: true, status: 200, json: async () => b }) as unknown as Response;
        if (/\/proposals$/.test(u)) return json([]);
        if (/\/topics$/.test(u)) return json([]);
        if (/\/packages$/.test(u)) return json([]);
        if (/\/config\/fees/.test(u)) return json({});
        return json(LISTING);
    });
}

const base = {
    kind: "event" as const,
    listingId: "listing-1",
    backHref: "/pbn/events/requests",
    apiBaseUrl: "https://api.test",
};

describe("headerActions", () => {
    let original: typeof globalThis.fetch;
    beforeEach(() => {
        original = globalThis.fetch;
        globalThis.fetch = mockApi() as unknown as typeof globalThis.fetch;
    });
    afterEach(() => {
        globalThis.fetch = original;
    });

    it("renders nothing extra when the host passes no actions", async () => {
        render(<ManagedListingDetail {...base} viewer="owner" />);
        await screen.findByText("The Build Room");
        expect(screen.queryByRole("link", { name: /details/i })).toBeNull();
    });

    it("hands the function the listed item, so the host can build a link to it", async () => {
        const seen: Array<{ id?: string; slug?: string; name?: string | null }> = [];
        render(
            <ManagedListingDetail
                {...base}
                viewer="leader"
                headerActions={(item) => {
                    seen.push(item);
                    return <a href={`/pbn/events/${item.slug || item.id}`}>Details</a>;
                }}
            />,
        );
        await screen.findByText("The Build Room");
        await waitFor(() => expect(seen.some((i) => i.slug)).toBe(true));

        const withItem = seen[seen.length - 1];
        expect(withItem.slug).toBe("the-build-room-2");
        expect(withItem.id).toBe("evt-9");
        expect(withItem.name).toBe("The Build Room");

        // ...and the href the host built from it is the one that renders.
        const link = screen.getByRole("link", { name: "Details" });
        expect(link.getAttribute("href")).toBe("/pbn/events/the-build-room-2");
    });

    /**
     * `live` gates the host's Preview button.
     *
     * A leader on a PENDING request has nothing to preview -- the item is not
     * on the shelf -- so a Preview link there opens a 404 on the back of a
     * button that promised to show them the thing. The host cannot tell:
     * it never sees the listing row. These pin that BOTH halves are required,
     * because the two fields do come apart in prod.
     */
    describe("live", () => {
        /** Re-point fetch at a listing with the given row fields. */
        function withListing(over: Record<string, unknown>) {
            globalThis.fetch = vi.fn(async (url: RequestInfo | URL) => {
                const u = String(url);
                const json = (b: unknown) =>
                    ({ ok: true, status: 200, json: async () => b }) as unknown as Response;
                if (/\/proposals$/.test(u)) return json([]);
                if (/\/topics$/.test(u)) return json([]);
                if (/\/packages$/.test(u)) return json([]);
                if (/\/config\/fees/.test(u)) return json({});
                return json({ ...LISTING, ...over });
            }) as unknown as typeof globalThis.fetch;
        }

        /** The last `live` the slot was handed, once the item has loaded. */
        async function liveFor(over: Record<string, unknown>) {
            withListing(over);
            const seen: Array<boolean | undefined> = [];
            render(
                <ManagedListingDetail
                    {...base}
                    viewer="leader"
                    headerActions={(item) => {
                        if (item.slug) seen.push(item.live);
                        return item.live ? <a href="/live">Preview</a> : <span>no-preview</span>;
                    }}
                />,
            );
            await screen.findByText("The Build Room");
            await waitFor(() => expect(seen.length).toBeGreaterThan(0));
            return seen[seen.length - 1];
        }

        it("is true for an approved ACTIVE listing", async () => {
            expect(await liveFor({ status: "ACTIVE", approvedAt: "2026-10-01T00:00:00.000Z" })).toBe(true);
            expect(screen.getByRole("link", { name: "Preview" })).toBeTruthy();
        });

        it("is false while the request is still PENDING", async () => {
            expect(await liveFor({ status: "PENDING", approvedAt: null })).toBe(false);
            expect(screen.queryByRole("link", { name: "Preview" })).toBeNull();
        });

        it("is false for ACTIVE with no approvedAt, so status alone cannot carry it", async () => {
            expect(await liveFor({ status: "ACTIVE", approvedAt: null })).toBe(false);
        });

        it("is false for an approved listing the seller has since PAUSED", async () => {
            // Off the shelf by the owner's own hand: approved, not visible.
            expect(await liveFor({ status: "PAUSED", approvedAt: "2026-10-01T00:00:00.000Z" })).toBe(false);
        });

        it("is false once revoked, however it was approved before", async () => {
            expect(await liveFor({ status: "REVOKED", approvedAt: "2026-10-01T00:00:00.000Z" })).toBe(false);
        });
    });

    it("takes a plain node too, for a host with nothing to look up", async () => {
        render(
            <ManagedListingDetail
                {...base}
                viewer="leader"
                headerActions={<a href="/pbn/events/requests">Requests</a>}
            />,
        );
        await screen.findByText("The Build Room");
        expect(screen.getByRole("link", { name: "Requests" }).getAttribute("href")).toBe(
            "/pbn/events/requests",
        );
    });
});
