/**
 * Whose face is on a comment in the negotiation thread.
 *
 * ── The bug these exist for ─────────────────────────────────────────────────
 *
 * Every comment drew a LETTER, and it looked like the API simply had no photo
 * for anybody. It had one all along: core selects `profileImage` and `usertag`
 * on the author of every topic comment, on both the product and the event
 * route, and this package's `TopicComment` type stopped at `name` -- so the
 * photo arrived in the response and was dropped on the floor by a type.
 *
 * That is invisible in review (nothing is "wrong", a letter is a plausible
 * avatar) and invisible in a screenshot unless you know a photo was expected.
 * So the first test here is the one that would have caught it: given an author
 * WITH a photo, an <img> must render.
 *
 * ── Why a face and not an initial ───────────────────────────────────────────
 *
 * Second: with no photo, the fallback is the seeded Cobuntu persona the rest of
 * the product already draws for that person, not their monogram. A monogram in
 * the app's own ink read as a SYSTEM note rather than as something a human
 * said, which is the opposite of what a negotiation thread is.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup, within } from "@testing-library/react";
import { ManagedListingDetail } from "../listings/ManagedListingDetail";

const PHOTO = "https://cdn.test/drew.jpg";

const LISTING = {
    id: "listing-1",
    status: "ACTIVE",
    approvedAt: "2026-10-01T00:00:00.000Z",
    communityId: "c1",
    event: { id: "evt-9", slug: "the-build-room-2", name: "The Build Room", price: 5, currency: "EUR" },
    requestedBy: { name: "Drew Milligan" },
};

/** One open topic whose single comment has the given author shape. */
function topicWithAuthor(author: unknown) {
    return [
        {
            id: "t1",
            subject: "The commission",
            status: "OPEN",
            closedBySeller: false,
            closedByCommunity: false,
            openedByUserId: "u-drew",
            comments: [{ id: "c1", body: "Can we talk about the rate?", authorUserId: "u-drew", author }],
        },
    ];
}

function mockApi(topics: unknown) {
    return vi.fn(async (url: RequestInfo | URL) => {
        const u = String(url);
        const json = (b: unknown) => ({ ok: true, status: 200, json: async () => b }) as unknown as Response;
        if (/\/proposals$/.test(u)) return json([]);
        if (/\/topics$/.test(u)) return json(topics);
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
    viewer: "leader" as const,
};

/**
 * Render with one comment by `author`, and wait for the thread to arrive.
 *
 * Unmounts anything already rendered first, and scopes its waits to its OWN
 * container: the two determinism tests below render twice in one test, and a
 * document-wide `screen` query throws the moment the same text matches in both
 * trees -- which fails the test for a reason that has nothing to do with faces.
 */
async function renderThread(author: unknown) {
    cleanup();
    globalThis.fetch = mockApi(topicWithAuthor(author)) as unknown as typeof globalThis.fetch;
    const { container } = render(<ManagedListingDetail {...base} />);
    const scope = within(container);
    await waitFor(() => expect(scope.queryByText("The Build Room")).not.toBeNull());
    await waitFor(() => expect(scope.queryByText("The commission")).not.toBeNull());
    return container;
}

describe("a topic comment's author", () => {
    let original: typeof globalThis.fetch;
    beforeEach(() => {
        original = globalThis.fetch;
    });
    afterEach(() => {
        globalThis.fetch = original;
    });

    it("renders their real photo when the payload carries one", async () => {
        const container = await renderThread({
            id: "u-drew",
            name: "Drew Milligan",
            usertag: "drew",
            profileImage: PHOTO,
        });
        const img = container.querySelector(`img[src="${PHOTO}"]`);
        expect(img).not.toBeNull();
    });

    it("draws a persona face, not an initial, when there is no photo", async () => {
        const container = await renderThread({
            id: "u-drew",
            name: "Drew Milligan",
            usertag: "drew",
            profileImage: null,
        });
        // The persona is an inline <svg> on an 80-unit canvas; a monogram would
        // have been a bare "D" text node and no svg at all.
        const svgs = Array.from(container.querySelectorAll('svg[viewBox="0 0 80 80"]'));
        expect(svgs.length).toBeGreaterThan(0);
    });

    it("gives the same person the same face every time", async () => {
        // The face is derived from the seed, so a seed that is stable across
        // renders is the whole reason this is not a random avatar per paint.
        const a = await renderThread({ id: "u-drew", name: "Drew Milligan", usertag: "drew" });
        const first = a.querySelector('svg[viewBox="0 0 80 80"]')?.innerHTML;
        const b = await renderThread({ id: "u-drew", name: "Drew Milligan", usertag: "drew" });
        const second = b.querySelector('svg[viewBox="0 0 80 80"]')?.innerHTML;
        expect(first).toBeTruthy();
        expect(first).toBe(second);
    });

    it("gives two different people different faces", async () => {
        const a = await renderThread({ id: "u-drew", name: "Drew Milligan", usertag: "drew" });
        const first = a.querySelector('svg[viewBox="0 0 80 80"]')?.innerHTML;
        const b = await renderThread({ id: "u-sam", name: "Sam Reyes", usertag: "sam" });
        const second = b.querySelector('svg[viewBox="0 0 80 80"]')?.innerHTML;
        expect(first).not.toBe(second);
    });

    it("still draws a face when `author` never expanded, falling back to the id", async () => {
        // authorUserId is on the comment itself and is always present, so a
        // failed join costs the name, not the avatar.
        const container = await renderThread(null);
        expect(container.querySelectorAll('svg[viewBox="0 0 80 80"]').length).toBeGreaterThan(0);
    });
});
