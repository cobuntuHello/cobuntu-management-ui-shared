import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { fetchMembershipTiers } from "../lib/fetchMembershipTiers";

/**
 * The access picker reported "This community has no membership tiers yet" for
 * communities that plainly had several.
 *
 * `/segments/public` is guarded by requireApiKey("READ_PUBLIC"). It used to be
 * reachable regardless, through an X-Internal-Gateway bypass that let anything
 * proxied via api-gateway past the key check. That bypass was REMOVED and this
 * helper was never updated, so every call 401'd — and since any failure here
 * becomes an empty list, it surfaced as a data problem rather than an error.
 *
 * Measured against production before the fix: pathseekers returns 401 without a
 * key and its two tiers ("Free", "Membership") with one.
 *
 * The community app's own pickers kept working throughout, which is what made
 * this look community-specific: its apiClient injects the key into every call,
 * so only the admin app — which calls this helper with a bare user token — saw
 * the empty list.
 */

const API = "https://api.test";
const KEY = "ck_test_key";

let calls: { url: string; headers: Record<string, string> }[] = [];

function installFetch(opts: { keyStatus?: number; segmentsStatus?: number; body?: unknown } = {}) {
  calls = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    const headers = (init?.headers ?? {}) as Record<string, string>;
    calls.push({ url, headers });

    if (url.includes("/publishable-key")) {
      const status = opts.keyStatus ?? 200;
      return new Response(status === 200 ? JSON.stringify({ key: KEY }) : "{}", { status });
    }
    // The route only answers when a key arrived, exactly as requireApiKey does.
    const authorised = !!(headers["X-API-Key"] || headers["x-api-key"]);
    const status = opts.segmentsStatus ?? (authorised ? 200 : 401);
    const body = status === 200
      ? JSON.stringify(opts.body ?? [{ id: "t1", name: "Free" }, { id: "t2", name: "Membership" }])
      : JSON.stringify({ error: "API key required. Pass it via X-API-Key header." });
    return new Response(body, { status });
  }));
}

beforeEach(() => vi.spyOn(console, "warn").mockImplementation(() => {}));
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("fetchMembershipTiers", () => {
  it("resolves a publishable key and returns the tiers", async () => {
    installFetch();
    const tiers = await fetchMembershipTiers(API, "pathseekers");
    expect(tiers).toEqual([{ id: "t1", name: "Free" }, { id: "t2", name: "Membership" }]);
    expect(calls.some(c => c.url.includes("/publishable-key"))).toBe(true);
    expect(calls.find(c => c.url.includes("/segments/public"))!.headers["X-API-Key"]).toBe(KEY);
  });

  it("without the key it returns nothing — the bug, pinned", async () => {
    // Proves the empty list is caused by the missing key and not by the shape
    // handling, so a future change that drops the key fails here rather than in
    // somebody's wizard.
    installFetch({ keyStatus: 500 });
    // A tag no other case has warmed: the key cache is module-scoped by
    // design (see the caching test below), so reusing one would hand this
    // case a key from an earlier test and quietly prove nothing.
    expect(await fetchMembershipTiers(API, "no-key-tag")).toEqual([]);
  });

  it("says why, instead of failing silently", async () => {
    // A silent empty list is indistinguishable from a community with no tiers.
    // That ambiguity is what hid this for as long as it did.
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    installFetch({ keyStatus: 500 });
    await fetchMembershipTiers(API, "warns-tag");
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("401"));
  });

  it("keeps a key the caller already supplies, and does not fetch another", async () => {
    // The community app injects its own on every call; re-resolving would be a
    // wasted round-trip per picker mount.
    installFetch();
    const tiers = await fetchMembershipTiers(API, "pathseekers", { "X-API-Key": "caller-key" });
    expect(tiers).toHaveLength(2);
    expect(calls.some(c => c.url.includes("/publishable-key"))).toBe(false);
    expect(calls[0].headers["X-API-Key"]).toBe("caller-key");
  });

  it("caches the key per tag, not across tags", async () => {
    installFetch();
    await fetchMembershipTiers(API, "cached-tag");
    await fetchMembershipTiers(API, "cached-tag");
    expect(calls.filter(c => c.url.includes("/publishable-key"))).toHaveLength(1);

    await fetchMembershipTiers(API, "other-tag");
    expect(calls.filter(c => c.url.includes("/publishable-key"))).toHaveLength(2);
  });

  it("still yields an empty list for a community that truly has none", async () => {
    installFetch({ body: [] });
    expect(await fetchMembershipTiers(API, "pathseekers")).toEqual([]);
  });

  it("accepts both the bare array and a { segments } envelope", async () => {
    installFetch({ body: { segments: [{ id: "s1", name: "Gold" }] } as any });
    expect(await fetchMembershipTiers(API, "enveloped")).toEqual([{ id: "s1", name: "Gold" }]);
  });

  it("returns nothing without a tag, and never calls out", async () => {
    installFetch();
    expect(await fetchMembershipTiers(API, null)).toEqual([]);
    expect(calls).toHaveLength(0);
  });
});
