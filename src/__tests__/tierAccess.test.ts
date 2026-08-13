import { describe, it, expect } from "vitest";
import {
  toTierAccessValue,
  fromTierAccessValue,
  tierRowsLocked,
  tierIsIncluded,
  toggleTier,
  tierAccessSummary,
  ceilingFor,
  clampToCeiling,
  tierAccessConsequence,
} from "../lib/tierAccess";
import type { TierAccessValue } from "../lib/tierAccess";

/**
 * The editor shows one list; the database stores an enum plus rows. These pin
 * the translation, and in particular the two states that are easy to conflate:
 *
 *   MEMBERS_ONLY + no rows  = every tier (the no-backfill rule)
 *   MEMBERS_ONLY + no rows  is NOT "an empty selection"
 *
 * Getting that backwards would open every listing that predates this feature
 * as a picker with nothing ticked, and saving it would then hide the listing
 * from everyone.
 */

const TIERS = [
  { id: "t1", name: "Founding" },
  { id: "t2", name: "Standard" },
  { id: "t3", name: "Alumni" },
];
const ALL = TIERS.map((t) => t.id);

describe("reading what is stored", () => {
  it("treats MEMBERS_ONLY with no rows as ALL members, not an empty selection", () => {
    // Every listing that predates this feature is exactly this case.
    expect(toTierAccessValue("MEMBERS_ONLY", [])).toEqual({ mode: "all", tierIds: [] });
    expect(toTierAccessValue("MEMBERS_ONLY", null)).toEqual({ mode: "all", tierIds: [] });
  });

  it("reads PUBLIC as public regardless of stray rows", () => {
    // A grant left behind from a previous setting must not make a public
    // listing open as restricted; the backend ignores rows on PUBLIC too.
    expect(toTierAccessValue("PUBLIC", ["t1"])).toEqual({ mode: "public", tierIds: [] });
  });

  it("reads rows as a tier selection", () => {
    expect(toTierAccessValue("MEMBERS_ONLY", ["t1", "t2"])).toEqual({ mode: "tiers", tierIds: ["t1", "t2"] });
  });
});

describe("writing what the editor shows", () => {
  it("sends no rows for either shortcut", () => {
    expect(fromTierAccessValue({ mode: "public", tierIds: [] })).toEqual({ visibility: "PUBLIC", tierIds: [] });
    expect(fromTierAccessValue({ mode: "all", tierIds: [] })).toEqual({ visibility: "MEMBERS_ONLY", tierIds: [] });
  });

  it("drops a stale tier list when the mode is a shortcut", () => {
    // Switching to Public after picking tiers must not leave the rows behind.
    expect(fromTierAccessValue({ mode: "public", tierIds: ["t1"] }).tierIds).toEqual([]);
    expect(fromTierAccessValue({ mode: "all", tierIds: ["t1"] }).tierIds).toEqual([]);
  });

  it("round-trips a subset", () => {
    const stored = fromTierAccessValue({ mode: "tiers", tierIds: ["t1", "t3"] });
    expect(toTierAccessValue(stored.visibility, stored.tierIds)).toEqual({ mode: "tiers", tierIds: ["t1", "t3"] });
  });
});

