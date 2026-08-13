import { describe, it, expect } from "vitest";
import {
  toTierAccessValue,
  fromTierAccessValue,
  tierRowsLocked,
  tierIsIncluded,
  toggleTier,
  tierAccessSummary,
} from "../lib/tierAccess";

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
