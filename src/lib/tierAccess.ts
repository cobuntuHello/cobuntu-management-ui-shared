/**
 * Who a listing is open to, as the editor models it.
 *
 * The stored shape is two things — a `viewability` / `accessibility` enum plus
 * rows in `product_segment_access` / `event_segment_access` — and the editor
 * shows one list. This is the translation between them, kept out of the
 * component so both packages and both apps share one interpretation.
 *
 * The three modes are NOT three independent checkboxes. Public and All members
 * are shortcuts that imply every tier below them, which is why selecting one
 * checks and locks the rest: there must never be a state where the summary
 * says "Public" and the tier list says something narrower.
 *
 * Mapping (see docs/features/tier-access.md):
 *
 *   public → PUBLIC       + no rows   (rows are ignored on a PUBLIC listing)
 *   all    → MEMBERS_ONLY + no rows   (absence means every tier)
 *   tiers  → MEMBERS_ONLY + one row per selected tier
 */

export type TierAccessMode = "public" | "all" | "tiers";

export interface TierAccessValue {
  mode: TierAccessMode;
  /** Only meaningful in `tiers` mode; ignored otherwise. */
  tierIds: string[];
}

export type Visibility = "PUBLIC" | "MEMBERS_ONLY";

/**
 * What the editor should show, given what is stored.
 *
 * No rows on a MEMBERS_ONLY listing is `all`, never an empty `tiers` — that is
 * the no-backfill rule surfacing in the UI. Every listing that predates this
 * feature has no rows, and each must open as "All members" rather than as a
 * broken picker with nothing ticked.
 */
export function toTierAccessValue(
  visibility: Visibility | null | undefined,
  grantedTierIds: string[] | null | undefined,
): TierAccessValue {
  if (visibility !== "MEMBERS_ONLY") return { mode: "public", tierIds: [] };
  const ids = grantedTierIds ?? [];
  if (ids.length === 0) return { mode: "all", tierIds: [] };
  return { mode: "tiers", tierIds: [...ids] };
}

/** What to send, given what the editor shows. */
export function fromTierAccessValue(value: TierAccessValue): {
  visibility: Visibility;
  tierIds: string[];
} {
  if (value.mode === "public") return { visibility: "PUBLIC", tierIds: [] };
  if (value.mode === "all") return { visibility: "MEMBERS_ONLY", tierIds: [] };
  return { visibility: "MEMBERS_ONLY", tierIds: [...value.tierIds] };
}

/**
 * Is the whole tier list locked by a shortcut above it?
 *
 * Locked here means "already included", never "not available to you" — the
 * rows are ticked and frozen because Public and All members both imply them.
 * A capability the user cannot have is not rendered at all; that is a
 * different rule and lives in the card-level gate.
 */
export function tierRowsLocked(mode: TierAccessMode): boolean {
  return mode !== "tiers";
}

/** Is a given tier included, accounting for the shortcuts? */
export function tierIsIncluded(value: TierAccessValue, tierId: string): boolean {
  if (value.mode !== "tiers") return true;
  return value.tierIds.includes(tierId);
}

/**
 * Toggling a single tier.
 *
 * Untick the last one and the listing would be visible to nobody, which is
 * never what someone means — it falls back to `all`, the nearest sensible
 * state, rather than saving something that hides the listing from everyone
 * including the people who were meant to see it.
 */
export function toggleTier(value: TierAccessValue, tierId: string, allTierIds: string[]): TierAccessValue {
  // Coming from a shortcut, the visible state is "everything ticked", so the
  // first click means "everything except this one".
  const base = value.mode === "tiers" ? value.tierIds : allTierIds;
  const next = base.includes(tierId) ? base.filter((id) => id !== tierId) : [...base, tierId];

  if (next.length === 0) return { mode: "all", tierIds: [] };
  if (next.length === allTierIds.length) return { mode: "all", tierIds: [] };
  return { mode: "tiers", tierIds: next };
}

/** One-line summary for a collapsed row, e.g. a settings-drawer entry. */
export function tierAccessSummary(
  value: TierAccessValue,
  tiers: Array<{ id: string; name: string }>,
): string {
  if (value.mode === "public") return "Everyone";
  if (value.mode === "all") return "All members";
  const names = tiers.filter((t) => value.tierIds.includes(t.id)).map((t) => t.name);
  if (names.length === 0) return "All members";
  if (names.length <= 2) return names.join(" and ");
  return `${names.length} membership tiers`;
}