describe("the cascade", () => {
  it("locks the tier rows under either shortcut", () => {
    expect(tierRowsLocked("public")).toBe(true);
    expect(tierRowsLocked("all")).toBe(true);
    expect(tierRowsLocked("tiers")).toBe(false);
  });

  it("shows every tier as included under a shortcut", () => {
    // Locked means "already included", not "unavailable".
    for (const mode of ["public", "all"] as const) {
      for (const t of ALL) expect(tierIsIncluded({ mode, tierIds: [] }, t)).toBe(true);
    }
  });

  it("first click from a shortcut means everything EXCEPT this one", () => {
    // The rows read as all-ticked, so unticking one should subtract, not
    // start from an empty selection.
    expect(toggleTier({ mode: "all", tierIds: [] }, "t2", ALL)).toEqual({ mode: "tiers", tierIds: ["t1", "t3"] });
  });

  it("collapses back to ALL when every tier ends up selected", () => {
    // Otherwise the same meaning gets two representations and the summary
    // says "3 membership tiers" where it should say "All members".
    expect(toggleTier({ mode: "tiers", tierIds: ["t1", "t2"] }, "t3", ALL)).toEqual({ mode: "all", tierIds: [] });
  });

  it("falls back to ALL rather than saving a listing nobody can see", () => {
    // Unticking the last tier is never a request to hide it from everyone.
    expect(toggleTier({ mode: "tiers", tierIds: ["t1"] }, "t1", ALL)).toEqual({ mode: "all", tierIds: [] });
  });
});

describe("the collapsed summary", () => {
  it("names one or two tiers, counts more", () => {
    expect(tierAccessSummary({ mode: "public", tierIds: [] }, TIERS)).toBe("Everyone");
    expect(tierAccessSummary({ mode: "all", tierIds: [] }, TIERS)).toBe("All members");
    expect(tierAccessSummary({ mode: "tiers", tierIds: ["t1"] }, TIERS)).toBe("Founding");
    expect(tierAccessSummary({ mode: "tiers", tierIds: ["t1", "t3"] }, TIERS)).toBe("Founding and Alumni");
    expect(tierAccessSummary({ mode: "tiers", tierIds: ALL }, TIERS)).toBe("3 membership tiers");
  });

  it("says All members when the selection names nothing real", () => {
    // A tier deleted after being granted leaves an id that matches no name.
    expect(tierAccessSummary({ mode: "tiers", tierIds: ["gone"] }, TIERS)).toBe("All members");
  });
});

/**
 * ── Buying is a subset of seeing ────────────────────────────────────
 *
 * The two settings were independent state, so a listing could be saved as
 * "visible to Founding only" AND "anyone can buy it". The view gate runs
 * first so nobody could actually buy it, but the card asserted the opposite
 * of what it did.
 */
describe("ceilingFor", () => {
  it("constrains nothing when the listing is public", () => {
    expect(ceilingFor({ mode: "public", tierIds: [] })).toEqual({
      allowPublic: true, allowAll: true, tierIds: null,
    });
  });

  it("forbids Public once the listing is members-only", () => {
    expect(ceilingFor({ mode: "all", tierIds: [] })).toEqual({
      allowPublic: false, allowAll: true, tierIds: null,
    });
  });

  it("forbids both shortcuts and names the visible tiers", () => {
    expect(ceilingFor({ mode: "tiers", tierIds: ["t1", "t2"] })).toEqual({
      allowPublic: false, allowAll: false, tierIds: ["t1", "t2"],
    });
  });

  it("returns null rather than [] for 'no tier restriction'", () => {
    // [] would read as "no tier may buy", which is the opposite.
    expect(ceilingFor({ mode: "all", tierIds: [] }).tierIds).toBeNull();
  });
});

