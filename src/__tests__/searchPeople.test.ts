import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { searchPeople, minQueryLength } from "../lib/searchPeople";

/**
 * The two sources behind every "add a person" picker.
 *
 * The product package's co-seller modal used neither: it posted a typed
 * `{ usertag }` to an endpoint that only ever read `userId`, so it answered
 * "userId is required" and had never worked in admin. Routing both surfaces
 * through one searched-and-picked id is what makes that unrepeatable — you
 * cannot pick a person who does not exist.
 */

const API = "https://api.test";

function mockFetch(impl: (url: string) => { ok: boolean; body?: any }) {
    return vi.fn(async (url: string) => {
        const { ok, body } = impl(String(url));
        return { ok, json: async () => body } as any;
    });
}

beforeEach(() => { vi.restoreAllMocks(); });
afterEach(() => { vi.unstubAllGlobals(); });

describe("minQueryLength", () => {
    it("is 1 for community member search and 2 for global", () => {
        // The global endpoint refuses a single character, so promising results
        // at one would be a hint that lies.
        expect(minQueryLength("w35")).toBe(1);
        expect(minQueryLength(null)).toBe(2);
    });
});

describe("community member search", () => {
    it("calls the member endpoint and passes excludeUserIds to the server", async () => {
        const fetchMock = mockFetch(() => ({
            ok: true,
            body: { members: [{ id: "u1", name: "Ana", usertag: "ana", profileImage: null }] },
        }));
        vi.stubGlobal("fetch", fetchMock);

        const out = await searchPeople({
            apiBaseUrl: API, communityTag: "w35", query: "an", excludeUserIds: ["u9", "u8"],
        });

        const url = String(fetchMock.mock.calls[0][0]);
        expect(url).toContain("/api/communities/w35/members/search");
        expect(url).toContain("excludeUserIds=u9%2Cu8");
        expect(out).toEqual([{ id: "u1", name: "Ana", usertag: "ana", profileImage: null }]);
    });

    it("url-encodes the community tag", async () => {
        const fetchMock = mockFetch(() => ({ ok: true, body: { members: [] } }));
        vi.stubGlobal("fetch", fetchMock);
        await searchPeople({ apiBaseUrl: API, communityTag: "a b", query: "x" });
        expect(String(fetchMock.mock.calls[0][0])).toContain("/communities/a%20b/");
    });

    it("returns nothing below the 1-char floor without calling out", async () => {
        const fetchMock = mockFetch(() => ({ ok: true, body: { members: [] } }));
        vi.stubGlobal("fetch", fetchMock);
        expect(await searchPeople({ apiBaseUrl: API, communityTag: "w35", query: "  " })).toEqual([]);
        expect(fetchMock).not.toHaveBeenCalled();
    });
});

describe("global user search, for a listing no community owns", () => {
    it("calls discovery and excludes the current user client-side", async () => {
        // The endpoint has no exclude parameter, so this is the only place it
        // can happen — and adding yourself is the one result nobody wants.
        const fetchMock = mockFetch(() => ({
            ok: true,
            body: { data: [{ id: "me" }, { id: "u2", name: "Bo" }] },
        }));
        vi.stubGlobal("fetch", fetchMock);

        const out = await searchPeople({
            apiBaseUrl: API, communityTag: null, query: "bo", currentUserId: "me",
        });

        expect(String(fetchMock.mock.calls[0][0])).toContain("/api/discovery/users?search=bo");
        expect(out.map((p) => p.id)).toEqual(["u2"]);
    });

    it("excludes people already on the list", async () => {
        vi.stubGlobal("fetch", mockFetch(() => ({ ok: true, body: { data: [{ id: "u2" }, { id: "u3" }] } })));
        const out = await searchPeople({
            apiBaseUrl: API, communityTag: null, query: "bo", excludeUserIds: ["u2"],
        });
        expect(out.map((p) => p.id)).toEqual(["u3"]);
    });

    it("reads { data }, { users } or a bare array", async () => {
        for (const body of [{ data: [{ id: "u1" }] }, { users: [{ id: "u1" }] }, [{ id: "u1" }]]) {
            vi.stubGlobal("fetch", mockFetch(() => ({ ok: true, body })));
            const out = await searchPeople({ apiBaseUrl: API, communityTag: null, query: "ab" });
            expect(out.map((p) => p.id)).toEqual(["u1"]);
        }
    });

    it("holds its fire until 2 characters", async () => {
        const fetchMock = mockFetch(() => ({ ok: true, body: { data: [] } }));
        vi.stubGlobal("fetch", fetchMock);
        expect(await searchPeople({ apiBaseUrl: API, communityTag: null, query: "a" })).toEqual([]);
        expect(fetchMock).not.toHaveBeenCalled();
    });
});

describe("failure", () => {
    it("yields an empty list on a non-ok response", async () => {
        vi.stubGlobal("fetch", mockFetch(() => ({ ok: false })));
        expect(await searchPeople({ apiBaseUrl: API, communityTag: "w35", query: "a" })).toEqual([]);
    });

    it("yields an empty list when fetch throws, rather than flashing an error per keystroke", async () => {
        vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("network"); }));
        expect(await searchPeople({ apiBaseUrl: API, communityTag: "w35", query: "a" })).toEqual([]);
    });

    it("drops rows with no id instead of rendering a person who cannot be picked", async () => {
        vi.stubGlobal("fetch", mockFetch(() => ({ ok: true, body: { members: [{ name: "Ghost" }, { id: "u1" }] } })));
        const out = await searchPeople({ apiBaseUrl: API, communityTag: "w35", query: "g" });
        expect(out.map((p) => p.id)).toEqual(["u1"]);
    });
});
