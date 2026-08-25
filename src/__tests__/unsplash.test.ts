import { describe, expect, it, vi } from "vitest";
import {
    UNSPLASH_APP_NAME,
    UNSPLASH_DOWNLOAD_PATH,
    UNSPLASH_PHOTOS_PATH,
    UNSPLASH_URL,
    fetchStockPhotos,
    notifyDownload,
    photographerUrl,
    photosRequestUrl,
    withReferral,
    type UnsplashPhoto,
} from "../lib/unsplash";

/**
 * Unsplash's API Guidelines, asserted.
 *
 * The picker previously met none of these, which is why the app was stuck on
 * the Demo tier (50 requests/hour). Attribution links without the referral
 * params do not count as attribution, and a missing download ping is checked
 * for during Production review -- so both are correctness, not decoration, and
 * both are easy to drop silently in a refactor. Hence tests.
 */

function photo(over: Partial<UnsplashPhoto> = {}): UnsplashPhoto {
    return {
        id: "abc",
        urls: { regular: "r.jpg", thumb: "t.jpg", full: "f.jpg" },
        alt_description: "a field",
        user: { name: "Ansel", username: "ansel", links: { html: "https://unsplash.com/@ansel" } },
        links: { download_location: "https://api.unsplash.com/photos/abc/download" },
        ...over,
    };
}

describe("attribution links", () => {
    it("carries the referral params Unsplash requires", () => {
        const url = photographerUrl(photo());
        expect(url).toContain(`utm_source=${UNSPLASH_APP_NAME}`);
        expect(url).toContain("utm_medium=referral");
    });

    it("credits Unsplash itself with the same params", () => {
        expect(UNSPLASH_URL).toContain(`utm_source=${UNSPLASH_APP_NAME}`);
        expect(UNSPLASH_URL).toContain("utm_medium=referral");
    });

    it("points at the photographer, not just unsplash.com", () => {
        expect(photographerUrl(photo())).toContain("/@ansel");
    });

    it("builds the profile from the username when links.html is absent", () => {
        const url = photographerUrl(photo({ user: { name: "Ansel", username: "ansel" } }));
        expect(url).toContain("https://unsplash.com/@ansel");
        expect(url).toContain("utm_medium=referral");
    });

    it("still yields a working link when the payload has neither", () => {
        const url = photographerUrl(photo({ user: { name: "Ansel" } }));
        expect(url.startsWith("https://unsplash.com")).toBe(true);
    });

    it("appends rather than replaces an existing query string", () => {
        expect(withReferral("https://unsplash.com/@x?foo=1")).toBe(
            `https://unsplash.com/@x?foo=1&utm_source=${UNSPLASH_APP_NAME}&utm_medium=referral`,
        );
    });
});

describe("the photos request", () => {
    it("asks for random photos when there is no query", () => {
        expect(photosRequestUrl("   ")).toBe(UNSPLASH_PHOTOS_PATH);
    });

    it("encodes the query", () => {
        expect(photosRequestUrl("a b&c")).toBe(`${UNSPLASH_PHOTOS_PATH}?query=a%20b%26c`);
    });

    it("never carries a key -- the proxy holds it", () => {
        expect(photosRequestUrl("beach")).not.toContain("client_id");
    });

    it("reads the photos out of the proxy's envelope", async () => {
        const fetchImpl = vi.fn().mockResolvedValue({
            ok: true, status: 200, json: async () => ({ photos: [photo()] }),
        });
        const res = await fetchStockPhotos("beach", { fetchImpl: fetchImpl as never });
        expect(res).toEqual({ status: "ok", photos: [photo()] });
    });

    it("treats 503 as unconfigured, not as an error", async () => {
        const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 503 });
        const res = await fetchStockPhotos("", { fetchImpl: fetchImpl as never });
        expect(res).toEqual({ status: "unconfigured" });
    });

    it("reports other failures as an error", async () => {
        const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 502 });
        expect(await fetchStockPhotos("", { fetchImpl: fetchImpl as never })).toEqual({ status: "error" });
    });

    it("does not throw when the request rejects", async () => {
        const fetchImpl = vi.fn().mockRejectedValue(new Error("offline"));
        expect(await fetchStockPhotos("", { fetchImpl: fetchImpl as never })).toEqual({ status: "error" });
    });

    it("forwards the host app's auth headers", async () => {
        const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ photos: [] }) });
        await fetchStockPhotos("x", { headers: { Authorization: "Bearer t" }, fetchImpl: fetchImpl as never });
        expect(fetchImpl.mock.calls[0][1].headers).toEqual({ Authorization: "Bearer t" });
    });
});

describe("the download ping", () => {
    it("posts the location Unsplash supplied", () => {
        const fetchImpl = vi.fn().mockResolvedValue({ ok: true });
        notifyDownload(photo(), { fetchImpl: fetchImpl as never });
        expect(fetchImpl).toHaveBeenCalledOnce();
        const [url, init] = fetchImpl.mock.calls[0];
        expect(url).toBe(UNSPLASH_DOWNLOAD_PATH);
        expect(JSON.parse(init.body)).toEqual({
            downloadLocation: "https://api.unsplash.com/photos/abc/download",
        });
    });

    it("uses keepalive, because picking a photo closes the modal", () => {
        const fetchImpl = vi.fn().mockResolvedValue({ ok: true });
        notifyDownload(photo(), { fetchImpl: fetchImpl as never });
        expect(fetchImpl.mock.calls[0][1].keepalive).toBe(true);
    });

    it("skips the ping when the photo carries no download location", () => {
        const fetchImpl = vi.fn();
        notifyDownload(photo({ links: {} }), { fetchImpl: fetchImpl as never });
        expect(fetchImpl).not.toHaveBeenCalled();
    });

    it("swallows a failed ping -- the photo was still picked", () => {
        const fetchImpl = vi.fn().mockRejectedValue(new Error("nope"));
        expect(() => notifyDownload(photo(), { fetchImpl: fetchImpl as never })).not.toThrow();
    });
});