describe("clampToCeiling", () => {
  it("pulls a public buy setting down when view goes members-only", () => {
    const c = ceilingFor({ mode: "all", tierIds: [] });
    expect(clampToCeiling({ mode: "public", tierIds: [] }, c)).toEqual({ mode: "all", tierIds: [] });
  });

  it("lands on the ceiling itself, the widest thing still allowed", () => {
    // The seller narrowed who can SEE it and said nothing about buying, so
    // buying stays as open as seeing rather than collapsing to one tier.
    const c = ceilingFor({ mode: "tiers", tierIds: ["t1", "t2"] });
    expect(clampToCeiling({ mode: "public", tierIds: [] }, c)).toEqual({ mode: "tiers", tierIds: ["t1", "t2"] });
    expect(clampToCeiling({ mode: "all", tierIds: [] }, c)).toEqual({ mode: "tiers", tierIds: ["t1", "t2"] });
  });

  it("drops tiers that are no longer visible, keeping the rest", () => {
    const c = ceilingFor({ mode: "tiers", tierIds: ["t1", "t2"] });
    expect(clampToCeiling({ mode: "tiers", tierIds: ["t1", "t3"] }, c)).toEqual({ mode: "tiers", tierIds: ["t1"] });
  });

  it("falls back to the ceiling when every named tier went invisible", () => {
    // An empty list would be "nobody can buy it", which nobody means.
    const c = ceilingFor({ mode: "tiers", tierIds: ["t1"] });
    expect(clampToCeiling({ mode: "tiers", tierIds: ["t3"] }, c)).toEqual({ mode: "tiers", tierIds: ["t1"] });
  });

  it("leaves a value that already fits alone", () => {
    const c = ceilingFor({ mode: "public", tierIds: [] });
    const v: TierAccessValue = { mode: "tiers", tierIds: ["t2"] };
    expect(clampToCeiling(v, c)).toBe(v);
  });
});

describe("toggleTier under a ceiling", () => {
  it("collapses to the ceiling instead of to 'all', which would be wider", () => {
    const c = ceilingFor({ mode: "tiers", tierIds: ["t1", "t2"] });
    expect(toggleTier({ mode: "tiers", tierIds: ["t1"] }, "t2", ["t1", "t2"], c))
      .toEqual({ mode: "tiers", tierIds: ["t1", "t2"] });
  });

  it("still collapses to 'all' when no ceiling forbids it", () => {
    expect(toggleTier({ mode: "tiers", tierIds: ["t1"] }, "t2", ["t1", "t2"]))
      .toEqual({ mode: "all", tierIds: [] });
  });
});

describe("tierAccessConsequence", () => {
  const T = [
    { id: "t1", name: "Founding" },
    { id: "t2", name: "Standard" },
    { id: "t3", name: "Alumni" },
  ];
  const V = (mode: any, tierIds: string[] = []) => ({ mode, tierIds }) as TierAccessValue;

  it("says nothing about a fully public listing", () => {
    expect(tierAccessConsequence(V("public"), V("public"), T)).toBeNull();
  });

  it("names the split when anyone can see but only members can buy", () => {
    expect(tierAccessConsequence(V("public"), V("all"), T))
      .toBe("Anyone can find it, but only members can buy it.");
  });

  it("names who is left out, which is the whole point of the line", () => {
    const s = tierAccessConsequence(V("all"), V("tiers", ["t1"]), T)!;
    expect(s).toContain("Only Founding can buy it");
    expect(s).toContain("Standard and Alumni will see it but not be able to buy");
  });

  it("reads back a tier-restricted view as an absence, not a restriction", () => {
    expect(tierAccessConsequence(V("tiers", ["t1"]), V("tiers", ["t1"]), T))
      .toBe("Only Founding can find it. Nobody else sees it anywhere in the community.");
  });
});

describe("the consequence line speaks the right verb", () => {
  const T = [{ id: "t1", name: "Founding" }, { id: "t2", name: "Standard" }];
  const V = (mode: any, tierIds: string[] = []) => ({ mode, tierIds }) as TierAccessValue;

  it("says buy for products", () => {
    expect(tierAccessConsequence(V("public"), V("all"), T))
      .toBe("Anyone can find it, but only members can buy it.");
  });

  it("says register for events", () => {
    // The same card renders for both. "Only Founding can buy it" under an
    // event is wrong in the one place the line exists to be right.
    expect(tierAccessConsequence(V("public"), V("all"), T, "register"))
      .toBe("Anyone can find it, but only members can register.");
  });

  it("uses the verb in the left-out clause too", () => {
    const s = tierAccessConsequence(V("all"), V("tiers", ["t1"]), T, "register")!;
    expect(s).toContain("Only Founding can register");
    expect(s).toContain("not be able to register");
  });
});
