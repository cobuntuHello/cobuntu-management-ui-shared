/**
 * What the review bar says when a paid event listing has no agreed rate.
 *
 * ── The bug ─────────────────────────────────────────────────────────────────
 *
 * One condition (paid event, no accepted rate) drove one sentence: "Agree the
 * commission first. They have to accept a package before this can go live."
 * It was written for a PENDING request and it was rendered in every state, so
 * on an approved listing a leader read it beside a "Take it down" button, on
 * something that went live months ago and had already sold tickets. The page
 * was telling them to prevent a thing that had happened.
 *
 * PBN has 26 live event listings in exactly this state, which is how it was
 * found.
 *
 * ── Why the live wording says something different, not something softer ─────
 *
 * Before approval the missing agreement is a RULE: the backend refuses the
 * approve, so the button is disabled and the sentence explains it. After
 * approval it is a LIABILITY, and one nothing else on the page mentions: with
 * no rate snapshotted on the row, every sale resolves the cut through the
 * fallback resolver, from the community's current rate for that product type.
 * So editing those rates retrades the live listing. That is the fact worth the
 * same line of screen.
 *
 * These also pin that the notice is LEADER-ONLY, which is what keeps the new
 * key out of the community app's message files: it passes its own next-intl
 * `t`, and a key missing there renders as the key rather than falling back.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup, within } from "@testing-library/react";
import { ManagedListingDetail } from "../listings/ManagedListingDetail";

const NEEDS_TERMS = /they have to accept a package before this can go live/i;
const LIVE_NO_TERMS = /live without an agreed package/i;

const EVENT = { id: "evt-9", slug: "the-build-room-2", name: "The Build Room", price: 15, currency: "EUR" };

function mockApi(listing: Record<string, unknown>) {
    return vi.fn(async (url: RequestInfo | URL) => {
        const u = String(url);
        const json = (b: unknown) => ({ ok: true, status: 200, json: async () => b }) as unknown as Response;
        if (/\/proposals$/.test(u)) return json([]);
        if (/\/topics$/.test(u)) return json([]);
        if (/\/packages$/.test(u)) return json([]);
        if (/\/config\/fees/.test(u)) return json({});
        return json(listing);
    });
}

const base = {
    kind: "event" as const,
    listingId: "listing-1",
    backHref: "/pbn/events/requests",
    apiBaseUrl: "https://api.test",
};

/**
 * Render a listing in the given shape. `isPaid` and `commissionRate` are the
 * two fields the condition turns on; `status` decides which sentence applies.
 */
async function renderListing(over: Record<string, unknown>, viewer: "leader" | "owner" = "leader") {
    cleanup();
    const listing = {
        id: "listing-1",
        communityId: "c1",
        event: EVENT,
        requestedBy: { name: "Drew Milligan" },
        isPaid: true,
        commissionRate: null,
        ...over,
    };
    globalThis.fetch = mockApi(listing) as unknown as typeof globalThis.fetch;
    const { container } = render(<ManagedListingDetail {...base} viewer={viewer} />);
    const scope = within(container);
    await waitFor(() => expect(scope.queryByText("The Build Room")).not.toBeNull());
    return container;
}

describe("a paid event listing with no agreed rate", () => {
    let original: typeof globalThis.fetch;
    beforeEach(() => {
        original = globalThis.fetch;
    });
    afterEach(() => {
        globalThis.fetch = original;
    });

    describe("while the request is PENDING", () => {
        it("tells the leader to agree the commission first", async () => {
            await renderListing({ status: "PENDING" });
            await waitFor(() => expect(screen.queryByText(NEEDS_TERMS)).not.toBeNull());
        });

        it("disables Approve, which the backend would refuse anyway", async () => {
            await renderListing({ status: "PENDING" });
            const approve = await screen.findByRole("button", { name: /approve/i });
            expect(approve).toBeDisabled();
        });

        it("does not claim it is already live", async () => {
            await renderListing({ status: "PENDING" });
            expect(screen.queryByText(LIVE_NO_TERMS)).toBeNull();
        });
    });

    describe("once it is ACTIVE", () => {
        it("stops telling the leader to prevent something that already happened", async () => {
            const c = await renderListing({ status: "ACTIVE", approvedAt: "2026-08-01T00:00:00.000Z" });
            await waitFor(() => expect(within(c).queryByText(LIVE_NO_TERMS)).not.toBeNull());
            expect(within(c).queryByText(NEEDS_TERMS)).toBeNull();
        });

        it("says instead that the rate is the community's current one, which moves", async () => {
            const c = await renderListing({ status: "ACTIVE", approvedAt: "2026-08-01T00:00:00.000Z" });
            await waitFor(() => expect(within(c).queryByText(LIVE_NO_TERMS)).not.toBeNull());
            // The consequence is the point, not just the absence of a snapshot.
            expect(within(c).getByText(/changing that rate also changes what this one earns/i)).toBeTruthy();
        });
    });

    describe("says nothing at all when there is nothing to say", () => {
        it("with a rate agreed on a live listing", async () => {
            const c = await renderListing({
                status: "ACTIVE",
                approvedAt: "2026-08-01T00:00:00.000Z",
                commissionRate: 8,
            });
            expect(within(c).queryByText(LIVE_NO_TERMS)).toBeNull();
            expect(within(c).queryByText(NEEDS_TERMS)).toBeNull();
        });

        it("on a FREE event, where there is no cut to agree", async () => {
            const c = await renderListing({ status: "PENDING", isPaid: false });
            expect(within(c).queryByText(NEEDS_TERMS)).toBeNull();
            expect(within(c).queryByText(LIVE_NO_TERMS)).toBeNull();
        });

        it("to the SELLER, who has no review bar and whose host owns the copy", async () => {
            // Load-bearing for i18n: the community app mounts this as "owner"
            // with its own next-intl `t`, where a key it has never heard of
            // renders AS THE KEY. Leader-only means it never needs the key.
            const c = await renderListing(
                { status: "ACTIVE", approvedAt: "2026-08-01T00:00:00.000Z" },
                "owner",
            );
            expect(within(c).queryByText(LIVE_NO_TERMS)).toBeNull();
            expect(within(c).queryByText(NEEDS_TERMS)).toBeNull();
        });
    });
});
